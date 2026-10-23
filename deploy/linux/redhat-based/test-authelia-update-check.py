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
        self.dependencies_patch = patch.object(module, 'check_dependencies', return_value=False)
        self.dependencies_patch.start()
        self.addCleanup(self.dependencies_patch.stop)

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


class DependencyCheckTests(unittest.TestCase):
    def setUp(self):
        self.items = {
            'node_modules/express': dict(name='express', current='4.22.3'),
            'node_modules/express/node_modules/debug': dict(name='debug', current='2.6.9'),
            'public/vendor/vue.js': dict(name='vue', current='3.5.13'),
        }

    def test_transitive_and_browser_libraries_report_major_updates(self):
        state = {}
        with patch.object(module, 'inventory', return_value=self.items), patch.object(module, 'registry_latest', side_effect=lambda name: {'express': '5.2.0', 'debug': '4.4.0', 'vue': '3.5.13'}[name]):
            self.assertFalse(module.check_dependencies(state))
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                module.dependency_status(state)
        self.assertIn('2 update(s) available / 3 checked', output.getvalue())
        self.assertIn('express: 4.22.3 -> 5.2.0 [MAJOR]', output.getvalue())
        self.assertIn('debug: 2.6.9 -> 4.4.0 [MAJOR]', output.getvalue())

    def test_registry_failure_preserves_previous_results(self):
        state = {'dependencies': {'checked_at': 'old', 'items': self.items}}
        with patch.object(module, 'inventory', return_value=self.items), patch.object(module, 'registry_latest', side_effect=OSError('offline')), contextlib.redirect_stdout(io.StringIO()):
            self.assertTrue(module.check_dependencies(state))
        self.assertEqual(state['dependencies']['checked_at'], 'old')
        self.assertEqual(state['dependencies']['items'], self.items)
        self.assertTrue(state['dependencies']['failed'])

    def test_deployment_changes_invalidate_cached_results(self):
        state = {'dependencies': dict(checked_at=datetime.now(timezone.utc).isoformat(), items={})}
        with patch.object(module, 'inventory', return_value=self.items), contextlib.redirect_stdout(io.StringIO()) as output:
            module.dependency_status(state)
        self.assertIn('deployed files changed', output.getvalue())

    def test_inventory_excludes_dev_but_includes_installed_optional_and_vendors(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            lock = {'packages': {'': {}, 'node_modules/prod': {},
                                 'node_modules/dev': {'dev': True},
                                 'node_modules/missing': {'optional': True}}}
            (root / 'package-lock.json').write_text(json.dumps(lock))
            target = root / 'node_modules/prod'
            target.mkdir(parents=True)
            (target / 'package.json').write_text(json.dumps(dict(name='prod', version='1.0.0')))
            vendor = root / 'public/vendor'
            vendor.mkdir(parents=True)
            (vendor / 'vue.esm-browser.prod.js').write_text('/* vue v3.5.13 */')
            (vendor / 'chart.umd.min.js').write_text('/* Chart.js v4.4.4 */')
            with patch.object(module, 'APP', root):
                items = module.inventory()
            self.assertEqual(len(items), 3)
            self.assertEqual(items['public/vendor/chart.umd.min.js']['current'], '4.4.4')
            (vendor / 'new-library.js').write_text('/* New library */')
            with patch.object(module, 'APP', root), self.assertRaisesRegex(ValueError, 'missing version tracking'):
                module.inventory()


if __name__ == '__main__':
    unittest.main()
