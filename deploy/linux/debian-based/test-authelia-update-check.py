#!/usr/bin/python3
"""Exercise release alerts and failed checks without network or host writes."""
import contextlib
from datetime import datetime, timezone, timedelta
import importlib.machinery
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

loader = importlib.machinery.SourceFileLoader('update_check', str(Path(__file__).with_name('authelia-update-check')))
spec = importlib.util.spec_from_loader(loader.name, loader)
module = importlib.util.module_from_spec(spec)
loader.exec_module(module)


class ReleaseCheckTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state_patch = patch.object(module, 'STATE', Path(self.directory.name) / 'status.json')
        self.state_patch.start()
        self.addCleanup(self.state_patch.stop)

    def show(self, latest, installed='v4.39.28', age=0, failed=False):
        module.STATE.write_text(json.dumps(dict(
            latest=latest, failed=failed,
            checked_at=(datetime.now(timezone.utc) - timedelta(days=age)).isoformat())))
        output = io.StringIO()
        with patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'authelia version ' + installed)), contextlib.redirect_stdout(output):
            module.status()
        return output.getvalue()

    def test_numeric_comparison_and_release_link(self):
        output = self.show('v4.39.100')
        self.assertIn('UPDATE AVAILABLE v4.39.28 -> v4.39.100', output)
        self.assertIn('/releases/tag/v4.39.100', output)

    def test_current_or_newer_install_does_not_alert(self):
        for tag in ['v4.39.28', 'v4.39.27']:
            self.assertNotIn('UPDATE AVAILABLE', self.show(tag))

    def test_stale_and_failed_checks_remain_visible(self):
        output = self.show('v4.39.28', age=9, failed=True)
        self.assertIn('more than 8 days old', output)
        self.assertIn('check failed', output)

    def test_network_failure_preserves_last_success(self):
        self.show('v4.39.29')
        with patch.object(module.urllib.request, 'urlopen', side_effect=OSError('offline')), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module.check(), 1)
        state = module.read_state()
        self.assertEqual(state['latest'], 'v4.39.29')
        self.assertTrue(state['failed'])

    def test_prerelease_is_rejected(self):
        response = io.BytesIO(json.dumps(dict(tag_name='v4.40.0', prerelease=True)).encode())
        with patch.object(module.urllib.request, 'urlopen', return_value=response), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module.check(), 1)
        self.assertNotIn('latest', module.read_state())


if __name__ == '__main__':
    unittest.main()
