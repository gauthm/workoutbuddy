# Exploitation et maintenance Linux

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

- État : `systemctl status workoutbuddy authelia workoutbuddy-sessions caddy` ; vérifier aussi le pare-feu et fail2ban s’ils sont installés.
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
  Si SSH accepte les mots de passe, installer `fail2ban-server` (Red Hat) ou `fail2ban` (Debian/Ubuntu) et le modèle
  `sshd-jail.local` dans `/etc/fail2ban/jail.d/` ; adapter le port, valider avec
  `fail2ban-client -t`, activer le service. Tester le filtre sur une ligne synthétique
  puis bannir/débannir `192.0.2.123` en vérifiant la règle firewalld.
- En LXC, l'hôte gère l'horloge : pas de contournement d'`adjtimex`. Chrony peut
  rester absent ; vérifier l'écart NTP sans modifier l'heure et faire intervenir
  l'hébergeur en cas de dérive, car le TOTP en dépend.

## Mises à jour nocturnes

### Installer la maintenance de la famille choisie

Définir `WB_DEPLOY_DIR=deploy/redhat-based` ou `WB_DEPLOY_DIR=deploy/debian-based`.
Installer les fichiers `workoutbuddy-maintenance`, `workoutbuddy-maintenance.service`
et `workoutbuddy-maintenance.timer` de cette variante :

```sh
install -o root -g root -m 0750 "$WB_DEPLOY_DIR/workoutbuddy-maintenance" /usr/local/sbin/workoutbuddy-maintenance
install -o root -g root -m 0644 "$WB_DEPLOY_DIR/workoutbuddy-maintenance.service" /etc/systemd/system/workoutbuddy-maintenance.service
install -o root -g root -m 0644 "$WB_DEPLOY_DIR/workoutbuddy-maintenance.timer" /etc/systemd/system/workoutbuddy-maintenance.timer
```

La sauvegarde doit réussir avant la première transaction. La variante Red Hat utilise
DNF 4/5 et son plugin `needs-restarting`. La variante Debian utilise APT et `needrestart`
en mode batch/liste. Elles suivent les dépôts configurés, sans changer de release Linux.
Conserver Node sur la branche 24 via la politique du dépôt ou un verrouillage du paquet ;
aucun script ne garantit la branche majeure d’un dépôt tiers qui change sa politique.
Ne pas activer de dépôt non fiable.

Désactiver les planificateurs concurrents sur une installation dédiée :

- Red Hat : `dnf-automatic.timer`, `dnf-automatic-install.timer` ou le timer DNF 5,
  selon les unités réellement installées. Les anciens drop-ins `dnf-automatic*.conf`
  sont conservés dans le dépôt pour les installations DNF 4 existantes ; leur wrapper
  continue de fonctionner, mais un seul timer doit lancer la maintenance.
- Debian/Ubuntu : `apt-daily.timer` et `apt-daily-upgrade.timer`. Si `unattended-upgrades`
  reste installé, désactiver son exécution périodique dans la configuration APT et
  conserver `Unattended-Upgrade::Automatic-Reboot "false";`. Désactiver aussi tout
  planificateur d’un outil tiers qui installerait les mises à jour en parallèle.

Ne pas interrompre une transaction de paquets en cours lors de la migration.
Contrôler les unités actives avant de changer de planificateur.

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

`workoutbuddy-maintenance --check` vérifie l’état sans installer de paquet,
redémarrer de service ou rebooter. `--apply` commence seulement entre 04 h et 06 h.
Après une transaction longue, les services concernés peuvent être relancés même si la
fenêtre vient de se fermer ; seul le reboot est reporté à la nuit suivante.
Les scripts internes des paquets peuvent aussi relancer leurs propres services.

Tester les deux variantes sans modifier le serveur :

```sh
python3 deploy/redhat-based/test-maintenance.py
python3 deploy/debian-based/test-maintenance.py
python3 deploy/test-deployment.py
```

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
systemctl enable --now workoutbuddy-maintenance.timer workoutbuddy-audit.timer
systemctl restart workoutbuddy-maintenance.timer
systemctl list-timers workoutbuddy-maintenance.timer workoutbuddy-audit.timer
/usr/local/sbin/workoutbuddy-maintenance --check
journalctl -u workoutbuddy-maintenance -u workoutbuddy-audit --since '7 days ago'

# Suspendre la maintenance nocturne si nécessaire :
systemctl disable --now workoutbuddy-maintenance.timer
```

### Mises à jour manuelles

Pas de `npm update` ou `npm audit fix` automatique : mettre le lockfile à jour dans le dépôt, tester
puis installer avec `npm ci --omit=dev`. Le binaire Authelia est installé hors gestionnaire de paquets : vérifier ses releases
officielles, sa configuration et les migrations, sauvegarder puis tester avant remplacement. Il
n’est pas mis à jour sans validation.
