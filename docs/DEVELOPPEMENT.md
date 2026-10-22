# Tests et développement

[Accueil de la documentation](INDEX.md) · [README](../README.md)

- [Commandes depuis la racine du dépôt](#commandes-depuis-la-racine-du-dépôt)
- [Tests métier et API](#tests-métier-et-api)
- [Tests navigateur](#tests-navigateur)
- [Contrôles visuels complémentaires](#contrôles-visuels-complémentaires)
- [Architecture et migrations](#architecture-et-migrations)
- [Navigation dans le dépôt](#navigation-dans-le-dépôt)
- [Contrôle des secrets](#contrôle-des-secrets)

## Commandes depuis la racine du dépôt

```sh
npm run test:affected     # Seulement les fichiers Node concernés
npm run test:affected -- --list # Voir la sélection sans exécution
npm run test:affected -- tests/unit/equipmentCalc.test.js # Fichier précis
npm test                  # Suite Node complète, pour les changements transversaux
npm run test:journeys     # Sept parcours de fiabilité
npm run test:e2e          # Vrais parcours navigateur, ordinateur et mobile
npm run test:e2e -- sessions  # Domaine séance uniquement
npm run test:e2e:affected # Domaines concernés par les fichiers modifiés
npm run test:e2e:affected -- --domains exercises,motion # Portée locale vérifiée dans le diff
npm run hooks:install    # Contrôles avant push pour ce dépôt
npm run test:in-process   # Même suite complète que npm test
```

## Tests métier et API

Les tests utilisent des bases isolées en mémoire ou temporaires. Par défaut, `npm test` exécute les
requêtes Express directement, sans ports TCP éphémères ; les vrais échanges HTTP sont couverts par
Playwright. Les parcours complets exécutent l’API et le moteur réels sans service IA :
programme/calendrier, séance/progression, suppressions/historique, export/import, réglages,
remplacement et rollback d’un import invalide.

Voir [leur guide](TESTS_JOURNEYS.md). `tests/integration/reliabilityStress.test.js` ajoute une
simulation de 24 séances sur douze semaines, doubles requêtes, corrections historiques, imports
incohérents, rollback et allègement après fatigue. Le temps historique y est préparé dans les
fixtures ; le serveur et les calculs restent réels. Résultats et limites : [audit de
fiabilité](RELIABILITY_AUDIT.md).

## Tests navigateur

Les tests de `tests/e2e/` pilotent le navigateur contre le vrai serveur et une base temporaire
indépendante pour chaque cas, sans réponses API simulées. Ils sont séparés par domaine : programmes,
séances, historique/calendrier, matériel, réglages, données, exercices et statistiques. Les parcours
vérifient aussi rechargements, redémarrages et erreurs réseau ; ils tournent sous Chrome en formats
ordinateur et mobile.

Pour les modifications courantes, lancer seulement les fichiers Node et les domaines navigateur
concernés, sans répéter les validations déjà réussies. Les dépendances globales ou les sources
inconnues gardent un repli complet. Le hook avant push utilise cette sélection pour les commits
poussés, avec tests Node sans ports TCP puis vrais serveurs HTTP pour le navigateur.

Un simple numéro de cache ne relance pas les tests de livraison. Voir [installation, sélection et
rapports](TESTS_E2E.md).

## Contrôles visuels complémentaires

Les anciens scénarios de `tests/ui/` servent aux contrôles visuels complémentaires ; certains
utilisent des réponses API simulées. Les tests navigateur restent séparés de `npm test`.

## Architecture et migrations

Le frontend utilise des modules JavaScript et des composants Vue avec templates, sans fichiers
`.vue` ni compilation. Le backend utilise Express et SQLite synchrone. Les migrations existantes
restent immuables ; les nouveaux changements de schéma prennent la forme d’une migration numérotée.
Toute modification de `public/` doit mettre à jour le cache du service worker.

## Navigation dans le dépôt

Pour naviguer dans le dépôt : [CODEBASE.md](CODEBASE.md) est l’index du code, [AGENTS.md](../AGENTS.md)
contient les règles de développement et [TASKS.md](TASKS.md) suit les tâches. Le [dernier audit de
fiabilité](RELIABILITY_AUDIT.md) précise la couverture et ses limites. Les tâches terminées et
anciens plans restent consultables dans l’historique Git.

## Contrôle des secrets

Le [contrôle du dépôt public](REPOSITORY_SECURITY.md) décrit la recherche de secrets dans les
fichiers et l’historique, ses limites et la commande pour la répéter.
