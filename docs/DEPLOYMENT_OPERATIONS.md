# Exploitation et maintenance Rocky

[Accueil de la documentation](INDEX.md) · [README](../README.md)

## Sauvegardes et administration

### Sauvegardes nocturnes

Le timer crée chaque nuit des sauvegardes SQLite cohérentes des deux bases, contrôle
`integrity_check`, archive leur configuration et garde **7 instantanés** dans
`/var/backups/workoutbuddy`, root uniquement. Les sauvegardes internes de l'application sont
distinctes et limitées à sept fichiers. Les archives contiennent des données privées et les clés
nécessaires au déchiffrement : les protéger.

Les copies sur le même VPS ne couvrent pas sa perte ou sa compromission.

### Transférer une archive

Depuis votre ordinateur, adapter l'utilisateur et le port SSH :

```sh
umask 077
ssh -t ADMIN@VPS 'umask 077; sudo tar -C /var/backups -czf - workoutbuddy > "$HOME/workoutbuddy-backups.tar.gz"'
scp ADMIN@VPS:workoutbuddy-backups.tar.gz .
```

### Restaurer et contrôler

La première commande demande le mot de passe sudo dans le terminal et prépare une archive privée
dans le home du compte SSH ; supprimer cette copie serveur après transfert vérifié. Garder l'archive
locale sur un disque chiffré.

Pour restaurer : sauvegarder l'état courant, arrêter Node et Authelia, extraire un instantané **dans
un répertoire isolé**, contrôler les deux bases avec `sqlite3 COPIE 'PRAGMA integrity_check;'`,
démarrer une instance isolée (`DB_PATH` vers la copie, loopback et autre port). Restaurer ensuite
bases et configuration correspondante, avec propriétaires et modes initiaux.

Déplacer l'ancien ensemble SQLite, WAL/SHM compris, avant remplacement. Redémarrer et vérifier
l'application et le MFA. Aucun essai destructif sur la base personnelle.

### Commandes et protections du serveur

- État : `systemctl status workoutbuddy authelia workoutbuddy-sessions caddy firewalld fail2ban`.
- Journaux : `journalctl -u workoutbuddy -u authelia -u caddy --since today`.
- Redémarrage : `systemctl restart workoutbuddy` ; drainage HTTP, limite 25 s
  pour les flux persistants, fermeture SQLite ; systemd attend 35 s.
- Sauvegarde immédiate : `systemctl start workoutbuddy-backup.service`.
- Timers/ressources : `systemctl list-timers`, `free -m`, `df -h /`,
  `systemctl show workoutbuddy authelia caddy -p MemoryCurrent`.
- Installer `journald-limits.conf` dans `/etc/systemd/journald.conf.d/` et recharger
  journald : limites 128 Mo persistants / 32 Mo volatils, 14 jours. Caddy tourne
  ses accès à 5 Mo, trois archives, sept jours. Ne pas activer `log_credentials`.
- Authelia : bannissement après trois échecs en deux minutes, pendant quinze minutes.
  Si SSH accepte les mots de passe, installer `fail2ban-server` et le modèle
  `sshd-jail.local` dans `/etc/fail2ban/jail.d/` ; adapter le port, valider avec
  `fail2ban-client -t`, activer le service. Tester le filtre sur une ligne synthétique
  puis bannir/débannir `192.0.2.123` en vérifiant la règle firewalld.
- En LXC, l'hôte gère l'horloge : pas de contournement d'`adjtimex`. Chrony peut
  rester absent ; vérifier l'écart NTP sans modifier l'heure et faire intervenir
  l'hébergeur en cas de dérive, car le TOTP en dépend.

## Mises à jour nocturnes

### Installer la maintenance DNF

Installer `dnf-automatic.conf` dans `/etc/dnf/automatic.conf`, les deux modèles
`dnf-automatic-service.conf` et `dnf-automatic-timer.conf` dans les drop-ins respectifs
`/etc/systemd/system/dnf-automatic.service.d/workoutbuddy.conf` et
`dnf-automatic.timer.d/workoutbuddy.conf`.

Le service utilise `/usr/local/sbin/workoutbuddy-maintenance --apply` : sauvegarde réussie
obligatoire, mises à jour RPM stables, puis `dnf needs-restarting -r`. Les mises à jour incluent
Node dans le **module 24**, les paquets Rocky/EPEL et Caddy ; elles ne changent pas de version
majeure de Rocky ou Node. Ne pas activer un dépôt non fiable.

### Horaires et redémarrages

Le timer démarre entre **04:00 et 04:15, Europe/Paris**, y compris lors des changements d’heure. Un
redémarrage nécessaire est autorisé uniquement entre **04:00 et 06:00**. Un traitement long reporte
le redémarrage à la nuit suivante ; l’indicateur est recontrôlé même sans nouveaux RPM. Un timer
manqué ne se rattrape pas en journée.

Sans redémarrage complet, les services applicatifs utilisant un binaire ou une bibliothèque mise à
jour sont redémarrés ; Node nouvellement installé est ainsi effectivement utilisé. En LXC, ce
redémarrage concerne le conteneur : le noyau et l’horloge de l’hôte restent sous la responsabilité
de l’hébergeur.

### Vérifier sans modifier le serveur

DNF garde `reboot = never` car le script décide du redémarrage et de son horaire. Ne pas appeler
directement une variante `dnf-automatic-install.timer` en parallèle. `workoutbuddy-maintenance
--check` est strictement en lecture ; `--apply` change le serveur seulement pendant la fenêtre
nocturne. Tester le garde horaire sans effets réels : `python3 deploy/rocky/test-maintenance.py`.

### Audit des dépendances

Créer `workoutbuddy-audit` avec `useradd --system --shell /sbin/nologin --home-dir
/var/cache/workoutbuddy-audit workoutbuddy-audit`, installer `workoutbuddy-audit.*` dans
`/etc/systemd/system/`, puis `service-hardening.conf` dans son drop-in `zzz-lxc-service.conf`. Il
peut lire le code, sans accès aux bases ni aux secrets.

L’audit npm hebdomadaire lit le lockfile de production le dimanche vers 05:30 ; une vulnérabilité
modérée ou supérieure fait échouer le service et apparaît dans le journal. Une indisponibilité du
registre fait également échouer le contrôle. Il n’y a pas de notification externe configurée.

### Activer et surveiller les timers

```sh
systemctl daemon-reload
systemctl enable --now dnf-automatic.timer workoutbuddy-audit.timer
systemctl restart dnf-automatic.timer
systemctl list-timers dnf-automatic.timer workoutbuddy-audit.timer
/usr/local/sbin/workoutbuddy-maintenance --check
journalctl -u dnf-automatic -u workoutbuddy-audit --since '7 days ago'

# Suspendre la maintenance nocturne si nécessaire :
systemctl disable --now dnf-automatic.timer
```

### Mises à jour manuelles

Pas de `npm update` ou `npm audit fix` automatique : mettre le lockfile à jour dans le dépôt, tester
puis installer avec `npm ci --omit=dev`. Le binaire Authelia est hors RPM : vérifier ses releases
officielles, sa configuration et les migrations, sauvegarder puis tester avant remplacement. Il
n’est pas mis à jour sans validation.
