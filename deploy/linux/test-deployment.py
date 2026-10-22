"""Platform and template checks in temporary directories; no host installation."""
import importlib.util
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

os.environ['PATH']=os.environ.get('PATH',os.defpath)+os.pathsep+'/usr/local/bin'
ROOT=Path(__file__).parent
FAMILIES=('redhat-based','debian-based')


def platform_module(family):
    spec=importlib.util.spec_from_file_location('platform_check',ROOT/family/'check-platform.py')
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DeploymentTest(unittest.TestCase):
    def test_shared_files_stay_identical(self):
        # Both folders are standalone; prevent drift in their common security configuration.
        redhat,debian=(ROOT/family for family in FAMILIES)
        specific={'workoutbuddy-maintenance','sshd-jail.local'}
        for p in redhat.iterdir():
            if p.is_file() and not p.name.startswith('dnf-') and p.name not in specific:
                self.assertEqual(p.read_bytes(),(debian/p.name).read_bytes(),p.name)

    def test_firewall_actions_match_the_distribution(self):
        self.assertIn('banaction = firewallcmd-rich-rules',(ROOT/'redhat-based/sshd-jail.local').read_text())
        self.assertIn('banaction = nftables-multiport',(ROOT/'debian-based/sshd-jail.local').read_text())
        self.assertNotIn('firewallcmd',(ROOT/'debian-based/sshd-jail.local').read_text())

    def test_family_detection_uses_id_and_id_like(self):
        redhat=platform_module('redhat-based')
        for text in ['ID=rocky','ID=almalinux','ID=fedora','ID=ol','ID=amzn', 'ID=example\nID_LIKE="rhel fedora"']:
            self.assertTrue(redhat.family_matches(text,'redhat-based'),text)
            self.assertFalse(redhat.family_matches(text,'debian-based'),text)
        for text in ['ID=debian','ID=ubuntu','ID=example\nID_LIKE="ubuntu debian"']:
            self.assertTrue(redhat.family_matches(text,'debian-based'),text)
            self.assertFalse(redhat.family_matches(text,'redhat-based'),text)
        self.assertFalse(redhat.family_matches('ID=arch','redhat-based'))

    def test_platform_rejects_old_node_and_systemd(self):
        for family in FAMILIES:
            module=platform_module(family)
            def run(args,**kwargs):
                value='v22.0.0' if args[0].endswith('node') else 'systemd 239'
                return SimpleNamespace(stdout=value,returncode=0)
            release=SimpleNamespace(read_text=lambda:'ID='+('rocky' if family=='redhat-based' else 'debian'))
            with patch.object(module.shutil,'which',side_effect=lambda x:x),patch.object(module.subprocess,'run',side_effect=run),patch.object(module.Path,'read_text',return_value='systemd'):
                errors=module.check(family,release)
            self.assertEqual(len(errors),2,errors)

    def test_rendered_configuration_has_private_permissions_and_no_placeholders(self):
        if not shutil.which('authelia'):self.skipTest('Authelia is needed to render synthetic password hashes')
        for family in FAMILIES:
            with tempfile.TemporaryDirectory(prefix='wb-render-test-') as directory:
                subprocess.run(['python3',str(ROOT/family/'render.py'),'workoutbuddy.example.org',directory],check=True,capture_output=True)
                files=list(Path(directory).iterdir())
                self.assertGreater(len(files),5)
                for p in files:
                    self.assertFalse(re.search(r'__[A-Z_]+__',p.read_text()),p.name)
                    self.assertEqual(p.stat().st_mode & 0o777,0o600,p.name)
                config=Path(directory)/'authelia.yml'
                # Validation only; these generated secrets and paths never reach production.
                subprocess.run(['authelia','config','validate','--config',str(config)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__=='__main__':
    unittest.main()
