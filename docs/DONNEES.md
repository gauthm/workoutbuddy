# Backup, export, and reset

[Documentation home](INDEX.md) · [README](../README.md)

- [Available actions](#available-actions)
- [File permissions](#file-permissions)
- [Custom storage and privacy](#custom-storage-and-privacy)
- [Copy and restore SQLite](#copy-and-restore-sqlite)
- [Personal files and Git](#personal-files-and-git)

## Available actions

These features are under **Settings → Advanced settings → Data**.

| Action | Contents or effect |
| --- | --- |
| JSON export | Programs, session templates, sessions, deleted slots, sets, body weight, records, progressions, calculation context, reviews, inventory, exercise exclusions, profile, conversations, and settings; API key excluded |
| Session summary CSV | One row per session, with its information and totals |
| Set details CSV | One row per set, with exercise, load, repetitions, and other measurements |
| JSON import | Restores exported data, replacing covered data; backup beforehand and transactional restore. Recognized historical duplicates are merged with the catalog; a custom exercise without a recognized equivalent blocks import before any changes |
| Local backup | Consistent SQLite copy in `data/backups/`, or the `backups/` directory beside the configured database |
| Reset stats and history | Deletes sessions, sets, records, body weight, retained progress, and reviews; keeps programs, inventory, profile, settings, and pain areas |
| Full reset | Deletes user data and pain areas; keeps the built-in catalog and application settings |

## File permissions

The database, its `-wal`/`-shm`/`-journal` files, and SQLite backups receive POSIX `0600`
permissions (owner read/write only). The project's `data/` directory, new storage directories, and
the `backups/` directory receive `0700`. Startup also corrects existing files; creating a backup
restricts older copies before continuing.

A symbolic link used as a sensitive file or final directory is rejected.

## Custom storage and privacy

With a custom `DB_PATH`, permissions on an existing parent directory are not changed: use a
dedicated directory owned by the service account. A custom parent writable by the group or other
users is rejected. These permissions do not encrypt data or protect against root or a process
running under the same account.

The API key remains in SQLite and its backups; downloaded exports are subject to the receiving
device's permissions.

## Copy and restore SQLite

The database uses SQLite WAL journaling. For a manual copy, stop the server before copying the
database and any `-wal`/`-shm` files. The backup button creates a consistent file even while the
server runs. To restore a SQLite backup, stop the server, then replace the database without keeping
old journal files from the replaced database.

## Personal files and Git

JSON exports and local backups contain personal data; store them appropriately. The database,
backups, `.env`, and local exports are excluded from Git.
