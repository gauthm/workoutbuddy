# Livrer une nouvelle version de l’interface

[Accueil de la documentation](INDEX.md) · [README](../README.md)

## Cache, authentification et mises à jour

Chaque changement de `public/` incrémente `CACHE_NAME` dans `sw.js`. Le service worker précharge les
fichiers statiques après contrôle d’accès, jamais l’HTML protégé. La navigation reste native pour
laisser le navigateur suivre Authelia ; un 401 API provoque aussi le retour au portail, tandis
qu’une vraie panne réseau garde `OFFLINE`.

Le worker `/sw.js` est public pour pouvoir remplacer un ancien worker même après expiration ;
`/auth/login` et `/auth/logout` sont des renvois publics au portail. Le manifeste et les seuls
fichiers d’icônes explicitement listés dans le matcher `@public_assets` sont publics pour les
navigateurs et l’installation iPhone sans cookie partagé. Ils ne contiennent aucune donnée
utilisateur.

L’interface, les autres assets et toute l’API restent authentifiés ; ne pas ouvrir `icons/*` ou
d’autres chemins par un joker. Un worker installé pendant une session expirée ne précharge aucun
asset privé et répare les fenêtres visibles déjà en cache. Caddy interdit le cache HTTP du
bootstrap, du worker et d’`offline.html`.

Au premier plan, l’application vérifie sa connexion et recherche une version au démarrage puis
toutes les cinq minutes. Les écrans de consultation se rechargent automatiquement ; une saisie ou
séance reporte ce rechargement et affiche un bouton avec confirmation.

### Publier les fichiers validés

Après les tests isolés, publier sans changer le code possédé par le compte de service : `sudo
/usr/local/sbin/workoutbuddy-deploy-assets /CHEMIN/DEPOT/public`. Installer d’abord les ressources
dans le clone avec `node scripts/download-vendors.js` et `node scripts/download-exercise-images.js`.
Le script de publication refuse une version dont des photos du catalogue sont absentes ou invalides.

Les JPEG restent servis localement et protégés par Authelia ; aucun chargement d’image vers GitHub
n’est nécessaire depuis le navigateur. Ce script root échange atomiquement deux dossiers `public/`,
garde l’ancienne copie dans `.public-release-*` pour retour arrière, et ne touche pas à SQLite.
Conserver une seule copie précédente après validation.

Sous SELinux enforcing, vérifier les contextes du staging et de la destination avant publication. Ce
script ne déploie que l’interface : les changements backend nécessitent une livraison du code
validé.

### Migrer un ancien worker

Lors de la migration depuis l’ancien worker sans mécanisme de rechargement, fermer puis rouvrir une
fois l’application peut être nécessaire ; ne pas effacer les données du site. Les versions suivantes
utilisent la détection automatique.

### Contrôles avant livraison

Validation avant mise à jour : `npm ci && npm test` dans la copie source ; parcours isolés selon
`docs/TESTS_E2E.md`. Vérifier TLS/HTTP 308, UI/API/export/IA protégés, worker public sans donnée
privée, en-têtes forgés, Host alternatif et ports directs. Tester MFA, déconnexion, expiration,
import/export/sauvegarde sur base jetable derrière le proxy, redémarrages et restauration.

Le Coach IA reste désactivé sans fournisseur gratuit explicitement choisi ; aucun appel réel ne peut
être validé sans configuration.
