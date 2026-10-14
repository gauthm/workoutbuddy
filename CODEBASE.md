# Index du code

Installation, fonctionnement et tests : [README.md](README.md). Règles de développement : [AGENT.md](AGENT.md). Suivi : [TASKS.md](TASKS.md).

## Serveur et données

| Emplacement | Rôle |
| --- | --- |
| `server.js` | Démarrage, routes, fichiers statiques |
| `src/db/database.js` | Connexion SQLite |
| `src/db/migrate.js`, `src/db/migrations/` | Migrations |
| `src/db/backup.js` | Sauvegardes |
| `src/seed/` | Catalogue intégré et chargement |
| `scripts/` | Téléchargement des bibliothèques et import d’exercices |

## API — `/api/v1`

Tous les fichiers ci-dessous sont dans `src/routes/`.

| Domaine | Fichier |
| --- | --- |
| Exercices, historique, exclusions | `exercises.js` |
| Inventaire et charges disponibles | `equipment.js` |
| Création, activation, modification des programmes | `programs.js` |
| Séances types et remplacement d’exercices | `templates.js` |
| Séances, cibles, démarrage et complétion | `sessions.js` |
| Séries | `sets.js` |
| Statistiques et records | `stats.js` |
| Poids corporel | `bodyweight.js` |
| Préférences, sauvegarde groupée, connexion IA | `settings.js` |
| Profil | `userProfile.js` |
| Coach IA et conversations | `ai.js` |
| Exports, import, sauvegarde et réinitialisations | `exportImport.js` |

## Logique métier — `src/services/`

| Domaine | Fichiers |
| --- | --- |
| Création des programmes | `programGenerator.js`, `programPlanner.js`, `programExerciseCatalog.js` |
| Planification et durée | `sessionScheduler.js`, `programLifecycle.js` |
| Progression et mémoire des exercices | `progressionEngine.js`, `exerciseProgression.js`, `firstTimeSuggestion.js` |
| Remplacement et contraintes | `exerciseReplacement.js`, `exerciseConstraints.js`, `exerciseEquipment.js` |
| Bilans, allègement, stagnation | `programReview.js`, `deloadEngine.js`, `plateauDetector.js` |
| Matériel et calculs | `equipmentCalc.js`, `rmCalculator.js`, `personalRecords.js`, `streakCalculator.js` |
| Coach IA | `aiProvider.js`, `systemPromptBuilder.js`, `coachingAdvisor.js`, `adviceTextGenerator.js`, `actionStreamParser.js` |
| Utilitaires et compatibilité | `date.js`, `validation.js`, `rotationEngine.js` |

## Interface — `public/`

| Domaine | Emplacement |
| --- | --- |
| Initialisation, navigation, état, API, traductions | `js/app.js`, `js/router.js`, `js/store.js`, `js/api.js`, `js/i18n.js` |
| Accueil | `js/views/DashboardView.js` |
| Navigation et composants communs | `js/components/layout/`, `js/components/common/` |
| Exercices, douleurs, filtres | `js/components/exercises/` |
| Inventaire et registre du matériel | `js/components/equipment/` (`EquipmentEditor.js`, `inventoryCatalog.js`) |
| Questionnaire et fiche programme | `js/components/programs/` |
| Séance, séries, historique et repos | `js/components/session/`, `js/timer-worker*.js` |
| Calendrier, statistiques, coach, réglages | `js/components/calendar/`, `stats/`, `coach/`, `settings/` sous `js/components/` |
| RM, échauffement, douleurs, dates, dialogues | `js/utils/` |
| Styles, traductions, bibliothèques, cache | `css/`, `locales/`, `vendor/`, `sw.js` |

## Tests et documentation

| Emplacement | Contenu |
| --- | --- |
| `tests/unit/`, `tests/integration/` | Logique métier et API |
| `tests/journeys/` | Parcours complets ; [guide](tests/journeys/README.md) |
| `tests/helpers/` | Exécution isolée des requêtes |
| `tests/ui/` | Scénarios Playwright |
| `docs/` | Audits et suivis détaillés |
| `docs/plan/` | Plan initial et fiches de tâches |
