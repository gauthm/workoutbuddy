# Rocky Linux 9 : déploiement personnel

Architecture gratuite : **Caddy → Authelia (mot de passe + TOTP) → Node 24 / SQLite**.
Les sessions Authelia sont conservées dans une instance Redis privée et persistante.
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
python3 redis dnf-automatic dnf-plugins-core policycoreutils-python-utils`. Aucun build
frontend. Pour Caddy : `dnf copr enable @caddy/caddy`, puis `dnf install caddy`.
Installer le binaire stable Authelia dans `/usr/local/bin/authelia` (root:root,
0755), depuis ses releases officielles, après vérification de `checksums.sha256`.
Versions validées : Node 24.21, Caddy 2.11.7, Authelia 4.39.28.

Créer les comptes `workoutbuddy` et `authelia` avec `useradd --system --shell
/sbin/nologin --home-dir /var/lib/NOM NOM`. Créer `/var/lib/NOM` en 0700,
appartenant au compte correspondant ; `/etc/authelia` en 0750 root:authelia,
`/etc/workoutbuddy` en 0750 root:workoutbuddy, `/var/backups/workoutbuddy` en
0700 root:root, `/var/log/caddy` en 0750 caddy:caddy.
Créer aussi `groupadd --system workoutbuddy-sessions` ; le paquet Redis fournit
son compte système. L’instance générique `redis.service` reste désactivée.

Copier le code validé dans `/usr/local/lib/workoutbuddy`, root:root, sans écriture
pour le service. Y lancer `npm ci --omit=dev`, `node scripts/download-vendors.js`
et `node scripts/download-exercise-images.js`.
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
| rendu `workoutbuddy-sessions.conf` | `/etc/redis/workoutbuddy-sessions.conf`, 0640 root:workoutbuddy-sessions |
| modèle `workoutbuddy-backup` | `/usr/local/sbin/`, 0750 root:root |
| `workoutbuddy-deploy-assets`, `workoutbuddy-maintenance` | `/usr/local/sbin/`, 0750 root:root |
| modèles `*.service`, `*.timer` | `/etc/systemd/system/`, 0644 root:root |
| `caddy-hardening.conf` | `/etc/systemd/system/caddy.service.d/zzz-lxc-service.conf` |
| `service-hardening.conf` | même nom pour les services workoutbuddy, authelia et workoutbuddy-sessions |
| `workoutbuddy-isolation.conf` | `/etc/systemd/system/workoutbuddy.service.d/zzzz-isolation.conf` |
| `authelia-sessions.conf` | `/etc/systemd/system/authelia.service.d/workoutbuddy-sessions.conf` |

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
`systemctl enable --now workoutbuddy workoutbuddy-sessions authelia caddy workoutbuddy-backup.timer`.
Vérifier le démarrage complet avant la première sauvegarde. Node écoute uniquement
sur 127.0.0.1:3000, Authelia sur 127.0.0.1:9091, l'administration Caddy sur 127.0.0.1:2019.

Caddy applique HSTS (un an, `includeSubDomains`), `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, supprime `Server` et `X-Powered-By` et fournit
une Permissions Policy par défaut. Les CSP de l’application (Vue) et d’Authelia
(avec nonce) sont conservées ; une CSP restrictive de secours est prévue pour
les réponses sans politique. Vérifier les en-têtes réellement reçus, pas seulement
le Caddyfile, après chaque modification.

