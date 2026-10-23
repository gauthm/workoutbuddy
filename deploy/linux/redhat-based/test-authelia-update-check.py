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
            latest=latest, versions=[latest], failed=failed,
            checked_at=(datetime.now(timezone.utc) - timedelta(days=age)).isoformat())))
        output = io.StringIO()
        with patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'authelia version ' + installed)), contextlib.redirect_stdout(output):
            module.status()
        return output.getvalue()

    def test_numeric_comparison_and_release_link(self):
        output = self.show('v4.39.100')
        self.assertIn('UPDATE AVAILABLE v4.39.28 | [FIX] v4.39.100', output)
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
        response = [dict(tag_name='v4.40.0', prerelease=True)]
        with patch.object(module, 'fetch_json', return_value=response), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module.check(), 1)
        self.assertNotIn('latest', module.read_state())

    def test_authelia_pagination_keeps_backported_fixes_and_excludes_drafts(self):
        first = [dict(tag_name='v5.0.0')] * 100
        second = [dict(tag_name='v4.39.30'), dict(tag_name='v6.0.0-rc.1', prerelease=True),
                  dict(tag_name='v7.0.0', draft=True)]
        with patch.object(module, 'fetch_json', side_effect=[first, second]) as fetch:
            published = module.authelia_versions()
        self.assertEqual(module.release_levels('v4.39.28', published), {'MAJOR': 'v5.0.0', 'FIX': 'v4.39.30'})
        self.assertIn('page=2', fetch.call_args.args[0])

    def test_all_authelia_levels_appear_in_status(self):
        module.STATE.write_text(json.dumps(dict(
            latest='v5.1.0', versions=['v4.39.30', 'v4.40.2', 'v5.1.0'],
            checked_at=datetime.now(timezone.utc).isoformat())))
        with patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'authelia version v4.39.28')), contextlib.redirect_stdout(io.StringIO()) as output:
            module.authelia_status(module.read_state())
        for label in ['[FIX] v4.39.30', '[MINOR] v4.40.2', '[MAJOR] v5.1.0']:
            self.assertIn(label, output.getvalue())


class ReleaseLevelTests(unittest.TestCase):
    def test_patch_minor_major_coexist_without_hiding_old_branch_fixes(self):
        candidates = ['3.0.9', '3.0.100', '3.2.1', '3.10.0', '4.0.0', '5.0.0',
                      '6.0.0-beta.1', 'latest', '3.0.1']
        self.assertEqual(module.release_levels('3.0.2', candidates),
                         {'FIX': '3.0.100', 'MINOR': '3.10.0', 'MAJOR': '5.0.0'})

    def test_zero_major_is_minor_and_no_downgrade_is_reported(self):
        self.assertEqual(module.release_levels('0.7.2', ['0.7.3', '0.8.0', '1.0.0']),
                         {'FIX': '0.7.3', 'MINOR': '0.8.0', 'MAJOR': '1.0.0'})
        self.assertEqual(module.release_levels('3.0.0', ['1.0.0', '2.5.0', '3.0.0']), {})

    def test_registry_reads_all_published_versions_not_latest_tag_only(self):
        metadata = {'dist-tags': {'latest': '4.0.0'}, 'versions': {
            '3.0.3': {}, '4.0.0': {}, '5.0.0-rc.1': {}}}
        with patch.object(module, 'fetch_json', return_value=metadata) as fetch:
            self.assertEqual(module.registry_versions('@scope/pkg'), ['3.0.3', '4.0.0'])
        self.assertIn('%40scope%2Fpkg', fetch.call_args.args[0])

    def test_compressed_metadata_is_supported(self):
        import gzip
        response = io.BytesIO(gzip.compress(b'{"versions":{"1.0.0":{}}}'))
        response.headers = {'Content-Encoding': 'gzip'}
        with patch.object(module.urllib.request, 'urlopen', return_value=response):
            self.assertIn('1.0.0', module.fetch_json('https://example.test')['versions'])


class DependencyCheckTests(unittest.TestCase):
    def setUp(self):
        self.items = {
            'node_modules/express': dict(name='express', current='4.22.3'),
            'node_modules/express/node_modules/debug': dict(name='debug', current='2.6.9'),
            'public/vendor/vue.js': dict(name='vue', current='3.5.13'),
        }

    def test_transitive_and_browser_libraries_report_major_updates(self):
        state = {}
        with patch.object(module, 'inventory', return_value=self.items), patch.object(module, 'registry_versions', side_effect=lambda name: [{'express': '5.2.0', 'debug': '4.4.0', 'vue': '3.5.13'}[name]]):
            self.assertFalse(module.check_dependencies(state))
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                module.dependency_status(state)
        self.assertIn('2 package(s) with updates / 3 checked', output.getvalue())
        self.assertIn('FIX 0, MINOR 0, MAJOR 2', output.getvalue())
        self.assertIn('express: 4.22.3 | [MAJOR] 5.2.0', output.getvalue())
        self.assertIn('debug: 2.6.9 | [MAJOR] 4.4.0', output.getvalue())

    def test_registry_failure_preserves_previous_results(self):
        state = {'dependencies': {'checked_at': 'old', 'items': self.items}}
        with patch.object(module, 'inventory', return_value=self.items), patch.object(module, 'registry_versions', side_effect=OSError('offline')), contextlib.redirect_stdout(io.StringIO()):
            self.assertTrue(module.check_dependencies(state))
        self.assertEqual(state['dependencies']['checked_at'], 'old')
        self.assertEqual(state['dependencies']['items'], self.items)
        self.assertTrue(state['dependencies']['failed'])

    def test_deployment_changes_invalidate_cached_results(self):
        state = {'dependencies': dict(checked_at=datetime.now(timezone.utc).isoformat(), items={}, format=2)}
        with patch.object(module, 'inventory', return_value=self.items), contextlib.redirect_stdout(io.StringIO()) as output:
            module.dependency_status(state)
        self.assertIn('deployed files changed', output.getvalue())

    def test_all_levels_are_counted_without_counting_a_package_three_times(self):
        items = {'node_modules/pkg': dict(name='pkg', current='2.1.0')}
        state = {}
        with patch.object(module, 'inventory', return_value=items), patch.object(module, 'registry_versions', return_value=['2.1.1', '2.2.0', '3.0.0']):
            self.assertFalse(module.check_dependencies(state))
            with contextlib.redirect_stdout(io.StringIO()) as output:
                module.dependency_status(state)
        self.assertIn('1 package(s) with updates / 1 checked', output.getvalue())
        self.assertIn('FIX 1, MINOR 1, MAJOR 1', output.getvalue())
        self.assertIn('pkg: 2.1.0 | [FIX] 2.1.1 | [MINOR] 2.2.0 | [MAJOR] 3.0.0', output.getvalue())

    def test_legacy_cache_requests_refresh_instead_of_claiming_branches_are_current(self):
        state = {'dependencies': dict(checked_at=datetime.now(timezone.utc).isoformat(), items={})}
        with contextlib.redirect_stdout(io.StringIO()) as output:
            module.dependency_status(state)
        self.assertIn('branch-level version information unavailable', output.getvalue())

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
