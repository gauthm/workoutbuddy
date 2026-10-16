#!/usr/bin/python3
"""Render private configuration outside the repository; prints no secrets."""
import os, pathlib, re, secrets, subprocess, sys, json
os.umask(0o077)
domain, output = sys.argv[1:]
if not re.fullmatch(r'[a-z0-9][a-z0-9.-]+\.[a-z]{2,}',domain): raise SystemExit('Invalid domain')
root=pathlib.Path(output)
root.mkdir(mode=0o700,parents=True,exist_ok=True)
values={'DOMAIN':domain,**{k:secrets.token_hex(32) for k in ['JWT_SECRET','SECRET','ENCRYPTION_KEY','REDIS_PASSWORD']}}
for source in pathlib.Path(__file__).parent.glob('*.template'):
 s=source.read_text()
 for k,v in values.items():s=s.replace('__'+k+'__',v)
 p=root/source.name.removesuffix('.template');p.write_text(s);p.chmod(0o600)
r=subprocess.run(['authelia','crypto','hash','generate','argon2','--random'],capture_output=True,text=True,check=True)
digest=re.search(r'Digest:\s*(\S+)',r.stdout)[1]
(root/'users.yml').write_text('users:\n  pending:\n    disabled: true\n    displayname: WorkoutBuddy\n    password: '+json.dumps(digest)+'\n    email: owner@'+domain+'\n')