La CSP de secours utilise le préfixe Caddy `?` : elle ne remplace ni la CSP Vue
(qui exige encore `unsafe-eval`) ni celle d’Authelia avec nonce. `{remote_host}`
transmet l’adresse sans port ; ce n’est pas `{remote}`. La politique `no-referrer`
est compatible avec le flux testé : le retour utilise une URL explicite. Références :
[en-têtes Caddy](https://caddyserver.com/docs/caddyfile/directives/header),
[placeholders](https://caddyserver.com/docs/caddyfile/concepts#placeholders).

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
puis déconnexion depuis **Réglages → Se déconnecter**, ou via
`https://auth.DOMAINE/logout`. Le proxy annonce le bouton avec
`X-WorkoutBuddy-Logout: /auth/logout` et renvoie cette route vers le logout natif
d’Authelia. La session mémorisée est révoquée sans supprimer les données SQLite.
Sans **Se souvenir de moi** :
15 min d’inactivité et 1 h maximum. Avec cette case cochée sur un appareil de
confiance : connexion complète mémorisée pendant **60 jours**, sans expiration
par inactivité ; nouveau navigateur, cookie effacé, déconnexion ou expiration
imposent mot de passe et TOTP. Le cookie reste Secure, HttpOnly et SameSite=Lax.
Ce mécanisme ne mémorise pas séparément le MFA. Voir la
[configuration officielle](https://www.authelia.com/configuration/session/introduction/).

`workoutbuddy-sessions.service` utilise uniquement un socket Unix 0660, sous un
dossier 0750 accessible au groupe dédié d’Authelia. Aucun port TCP Redis. Le mot
de passe aléatoire du fournisseur est généré hors dépôt par `render.py` ; pour
une installation existante, l’ajouter sans changer les clés Authelia ni le compte.
Son stockage `/var/lib/workoutbuddy-sessions` est en 0700, avec AOF synchronisé
chaque seconde et limite Redis de 32 Mio. Le service est plafonné à 128 Mio de RAM
au total et 20 % d’un CPU. Au repos, sa consommation mesurée est d’environ 7 à 8 Mio.
Un arrêt propre conserve les sessions ; une coupure brutale peut perdre la dernière
seconde. Ne pas restaurer les anciennes
sessions depuis une sauvegarde : une restauration doit imposer une reconnexion.
Le test `python3 deploy/rocky/test-auth-sessions.py` utilise des services, secrets,
utilisateurs, TOTP et bases intégralement jetables, sur loopback ; il exige les
binaires Node, Caddy, Redis et Authelia, et ne touche pas aux comptes réels.
Avec `WB_PLAYWRIGHT_PATH` défini comme pour les E2E, il ajoute le test navigateur
HTTPS `test-auth-recovery.mjs` : ancien cache et installation du worker anonyme,
redirection effective vers Authelia sans blocage d’activation, puis déconnexion
par le bouton des réglages, annulation d’un brouillon et révocation de l’ancien
cookie mémorisé avec données sauvegardées inchangées. Les deux photos d’un exercice
sont aussi décodées derrière le véritable TLS, la CSP et le MFA. Aucun certificat
de test n’est ajouté au système ; le navigateur jetable accepte uniquement ce
test avec sa propre autorité locale et des noms `.test` résolus sur loopback.

Les flux IA sont authentifiés à l'ouverture et
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
ssh -t ADMIN@VPS 'umask 077; sudo tar -C /var/backups -czf - workoutbuddy > "$HOME/workoutbuddy-backups.tar.gz"'
scp ADMIN@VPS:workoutbuddy-backups.tar.gz .
```

La première commande demande le mot de passe sudo dans le terminal et prépare une
archive privée dans le home du compte SSH ; supprimer cette copie serveur après
transfert vérifié. Garder l'archive locale sur un disque chiffré. Pour restaurer : sauvegarder l'état courant,
arrêter Node et Authelia, extraire un instantané **dans un répertoire isolé**,
contrôler les deux bases avec `sqlite3 COPIE 'PRAGMA integrity_check;'`, démarrer
une instance isolée (`DB_PATH` vers la copie, loopback et autre port). Restaurer
ensuite bases et configuration correspondante, avec propriétaires et modes initiaux.
Déplacer l'ancien ensemble SQLite, WAL/SHM compris, avant remplacement. Redémarrer
et vérifier l'application et le MFA. Aucun essai destructif sur la base personnelle.

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

Installer `dnf-automatic.conf` dans `/etc/dnf/automatic.conf`, les deux modèles
`dnf-automatic-service.conf` et `dnf-automatic-timer.conf` dans les drop-ins
respectifs `/etc/systemd/system/dnf-automatic.service.d/workoutbuddy.conf` et
`dnf-automatic.timer.d/workoutbuddy.conf`. Le service utilise
`/usr/local/sbin/workoutbuddy-maintenance --apply` : sauvegarde réussie obligatoire,
mises à jour RPM stables, puis `dnf needs-restarting -r`. Les mises à jour incluent
Node dans le **module 24**, les paquets Rocky/EPEL et Caddy ; elles ne changent pas
de version majeure de Rocky ou Node. Ne pas activer un dépôt non fiable.

Le timer démarre entre **04:00 et 04:15, Europe/Paris**, y compris lors des changements
d’heure. Un redémarrage nécessaire est autorisé uniquement entre **04:00 et 06:00**.
Un traitement long reporte le redémarrage à la nuit suivante ; l’indicateur est
recontrôlé même sans nouveaux RPM. Un timer manqué ne se rattrape pas en journée.
Sans redémarrage complet, les services applicatifs utilisant un binaire ou une
bibliothèque mise à jour sont redémarrés ; Node nouvellement installé est ainsi
effectivement utilisé. En LXC, ce redémarrage concerne le conteneur : le noyau et
l’horloge de l’hôte restent sous la responsabilité de l’hébergeur.

DNF garde `reboot = never` car le script décide du redémarrage et de son horaire.
Ne pas appeler directement une variante `dnf-automatic-install.timer` en parallèle.
`workoutbuddy-maintenance --check` est strictement en lecture ; `--apply` change le
serveur seulement pendant la fenêtre nocturne. Tester le garde horaire sans effets
réels : `python3 deploy/rocky/test-maintenance.py`.

Créer `workoutbuddy-audit` avec `useradd --system --shell /sbin/nologin --home-dir
/var/cache/workoutbuddy-audit workoutbuddy-audit`, installer `workoutbuddy-audit.*`
dans `/etc/systemd/system/`, puis `service-hardening.conf` dans son drop-in
`zzz-lxc-service.conf`. Il peut lire le code, sans accès aux bases ni aux secrets.
L’audit npm hebdomadaire lit le lockfile de production le dimanche vers 05:30 ;
une vulnérabilité modérée ou supérieure fait échouer le service et apparaît dans
le journal. Une indisponibilité du registre fait également échouer le contrôle.
Il n’y a pas de notification externe configurée.

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

Pas de `npm update` ou `npm audit fix` automatique : mettre le lockfile à jour dans
le dépôt, tester puis installer avec `npm ci --omit=dev`. Le binaire Authelia est
hors RPM : vérifier ses releases officielles, sa configuration et les migrations,
sauvegarder puis tester avant remplacement. Il n’est pas mis à jour sans validation.

## Livraison de l’interface

Chaque changement de `public/` incrémente `CACHE_NAME` dans `sw.js`. Le service worker
précharge les fichiers statiques après contrôle d’accès, jamais l’HTML protégé.
La navigation reste native pour laisser le navigateur suivre Authelia ; un 401 API
provoque aussi le retour au portail, tandis qu’une vraie panne réseau garde `OFFLINE`.
Le worker `/sw.js` est public pour pouvoir remplacer un ancien worker même après
expiration ; `/auth/login` et `/auth/logout` sont des renvois publics au portail.
Le manifeste et les seuls fichiers d’icônes explicitement listés dans le matcher
`@public_assets` sont publics pour les navigateurs et l’installation iPhone sans
cookie partagé. Ils ne contiennent aucune donnée utilisateur. L’interface,
les autres assets et toute l’API restent authentifiés ; ne pas ouvrir `icons/*`
ou d’autres chemins par un joker.
Un worker installé pendant une session expirée ne précharge aucun asset privé et
répare les fenêtres visibles déjà en cache. Caddy interdit le cache HTTP du bootstrap,
du worker et d’`offline.html`. Au premier plan, l’application vérifie sa connexion et
recherche une version au démarrage puis
toutes les cinq minutes. Les écrans de consultation se rechargent automatiquement ;
une saisie ou séance reporte ce rechargement et affiche un bouton avec confirmation.

Après les tests isolés, publier sans changer le code possédé par le compte de service :
`sudo /usr/local/sbin/workoutbuddy-deploy-assets /CHEMIN/DEPOT/public`.
Installer d’abord les ressources dans le clone avec
`node scripts/download-vendors.js` et `node scripts/download-exercise-images.js`.
Le script de publication refuse une version dont des photos du catalogue sont
absentes ou invalides. Les JPEG restent servis localement et protégés par Authelia ;
aucun chargement d’image vers GitHub n’est nécessaire depuis le navigateur.
Ce script root échange atomiquement deux dossiers `public/`, garde l’ancienne copie
dans `.public-release-*` pour retour arrière, et ne touche pas à SQLite. Conserver
une seule copie précédente après validation. Sous SELinux enforcing, vérifier les
contextes du staging et de la destination avant publication. Ce script ne déploie
que l’interface : les changements backend nécessitent une livraison du code validé.

Lors de la migration depuis l’ancien worker sans mécanisme de rechargement, fermer
puis rouvrir une fois l’application peut être nécessaire ; ne pas effacer les données
du site. Les versions suivantes utilisent la détection automatique.

Validation avant mise à jour : `npm ci && npm test` dans la copie source ; parcours
isolés selon `tests/e2e/README.md`. Vérifier TLS/HTTP 308, UI/API/export/IA protégés,
worker public sans donnée privée, en-têtes forgés, Host alternatif et ports directs. Tester MFA,
déconnexion, expiration, import/export/sauvegarde sur base jetable derrière le proxy,
redémarrages et restauration. Le Coach IA reste désactivé sans fournisseur gratuit
explicitement choisi ; aucun appel réel ne peut être validé sans configuration.
