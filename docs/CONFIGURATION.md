# Configuration et protections du serveur

[Accueil de la documentation](INDEX.md) · [README](../README.md)

Les variables d’environnement priment sur les réglages enregistrés. Elles peuvent être définies dans
un fichier `.env` à la racine, en s’appuyant sur [.env.example](../.env.example).

| Variable | Valeur par défaut | Usage |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Adresse d’écoute |
| `PORT` | `3000` | Port HTTP |
| `DB_PATH` | `data/workoutbuddy.db` | Base SQLite, chemin relatif au lancement ou absolu |
| `NODE_ENV` | développement | `production` exige une origine HTTPS explicite |
| `PUBLIC_ORIGIN` | origine HTTP locale de la requête | URL publique exacte, par exemple `https://workout.example.com` |
| `TRUST_PROXY` | désactivé | `loopback` uniquement si le proxy est local, protégé et réécrit les en-têtes transmis |

Si `HOST` ou `PORT` figure dans `.env`, modifier le réglage correspondant dans l’interface ne
remplace pas cette variable. Redémarrer le serveur après un changement réseau. Configurer la clé du
Coach IA dans l’application.

### Protections HTTP et hébergement

### Origine et requêtes HTTP

Les réponses portent une politique CSP, des protections contre les iframes et le sniffing de contenu
et une politique de référent restrictive. Les données API ne sont pas mises en cache. Les appels API
avec une origine étrangère ou signalés comme provenant d’un autre site sont refusés ; les écritures
avec un corps exigent du JSON.

Sans `PUBLIC_ORIGIN`, seuls les hôtes `localhost` et les adresses IP sont acceptés pour bloquer le
DNS rebinding ; pour un nom local personnalisé, définir son origine HTTP exacte. Les clients sans
en-tête Origin (CLI et outils locaux) restent possibles : ces contrôles ne remplacent pas une
authentification.

### Politique de contenu

La CSP autorise `unsafe-eval` pour la compilation des templates Vue actuels et les styles en ligne
utilisés par l’interface ; les scripts en ligne sont interdits. Retirer `unsafe-eval` demanderait de
précompiler les templates. L’enregistrement du service worker est dans le module externe de
l’application. HSTS s’applique à l’origine HTTPS configurée ou à une connexion reconnue HTTPS, sans
forcer le HTTPS sur le LAN HTTP.

### Limites de requêtes

Limites par IP et par minute : 600 appels API ; dans ce total, 60 créations/aperçus de programme, 30
imports/sauvegardes/réinitialisations et 12 appels IA (chat, connexion, modèles, conseils). Deux
appels IA et une seule importation peuvent être en cours au maximum pour l’instance mono-utilisateur
; la réservation d’import intervient avant la lecture du corps volumineux.

Une réponse 429 indique `Retry-After` ; les limites coûtent une mémoire bornée et sont remises à
zéro au redémarrage. Les corps JSON sont limités à 100 Ko, sauf l’import à 20 Mo ; les corps
compressés sont refusés. Le serveur borne également les délais de réception des requêtes/en-têtes.

### Hébergement public

Sur un VPS, faire écouter Node sur `127.0.0.1`, derrière un proxy ou tunnel avec HTTPS **et une
authentification externe**. Définir `NODE_ENV=production` et
`PUBLIC_ORIGIN=https://workout.example.com`.

Le proxy doit conserver le champ Host public et rediriger HTTP vers HTTPS ; ne pas exposer
directement le port de Node. `TRUST_PROXY=loopback` permet de lire l’IP transmise uniquement depuis
un proxy local de confiance ; celui-ci doit supprimer ou réécrire les en-têtes fournis par le
client. Par défaut, les en-têtes de proxy ne sont pas utilisés. Ne pas exécuter l’application en
root.

### Versions et dépendances

Les dépendances serveur sont verrouillées dans `package-lock.json`. Vérifier avec `npm audit`,
installer avec `npm ci` et tester les mises à jour avant déploiement. La cible est Node 24 LTS ;
Node 20 n’est plus pris en charge.

### Hébergement Linux et sessions Authelia

Les guides [Red Hat](DEPLOYMENT_REDHAT.md), [Debian/Ubuntu](DEPLOYMENT_DEBIAN.md) et
[configuration commune](DEPLOYMENT_LINUX.md) décrivent l’hébergement public avec Caddy
et Authelia. Les deux familles disposent de sauvegardes, protections systemd et maintenance
nocturne propres à leur gestionnaire de paquets. Les dépendances npm restent auditées
chaque semaine et mises à jour après tests.

Sur un appareil de confiance, cocher **Se souvenir de moi** dans Authelia conserve la connexion
complète pendant 60 jours, y compris après maintenance. Sans cette option : 15 minutes d’inactivité,
une heure maximum. Une déconnexion invalide la session mémorisée ; le navigateur peut aussi
supprimer son cookie plus tôt.
