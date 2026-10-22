# Accès mobile et mises à jour

[Accueil de la documentation](INDEX.md) · [README](../README.md)

## Accès sur le réseau local

Dans **Réglages → Réglages avancés**, configurer l’hôte réseau sur `0.0.0.0`, enregistrer et
redémarrer le serveur. Depuis un téléphone sur le même réseau, ouvrir l’adresse IP locale de la
machine, par exemple `http://192.168.1.10:3000`. Le pare-feu doit autoriser le port choisi.

L’application est prévue pour un usage personnel sur un réseau de confiance : elle n’a pas
d’authentification et ne doit pas être exposée directement à Internet.

## Installation sur l’écran d’accueil

Le logo haltère apparaît dans l’onglet du navigateur et lors de **Partager → Sur l’écran d’accueil**
dans Safari. Une icône Apple PNG 180×180 et les icônes du manifeste 192/512 complètent le favicon
SVG/ICO.

Leur source est `public/icons/workoutbuddy.svg` ; `node scripts/generate-icons.js` régénère les
fichiers avec le Playwright déjà disponible pour les tests, sans dépendance ajoutée. iOS peut
conserver l’ancienne icône d’un raccourci déjà installé : si nécessaire, retirer ce raccourci et
l’ajouter à nouveau depuis Safari, sans effacer les données du site.

## Gestes et saisie

Sur mobile, le pincement et le double tap ne zooment plus la page ; le défilement tactile reste
natif et les champs compacts utilisent au moins 16 px pour éviter le zoom à la saisie de Safari. Les
options d’accessibilité du navigateur ou du système peuvent toutefois primer sur ces règles.

## Mises à jour et reconnexion

En HTTPS, Safari et l’application ajoutée à l’écran d’accueil vérifient les nouvelles versions à
l’ouverture, au retour au premier plan et toutes les cinq minutes pendant l’utilisation. Une version
complète se charge automatiquement sur un écran de consultation. Pendant une séance ou une saisie,
une notification propose **Mettre à jour**, avec confirmation avant de perdre une saisie non
enregistrée.

Aucun hard refresh ni effacement des données du site n’est nécessaire. Le cache accélère les
fichiers statiques, mais les navigations passent par le réseau : une session expirée renvoie vers le
portail d’authentification, sans interface hors ligne trompeuse. Les appels API distinguent aussi
une session expirée d’une panne réseau. Chaque livraison doit changer la version du cache.
