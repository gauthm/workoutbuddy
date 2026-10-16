# Index du code

Installation, fonctionnement et tests : [README.md](README.md). Règles de développement : [AGENT.md](AGENT.md). Suivi : [TASKS.md](TASKS.md).

## Serveur et données

| Emplacement | Rôle |
| --- | --- |
| `server.js` | Démarrage, routes, fichiers statiques |
| `src/db/database.js` | Connexion SQLite |
| `src/db/migrate.js`, `src/db/migrations/` | Migrations |
| `src/db/backup.js`, `src/db/privateStorage.js` | Sauvegardes et permissions privées SQLite |
| `src/seed/` | Catalogue source, traductions `exercises.fr.json`, chargement et synchronisation |
| `scripts/` | Téléchargement des bibliothèques et import d’exercices |
| `scripts/download-exercise-images.js` | Installation/reprise des photos à une révision source figée, contrôle hors ligne avec `--check`, sans import du catalogue ni accès SQLite |

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
| Planification et durée | `sessionScheduler.js`, `programLifecycle.js`, `programWeeklyProgress.js` |
| Progression et mémoire des exercices | `progressionEngine.js`, `exerciseProgression.js`, `firstTimeSuggestion.js`, `sessionReset.js`, `trainingHistory.js` |
| Remplacement et contraintes | `exerciseReplacement.js`, `exerciseConstraints.js`, `exerciseEquipment.js` |
| Bilans, allègement, stagnation | `programReview.js`, `deloadEngine.js`, `plateauDetector.js` |
| Matériel et calculs | `equipmentCalc.js`, `rmCalculator.js`, `personalRecords.js`, `streakCalculator.js` |
| Coach IA | `aiProvider.js`, `systemPromptBuilder.js`, `coachingAdvisor.js`, `adviceTextGenerator.js`, `actionStreamParser.js` |
| Sécurité HTTP | `httpSecurity.js` : en-têtes, origine, limites et configuration du proxy |
| Utilitaires et compatibilité | `date.js`, `validation.js`, `rotationEngine.js`, `catalogueCleanup.js` |

## Interface — `public/`

| Domaine | Emplacement |
| --- | --- |
| Initialisation, navigation, état, API, traductions | `js/app.js`, `js/router.js`, `js/store.js`, `js/api.js`, `js/i18n.js` |
| Détection des versions, protection des saisies et retour au portail après expiration | `js/appUpdates.js`, `js/api.js`, `js/components/common/AppUpdateBanner.js`, `sw.js` |
| Accueil sans défilement, objectif du formulaire et fréquence | `js/views/DashboardView.js`, styles `.dashboard-view` dans `css/components.css` |
| Calendrier ajustable et séances du jour paginées sur l’accueil | `js/components/calendar/CalendarView.js` ; priorité reprise/planifiées, liste complète sur le calendrier séparé |
| Navigation et composants communs | `js/components/layout/`, `js/components/common/` |
| Exercices, douleurs, filtres | `js/components/exercises/` (`ExerciseMotion.js` pour les photos animées) |
| Inventaire et registre du matériel | `js/components/equipment/` (`EquipmentEditor.js`, `inventoryCatalog.js`) |
| Questionnaire et fiche programme | `js/components/programs/` |
| Séance, séries, historique et repos | `js/components/session/`, `js/timer-worker*.js` |
| Calendrier, statistiques, coach, réglages | `js/components/calendar/`, `stats/`, `coach/`, `settings/` sous `js/components/` |
| Saisie du Coach ajustable jusqu’à 120 px, défilement au-delà et réduction après envoi | `js/components/coach/CoachView.js`, `.coach-view__input` dans `css/components.css` |
| Déconnexion Authelia avec confirmation | `js/components/settings/SettingsView.js`, `js/api.js`, route Caddy `/auth/logout` |
| RM, échauffement, douleurs, dates, dialogues | `js/utils/` |
| Styles, traductions, bibliothèques, cache | `css/`, `locales/`, `vendor/`, `sw.js` |
| Zoom tactile désactivé, défilement natif et champs mobiles sans zoom au focus | viewport dans `index.html`, `css/main.css`, `css/components.css` ; parcours dans `tests/e2e/security.spec.js` |
| Logo d’onglet et d’écran d’accueil | `icons/workoutbuddy.svg`, `favicon.ico`, `apple-touch-icon.png`, `icons/icon-*.png`, `manifest.json`, génération via `scripts/generate-icons.js` |

## Tests et documentation

| Emplacement | Contenu |
| --- | --- |
| `tests/unit/`, `tests/integration/` | Logique métier et API ; `reliabilityStress.test.js` pour les simulations de durée et incidents |
| `tests/journeys/` | Parcours complets ; [guide](tests/journeys/README.md) |
| `tests/helpers/` | Exécution isolée des requêtes |
| `tests/e2e/` | Parcours Playwright contre serveur et base isolés ; [guide](tests/e2e/README.md) |
| `tests/e2e/updates.spec.js` | Livraison sur copie isolée : rechargement, brouillon, panne réseau et proxy HTTP de session expirée, y compris ancien worker |
| `tests/e2e/authProxy.js`, `settings.spec.js` | Proxy HTTP jetable partagé, déconnexion avec confirmation et préservation des données |
| `tests/e2e/theme.spec.js`, `security.spec.js` | Contrastes du thème clair et séries validées ; liens et décodage des icônes, dimensions et opacité Apple/manifest |
| `tests/e2e/dashboard.spec.js` | Accueil sans scroll ni masquage sur six tailles/zones sûres, portrait/paysage, six semaines, tous les statuts, pagination, semaine complète ; cinq objectifs FR/EN |
| `tests/e2e/coach.spec.js` | Message court, Maj+Entrée, croissance jusqu’à la limite, défilement long, réduction après effacement/envoi ; aucune IA externe |
| `tests/ui/` | Scénarios visuels Playwright complémentaires |
| `docs/RELIABILITY_AUDIT.md` | Dernier audit : corrections, couverture et limites |
| `docs/DEPLOYMENT_ROCKY.md`, `deploy/rocky/` | Caddy/Authelia, systemd, sauvegardes et configuration reproductible Rocky |
| `deploy/rocky/workoutbuddy-maintenance`, `dnf-automatic-*.conf` | Sauvegarde avant mises à jour RPM, redémarrage conditionnel entre 4 h et 6 h, heure de Paris |
| `deploy/rocky/workoutbuddy-audit.*`, `test-maintenance.py` | Audit npm hebdomadaire et tests simulés de la maintenance, sans toucher au serveur |
| `deploy/rocky/workoutbuddy-deploy-assets` | Contrôle des photos obligatoires, publication atomique de l’interface et conservation de la version précédente |
| `deploy/rocky/workoutbuddy-sessions.*`, `authelia-sessions.conf` | Stockage Redis privé et persistant des sessions Authelia, par socket Unix |
| `deploy/rocky/test-auth-sessions.py`, `test-auth-recovery.mjs` | Test intégral jetable Caddy/Authelia/Redis/Node : TOTP, cookie 60 jours, persistance, révocation par le bouton Réglages, icônes publiques, en-têtes et activation HTTPS du worker |

Sécurité des contenus et de l’historique Git : [docs/REPOSITORY_SECURITY.md](docs/REPOSITORY_SECURITY.md).
