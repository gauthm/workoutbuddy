# Déployer WorkoutBuddy avec Docker

[Documentation](INDEX.md) · [Déploiement Linux natif](DEPLOYMENT_LINUX.md)

## Ce qui est fourni

- `deploy/docker/Dockerfile` : image Node 24, dépendances verrouillées, Vue/Chart.js et photos locales.
- `deploy/docker/compose.yaml` : application seule, accessible sur localhost.
- `deploy/docker/compose.production.yaml` : origine HTTPS obligatoire derrière un proxy authentifié.
- `deploy/docker/backup.mjs`, `restore.mjs` : sauvegarde SQLite cohérente et restauration hors ligne.

L’application tourne sous le compte `node` (UID/GID 1000), avec un système de fichiers en lecture
seule et un volume de données inscriptible. L’image ne contient ni la base personnelle, ni `.env`,
ni les dépendances de développement. Les ressources sont téléchargées pendant la construction,
pas au démarrage. Le script natif de `better-sqlite3` est explicitement autorisé pour
la version verrouillée ; la construction vérifie son chargement avant de produire l’image. La première construction demande un accès au registre Node, à npm, à GitHub
et au CDN des bibliothèques ; elle télécharge environ 101 Mio de photos.

## Prérequis

Installer [Docker Engine](https://docs.docker.com/engine/install/) et le
[plugin Docker Compose](https://docs.docker.com/compose/install/) sur l’hôte, ou Docker Desktop
sur macOS/Windows. Vérifier `docker version` et `docker compose version`.
Node/npm ne sont pas nécessaires sur l’hôte. Utiliser Compose avec prise en charge de `up --wait`.

Toutes les commandes suivantes partent de la racine du dépôt. Cette variante est indépendante
des unités systemd de `deploy/linux/` : ne pas installer ces unités dans les conteneurs.

## Démarrer en local

```sh
cp deploy/docker/.env.example deploy/docker/.env
```

Adapter `WB_PORT` dans ce fichier si le port 3000 est occupé.
`WB_TIMEZONE` règle les dates locales du serveur ; sa valeur par défaut est `Europe/Paris`. Définir ce raccourci dans le terminal :

```sh
wb() {
  docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml "$@"
}
wb config --quiet
wb build --pull
wb up -d --wait
wb ps
```

Ouvrir `http://localhost:3000`, ou le port choisi. Le port est publié uniquement sur `127.0.0.1`.
Le mode local utilise `NODE_ENV=development` pour autoriser HTTP ; le code de l’application et
les dépendances installées sont les mêmes qu’en production. Docker crée le volume nommé
`workoutbuddy_data`, avec les droits du compte de l’application.

L’application n’intègre pas d’authentification. Pour un accès depuis Internet ou un téléphone,
utiliser un proxy HTTPS authentifié ; le maintien du port Docker sur localhost évite une
exposition directe.

## Utiliser un domaine en production

Configurer d’abord le DNS, le certificat HTTPS et l’authentification externe du proxy.
Le couple Caddy/Authelia des [guides Linux](DEPLOYMENT_LINUX.md) peut servir de proxy sur l’hôte,
ou utiliser un proxy déjà administré. Cette composition ne démarre pas Caddy, Authelia ou Redis.

Dans `deploy/docker/.env`, renseigner l’origine exacte :

```dotenv
PUBLIC_ORIGIN=https://workout.example.com
```

Redéfinir le raccourci en ajoutant l’override de production, puis le garder pour les opérations suivantes :

```sh
wb() {
  docker compose --env-file deploy/docker/.env \
    -f deploy/docker/compose.yaml \
    -f deploy/docker/compose.production.yaml "$@"
}
wb config --quiet
wb up -d --build --wait
```

Le proxy sur l’hôte doit joindre `127.0.0.1:3000` (ou `WB_PORT`) et conserver le Host public.
Faire passer les pages, photos, assets privés et l’API par l’authentification. Pour Caddy/Authelia,
reprendre les règles de chemins publics explicites du modèle Linux et adapter la destination Node.
Ne pas exposer le port Docker directement ni ajouter une seconde route publique vers l’API.

`TRUST_PROXY` reste désactivé : un proxy hôte atteint généralement l’application via le bridge
Docker, pas via le loopback du conteneur. `PUBLIC_ORIGIN` fournit l’origine HTTPS et le Host
attendus. Avec un proxy lui-même conteneurisé, créer explicitement un réseau partagé privé,
utiliser le nom du service comme destination et conserver la protection d’accès du proxy.

Le contrôle de santé interroge l’API et SQLite sur le loopback interne avec le bon Host,
même si l’origine publique est un domaine HTTPS. Un état `unhealthy` est visible dans `wb ps` ;
la politique de redémarrage relance un processus arrêté, pas un processus simplement malsain.

## Mettre à jour

Recréer le raccourci `wb` du mode choisi dans chaque nouveau terminal. Garder le même nom de
projet Compose pour retrouver le même volume.

```sh
wb exec -T workoutbuddy node deploy/docker/backup.mjs
git pull --ff-only
wb build --pull
wb up -d --wait
wb logs --tail=100 workoutbuddy
```

Le volume est conservé lors d’une recréation. Les migrations et la synchronisation du catalogue
s’exécutent au démarrage. Avant une livraison, copier la sauvegarde hors du volume comme indiqué
ci-dessous. Conserver aussi l’image précédente si un retour arrière est nécessaire ; une ancienne
image peut nécessiter la sauvegarde de base antérieure à la migration.

Les modifications de l’interface doivent toujours incrémenter la version du service worker.
Le mécanisme habituel de mise à jour du navigateur reste actif.

## Sauvegarder

Lancer une sauvegarde avec le serveur en fonctionnement :

```sh
wb exec -T workoutbuddy node deploy/docker/backup.mjs
```

La commande affiche le chemin créé dans `/app/data/backups/`. Elle utilise le mécanisme SQLite
de l’application, incluant les transactions du WAL, et conserve les sept dernières copies.
Pour les sortir du volume :

```sh
umask 077
mkdir -p "$HOME/workoutbuddy-backups"
wb cp workoutbuddy:/app/data/backups/. "$HOME/workoutbuddy-backups/"
```

Les bases et leurs sauvegardes contiennent des données privées, dont la clé API configurée.
Les conserver hors Git et sur un support adapté. L’export JSON depuis l’interface reste disponible
et exclut la clé API. Planifier la commande de sauvegarde sur l’hôte si une copie périodique est souhaitée.

## Restaurer une sauvegarde SQLite

Arrêter d’abord l’application. Utiliser un fichier issu d’une sauvegarde SQLite cohérente :

```sh
wb stop workoutbuddy
wb run --rm --no-deps -T workoutbuddy node deploy/docker/restore.mjs < /chemin/backup.db
wb up -d --wait
```

Le programme vérifie l’intégrité et les tables attendues avant remplacement. Une entrée invalide
est refusée. Les anciens fichiers SQLite et journaux sont conservés ensemble dans un sous-dossier
`.restore-*` du volume ; ils ne sont pas supprimés automatiquement. Ne jamais exécuter cette
restauration pendant que le serveur utilise la base. Pour une reprise sur une autre machine,
construire l’image, créer le volume avec la commande `run`, restaurer, puis démarrer l’application.

## Arrêter et diagnostiquer

```sh
wb logs --tail=100 workoutbuddy
wb ps
wb stop
wb down
```

`down` conserve le volume. L’option `down -v` supprime les données : elle ne fait pas partie de la
procédure de mise à jour. L’arrêt accorde 35 secondes au drainage HTTP et à la fermeture SQLite.

## Vérifier une image

Après construction, avec Python 3 sur l’hôte :

```sh
python3 deploy/docker/test-docker.py --image workoutbuddy:local
```

Adapter le tag si `WB_IMAGE_TAG` a changé. Le test crée ses propres conteneurs et un volume neuf,
sans publier de port ni utiliser la base personnelle. Il vérifie l’API, le compte sans privilèges,
la lecture seule, les contrôles de santé local/production, la persistance après recréation,
l’arrêt propre, la sauvegarde et la restauration. Ses ressources sont supprimées à la fin.

Références : [construction Compose](https://docs.docker.com/reference/compose-file/build/),
[options des services](https://docs.docker.com/reference/compose-file/services/),
[image officielle Node](https://github.com/nodejs/docker-node).
