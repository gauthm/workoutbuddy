# WorkoutBuddy

Application locale de musculation pour un utilisateur, avec programmes personnalisés, suivi des séances et progression par exercice. Les algorithmes créent les programmes et calculent leur progression ; un Coach IA facultatif apporte des conseils.

Les données sont stockées dans SQLite sur la machine qui lance le serveur. Si le Coach IA est activé, les informations nécessaires à ses réponses sont envoyées au fournisseur configuré.

## Démarrer

Prérequis : **Node.js 24.x LTS et npm**. Sur macOS, SQLite peut nécessiter
les Xcode Command Line Tools (`xcode-select --install`).

```sh
git clone https://github.com/gauthm/workoutbuddy.git
cd workoutbuddy
npm ci
node scripts/download-vendors.js
node scripts/download-exercise-images.js
npm start
```

Ouvrir [localhost:3000](http://localhost:3000). Aucun build frontend.
Les bibliothèques et les photos sont installées une fois, puis servies localement.
Voir le [guide d’installation](docs/INSTALLATION.md) pour les détails.

## Documentation

| Besoin | Guide |
| --- | --- |
| Créer un programme, utiliser le calendrier | [Programmes](docs/PROGRAMMES.md) |
| Consulter les exercices, gérer le matériel et les douleurs | [Exercices et matériel](docs/EXERCICES_MATERIEL.md) |
| S’entraîner, choisir ses charges, suivre sa progression | [Séances et progression](docs/SEANCES_PROGRESSION.md) |
| Régler l’application et le Coach IA | [Réglages et Coach](docs/REGLAGES_COACH.md) |
| Utiliser un téléphone, installer l’application, recevoir les mises à jour | [Accès mobile](docs/MOBILE.md) |
| Sauvegarder, importer, exporter ou réinitialiser | [Données](docs/DONNEES.md) |
| Configurer le serveur ou héberger l’application | [Configuration](docs/CONFIGURATION.md) · [Red Hat](docs/DEPLOYMENT_REDHAT.md) · [Debian/Ubuntu](docs/DEPLOYMENT_DEBIAN.md) |
| Développer et tester | [Développement](docs/DEVELOPPEMENT.md) · [Index du code](docs/CODEBASE.md) · [Consignes](docs/AGENT.md) |

Toute la documentation, les audits et le suivi des tâches sont regroupés dans
[docs/INDEX.md](docs/INDEX.md).

L’application n’a pas d’authentification intégrée : utiliser un réseau de confiance
ou un proxy HTTPS avec authentification pour un accès Internet.
