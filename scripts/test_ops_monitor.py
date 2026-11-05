import importlib.util
from pathlib import Path
import tempfile
import unittest
import io
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ops_monitor', Path(__file__).with_name('ops-monitor.py'))
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


class MonitorTests(unittest.TestCase):
    def test_backup_freshness_rejects_old_future_and_malformed_manifests(self):
        class Response(io.BytesIO):
            status = 200

            def __init__(self, url):
                super().__init__(b'{"data":{"status":"ready"}}')
                self.url = url

        with tempfile.TemporaryDirectory() as tmp, patch.object(
                monitor.urllib.request, 'urlopen', side_effect=lambda url, **_: Response(url)):
            directory = Path(tmp)
            (directory / 'backup.dump').write_bytes(b'archive placeholder')
            now = datetime.now(timezone.utc)
            for offset, healthy in [(0, True), (-29, False), (1, False)]:
                (directory / 'backup.json').write_text(json.dumps({
                    'createdAt': (now + timedelta(hours=offset)).isoformat(),
                    'restoreVerified': True, 'archive': 'backup.dump',
                }))
                self.assertEqual(not monitor.health_checks(directory), healthy)
            (directory / 'backup.json').write_text('[]')
            self.assertIn('Verified local backup freshness (26 hours)', monitor.health_checks(directory))
            (directory / 'last-run.json').write_text('{"status":"failed"}')
            self.assertIn('Latest local backup/restore run', monitor.health_checks(directory))

    def test_transient_failure_does_not_alert(self):
        state = monitor.transition({}, True)
        state = monitor.transition(state, True)
        self.assertIsNone(state.get('notice'))
        state = monitor.transition(state, False)
        self.assertEqual(state['failures'], 0)
        self.assertIsNone(state.get('notice'))

    def test_sustained_outage_alerts_once_then_recovers(self):
        state = {}
        for _ in range(3):
            state = monitor.transition(state, True)
        self.assertEqual(state['notice'], 'outage')
        state.update(notice=None, delivered=['email'])
        state = monitor.transition(state, True)
        self.assertIsNone(state['notice'])
        state = monitor.transition(state, False)
        self.assertEqual(state['notice'], 'recovery')
        state.update(notice=None, delivered=['email'])
        self.assertIsNone(monitor.transition(state, False)['notice'])

    def test_failed_recovery_notice_is_not_sent_during_another_failure(self):
        state = monitor.transition({'incident': True}, False)
        state = monitor.transition(state, True)
        self.assertTrue(state['incident'])
        self.assertIsNone(state['notice'])

    def test_only_failed_channel_is_retried(self):
        config = {'EMAIL_TO': 'qa@example.com', 'TELEGRAM_BOT_TOKEN': 'test', 'TELEGRAM_CHAT_ID': '123'}
        delivered = []
        with patch.object(monitor, 'send_email') as email, patch.object(monitor, 'send_telegram') as telegram:
            telegram.side_effect = RuntimeError('private token must not be logged')
            _, errors = monitor.notify(config, 'test', 'body', delivered)
            self.assertEqual(delivered, ['email'])
            self.assertEqual(errors, [{'channel': 'telegram', 'error': 'RuntimeError'}])
            telegram.side_effect = None
            _, errors = monitor.notify(config, 'test', 'body', delivered)
            email.assert_called_once()
            self.assertEqual(delivered, ['email', 'telegram'])
            self.assertEqual(errors, [])

    def test_empty_destinations_fail_visibly(self):
        with self.assertRaises(RuntimeError):
            monitor.notify({}, 'test', 'body', [])

    def test_env_reader_only_extracts_mail_settings_and_preserves_quoted_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'private.env'
            path.write_text('SMTP_FROM="BloodChain <qa@example.com>"\nSMTP_PASSWORD="abc#123"\nDATABASE_URL=private\n')
            result = monitor.read_env(path, {'SMTP_FROM', 'SMTP_PASSWORD'})
            self.assertEqual(result, {'SMTP_FROM': 'BloodChain <qa@example.com>', 'SMTP_PASSWORD': 'abc#123'})


if __name__ == '__main__':
    unittest.main()
