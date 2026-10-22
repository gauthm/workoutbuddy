# AGENT.md

[Accueil de la documentation](INDEX.md) · [README](../README.md)

- [1. Projet](#1-projet)
- [2. Stack — versions figées](#2-stack--versions-figées)
- [3. Règles absolues](#3-règles-absolues)
- [4. Conventions essentielles](#4-conventions-essentielles)
- [5. Comment trouver l'information](#5-comment-trouver-linformation)
- [6. Checklist avant de soumettre](#6-checklist-avant-de-soumettre)
- [7. Parcours navigateur isolés](#7-parcours-navigateur-isolés)
- [8. Déploiement après validation](#8-déploiement-après-validation)
Lis ce fichier en entier avant toute action. Il prime sur toute instruction ad hoc.

---

## 1. Projet

**WorkoutBuddy** — SPA de musculation, locale, mono-utilisateur, macOS. Express + SQLite + Vue 3,
**aucun build frontend**, `npm start` = tout.

---

## 2. Stack — versions figées

| Rôle | Techno | Version |
|---|---|---|
| Runtime | Node.js | 24.x LTS |
| HTTP | Express | 4.22.3 |
| DB | better-sqlite3 | 13.0.3 |
| UI | Vue 3 (fichier local) | 3.5.13 |
| Graphiques | Chart.js (fichier local) | 4.4.4 |
| Tests API | supertest | 7.3.1 |
| Tests unit | node:test + assert | built-in |

**Ne jamais ajouter de paquet npm.** Implémenter à la main ou poser la question.

---

## 3. Règles absolues

| ❌ Interdit | ✅ À la place |
|---|---|
| Fichier `.vue`, `.ts`, `.jsx` | Composant Vue 3 en `.js` pur |
| `async/await` sur better-sqlite3 | `.get()` `.all()` `.run()` synchrones |
| Concaténation SQL | Paramètres `?` ou `@param` |
| `fetch()` dans un composant | Passer par `api.js` |
| Retourner `ai_api_key` en HTTP | `ai_api_key_set: bool` uniquement |
| Texte visible en dur dans un template | `t('clé')` + `locales/fr.json` + `locales/en.json` |
| Modifier une migration existante | Nouveau fichier `NNN_description.sql` |
| `data/workoutbuddy.db` dans un test | DB `:memory:` |
| Deuxième instance better-sqlite3 | Singleton `getDb()` |

---

## 4. Conventions essentielles

**DB** — tout champ JSON (`primary_muscles`, `equipment_required`, `signal_data`…) :
`JSON.stringify()` avant INSERT, `JSON.parse()` après SELECT. Toujours.

**Migrations** — fichiers `src/db/migrations/NNN_*.sql`, numérotation croissante, idempotentes.

**Réponses API** — JSON strict : `{ "error": "NOM" }` pour les erreurs. Codes : 200 OK · 201 Créé ·
204 Supprimé · 400 Bad request · 404 Not found · 409 Conflict · 500 Server error.

**Composants** — `{ name, props, template, setup() }`. Props déclarées avec types.

**i18n** — chaque nouveau texte visible : clé dans `fr.json` + `en.json` + `t('clé')` dans le
template.

**Cache SW** — toute modification de `public/` : bumper `CACHE_NAME` dans `public/sw.js`
(`workoutbuddy-vN` → `vN+1`) et ajouter les nouveaux fichiers `.js` dans `PRECACHE_URLS`.

---

## 5. Comment trouver l'information

- [INDEX.md](INDEX.md) : guides par thème ; [README.md](../README.md) : démarrage rapide.
- [INSTALLATION.md](INSTALLATION.md), [DEVELOPPEMENT.md](DEVELOPPEMENT.md) : installation et commandes de test.
- [CODEBASE.md](CODEBASE.md) : index pour trouver les fichiers concernés.
- [TASKS.md](TASKS.md) : travail en cours ou restant à faire.
- [Tests navigateur](TESTS_E2E.md) et [Parcours métier](TESTS_JOURNEYS.md) : guides des tests.

Pour chaque demande : lire les tâches en cours, identifier les fichiers concernés dans l’index, puis
charger seulement les sources utiles. Implémenter, exécuter les contrôles adaptés et retirer les
tâches terminées après validation. Ne pas recréer les anciens plans ni dupliquer le fonctionnement
dans des comptes rendus.

Si aucune tâche n’est en attente, travailler uniquement sur la demande explicite de l’utilisateur.
L’historique des changements et anciennes tâches se trouve dans Git. Chercher les informations
manquantes dans les guides puis les sources avant de poser une question.

Tous les chemins de code et commandes de cette documentation se lisent depuis la racine du dépôt.
Les liens Markdown sont relatifs au document. Conserver les guides Markdown dans `docs/` ; seuls le
README principal et la licence restent à la racine.

**Taille cible par session :** `docs/AGENT.md` + tâche en cours + fichiers source concernés = **< 30
k tokens**. Si un fichier source dépasse 500 lignes, copier seulement les sections pertinentes.

---

## 6. Checklist avant de soumettre

- [ ] Aucune dépendance npm ajoutée
- [ ] Les tests ciblés des parties touchées passent ; ne pas lancer systématiquement `npm test` ou tous les parcours
- [ ] Chaînes visibles dans `fr.json` ET `en.json`
- [ ] Aucune clé API dans les réponses HTTP
- [ ] Colonnes JSON sérialisées/désérialisées correctement
- [ ] Pas de concaténation SQL
- [ ] Si `public/` modifié → `CACHE_NAME` bumpé dans `sw.js`
- [ ] Après développement et tests, mettre les guides concernés dans `docs/`, le sommaire `README.md` et l’index `docs/CODEBASE.md` à jour pour refléter le fonctionnement et les fichiers actuels
- [ ] Une fois les vérifications terminées, committer les changements et les pousser sur `main`
- [ ] Pour un changement applicatif, déployer en production après validation, puis vérifier la version servie et le bon fonctionnement du service (§8)

## 7. Parcours navigateur isolés

Pour chaque modification, lire le diff et tester uniquement les comportements touchés et leurs
dépendances. **Ne pas relancer toutes les suites après chaque petite modification, ni répéter une
validation déjà réussie sans nouvelle raison.**

- Tests Node ciblés : `npm run test:affected` sélectionne les fichiers concernés (imports des tests unitaires, domaines API et parcours métier dépendants). `npm run test:affected -- --list` affiche la sélection sans exécuter. Pour préciser les fichiers après lecture du diff : `npm run test:affected -- tests/unit/equipmentCalc.test.js tests/integration/equipmentEnhancements.test.js`. Les options Node, par exemple `--test-name-pattern=...`, permettent aussi de cibler un scénario des parcours métier.
- Interface : lancer les domaines concernés, par exemple `npm run test:e2e -- coach` ou `npm run test:e2e -- exercises motion`. `npm run test:e2e:affected` fait une sélection automatique, y compris pour l’accueil, le chat et un fichier de parcours modifié. Un simple changement de numéro de cache ne déclenche pas de parcours supplémentaire.
- Pour les fichiers partagés (styles, traductions, i18n, etc.), inspecter les lignes modifiées : si la portée est locale, choisir explicitement les domaines avec `npm run test:e2e:affected -- --domains exercises,motion`. Ne pas employer cette option pour contourner une modification réellement globale. Si nécessaire, cibler aussi un cas avec `--grep`, en conservant ordinateur et mobile pour les changements d’interface.
- Ajouter ou adapter le test du domaine si le comportement utilisateur change. Une modification purement documentaire n’exige pas de tests. Une modification de la sélection des tests se vérifie avec `tests/unit/e2eSelection.test.js` et les commandes de sélection, sans lancer tous les parcours de l’application.
- Réserver `npm test` et `npm run test:e2e` complets aux changements transversaux (serveur, schéma, dépendances, navigation globale…), aux impacts incertains ou à une demande explicite. Les sélecteurs gardent un repli complet pour les sources inconnues et les dépendances globales. Mettre à jour les règles quand un nouveau domaine ou test est ajouté.
- En cas d’échec, analyser la cause, puis relancer le cas concerné après correction. Ne pas recommencer toute la suite par défaut.

Les tests de `tests/e2e/` utilisent Playwright déjà installé, le vrai serveur et une base SQLite
**temporaire créée par la fixture**, sur un port local libre. Cette base fichier est nécessaire aux
tests de redémarrage ; ne jamais leur fournir la base personnelle, une URL externe ou un serveur
déjà lancé. Les autres tests conservent leurs règles d’isolation existantes. Guide :
`docs/TESTS_E2E.md`.

Le hook local `.githooks/pre-push`, installable avec `npm run hooks:install`, lance uniquement les
fichiers Node et les domaines navigateur concernés par les commits poussés : tests Node sans ports
TCP éphémères, puis navigateur contre de vrais serveurs HTTP.

## 8. Déploiement après validation

L’utilisateur est le seul utilisateur de l’application et autorise durablement le déploiement direct
en production des changements demandés. **Ne pas attendre un nouveau « go » ni demander une
confirmation de déploiement**, sauf instruction explicite contraire de sa part pour la demande en
cours.

Après chaque changement applicatif :

1. Terminer le développement et relire le diff.
2. Exécuter les tests ciblés du code modifié et vérifier les comportements de l’interface touchés, sur ordinateur et mobile si concernés, selon le §7. Corriger les échecs avant livraison.
3. Actualiser la documentation concernée, committer et pousser sur `main`.
4. Déployer directement la version validée selon les guides `docs/DEPLOYMENT_LINUX.md` et de la famille du serveur (`docs/DEPLOYMENT_REDHAT.md` ou `docs/DEPLOYMENT_DEBIAN.md`). Pour une modification de l’interface uniquement, utiliser `/usr/local/sbin/workoutbuddy-deploy-assets /usr/local/src/workoutbuddy/public`. Pour le backend ou des migrations, suivre la procédure correspondante, avec sauvegarde SQLite avant migration.
5. Vérifier les fichiers ou la version réellement servis en production et l’état du service. Indiquer explicitement dans la réponse finale que le déploiement a été effectué, ou expliquer le blocage si la livraison n’a pas abouti.

Une modification purement documentaire ne nécessite ni tests applicatifs ni redéploiement de
l’application.
