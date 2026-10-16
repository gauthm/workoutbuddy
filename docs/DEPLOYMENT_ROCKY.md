# Rocky Linux 9 : déploiement personnel

Architecture gratuite : **Caddy → Authelia (mot de passe + TOTP) → Node 24 / SQLite**.
Les modèles sont dans `deploy/rocky/`. Exécuter les opérations système comme root.

## Préparation

- Lire `AGENT.md`, `README.md`, `package.json`, `.env.example`. Examiner
  `systemd-detect-virt`, `free -m`, `df -h /`, `ss -lntup`, `getenforce`,
  `sshd -t`, `sshd -T` et les zones firewalld. Garder une session SSH ouverte.
- Conserver SELinux enforcing si le noyau le fournit. Dans certains LXC, il est
  indisponible : ses paquets ne suffisent pas à l'activer ; cela dépend de l'hôte.
- DNS : `DOMAINE` et `auth.DOMAINE` doivent pointer vers le VPS (A/AAAA cohérents).
  `duckdns.org` est un suffixe public ; utiliser `nom.duckdns.org` pour le cookie,
  et `auth.nom.duckdns.org` pour le portail. Deux domaines DuckDNS indépendants
  ne partagent pas ce cookie. Vérifier la Public Suffix List avant changement.
- Sauvegarder toute base existante **avant migration** avec l'API SQLite backup
  (incluant le WAL), jamais avec une copie brute d'une base ouverte. Garder cet
  instantané antérieur aux migrations hors de la rétention automatique.

## Installation

Installer `nodejs:24` depuis le module Rocky, puis `nodejs npm gcc-c++ make sqlite
python3 dnf-automatic dnf-plugins-core policycoreutils-python-utils`. Aucun build
frontend. Pour Caddy : `dnf copr enable @caddy/caddy`, puis `dnf install caddy`.
Installer le binaire stable Authelia dans `/usr/local/bin/authelia` (root:root,
0755), depuis ses releases officielles, après vérification de `checksums.sha256`.
Versions validées : Node 24.21, Caddy 2.11.7, Authelia 4.39.28.

Créer les comptes `workoutbuddy` et `authelia` avec `useradd --system --shell
/sbin/nologin --home-dir /var/lib/NOM NOM`. Créer `/var/lib/NOM` en 0700,
appartenant au compte correspondant ; `/etc/authelia` en 0750 root:authelia,
`/etc/workoutbuddy` en 0750 root:workoutbuddy, `/var/backups/workoutbuddy` en
0700 root:root, `/var/log/caddy` en 0750 caddy:caddy.

Copier le code validé dans `/usr/local/lib/workoutbuddy`, root:root, sans écriture
pour le service. Y lancer `npm ci --omit=dev` puis `node scripts/download-vendors.js`.
Les données restent exclusivement dans `/var/lib/workoutbuddy`.

Définir le domaine non secret dans `$DOMAINE`, puis rendre les modèles hors dépôt :
`python3 deploy/rocky/render.py "$DOMAINE" /root/wb-config`.
**Ne pas régénérer les clés d'une installation existante**, notamment celle qui
chiffre les secrets TOTP. Installer les fichiers ainsi :

| Source | Destination / droits |
| --- | --- |
| rendu `authelia.yml`, `users.yml` | `/etc/authelia/configuration.yml`, `/etc/authelia/users.yml`, 0640 root:authelia |
| rendu `environment` | `/etc/workoutbuddy/environment`, 0600 root:root |
| rendu `Caddyfile` | `/etc/caddy/Caddyfile`, 0644 root:root |
| rendu `workoutbuddy-auth-setup` | `/usr/local/sbin/`, 0700 root:root |
| modèle `workoutbuddy-backup` | `/usr/local/sbin/`, 0750 root:root |
| modèles `*.service`, `*.timer` | `/etc/systemd/system/`, 0644 root:root |
| `caddy-hardening.conf` | `/etc/systemd/system/caddy.service.d/zzz-lxc-service.conf` |
| `service-hardening.conf` | même nom pour les services workoutbuddy et authelia |
| `workoutbuddy-isolation.conf` | `/etc/systemd/system/workoutbuddy.service.d/zzzz-isolation.conf` |

Les drop-ins rétablissent des protections parfois remplacées par l'hébergeur.
Vérifier les valeurs effectives avec `systemctl show`. Le drop-in d’isolation
WorkoutBuddy protège aussi l’horloge, les journaux noyau, le nom d’hôte et `/proc`,
interdit la création d’espaces de noms et filtre les appels système privilégiés.
Il désactive les core dumps. Garder les mappings exécutables nécessaires au JIT
de Node et le réseau sortant nécessaire au Coach IA. Tester les protections dans
une instance à base jetable avant application sur un autre hôte. Sous SELinux enforcing,
installer `selinux-policy-targeted`, appliquer `restorecon` aux chemins installés,
vérifier `ps -eZ` et les AVC après les parcours. Le paquet Caddy fournit sa politique.
N'ajouter que les permissions justifiées ; aucune politique générale `audit2allow`.

