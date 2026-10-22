# Installer WorkoutBuddy

[Accueil de la documentation](INDEX.md) · [README](../README.md)

## Prérequis

Prérequis : Node.js 24.x LTS (version sélectionnée dans `.nvmrc`) et npm. Sur macOS, installer les
Xcode Command Line Tools si nécessaires à la compilation de SQLite : `xcode-select --install`.

## Installer et démarrer

```sh
git clone https://github.com/gauthm/workoutbuddy.git
cd workoutbuddy
npm ci
node scripts/download-vendors.js
node scripts/download-exercise-images.js
npm start
```

Ouvrir [http://localhost:3000](http://localhost:3000). `npm start` lance le serveur et applique les
migrations et le catalogue intégré. Aucun build frontend n’est nécessaire. Les bibliothèques Vue et
Chart.js sont téléchargées une fois, puis servies localement.

## Photos des exercices

Les photos sont téléchargées une fois depuis
[free-exercise-db](https://github.com/yuhonas/free-exercise-db), à une révision figée, puis servies
localement avec l’application.

Le script récupère uniquement les 1 746 JPEG référencés par le catalogue : il reprend les fichiers
manquants, vérifie leur format et ne modifie ni le catalogue ni SQLite. `node
scripts/download-exercise-images.js --check` vérifie l’installation sans réseau. Ces fichiers
régénérables sont exclus de Git et doivent être installés sur chaque nouvelle machine.
