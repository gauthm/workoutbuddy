#!/usr/bin/python3
"""Read-only platform prerequisites for the deployment directory containing this file."""
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys


def family_matches(text, family):
    release={}
    for line in text.splitlines():
        if '=' in line and not line.startswith('#'):
            key,value=line.split('=',1)
            values=shlex.split(value)
            release[key]=' '.join(values)
    names=set((release.get('ID','')+' '+release.get('ID_LIKE','')).split())
    accepted={'rhel','fedora','centos','rocky','almalinux','ol','amzn','redhat'} if family=='redhat-based' else {'debian','ubuntu'}
    return bool(names & accepted)


def check(family, release_file=Path('/etc/os-release')):
    errors=[]
    if not family_matches(release_file.read_text(),family):
        errors.append('OS ID/ID_LIKE does not match '+family)
    if sys.version_info < (3,9):errors.append('Python 3.9+ is required')
    required=['/usr/bin/node','/usr/bin/npm','systemctl','/usr/local/bin/authelia','caddy']
    required+=['dnf','rpm'] if family=='redhat-based' else ['apt-get','dpkg-query','/usr/sbin/needrestart']
    for name in required:
        if not shutil.which(name):errors.append('Missing executable: '+name)
    if not (shutil.which('redis-server') or shutil.which('valkey-server')):
        errors.append('Redis or Valkey is required')
    if shutil.which('/usr/bin/node'):
        version=subprocess.run(['/usr/bin/node','--version'],capture_output=True,text=True,check=True).stdout
        if not re.match(r'^v24\.',version):errors.append('Node.js 24.x is required at /usr/bin/node')
    if shutil.which('systemctl'):
        version=subprocess.run(['systemctl','--version'],capture_output=True,text=True,check=True).stdout
        match=re.match(r'systemd (\d+)',version)
        if not match or int(match[1])<247:errors.append('systemd 247+ is required by the hardening templates')
    if family=='redhat-based' and shutil.which('dnf'):
        result=subprocess.run(['dnf','needs-restarting','--help'],capture_output=True,text=True)
        if result.returncode:errors.append('The DNF needs-restarting plugin is required')
    if Path('/proc/1/comm').read_text().strip()!='systemd':
        errors.append('systemd must run as PID 1 to install the supplied units')
    return errors


if __name__=='__main__':
    errors=check(Path(__file__).parent.name)
    for error in errors:print(error,file=sys.stderr)
    if not errors:print('Platform prerequisites: OK (no system changes)')
    raise SystemExit(bool(errors))
