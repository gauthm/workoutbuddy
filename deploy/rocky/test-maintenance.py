"""Synthetic checks: this test never invokes systemctl, DNF, or a reboot."""
import importlib.machinery
import importlib.util
from pathlib import Path
from datetime import datetime
from types import SimpleNamespace
import unittest
from unittest.mock import patch

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

    def exercise(self, reboot, windows, updated=False, backup_fails=False):
        calls=[]
        def run(*args, **kwargs):
            calls.append(args)
            if backup_fails:
                raise RuntimeError('Synthetic backup failure')
            return SimpleNamespace(stdout='', returncode=0)
        with patch.object(maintenance, 'in_window', side_effect=windows), \
             patch.object(maintenance.Path, 'open'), patch.object(maintenance.fcntl, 'flock'), \
             patch.object(maintenance, 'run', side_effect=run), \
             patch.object(maintenance, 'versions', side_effect=[{'nodejs':'old','caddy':'same'}, {'nodejs':'new' if updated else 'old','caddy':'same'}]), \
             patch.object(maintenance, 'reboot_needed', return_value=reboot):
            if backup_fails:
                with self.assertRaises(RuntimeError):maintenance.apply()
            else:
                maintenance.apply()
        return calls

    def test_backup_precedes_updates_and_required_nightly_reboot(self):
        calls=self.exercise(True, [True, True])
        self.assertEqual(calls[0], ('/usr/bin/systemctl','start','workoutbuddy-backup.service'))
        self.assertEqual(calls[1][0], '/usr/bin/dnf-automatic')
        self.assertIn(('/usr/bin/systemctl','reboot'), calls)

    def test_late_transaction_defers_reboot(self):
        self.assertNotIn(('/usr/bin/systemctl','reboot'), self.exercise(True, [True, False]))

    def test_node_update_restarts_application_without_reboot(self):
        calls=self.exercise(False, [True], updated=True)
        self.assertIn(('/usr/bin/systemctl','restart','workoutbuddy.service'), calls)
        self.assertNotIn(('/usr/bin/systemctl','reboot'), calls)

    def test_failed_backup_blocks_updates(self):
        self.assertEqual(len(self.exercise(False, [True], backup_fails=True)), 1)


if __name__ == '__main__':
    unittest.main()
