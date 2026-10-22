# Déploiement sur Debian, Ubuntu et dérivées

[Documentation](INDEX.md) · [Installation commune](DEPLOYMENT_LINUX.md) · [Red Hat](DEPLOYMENT_REDHAT.md)

## Périmètre

Modèles : `deploy/linux/debian-based/`. Prérequis : distribution Debian/Ubuntu maintenue,
**systemd 247+, Python 3.9+, Node 24**, APT/dpkg, Caddy, Authelia et Redis ou Valkey.
Les dérivées doivent déclarer leur filiation via `ID`/`ID_LIKE` dans `/etc/os-release`
et fournir ces mêmes outils. Les systèmes sans systemd ne sont pas couverts.

Cette variante dispose de tests isolés des scripts et des configurations ; elle n’a pas
encore été validée de bout en bout sur une VM Debian ou Ubuntu. Le dossier Red Hat
reste distinct : aucun paquet RPM, module DNF ou configuration firewalld n’est requis ici.

## Paquets

```sh
apt-get update
apt-get install build-essential python3 sqlite3 redis-server needrestart tzdata curl ca-certificates gnupg
```

Installer Node.js **24.x** et npm depuis une source signée fournissant cette branche,
puis vérifier `/usr/bin/node --version` et `/usr/bin/npm --version`. Ne pas supposer
que la version Node proposée par défaut par chaque version Debian/Ubuntu convient.
Conserver une source/politique APT qui reste sur Node 24 ; à défaut, utiliser
`apt-mark hold nodejs` puis mettre Node à jour manuellement après tests.

Installer Caddy depuis le [dépôt stable officiel Debian/Ubuntu](https://caddyserver.com/docs/install#debian-ubuntu-raspbian),
en suivant ses instructions de clé de signature et de dépôt. Son paquet installe
l’unité `caddy.service`. Installer Authelia depuis ses releases officielles, avec
vérification de `checksums.sha256`, dans `/usr/local/bin/authelia` (root:root, 0755).

Si la distribution fournit Valkey, installer son paquet serveur à la place de Redis,
puis utiliser le drop-in `valkey-sessions.conf` décrit dans le guide commun.

## Configuration de l’application

Suivre l’[installation commune](DEPLOYMENT_LINUX.md) avec :

```sh
WB_DEPLOY_DIR=deploy/linux/debian-based
```

Les comptes, chemins et unités privés WorkoutBuddy sont les mêmes que pour Red Hat.
Le compte Redis est `redis`, son binaire `/usr/bin/redis-server`. Le service par défaut
Debian/Ubuntu est généralement `redis-server.service` : le désactiver s’il n’a pas d’autre
usage, sans désactiver `workoutbuddy-sessions.service`.

## Pare-feu et isolation

Conserver AppArmor si activé et les protections systemd fournies. Vérifier les refus
effectifs dans le journal ; adapter uniquement les règles nécessaires sur cet hôte.
Les drop-ins SELinux de l’installation Red Hat ne sont pas des prérequis Debian.

Avec UFW, autoriser le port SSH réel, puis 80/tcp et 443/tcp avant d’activer le pare-feu.
Avec nftables ou un pare-feu de l’hébergeur, appliquer les règles équivalentes.
Ne pas ouvrir 3000, 9091 ou Redis au réseau. Garder une session SSH ouverte et un moyen
de retour arrière ; ne pas changer le port SSH dans cette opération.

Le modèle `sshd-jail.local` utilise `nftables-multiport`, pas `firewallcmd`.
Pour l’utiliser, installer `fail2ban` et `nftables`, adapter le port SSH puis vérifier
`fail2ban-client -t` avant activation. Si une autre action est nécessaire pour le
pare-feu choisi, l’adapter explicitement.

## Maintenance APT

Les unités `workoutbuddy-maintenance.*` lancent la sauvegarde avant `apt-get update`
et `apt-get -y upgrade` (avec conservation des fichiers de configuration locaux par dpkg). Elles n’exécutent ni `dist-upgrade`, ni migration de release.
`needrestart -b -r l` signale les services périmés sans les redémarrer lui-même.
Le script relance seulement les services de l’application concernés.

La décision de redémarrage utilise `/run/reboot-required` et le statut du noyau de
`needrestart`, car le marqueur Ubuntu peut être absent sur Debian. Un statut inconnu
(par exemple le noyau de l’hôte LXC) ne déclenche pas de reboot automatique.
Voir le [format batch de needrestart](https://sources.debian.org/src/needrestart/3.4-5%2Bdeb10u1/README.batch.md/).

Installer la politique APT fournie après avoir choisi ce planificateur :

```sh
install -o root -g root -m 0644 deploy/linux/debian-based/apt-periodic.conf /etc/apt/apt.conf.d/99workoutbuddy-maintenance
```

Elle désactive l’exécution périodique APT et le reboot autonome d’unattended-upgrades.

Suivre la [procédure de maintenance](DEPLOYMENT_OPERATIONS.md) pour désactiver les
planificateurs APT concurrents. Les scripts de paquets peuvent relancer leurs propres
services pendant la transaction ; la fenêtre 04 h–06 h encadre son démarrage et la
décision de reboot, pas toute action interne à un paquet très long à installer.