Valider `authelia config validate --config /etc/authelia/configuration.yml` et
`caddy validate --config /etc/caddy/Caddyfile`, puis `systemctl daemon-reload` et
`systemctl enable --now workoutbuddy authelia caddy workoutbuddy-backup.timer`.
Vérifier le démarrage complet avant la première sauvegarde. Node écoute uniquement
sur 127.0.0.1:3000, Authelia sur 127.0.0.1:9091, l'administration Caddy sur 127.0.0.1:2019.

Caddy applique HSTS (un an), `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, supprime `Server` et `X-Powered-By` et fournit
une Permissions Policy par défaut. Les CSP de l’application (Vue) et d’Authelia
(avec nonce) sont conservées ; une CSP restrictive de secours est prévue pour
les réponses sans politique. Vérifier les en-têtes réellement reçus, pas seulement
le Caddyfile, après chaque modification.

Avant d'activer firewalld : autoriser **le port SSH réellement utilisé**, HTTP/TCP
et HTTPS/TCP dans la zone de l'interface ; retirer les autres ouvertures. Prévoir
un retour automatique temporaire, vérifier SSH puis désarmer ce retour. Ne pas
modifier SSH simultanément. Les modèles supposent le port 22 : l'adapter si besoin.

## Compte et MFA, uniquement dans votre terminal

Exécuter `sudo /usr/local/sbin/workoutbuddy-auth-setup` en SSH interactif : identifiant,
mot de passe unique et varié de 20 caractères minimum, deux saisies masquées.
Le script sauvegarde, calcule Argon2id sans secret en argument ou environnement,
active le compte et redémarre Authelia. Le compte provisoire reste désactivé avant cela.

Ouvrir `https://auth.DOMAINE`, se connecter et demander l'enregistrement TOTP.
Lire le lien de vérification **dans votre terminal SSH uniquement** :
`sudo cat /var/lib/authelia/notifications.txt`. L'ouvrir, scanner le QR dans votre
authentificateur et confirmer un code. Aucun SMTP ni adresse personnelle requis.
Tronquer ensuite ce fichier privé. Ne transmettre aucun secret par messagerie.
Tester en fenêtre privée : mot de passe seul insuffisant, accès après TOTP,
puis déconnexion via `https://auth.DOMAINE/logout`. Sessions : 15 min d'inactivité,
1 h maximum, sans mémorisation. Les flux IA sont authentifiés à l'ouverture et
limités à 30 secondes côté fournisseur ; une déconnexion ne coupe pas un flux
existant, mais interdit les requêtes suivantes. Arrêter Node pour couper immédiatement.

## Sauvegardes et administration

Le timer crée chaque nuit des sauvegardes SQLite cohérentes des deux bases,
contrôle `integrity_check`, archive leur configuration et garde **7 instantanés**
dans `/var/backups/workoutbuddy`, root uniquement. Les sauvegardes internes de
l'application sont distinctes et limitées à sept fichiers. Les archives contiennent
des données privées et les clés nécessaires au déchiffrement : les protéger.
Les copies sur le même VPS ne couvrent pas sa perte ou sa compromission.
Depuis votre ordinateur, adapter l'utilisateur et le port SSH :

```sh
umask 077
ssh root@VPS 'tar -C /var/backups -czf - workoutbuddy' > workoutbuddy-backups.tar.gz
```

Garder l'archive sur un disque chiffré. Pour restaurer : sauvegarder l'état courant,
arrêter Node et Authelia, extraire un instantané **dans un répertoire isolé**,
contrôler les deux bases avec `sqlite3 COPIE 'PRAGMA integrity_check;'`, démarrer
une instance isolée (`DB_PATH` vers la copie, loopback et autre port). Restaurer
ensuite bases et configuration correspondante, avec propriétaires et modes initiaux.
Déplacer l'ancien ensemble SQLite, WAL/SHM compris, avant remplacement. Redémarrer
et vérifier l'application et le MFA. Aucun essai destructif sur la base personnelle.

- État : `systemctl status workoutbuddy authelia caddy firewalld fail2ban`.
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
- Dans `/etc/dnf/automatic.conf` : `upgrade_type = security`, `download_updates = yes`,
  `apply_updates = yes`, `reboot = never`. Activer `dnf-automatic.timer` et lancer
  `dnf upgrade --security`. Surveiller aussi les mises à jour Node/Caddy et les
  releases Authelia, qui n'ont pas toutes de métadonnées errata. Sauvegarder avant
  changement de binaire ou migration ; aucun redémarrage du VPS sans accord.
- En LXC, l'hôte gère l'horloge : pas de contournement d'`adjtimex`. Chrony peut
  rester absent ; vérifier l'écart NTP sans modifier l'heure et faire intervenir
  l'hébergeur en cas de dérive, car le TOTP en dépend.

Validation avant mise à jour : `npm ci && npm test` dans la copie source ; parcours
isolés selon `tests/e2e/README.md`. Vérifier TLS/HTTP 308, UI/API/export/IA/service
worker protégés, en-têtes forgés, Host alternatif et ports directs. Tester MFA,
déconnexion, expiration, import/export/sauvegarde sur base jetable derrière le proxy,
redémarrages et restauration. Le Coach IA reste désactivé sans fournisseur gratuit
explicitement choisi ; aucun appel réel ne peut être validé sans configuration.
