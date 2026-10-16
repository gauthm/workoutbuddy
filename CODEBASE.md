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
| Accueil équilibré, boutons sous le programme actif, objectif et fréquence | `js/views/DashboardView.js`, styles `.dashboard-view` dans `css/components.css` |
| Calendrier de l’accueil avec sélection permanente, premier jour hors mois courant, aujourd’hui au retour et séances paginées | `js/components/calendar/CalendarView.js` ; priorité reprise/planifiées, liste complète sur le calendrier séparé |
| Maintien de l’écran allumé, préférence enregistrée et renouvellement au retour | `js/utils/screenWakeLock.js`, initialisation dans `js/app.js`, état dans `js/store.js`, Général dans `SettingsView.js`, migration `017_screen_wake_lock.sql` |
| Navigation et composants communs | `js/components/layout/`, `js/components/common/` |
| Exercices, douleurs, filtres | `js/components/exercises/` (`ExerciseMotion.js` pour les photos animées) |
| Inventaire et registre du matériel | `js/components/equipment/` (`EquipmentEditor.js`, `inventoryCatalog.js`) |
| Questionnaire, fiche titrée par objectif et rappel d’un seul programme actif | `js/components/programs/` |
| Séance, séries, historique et repos | `js/components/session/`, `js/timer-worker*.js` |
| Calendrier, statistiques, coach, réglages | `js/components/calendar/`, `stats/`, `coach/`, `settings/` sous `js/components/` |
| Saisie du Coach ajustable jusqu’à 120 px, Entrée pour une nouvelle ligne et bouton pour envoyer | `js/components/coach/CoachView.js`, `.coach-view__input` dans `css/components.css` |
| Chat conservé pendant la navigation, réponse hors écran et retour au dernier message | `KeepAlive` limité au Coach dans `js/components/layout/AppShell.js`, hooks d’activation et observation des dimensions dans `js/components/coach/CoachView.js` |
| Indicateur de réflexion animé, mouvement réduit et bulles sans avatars | `js/components/coach/ChatMessage.js`, styles `.chat-msg` dans `css/components.css` |
| Bouton seul de déconnexion Authelia avec confirmation | `js/components/settings/SettingsView.js`, `js/api.js`, route Caddy `/auth/logout` |
| RM, échauffement, douleurs, dates, dialogues | `js/utils/` |
| Styles, traductions, bibliothèques, cache | `css/`, `locales/`, `vendor/`, `sw.js` |
| Zoom tactile désactivé, défilement natif et champs mobiles sans zoom au focus | viewport dans `index.html`, `css/main.css`, `css/components.css` ; parcours dans `tests/e2e/security.spec.js` |
| Logo d’onglet et d’écran d’accueil | `icons/workoutbuddy.svg`, `favicon.ico`, `apple-touch-icon.png`, `icons/icon-*.png`, `manifest.json`, génération via `scripts/generate-icons.js` |

## Tests et documentation

| Emplacement | Contenu |
| --- | --- |
| `scripts/test-selection.js`, `test-affected.js` | Sélection Node par imports et domaines API, commande `test:affected`, fichiers explicites et aperçu `--list` |
| `scripts/e2e-selection.js`, `test-e2e-affected.js`, `pre-push.js` | Domaines navigateur concernés, surcharge explicite après lecture du diff, numéro de cache seul ignoré, hook Node et navigateur ciblé ; tests `tests/unit/e2eSelection.test.js` |
| `tests/unit/`, `tests/integration/` | Logique métier et API ; `reliabilityStress.test.js` pour les simulations de durée et incidents |
| `tests/journeys/` | Parcours complets ; [guide](tests/journeys/README.md) |
| `tests/helpers/` | Exécution isolée des requêtes |
| `tests/e2e/` | Parcours Playwright contre serveur et base isolés ; [guide](tests/e2e/README.md) |
| `tests/e2e/updates.spec.js` | Livraison sur copie isolée : rechargement, brouillon, panne réseau et proxy HTTP de session expirée, y compris ancien worker |
| `tests/unit/screenWakeLock.test.js` | Acquisition unique, libération, arrière-plan/retour, requête en cours, refus du navigateur et absence de prise en charge |
| `tests/e2e/authProxy.js`, `settings.spec.js` | Option écran allumé enregistrée, navigation/rechargement, désactivation, refus et incompatibilité ; proxy HTTP jetable partagé, déconnexion avec confirmation et préservation des données |
| `tests/e2e/theme.spec.js`, `security.spec.js` | Contrastes du thème clair et séries validées ; liens et décodage des icônes, dimensions et opacité Apple/manifest |
| `tests/e2e/dashboard.spec.js` | Accueil sur huit tailles/zones sûres, boutons sous le programme, zones agrandies et défilement sur les écrans courts, portrait/paysage, six semaines, tous les statuts, pagination, semaine complète ; cinq objectifs FR/EN |
| `tests/e2e/coach.spec.js` | Saisie ajustable, Entrée sans envoi, animation avec mouvement réduit, absence d’avatars ; navigation avant/pendant la réponse, fin hors écran, suivi immédiat de réponses longues, redimensionnement, persistance et retour en bas après navigation/rechargement ; fournisseur SSE local, aucune IA externe |
| `tests/ui/` | Scénarios visuels Playwright complémentaires |
| `docs/RELIABILITY_AUDIT.md` | Dernier audit : corrections, couverture et limites |
| `docs/DEPLOYMENT_ROCKY.md`, `deploy/rocky/` | Caddy/Authelia, systemd, sauvegardes et configuration reproductible Rocky |
| `deploy/rocky/workoutbuddy-maintenance`, `dnf-automatic-*.conf` | Sauvegarde avant mises à jour RPM, redémarrage conditionnel entre 4 h et 6 h, heure de Paris |
| `deploy/rocky/workoutbuddy-audit.*`, `test-maintenance.py` | Audit npm hebdomadaire et tests simulés de la maintenance, sans toucher au serveur |
| `deploy/rocky/workoutbuddy-deploy-assets` | Contrôle des photos obligatoires, publication atomique de l’interface et conservation de la version précédente |
| `deploy/rocky/workoutbuddy-sessions.*`, `authelia-sessions.conf` | Stockage Redis privé et persistant des sessions Authelia, par socket Unix |
| `deploy/rocky/test-auth-sessions.py`, `test-auth-recovery.mjs` | Test intégral jetable Caddy/Authelia/Redis/Node : TOTP, cookie 60 jours, persistance, révocation par le bouton Réglages, icônes publiques, en-têtes et activation HTTPS du worker |

Sécurité des contenus et de l’historique Git : [docs/REPOSITORY_SECURITY.md](docs/REPOSITORY_SECURITY.md).

Les consignes partagées de `public/js/i18n.js` rappellent la saisie du poids de **1 haltère** pour chaque exercice utilisant des haltères, dans la fiche et l’aide en séance, en FR/EN. Vérification du catalogue entier et des deux langues dans `tests/e2e/exercises.spec.js`, aide en séance dans `motion.spec.js`.
