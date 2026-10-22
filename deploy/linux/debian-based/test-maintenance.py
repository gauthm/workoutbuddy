"""Synthetic checks: never invokes package managers, systemctl, or a reboot."""
import importlib.machinery
import importlib.util
from pathlib import Path
from datetime import datetime
from types import SimpleNamespace
import unittest
from unittest.mock import patch

FAMILY = Path(__file__).parent.name
loader = importlib.machinery.SourceFileLoader('maintenance', str(Path(__file__).with_name('workoutbuddy-maintenance')))
spec = importlib.util.spec_from_loader(loader.name, loader)
maintenance = importlib.util.module_from_spec(spec)
loader.exec_module(maintenance)


class MaintenanceTest(unittest.TestCase):
    def test_window(self):
        for hour, expected in [(3, False), (4, True), (5, True), (6, False), (18, False)]:
            self.assertEqual(maintenance.in_window(datetime(2026, 1, 1, hour)), expected)

    def test_daytime_does_nothing(self):
        with patch.object(maintenance, 'in_window', return_value=False), patch.object(maintenance, 'run') as run:
            maintenance.apply()
            run.assert_not_called()

    def exercise(self, reboot=False, windows=(True,), changed='nodejs', backup_fails=False, upgrade_fails=False):
        calls=[]
        def run(*args, **kwargs):
            calls.append(args)
            if backup_fails:
                raise RuntimeError('Synthetic backup failure')
            return SimpleNamespace(stdout='', returncode=0)
        def upgrade():
            calls.append(('update-packages',))
            if upgrade_fails:
                raise RuntimeError('Synthetic transaction failure')
        with patch.object(maintenance, 'in_window', side_effect=windows), \
             patch.object(maintenance.Path, 'open'), patch.object(maintenance.fcntl, 'flock'), \
             patch.object(maintenance, 'run', side_effect=run), \
             patch.object(maintenance, 'upgrade', side_effect=upgrade), \
             patch.object(maintenance, 'restart_services', return_value={'unrelated.service'}), \
             patch.object(maintenance, 'versions', side_effect=[{changed:'old'}, {changed:'new'}]), \
             patch.object(maintenance, 'reboot_needed', return_value=reboot):
            if backup_fails or upgrade_fails:
                with self.assertRaises(RuntimeError):maintenance.apply()
            else:
                maintenance.apply()
        return calls

    def test_backup_precedes_updates_and_required_nightly_reboot(self):
        calls=self.exercise(True, (True, True))
        self.assertEqual(calls[0], ('/usr/bin/systemctl','start','workoutbuddy-backup.service'))
        self.assertEqual(calls[1], ('update-packages',))
        self.assertIn(('/usr/bin/systemctl','reboot'), calls)

    def test_late_transaction_defers_reboot(self):
        self.assertNotIn(('/usr/bin/systemctl','reboot'), self.exercise(True, (True, False)))

    def test_node_update_restarts_application_without_reboot(self):
        calls=self.exercise()
        self.assertIn(('/usr/bin/systemctl','restart','workoutbuddy.service'), calls)
        self.assertNotIn(('/usr/bin/systemctl','reboot'), calls)
        self.assertNotIn(('/usr/bin/systemctl','restart','unrelated.service'), calls)

    def test_failed_backup_blocks_updates(self):
        self.assertEqual(len(self.exercise(backup_fails=True)), 1)

    def test_failed_upgrade_blocks_reboot_and_restarts(self):
        self.assertEqual(len(self.exercise(upgrade_fails=True)), 2)

    def test_store_update_restarts_private_session_store(self):
        for package in ('redis','redis-server','valkey','valkey-server'):
            calls=self.exercise(changed=package)
            self.assertIn(('/usr/bin/systemctl','restart','workoutbuddy-sessions.service'), calls)

    def test_upgrade_commands(self):
        with patch.object(maintenance, 'run') as run:
            maintenance.upgrade()
        if FAMILY == 'redhat-based':
            self.assertEqual(run.call_args_list[-1].args, ('/usr/bin/dnf','-y','upgrade','--refresh'))
        else:
            self.assertEqual([call.args for call in run.call_args_list], [('/usr/bin/apt-get','update'),('/usr/bin/apt-get','-y','-o','Dpkg::Options::=--force-confdef','-o','Dpkg::Options::=--force-confold','upgrade')])

    def test_package_version_parsing(self):
        text='nodejs 24.1\nredis 7.0\n' if FAMILY == 'redhat-based' else 'nodejs:amd64 24.1\nredis-server 7.0\n'
        with patch.object(maintenance, 'run', return_value=SimpleNamespace(stdout=text)):
            self.assertEqual(maintenance.versions()['nodejs'], '24.1')

    @unittest.skipUnless(FAMILY == 'redhat-based', 'DNF backend')
    def test_dnf4_and_dnf5_service_exit_codes(self):
        for code in (0,1):
            with patch.object(maintenance, 'run', return_value=SimpleNamespace(stdout='caddy.service\n',returncode=code)):
                self.assertEqual(maintenance.restart_services(), {'caddy.service'})
                self.assertEqual(maintenance.reboot_needed(), code == 1)
        with patch.object(maintenance, 'run', return_value=SimpleNamespace(returncode=2)):
            with self.assertRaises(RuntimeError):maintenance.reboot_needed()

    @unittest.skipUnless(FAMILY == 'debian-based', 'APT backend')
    def test_debian_kernel_hint_without_ubuntu_marker(self):
        for status,expected in [('0',False),('1',False),('2',True),('3',True)]:
            with patch.object(maintenance.Path,'exists',return_value=False), patch.object(maintenance,'restart_report',return_value='NEEDRESTART-KSTA: '+status+'\n'):
                self.assertEqual(maintenance.reboot_needed(), expected)
        with patch.object(maintenance.Path,'exists',return_value=True), patch.object(maintenance,'restart_report') as report:
            self.assertTrue(maintenance.reboot_needed())
            report.assert_not_called()
        with patch.object(maintenance.Path,'exists',return_value=False), patch.object(maintenance,'restart_report',return_value=''):
            with self.assertRaises(RuntimeError):maintenance.reboot_needed()

    @unittest.skipUnless(FAMILY == 'debian-based', 'APT backend')
    def test_needrestart_is_read_only_and_reports_services(self):
        with patch.object(maintenance,'run',return_value=SimpleNamespace(stdout='NEEDRESTART-SVC: caddy.service\nNEEDRESTART-SVC: unrelated.service\n')) as run:
            self.assertEqual(maintenance.restart_services(), {'caddy.service','unrelated.service'})
            self.assertEqual(run.call_args.args,('/usr/sbin/needrestart','-b','-r','l'))


if __name__ == '__main__':
    unittest.main()
