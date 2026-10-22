# Public repository review

[Documentation home](INDEX.md) · [README](../README.md)

Review performed on October 16, 2026, on the current tracked files and 50 accessible commits,
before publishing the frontend changes.

### Review results

- Gitleaks 8.30.1: no findings in history or current files.
- No SQLite database, backup, real `.env`, private key, or Authelia user file
  found in history.
- No VPS-specific identifier found in historical contents.
- In-memory comparison of secrets in production configurations against Git contents:
  no match; no secret displayed or recorded in a tracked report.
- Addresses in test scenarios are reserved examples.
- Metadata of 42 older commits contains a personal email address. History is
  preserved; new commits use a GitHub noreply address.

### Limitations and ignored files

Automated review does not guarantee the absence of all sensitive data. Local data,
exports, logs, `.env.*` variants, SQLite databases, and keys are ignored by Git;
`.env.example` remains intentionally tracked. Never add these files with `git add -f`.

### Repeat the review

To repeat the review with the official
[Gitleaks](https://github.com/gitleaks/gitleaks) binary, from the repository:

```sh
gitleaks git --redact=100 --log-opts=--all .
```

### If a secret is published

Also inspect new files before committing. An already published secret must be revoked
and replaced, even after deleting the file. Rewriting history requires coordination
with other clones.
