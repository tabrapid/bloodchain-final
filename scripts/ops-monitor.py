#!/usr/bin/env python3
"""Check public services and verified local backups; notify on state changes."""
import argparse
from datetime import datetime, timezone
from email.message import EmailMessage
import json
import os
from pathlib import Path
import shlex
import shutil
import smtplib
import ssl
import urllib.parse
import urllib.request

TARGETS = {
    'API readiness': 'https://api.bloodchain.uz/api/v1/health/ready',
    'Hospital portal': 'https://hospital.bloodchain.uz/',
    'Blood centre portal': 'https://center.bloodchain.uz/',
    'Admin portal': 'https://admin.bloodchain.uz/',
}


def read_env(path, allowed=None):
    result = {}
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        key, separator, value = line.partition('=')
        key = key.strip()
        if separator and (allowed is None or key in allowed) and not key.startswith('#'):
            result[key] = ' '.join(shlex.split(value, comments=True))
    return result


def transition(previous, failed, threshold=3):
    state = dict(previous)
    state['delivered'] = list(previous.get('delivered', []))
    if failed:
        if state.get('notice') == 'recovery':
            state.update(incident=True, notice=None, delivered=[])
        state['failures'] = state.get('failures', 0) + 1
        if state['failures'] >= threshold and not state.get('incident'):
            state.update(incident=True, notice='outage', delivered=[])
    else:
        state['failures'] = 0
        if state.get('incident'):
            state.update(incident=False, notice='recovery', delivered=[])
    return state


def health_checks(backup_directory):
    failed = []
    disk = shutil.disk_usage(backup_directory if backup_directory.exists() else '/')
    if disk.free / disk.total < 0.10:
        failed.append('Backup disk free space (below 10%)')
    for name, url in TARGETS.items():
        try:
            with urllib.request.urlopen(url, timeout=8) as response:
                if response.status != 200 or urllib.parse.urlparse(response.url).netloc != urllib.parse.urlparse(url).netloc:
                    raise ValueError('Unexpected health response')
                if name == 'API readiness' and json.load(response).get('data', {}).get('status') != 'ready':
                    raise ValueError('API is not ready')
        except Exception:
            failed.append(name)
    verified = False
    now = datetime.now(timezone.utc)
    for manifest in backup_directory.glob('*.json'):
        try:
            item = json.loads(manifest.read_text())
            age = (now - datetime.fromisoformat(item['createdAt'])).total_seconds()
            if (item.get('restoreVerified') is True and 0 <= age <= 26 * 3600
                    and Path(item['archive']).name == item['archive']
                    and (backup_directory / item['archive']).is_file()):
                verified = True
                break
        except (ValueError, KeyError, OSError, TypeError, AttributeError):
            continue
    if not verified:
        failed.append('Verified local backup freshness (26 hours)')
    return failed


def send_email(config, subject, body):
    message = EmailMessage()
    message['From'] = config['SMTP_FROM']
    message['To'] = config['EMAIL_TO']
    message['Subject'] = subject
    message.set_content(body)
    context = ssl.create_default_context()
    secure = config.get('SMTP_SECURE', 'false').lower() == 'true'
    factory = smtplib.SMTP_SSL if secure else smtplib.SMTP
    options = {'timeout': 15}
    if secure:
        options['context'] = context
    with factory(config['SMTP_HOST'], int(config.get('SMTP_PORT', '465' if secure else '587')), **options) as smtp:
        if not secure:
            smtp.starttls(context=context)
        if config.get('SMTP_USER'):
            smtp.login(config['SMTP_USER'], config['SMTP_PASSWORD'])
        smtp.send_message(message)


def send_telegram(config, subject, body):
    payload = json.dumps({'chat_id': config['TELEGRAM_CHAT_ID'], 'text': subject + '\n\n' + body}).encode()
    request = urllib.request.Request(
        'https://api.telegram.org/bot' + config['TELEGRAM_BOT_TOKEN'] + '/sendMessage',
        data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=15) as response:
        if not json.load(response).get('ok'):
            raise RuntimeError('Telegram rejected the notification')


def notify(config, subject, body, delivered):
    channels = {}
    if config.get('EMAIL_TO'):
        channels['email'] = send_email
    if config.get('TELEGRAM_CHAT_ID') and config.get('TELEGRAM_BOT_TOKEN'):
        channels['telegram'] = send_telegram
    if not channels:
        raise RuntimeError('No alert destination configured')
    errors = []
    for name, sender in channels.items():
        if name in delivered:
            continue
        try:
            sender(config, subject, body)
            delivered.append(name)
        except Exception as error:
            # Do not log SMTP credentials or Telegram token-bearing URLs.
            errors.append({'channel': name, 'error': type(error).__name__})
    return list(channels), errors


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-env', type=Path, default=Path('/opt/bloodchain/.env'))
    parser.add_argument('--alerts-env', type=Path, default=Path('/etc/bloodchain/alerts.env'))
    parser.add_argument('--backup-directory', type=Path, default=Path('/var/backups/bloodchain'))
    parser.add_argument('--state-directory', type=Path, default=Path('/var/lib/bloodchain'))
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--send-test', action='store_true')
    args = parser.parse_args()
    config = read_env(args.alerts_env)
    config.update(read_env(args.api_env, {'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'}))
    if args.send_test:
        delivered = []
        channels, errors = notify(config, 'BloodChain monitoring — sinov',
                                  'Monitoring xabarlari shu manzilga yuboriladi. Bu sinov xati; nosozlik qayd etilmadi.', delivered)
        print(json.dumps({'configured': channels, 'delivered': delivered, 'errors': errors}))
        return 1 if errors else 0
    failed = health_checks(args.backup_directory)
    if args.check_only:
        print(json.dumps({'failed': failed}))
        return 1 if failed else 0
    args.state_directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = args.state_directory / 'monitor-state.json'
    previous = json.loads(path.read_text()) if path.exists() else {}
    state = transition(previous, bool(failed))
    errors = []
    if state.get('notice'):
        subject = 'BloodChain — ' + ('nosozlik aniqlandi' if state['notice'] == 'outage' else 'servislar tiklandi')
        body = ('Uchta ketma-ket tekshiruvda muammo: ' + ', '.join(failed)
                if state['notice'] == 'outage' else 'Barcha kuzatilayotgan servislar va lokal backup tekshiruvi muvaffaqiyatli.')
        channels, errors = notify(config, subject, body, state['delivered'])
        if all(channel in state['delivered'] for channel in channels):
            state['notice'] = None
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(state) + '\n')
    temporary.replace(path)
    print(json.dumps({'failed': failed, 'incident': state.get('incident', False), 'notificationErrors': errors}))
    return 1 if failed or errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
