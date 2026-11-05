#!/usr/bin/env python3
"""Read-only snapshot backup; optionally restore into an isolated container."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
from datetime import datetime, timezone

COUNTS_SQL = """
SELECT coalesce(jsonb_object_agg(name, count), '{}'::jsonb) FROM (
 SELECT c.relname AS name,
 (xpath('/row/c/text()', query_to_xml(
   format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
   false, true, '')))[1]::text::bigint AS count
 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
) counts;
"""


def run(args, **kwargs):
    if 'stdin' not in kwargs and 'input' not in kwargs:
        kwargs['stdin'] = subprocess.DEVNULL
    return subprocess.run(args, check=True, timeout=600, **kwargs)


def source_command(container, program, *args):
    # PostgreSQL credentials stay inside its existing container.
    return ['docker', 'exec', '-i', container, 'sh', '-c',
            'exec "$@" -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
            'bloodchain-backup', program, *args]


def restore_check(archive, expected, image):
    name = 'bloodchain-restore-test-' + secrets.token_hex(6)
    with tempfile.TemporaryDirectory(prefix='bloodchain-restore-') as tmp:
        env = Path(tmp) / 'postgres.env'
        env.write_text('POSTGRES_USER=restore_qa\nPOSTGRES_DB=backup_restore_test\n'
                       'POSTGRES_PASSWORD=' + secrets.token_hex(32) + '\n')
        env.chmod(0o600)
        try:
            run(['docker', 'run', '-d', '--name', name, '--network', 'none',
                 '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=512m',
                 '--env-file', str(env), image], stdout=subprocess.DEVNULL)
            for _ in range(60):
                ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'restore_qa',
                                        '-d', 'backup_restore_test'], stdout=subprocess.DEVNULL,
                                       stderr=subprocess.DEVNULL, timeout=5)
                if ready.returncode == 0:
                    break
                time.sleep(1)
            else:
                raise RuntimeError('Restore test database did not become ready')
            with archive.open('rb') as data:
                run(['docker', 'exec', '-i', name, 'pg_restore', '-U', 'restore_qa',
                     '-d', 'backup_restore_test', '--no-owner', '--no-acl',
                     '--exit-on-error', '--single-transaction'], stdin=data,
                    stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            command = ['docker', 'exec', '-i', name, 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1',
                       '-U', 'restore_qa', '-d', 'backup_restore_test']
            result = run(command, input=COUNTS_SQL, text=True, capture_output=True)
            actual = json.loads(result.stdout)
            if actual != expected:
                raise RuntimeError('Restored table counts do not match the exported snapshot')
            result = run(command, input='SELECT count(*) FROM "_prisma_migrations" '
                         'WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;',
                         text=True, capture_output=True)
            if result.stdout.strip() != '0':
                raise RuntimeError('Restored database has unfinished migrations')
            return {'tables': len(actual), 'rows': sum(actual.values())}
        finally:
            subprocess.run(['docker', 'rm', '-fv', name], stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=30)


def backup(container, directory, check_restore=False):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.chmod(0o700)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + secrets.token_hex(3)
    archive = directory / (stamp + '.dump')
    partial = directory / (stamp + '.partial')
    session = subprocess.Popen(source_command(container, 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1'),
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True)
    try:
        session.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n"
                            "SET LOCAL statement_timeout = '60s';\n"
                            "SET LOCAL idle_in_transaction_session_timeout = '12min';\n"
                            "SELECT pg_export_snapshot();\n")
        session.stdin.flush()
        snapshot = session.stdout.readline().strip()
        if not snapshot:
            raise RuntimeError('Could not export a source database snapshot')
        session.stdin.write(COUNTS_SQL + '\n')
        session.stdin.flush()
        counts = json.loads(session.stdout.readline())
        if not counts:
            raise RuntimeError('Source database contains no public tables')
        with partial.open('xb') as data:
            run(source_command(container, 'pg_dump', '-Fc', '--snapshot', snapshot),
                stdout=data, stderr=subprocess.PIPE)
        session.stdin.write('COMMIT;\n')
        session.stdin.flush()
        session.communicate(timeout=30)
        if session.returncode != 0:
            raise RuntimeError('Source snapshot session failed')
        with partial.open('rb') as data:
            run(['docker', 'exec', '-i', container, 'pg_restore', '--list'],
                stdin=data, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        partial.rename(archive)
        hasher = hashlib.sha256()
        with archive.open('rb') as data:
            for chunk in iter(lambda: data.read(1024 * 1024), b''):
                hasher.update(chunk)
        digest = hasher.hexdigest()
        result = {'createdAt': datetime.now(timezone.utc).isoformat(),
                  'sourceContainer': container, 'archive': archive.name,
                  'sha256': digest, 'tableCounts': counts, 'restoreVerified': False}
        manifest = archive.with_suffix('.json')
        manifest.write_text(json.dumps(result, indent=2) + '\n')
        if check_restore:
            image = run(['docker', 'inspect', container, '--format', '{{.Image}}'],
                        text=True, capture_output=True).stdout.strip()
            result['restoreResult'] = restore_check(archive, counts, image)
            result['restoreVerified'] = True
            manifest.write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({k: v for k, v in result.items() if k != 'tableCounts'}))
        return result
    finally:
        if session.poll() is None:
            try:
                session.communicate('ROLLBACK;\n', timeout=10)
            except (subprocess.TimeoutExpired, BrokenPipeError):
                session.kill()
                session.wait(timeout=10)
        partial.unlink(missing_ok=True)


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--container', default='bloodchain-postgres-1')
    parser.add_argument('--directory', type=Path, default=Path('/var/backups/bloodchain'))
    parser.add_argument('--restore-check', action='store_true')
    args = parser.parse_args()
    backup(args.container, args.directory, args.restore_check)
