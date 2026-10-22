# Documentation WorkoutBuddy

[README](../README.md) · [Licence](../LICENSE)

Les commandes et les chemins de code se lisent depuis la racine du dépôt. Les guides ci-dessous
conservent les détails du fonctionnement et de l’exploitation.

## Installer et utiliser

| Guide | Contenu |
| --- | --- |
| [Installation](INSTALLATION.md) | Prérequis, démarrage, bibliothèques et photos locales |
| [Programmes et calendrier](PROGRAMMES.md) | Questionnaire, priorités, activation, durée et navigation |
| [Exercices et matériel](EXERCICES_MATERIEL.md) | Catalogue, langues, inventaire, douleurs et remplacement |
| [Séances et progression](SEANCES_PROGRESSION.md) | Saisie, reprise, charges, calculs et historique |
| [Réglages et Coach IA](REGLAGES_COACH.md) | Profil, écran allumé, sauvegarde des réglages, chat et clé API |
| [Accès mobile](MOBILE.md) | Réseau local, écran d’accueil, gestes et mises à jour |
| [Données](DONNEES.md) | Export, import, sauvegarde, permissions et réinitialisations |

## Configurer et héberger

| Guide | Contenu |
| --- | --- |
| [Configuration du serveur](CONFIGURATION.md) | Variables d’environnement, protections HTTP et limites |
| [Famille Red Hat](DEPLOYMENT_REDHAT.md) | DNF 4/5, RPM, SELinux et firewalld |
| [Debian et Ubuntu](DEPLOYMENT_DEBIAN.md) | APT, dpkg, needrestart et pare-feu |
| [Installation Linux commune](DEPLOYMENT_LINUX.md) | Comptes, configurations privées, Caddy, Authelia et systemd |
| [Authentification](AUTHENTIFICATION.md) | Compte, TOTP, déconnexion, sessions Redis et tests isolés |
| [Exploitation et maintenance](DEPLOYMENT_OPERATIONS.md) | Sauvegardes, restauration, journaux, DNF/APT et audit npm |
| [Livrer l’interface](DEPLOYMENT_RELEASES.md) | Cache, publication atomique, ancienne version et vérifications |

## Développer et tester

| Guide | Contenu |
| --- | --- |
| [Développement](DEVELOPPEMENT.md) | Commandes, architecture et choix des tests |
| [Index du code](CODEBASE.md) | Fichiers par domaine, services, interface et tests |
| [Consignes de travail](AGENT.md) | Conventions, validation ciblée et déploiement après tests |
| [Tests navigateur](TESTS_E2E.md) | Playwright, domaines, isolation, rapports et limites |
| [Parcours métier](TESTS_JOURNEYS.md) | Sept parcours API, base en mémoire et couverture |
| [Tâches en cours](TASKS.md) | Travail restant ; historique des tâches terminées dans Git |

## Audits et résultats

Ces documents décrivent les contrôles effectués à leur date de rédaction.

| Document | Contenu |
| --- | --- |
| [Audit de fiabilité](RELIABILITY_AUDIT.md) | Défauts corrigés, simulations, résultats et limites |
| [Validation du déploiement](DEPLOYMENT_VALIDATION.md) | Interface, données, authentification et protections du serveur |
| [Vérification du dépôt public](REPOSITORY_SECURITY.md) | Recherche de secrets, historique Git et commande de contrôle |
