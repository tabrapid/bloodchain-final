# VPS operations

## Release QA

```sh
bash scripts/release-qa-docker.sh
```

Requires Docker. Builds the API image from the current checkout, then creates
disposable PostgreSQL and API runner containers sharing a loopback-only network
with no published ports or egress. Source mounts are read-only. Neither the live
environment file nor the live database is mounted. Containers and test data are
removed on exit. Root is used only inside the isolated QA runner to read private
source checkouts; production runtime user settings remain unchanged.

The suite applies migrations and demo data only to `bloodchain_release_test`,
runs the database-backed API suite, then exercises real local SMTP account
recovery, browser verification and concurrent mobile verification. Skipped
recovery checks fail the command. To reuse an image, set `BLOODCHAIN_QA_IMAGE`
only when its compiled code matches the checkout.

On 2026-11-05: 26 suites / 278 tests passed, including cross-organisation
inventory, appointment, screening, deferral and clinical authorisation checks.
The SMTP journey also passed, including exactly one session from two competing
verification requests. These checks use disposable data, not actual patients.

## Verified local backups

```sh
python3 scripts/vps-backup.py --restore-check
```

Default source is `bloodchain-postgres-1`; destination is
`/var/backups/bloodchain` (0700; files 0600). PostgreSQL credentials stay inside
the source container. A repeatable-read, read-only exported snapshot is shared
by row counts and `pg_dump`, so concurrent application writes do not cause
false count mismatches. Publication is atomic, with a SHA-256 manifest.

Restore verification starts a separate PostgreSQL container using the source's
exact image, with no network, no published ports and tmpfs data. It restores
with `--exit-on-error --single-transaction --no-owner --no-acl`, compares every
public table's count with the exported snapshot and checks migration status.
The live database is never restored over or modified. This verifies data and
schema recovery, not role/grant reconstruction or the full application recovery
procedure.

Systemd units are in `deploy/systemd/`. The backup timer runs daily at
02:30 Asia/Tashkent, with up to five minutes of jitter and catch-up after a
missed schedule. Each run performs restore verification. Failed restores leave
the archive available, marked unverified in its manifest.

These are compressed, permission-protected **local** archives. They are not
encrypted or off-host; VPS loss can still lose every local copy. Off-host
storage, encryption/recovery-key custody, retention policy and recovery-time
acceptance remain open. No automatic deletion/retention rule is enabled.

## Monitoring

`bloodchain-monitor.timer` runs every minute. It checks HTTPS API readiness,
the three portal roots, less than 26 hours since the last verified local
backup, the latest backup job result, and at least 10% free space on the backup filesystem. Three consecutive
failed cycles trigger an incident; recovery triggers one notification.
Successful channels are not spammed when another channel needs retrying.

Private destinations: `/etc/bloodchain/alerts.env` (0600):

```dotenv
EMAIL_TO=your-operator@example.com
TELEGRAM_BOT_TOKEN=your-private-token
TELEGRAM_CHAT_ID=your-chat-id
```

SMTP settings are read from the existing private `/opt/bloodchain/.env`;
database and auth secrets are excluded. Python sends mail directly, so a stopped
API/Docker daemon does not prevent email alerts. Telegram errors are logged by
type without exposing token-bearing URLs. Notification contents contain service
names and status, never clinical records.

```sh
python3 scripts/ops-monitor.py --check-only
python3 scripts/ops-monitor.py --send-test
systemctl list-timers 'bloodchain-*'
journalctl -u bloodchain-backup.service -u bloodchain-monitor.service
```

A host-local monitor cannot report its own host losing power or internet.
An external uptime monitor is still required before public launch. Telegram is
not active until its token/chat are configured and a test message succeeds.
