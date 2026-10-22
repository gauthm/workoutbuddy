# Rocky Linux 9 : déploiement personnel

[Accueil de la documentation](INDEX.md) · [README](../README.md)

Architecture gratuite : **Caddy → Authelia (mot de passe + TOTP) → Node 24 / SQLite**. Les sessions
Authelia sont conservées dans une instance Redis privée et persistante. Les modèles sont dans
`deploy/rocky/`. Exécuter les opérations système comme root.

## Préparation

- Lire `docs/AGENT.md`, `README.md`, `package.json`, `.env.example`. Examiner
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

### Paquets et versions

Installer `nodejs:24` depuis le module Rocky, puis `nodejs npm gcc-c++ make sqlite python3 redis
dnf-automatic dnf-plugins-core policycoreutils-python-utils`. Aucun build frontend. Pour Caddy :
`dnf copr enable @caddy/caddy`, puis `dnf install caddy`. Installer le binaire stable Authelia dans
`/usr/local/bin/authelia` (root:root, 0755), depuis ses releases officielles, après vérification de
`checksums.sha256`.

Versions validées : Node 24.21, Caddy 2.11.7, Authelia 4.39.28.

### Comptes et répertoires

Créer les comptes `workoutbuddy` et `authelia` avec `useradd --system --shell /sbin/nologin
--home-dir /var/lib/NOM NOM`. Créer `/var/lib/NOM` en 0700, appartenant au compte correspondant ;
`/etc/authelia` en 0750 root:authelia, `/etc/workoutbuddy` en 0750 root:workoutbuddy,
`/var/backups/workoutbuddy` en 0700 root:root, `/var/log/caddy` en 0750 caddy:caddy.

Créer aussi `groupadd --system workoutbuddy-sessions` ; le paquet Redis fournit son compte système.
L’instance générique `redis.service` reste désactivée.

### Installer l’application

Copier le code validé dans `/usr/local/lib/workoutbuddy`, root:root, sans écriture pour le service.
Y lancer `npm ci --omit=dev`, `node scripts/download-vendors.js` et `node
scripts/download-exercise-images.js`. Les données restent exclusivement dans
`/var/lib/workoutbuddy`.

### Configuration et droits

Définir le domaine non secret dans `$DOMAINE`, puis rendre les modèles hors dépôt : `python3
deploy/rocky/render.py "$DOMAINE" /root/wb-config`. **Ne pas régénérer les clés d'une installation
existante**, notamment celle qui chiffre les secrets TOTP. Installer les fichiers ainsi :

| Source | Destination / droits |
| --- | --- |
| rendu `authelia.yml`, `users.yml` | `/etc/authelia/configuration.yml`, `/etc/authelia/users.yml`, 0640 root:authelia |
| rendu `environment` | `/etc/workoutbuddy/environment`, 0600 root:root |
| rendu `Caddyfile` | `/etc/caddy/Caddyfile`, 0644 root:root |
| rendu `workoutbuddy-auth-setup` | `/usr/local/sbin/`, 0700 root:root |
| rendu `workoutbuddy-sessions.conf` | `/etc/redis/workoutbuddy-sessions.conf`, 0640 root:workoutbuddy-sessions |
| modèle `workoutbuddy-backup` | `/usr/local/sbin/`, 0750 root:root |
| `workoutbuddy-deploy-assets`, `workoutbuddy-maintenance` | `/usr/local/sbin/`, 0750 root:root |
| modèles `*.service`, `*.timer` | `/etc/systemd/system/`, 0644 root:root |
| `caddy-hardening.conf` | `/etc/systemd/system/caddy.service.d/zzz-lxc-service.conf` |
| `service-hardening.conf` | même nom pour les services workoutbuddy, authelia et workoutbuddy-sessions |
| `workoutbuddy-isolation.conf` | `/etc/systemd/system/workoutbuddy.service.d/zzzz-isolation.conf` |
| `authelia-sessions.conf` | `/etc/systemd/system/authelia.service.d/workoutbuddy-sessions.conf` |

### Isolation et SELinux

Les drop-ins rétablissent des protections parfois remplacées par l'hébergeur. Vérifier les valeurs
effectives avec `systemctl show`. Le drop-in d’isolation WorkoutBuddy protège aussi l’horloge, les
journaux noyau, le nom d’hôte et `/proc`, interdit la création d’espaces de noms et filtre les
appels système privilégiés. Il désactive les core dumps.

Garder les mappings exécutables nécessaires au JIT de Node et le réseau sortant nécessaire au Coach
IA. Tester les protections dans une instance à base jetable avant application sur un autre hôte.
Sous SELinux enforcing, installer `selinux-policy-targeted`, appliquer `restorecon` aux chemins
installés, vérifier `ps -eZ` et les AVC après les parcours. Le paquet Caddy fournit sa politique.

N'ajouter que les permissions justifiées ; aucune politique générale `audit2allow`.

### Démarrer et valider les services

Valider `authelia config validate --config /etc/authelia/configuration.yml` et `caddy validate
--config /etc/caddy/Caddyfile`, puis `systemctl daemon-reload` et `systemctl enable --now
workoutbuddy workoutbuddy-sessions authelia caddy workoutbuddy-backup.timer`. Vérifier le démarrage
complet avant la première sauvegarde.

Node écoute uniquement sur 127.0.0.1:3000, Authelia sur 127.0.0.1:9091, l'administration Caddy sur
127.0.0.1:2019.

### En-têtes HTTP et CSP

Caddy applique HSTS (un an, `includeSubDomains`), `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, supprime `Server` et `X-Powered-By` et fournit une Permissions
Policy par défaut. Les CSP de l’application (Vue) et d’Authelia (avec nonce) sont conservées ; une
CSP restrictive de secours est prévue pour les réponses sans politique.

Vérifier les en-têtes réellement reçus, pas seulement le Caddyfile, après chaque modification.

La CSP de secours utilise le préfixe Caddy `?` : elle ne remplace ni la CSP Vue (qui exige encore
`unsafe-eval`) ni celle d’Authelia avec nonce. `{remote_host}` transmet l’adresse sans port ; ce
n’est pas `{remote}`. La politique `no-referrer` est compatible avec le flux testé : le retour
utilise une URL explicite.

Références : [en-têtes Caddy](https://caddyserver.com/docs/caddyfile/directives/header),
[placeholders](https://caddyserver.com/docs/caddyfile/concepts#placeholders).

### Pare-feu et accès SSH

Avant d'activer firewalld : autoriser **le port SSH réellement utilisé**, HTTP/TCP et HTTPS/TCP dans
la zone de l'interface ; retirer les autres ouvertures. Prévoir un retour automatique temporaire,
vérifier SSH puis désarmer ce retour. Ne pas modifier SSH simultanément. Les modèles supposent le
port 22 : l'adapter si besoin.

## Guides complémentaires

- [Compte, MFA et sessions](AUTHENTIFICATION.md)
- [Sauvegardes, administration et maintenance nocturne](DEPLOYMENT_OPERATIONS.md)
- [Livraison de l’interface](DEPLOYMENT_RELEASES.md)
- [Résultats de validation du déploiement](DEPLOYMENT_VALIDATION.md)
