# AGENT.md

Lis ce fichier en entier avant toute action. Il prime sur toute instruction ad hoc.

---

## 1. Projet

**WorkoutBuddy** — SPA de musculation, locale, mono-utilisateur, macOS.
Express + SQLite + Vue 3, **aucun build frontend**, `npm start` = tout.

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

**Réponses API** — JSON strict : `{ "error": "NOM" }` pour les erreurs.
Codes : 200 OK · 201 Créé · 204 Supprimé · 400 Bad request · 404 Not found · 409 Conflict · 500 Server error.

**Composants** — `{ name, props, template, setup() }`. Props déclarées avec types.

**i18n** — chaque nouveau texte visible : clé dans `fr.json` + `en.json` + `t('clé')` dans le template.

**Cache SW** — toute modification de `public/` : bumper `CACHE_NAME` dans `public/sw.js`
(`workoutbuddy-vN` → `vN+1`) et ajouter les nouveaux fichiers `.js` dans `PRECACHE_URLS`.

---

## 5. Comment trouver l'information

- [README.md](README.md) : installation, fonctionnement actuel et commandes.
- [CODEBASE.md](CODEBASE.md) : index pour trouver les fichiers concernés.
- [TASKS.md](TASKS.md) : travail en cours ou restant à faire.
- [tests/e2e/README.md](tests/e2e/README.md) et [tests/journeys/README.md](tests/journeys/README.md) : guides des tests.

Pour chaque demande : lire les tâches en cours, identifier les fichiers concernés dans l’index, puis charger seulement les sources utiles. Implémenter, exécuter les contrôles adaptés et retirer les tâches terminées après validation. Ne pas recréer les anciens plans ni dupliquer le fonctionnement dans des comptes rendus.

Si aucune tâche n’est en attente, travailler uniquement sur la demande explicite de l’utilisateur. L’historique des changements et anciennes tâches se trouve dans Git. Chercher les informations manquantes dans les guides puis les sources avant de poser une question.

**Taille cible par session :** `AGENT.md` + tâche en cours + fichiers source concernés
= **< 30 k tokens**.
Si un fichier source dépasse 500 lignes, copier seulement les sections pertinentes.

---

## 6. Checklist avant de soumettre

- [ ] Aucune dépendance npm ajoutée
- [ ] `npm test` passe sans erreur
- [ ] Chaînes visibles dans `fr.json` ET `en.json`
- [ ] Aucune clé API dans les réponses HTTP
- [ ] Colonnes JSON sérialisées/désérialisées correctement
- [ ] Pas de concaténation SQL
- [ ] Si `public/` modifié → `CACHE_NAME` bumpé dans `sw.js`
- [ ] Après développement et tests, mettre `README.md` et l’index `CODEBASE.md` à jour pour refléter le fonctionnement et les fichiers actuels
- [ ] Une fois les vérifications terminées, committer les changements et les pousser sur `main`

## 7. Parcours navigateur isolés

Après une modification de l’interface ou d’un comportement API/métier, lancer `npm run test:e2e:affected` en plus de `npm test`. Pour cibler explicitement : `npm run test:e2e -- sessions` (ou programs, history, equipment, settings, data, exercises, stats, motion, security, updates, theme, dashboard, coach). Ajouter ou adapter le parcours du domaine si le comportement utilisateur change. Les dépendances partagées et les fichiers source inconnus déclenchent toute la suite.

Les tests de `tests/e2e/` utilisent Playwright déjà installé, le vrai serveur et une base SQLite **temporaire créée par la fixture**, sur un port local libre. Cette base fichier est nécessaire aux tests de redémarrage ; ne jamais leur fournir la base personnelle, une URL externe ou un serveur déjà lancé. Les autres tests conservent leurs règles d’isolation existantes. Guide : `tests/e2e/README.md`. Le hook local `.githooks/pre-push`, installable avec `npm run hooks:install`, lance les tests métier/API en mode `test:in-process` (sans ports TCP éphémères), puis les parcours concernés par les commits poussés avec de vrais serveurs HTTP.
