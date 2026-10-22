# Installation Linux : configuration commune

[Accueil de la documentation](INDEX.md) · [README](../README.md)

Architecture gratuite : **Caddy → Authelia (mot de passe + TOTP) → Node 24 / SQLite**. Les sessions
Authelia sont conservées dans une instance Redis privée et persistante. Les modèles sont dans
`deploy/linux/redhat-based/` et `deploy/linux/debian-based/`. Exécuter les opérations système comme root.

Pour une installation conteneurisée, utiliser le [guide Docker](DEPLOYMENT_DOCKER.md).

Choisir d’abord les paquets et protections du guide [Red Hat](DEPLOYMENT_REDHAT.md) ou
[Debian/Ubuntu](DEPLOYMENT_DEBIAN.md), puis suivre cette procédure commune.
Définir `WB_DEPLOY_DIR=deploy/linux/redhat-based` ou `WB_DEPLOY_DIR=deploy/linux/debian-based`
dans le terminal utilisé pour les commandes.

## Préparation

- Lire `AGENTS.md`, `README.md`, `package.json`, `.env.example`. Examiner
  `systemd-detect-virt`, `free -m`, `df -h /`, `ss -lntup`,
  `sshd -t`, `sshd -T` et le pare-feu de la distribution. Garder une session SSH ouverte.
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

### Comptes et répertoires

Créer les comptes `workoutbuddy` et `authelia` avec `useradd --system --shell /usr/sbin/nologin
--home-dir /var/lib/NOM NOM`. Créer `/var/lib/NOM` en 0700, appartenant au compte correspondant ;
`/etc/authelia` en 0750 root:authelia, `/etc/workoutbuddy` en 0750 root:workoutbuddy,
`/var/backups/workoutbuddy` en 0700 root:root, `/var/log/caddy` en 0750 caddy:caddy.

Créer aussi `groupadd --system workoutbuddy-sessions` ; le paquet Redis fournit son compte système.
Sur cette installation dédiée, rendre le dossier de configuration accessible au groupe privé :

```sh
install -d -o root -g workoutbuddy-sessions -m 0750 /etc/redis
```

Le fichier `workoutbuddy-sessions.conf` est root:workoutbuddy-sessions, 0640.
Désactiver l’instance générique du paquet (`redis.service`, `redis-server.service` ou
`valkey.service` suivant la distribution) si elle n’a aucun autre usage. Le service privé
`workoutbuddy-sessions` reste indépendant.

Avec Valkey, installer `valkey-sessions.conf` en
`/etc/systemd/system/workoutbuddy-sessions.service.d/valkey.conf`. Ce drop-in choisit
le compte `valkey` et `/usr/bin/valkey-server` ; le groupe privé reste
`workoutbuddy-sessions`. Créer `/etc/redis` avec les droits requis même si Redis
n’est pas installé : ce chemin commun est utilisé aussi par les sauvegardes et Authelia.

### Installer l’application

Copier le code validé dans `/usr/local/lib/workoutbuddy`, root:root, sans écriture pour le service.
Y lancer `npm ci --omit=dev`, `node scripts/download-vendors.js` et `node
scripts/download-exercise-images.js`. Les données restent exclusivement dans
`/var/lib/workoutbuddy`.

### Configuration et droits

Définir le domaine non secret dans `$DOMAINE`, puis rendre les modèles hors dépôt : `python3 "$WB_DEPLOY_DIR/render.py" "$DOMAINE" /root/wb-config`. **Ne pas régénérer les clés d'une installation
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
| `valkey-sessions.conf` (si Valkey) | `/etc/systemd/system/workoutbuddy-sessions.service.d/valkey.conf` |
| `service-hardening.conf` | même nom pour les services workoutbuddy, authelia et workoutbuddy-sessions |
| `workoutbuddy-isolation.conf` | `/etc/systemd/system/workoutbuddy.service.d/zzzz-isolation.conf` |
| `authelia-sessions.conf` | `/etc/systemd/system/authelia.service.d/workoutbuddy-sessions.conf` |

### Vérifier les prérequis

```sh
python3 "$WB_DEPLOY_DIR/check-platform.py"
```

Ce contrôle en lecture vérifie la famille Linux, Python 3.9+, Node 24, systemd 247+,
les exécutables et le gestionnaire de paquets. Il ne valide pas une installation complète.

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

## Guides complémentaires

- [Compte, MFA et sessions](AUTHENTIFICATION.md)
- [Sauvegardes, administration et maintenance nocturne](DEPLOYMENT_OPERATIONS.md)
- [Livraison de l’interface](DEPLOYMENT_RELEASES.md)
- [Résultats de validation du déploiement](DEPLOYMENT_VALIDATION.md)

## Vérifications des variantes

```sh
python3 deploy/linux/redhat-based/test-maintenance.py
python3 deploy/linux/debian-based/test-maintenance.py
python3 deploy/linux/test-deployment.py
```

Les tests de maintenance simulent les transactions, erreurs de sauvegarde, redémarrages
et limites horaires sans exécuter DNF/APT ni systemctl. Le test commun vérifie le rendu
privé des configurations, la détection de famille et la parité des fichiers partagés.

Le test TLS/MFA peut être lancé avec la variante choisie :

```sh
python3 "$WB_DEPLOY_DIR/test-auth-sessions.py"
```

Il démarre de vrais services sur des ports et bases temporaires. Avec `WB_PLAYWRIGHT_PATH`,
il ajoute le contrôle navigateur mobile de récupération du worker et de déconnexion.
Les prérequis des tests sont décrits dans [Authentification](AUTHENTIFICATION.md).
Ces tests ne remplacent pas un essai d’installation sur chaque distribution cible.
