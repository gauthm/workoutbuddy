# Déploiement sur la famille Red Hat

[Documentation](INDEX.md) · [Installation commune](DEPLOYMENT_LINUX.md) · [Debian/Ubuntu](DEPLOYMENT_DEBIAN.md)

## Périmètre

Modèles : `deploy/redhat-based/`. Cette variante vise les distributions maintenues de la famille
RHEL/Fedora (Red Hat Enterprise Linux, Rocky, AlmaLinux, CentOS Stream, Oracle Linux, Fedora
et dérivées fournissant les prérequis). Elle utilise DNF 4 ou DNF 5 et RPM.

Prérequis : **systemd 247+, Python 3.9+, Node 24**, Caddy, Authelia et Redis ou Valkey.
Les systèmes anciens avec seulement YUM, les systèmes sans systemd et les distributions
arrivées en fin de vie ne sont pas couverts. Le contrôle `check-platform.py` refuse
les prérequis incompatibles : le nom de la distribution ne suffit pas à garantir le support.

Rocky Linux 9 est l’hôte historiquement validé. Les autres variantes ont des tests de scripts
isolés ; elles nécessitent encore une validation complète sur leur propre VM avant usage.
Les résultats historiques restent dans [Validation du déploiement](DEPLOYMENT_VALIDATION.md).

## Paquets

```sh
dnf install gcc-c++ make sqlite python3 tzdata curl ca-certificates
```

Installer Node.js **24.x** et npm via le dépôt signé de la distribution ou un fournisseur
compatible avec cette version. Sur une distribution proposant le module `nodejs:24`,
il est possible d’utiliser `dnf module install nodejs:24` ; cette commande n’est pas
universelle et n’est pas utilisée par les scripts. Vérifier `/usr/bin/node --version`
et `/usr/bin/npm --version`. Maintenir la branche majeure 24 dans la configuration du
dépôt/module ; si cette garantie n’est pas possible, exclure `nodejs*` des mises à jour
DNF et mettre Node à jour séparément après tests.

Pour DNF 4, installer `dnf-plugins-core` ; pour DNF 5, installer `dnf5-plugins`.
Vérifier `dnf needs-restarting --help` : le plugin doit fournir `-r` et `-s`.
La maintenance accepte les codes de retour 0 et 1 de DNF 5 pour la liste des services.
Voir les documentations [DNF 4](https://dnf-plugins-core.readthedocs.io/en/latest/needs_restarting.html)
et [DNF 5](https://dnf5.readthedocs.io/en/latest/dnf5_plugins/needs_restarting.8.html).

Installer `redis` ou `valkey` selon les dépôts disponibles. Installer Caddy depuis son
[dépôt officiel pour la distribution](https://caddyserver.com/docs/install#fedora-redhat-centos),
avec le plugin COPR de DNF adapté. L’activation de `@caddy/caddy` est une option fournie
par Caddy ; certains dérivés nécessitent un autre dépôt signé compatible.

Installer le binaire Authelia adapté à l’architecture dans `/usr/local/bin/authelia`,
root:root 0755, depuis ses releases officielles, après vérification de `checksums.sha256`.
Versions historiquement validées sur Rocky : Node 24.21, Caddy 2.11.7, Authelia 4.39.28.

## Configuration de l’application

Suivre l’[installation commune](DEPLOYMENT_LINUX.md) avec :

```sh
WB_DEPLOY_DIR=deploy/redhat-based
```

Les chemins installés et les données existantes sont conservés ; le renommage dans Git
ne requiert pas de réinstallation d’une application déjà en production.

## Isolation et SELinux

Les drop-ins rétablissent des protections parfois remplacées par l'hébergeur. Vérifier les valeurs
effectives avec `systemctl show`. Le drop-in d’isolation WorkoutBuddy protège aussi l’horloge, les
journaux noyau, le nom d’hôte et `/proc`, interdit la création d’espaces de noms et filtre les
appels système privilégiés. Il désactive les core dumps.

Garder les mappings exécutables nécessaires au JIT de Node et le réseau sortant nécessaire au Coach
IA. Tester les protections dans une instance à base jetable avant application sur un autre hôte.
Sous SELinux enforcing, installer `selinux-policy-targeted`, appliquer `restorecon` aux chemins
installés, vérifier `ps -eZ` et les AVC après les parcours. Le paquet Caddy fournit sa politique.

N'ajouter que les permissions justifiées ; aucune politique générale `audit2allow`.

## Pare-feu et accès SSH

Avant d'activer firewalld : autoriser **le port SSH réellement utilisé**, HTTP/TCP et HTTPS/TCP dans
la zone de l'interface ; retirer les autres ouvertures. Prévoir un retour automatique temporaire,
vérifier SSH puis désarmer ce retour. Ne pas modifier SSH simultanément. Les modèles supposent le
port 22 : l'adapter si besoin.

Le modèle Fail2ban `sshd-jail.local` utilise `firewallcmd-rich-rules` : installer
firewalld si ce modèle est retenu, ou adapter son action au pare-feu effectif.

## Maintenance

Utiliser les unités autonomes `workoutbuddy-maintenance.service` et
`workoutbuddy-maintenance.timer`. La maintenance appelle `dnf -y upgrade --refresh` et
`dnf needs-restarting` ; elle ne dépend ni des modules RHEL, ni de `dnf-automatic`.

Les anciens fichiers `dnf-automatic*.conf` restent disponibles pour une installation DNF 4
existante. Ils ne sont pas requis sur Fedora/DNF 5. Ne pas activer deux planificateurs :
la [procédure de maintenance](DEPLOYMENT_OPERATIONS.md) décrit la migration et les tests.
