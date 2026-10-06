# AGENT.md — Instructions pour l'implémenteur IA

Ce fichier est destiné à tout agent IA (LLM, Cursor, Copilot, etc.) qui
travaille sur ce dépôt. Lis-le intégralement avant toute modification.
En cas de contradiction entre ce fichier et une instruction ad hoc, ce
fichier a priorité sauf indication explicite contraire dans le message
utilisateur.

---

## 1. Vue d'ensemble du projet

**WorkoutBuddy** est une web app de musculation pour un utilisateur unique,
tournant en local sur macOS (`localhost`). C'est une SPA servie par un
serveur Express, sans étape de build frontend.

Le plan d'architecture complet se trouve dans `docs/plan/` (ou dans le
document de référence `PLAN.md` à la racine). **Tout ce qui n'est pas
décrit dans ce plan doit être posé comme question, pas inventé.**

---

## 2. Stack — versions figées, ne pas modifier

| Rôle                  | Technologie              | Version      |
|-----------------------|--------------------------|--------------|
| Runtime               | Node.js                  | 20.x LTS     |
| Serveur HTTP          | Express                  | 4.18.3       |
| Base de données       | better-sqlite3           | 13.0.3       |
| Framework UI          | Vue 3 (fichier local)    | 3.5.13       |
| Graphiques            | Chart.js (fichier local) | 4.4.4        |
| Tests API             | supertest                | 7.0.0        |
| Tests unitaires       | node:test + assert       | built-in     |

**`package.json` ne doit contenir que ces dépendances. Ne jamais ajouter
de paquet sans validation explicite de l'utilisateur.** Si tu penses
avoir besoin d'une dépendance externe (ex : `uuid`, `dayjs`, `zod`),
implémente la fonctionnalité à la main ou pose la question.

---

## 3. Règles absolues — à ne jamais violer

### 3.1 Pas de build frontend

- Vue 3 et Chart.js sont des **fichiers `.js` locaux** dans
  `public/vendor/`. Ils sont téléchargés une seule fois par
  `node scripts/download-vendors.js`.
- Il n'existe **pas** de Webpack, Vite, Rollup, Babel, TypeScript,
  PostCSS, ni aucun compilateur.
- Les composants Vue sont des **objets JavaScript purs** avec
  `template: \`...\`` en string littérale.
- Les imports frontend utilisent des **chemins relatifs avec
  extension `.js`** :

```javascript
import { ref } from '/vendor/vue.esm-browser.prod.js'
```

- **Ne jamais** créer de fichier `.vue`, `.ts`, `.jsx`, `.tsx`.

### 3.2 SQLite synchrone

- `better-sqlite3` est **synchrone**. Ne jamais utiliser `async/await`
  ni `.then()` sur les opérations de base de données.
- Toutes les requêtes DB s'écrivent ainsi :

```javascript
const row  = db.prepare('SELECT * FROM exercise WHERE id = ?').get(id)
const rows = db.prepare('SELECT * FROM exercise').all()
db.prepare('INSERT INTO exercise VALUES (?, ?)').run(id, name)
```

- Les transactions s'écrivent avec `db.transaction(() => { ... })()`.

### 3.3 Sécurité SQL

- **Jamais de concaténation de chaînes dans les requêtes SQL.**
- Toujours utiliser des paramètres positionnels `?` ou nommés `@param`.

```javascript
// ✅ Correct
db.prepare('SELECT * FROM exercise WHERE id = ?').get(id)

// ❌ Interdit
db.prepare(`SELECT * FROM exercise WHERE id = '${id}'`).get()
```

### 3.4 La clé API IA ne quitte jamais le serveur

- La clé est lue depuis la table `settings` en DB côté serveur.
- Elle n'est **jamais** renvoyée dans une réponse HTTP, même partielle.
- Le frontend reçoit uniquement `ai_api_key_set: true/false`.

### 3.5 Une seule commande de démarrage

- `npm start` doit tout faire : migrations, seed, démarrage du serveur.
- Ne jamais demander à l'utilisateur d'exécuter des commandes
  supplémentaires (sauf `npm install` et `node scripts/download-vendors.js`
  documentés dans le README).

---

## 4. Structure des fichiers — ne pas réorganiser

```
workoutbuddy/
├── server.js                   ← entrée unique
├── src/
│   ├── db/                     ← database.js, migrate.js, migrations/*.sql
│   ├── routes/                 ← un fichier par groupe de routes
│   ├── services/               ← logique métier pure (pas de DB directe)
│   └── seed/                   ← exercises.json + seed.js
├── public/
│   ├── js/
│   │   ├── app.js              ← createApp + mount
│   │   ├── router.js           ← hash router
│   │   ├── store.js            ← reactive() global
│   │   ├── api.js              ← wrappers fetch
│   │   ├── i18n.js             ← t(key)
│   │   ├── timer-worker.js     ← Web Worker
│   │   ├── utils/              ← rm.js, weight.js, date.js
│   │   └── components/
│   ├── vendor/                 ← vue + chart.js (générés, gitignorés)
│   ├── locales/                ← fr.json, en.json
│   └── exercises/images/       ← gitignorées
├── scripts/                    ← download-vendors.js, import-exercises.js
├── tests/
│   ├── unit/
│   └── integration/
└── data/                       ← gitignorée, créée à l'exécution
```

Si une tâche te demande de créer un fichier à un emplacement différent
de ce plan, **pose la question** avant de le faire.

---

## 5. Conventions de code

### 5.1 JavaScript

- **ES Modules** partout : `import`/`export`, pas de `require()`.
- `server.js` utilise `"type": "module"` dans `package.json` →
  tous les fichiers `.js` sont des modules ES.
- Pas de classes inutiles. Préférer des fonctions exportées.
- Commentaires en **français** dans le code métier, en anglais dans les
  utilitaires génériques.

### 5.2 Nommage — utiliser exactement ces noms

Les noms suivants sont figés dans le schéma SQL, les routes API et les
composants. Ne jamais les renommer :

| Entité DB             | Route API                 | Composant Vue           |
|-----------------------|---------------------------|-------------------------|
| `exercise`            | `/exercises`              | `ExerciseListView`      |
| `equipment_item`      | `/equipment`              | `EquipmentView`         |
| `program`             | `/programs`               | `ProgramListView`       |
| `workout_template`    | `/templates`              | `TemplateEditor`        |
| `template_exercise`   | `/template-exercises`     | —                       |
| `session`             | `/sessions`               | `SessionActiveView`     |
| `session_exercise`    | `/session-exercises`      | `ExerciseBlock`         |
| `set_log`             | `/sets`                   | `SetRow`                |
| `body_weight`         | `/bodyweight`             | `BodyWeightView`        |
| `equipment_advice`    | `/ai/advice`              | `AdviceCard`            |
| `progression_state`   | (interne)                 | —                       |
| `personal_record`     | `/stats/personal-records` | `PRList`                |

### 5.3 Réponses API

- Toujours retourner du JSON (sauf SSE et téléchargements).
- Les erreurs ont toujours la forme `{ "error": "NOM_ERREUR" }` et
  optionnellement `{ "detail": "..." }`.
- Les codes HTTP sont stricts :

| Code | Signification  |
|------|----------------|
| 200  | OK             |
| 201  | Créé           |
| 204  | Supprimé       |
| 400  | Mauvaise requête |
| 404  | Introuvable    |
| 409  | Conflit        |
| 500  | Erreur serveur |

- Ne jamais retourner un 200 pour une erreur.

### 5.4 Composants Vue

- Un composant = un fichier `.js` qui exporte
  `{ name, props, template, setup() }`.
- Le composant déclare ses props explicitement avec leurs types.
- Les appels API se font via `api.js`, jamais avec `fetch()` directement
  dans un composant.
- Les chaînes visibles par l'utilisateur passent toujours par `t('clé')`.
  Ne jamais écrire du texte français en dur dans un template.

---

## 6. Internationalisation

Toutes les chaînes affichées sont dans `public/locales/fr.json` (défaut)
et `public/locales/en.json`. La fonction `t(key, params)` est définie
dans `public/js/i18n.js`.

Format des clés :

```
{composant}.{element}           →  "session.start_button": "Démarrer"
{domaine}.{action}_{entité}     →  "program.create_program": "Créer un programme"
error.{code}                    →  "error.not_found": "Introuvable"
```

Quand tu crées un nouveau texte visible :

1. Ajouter la clé dans `fr.json` avec la valeur française.
2. Ajouter la même clé dans `en.json` avec la valeur anglaise.
3. Utiliser `t('clé')` dans le template.

**Ne jamais écrire de texte en dur dans un template ou un composant.**

---

## 7. Base de données

### 7.1 Migrations

- Toute modification du schéma = nouveau fichier
  `src/db/migrations/NNN_description.sql`.
- **Ne jamais modifier un fichier de migration existant.**
- Numéroter séquentiellement : `003_`, `004_`, etc.
- Les migrations sont idempotentes (`CREATE TABLE IF NOT EXISTS`,
  `INSERT OR IGNORE`).

### 7.2 Champs JSON dans SQLite

Les colonnes suivantes stockent du JSON en texte :
`primary_muscles`, `secondary_muscles`, `equipment_required`,
`instructions_fr`, `instructions_en`, `image_paths`, `signal_data`.

Toujours sérialiser avec `JSON.stringify()` avant INSERT et désérialiser
avec `JSON.parse()` après SELECT. Ne jamais stocker un objet JS brut.

### 7.3 Singleton DB

Appeler `getDb()` depuis `src/db/database.js` pour obtenir l'instance.
Ne jamais créer une deuxième instance de `better-sqlite3` dans
l'application.

---

## 8. Tests

### 8.1 Lancer les tests

```bash
npm test
# équivalent à :
node --test tests/unit/*.test.js tests/integration/*.test.js
```

### 8.2 Règle d'or

**Chaque tâche doit avoir ses tests verts avant d'être considérée
terminée.** Les tests listés dans la Partie 10 du plan sont obligatoires.

### 8.3 Base de données en test

Les tests unitaires des services utilisent une DB en mémoire :

```javascript
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}
```

Ne jamais utiliser `data/workoutbuddy.db` dans les tests. Chaque test crée sa
propre DB en mémoire, indépendante.

---

## 9. Gestion des erreurs

### Dans les routes Express

```javascript
// Pattern standard pour toutes les routes
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM exercise WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })
    res.json(parseExercise(row))
  } catch (err) {
    console.error('[GET /exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})
```

### Dans les services

- Les services (fichiers dans `src/services/`) **ne catchent pas** les
  erreurs SQL. Ils laissent remonter les exceptions.
- Les services ne font pas d'I/O réseau sauf `aiProvider.js`.
- Un service ne doit jamais appeler `res.json()` ou toucher l'objet
  Express — c'est le rôle de la route.

---

## 10. Flux de travail par tâche

Pour chaque tâche du plan (T1.1, T1.2, etc.) :

1. **Lire** l'intégralité de la tâche dans le plan avant d'écrire une
   ligne de code.
2. **Identifier** tous les fichiers à créer ou modifier.
3. **Vérifier** les dépendances : ne pas implémenter T2.3 sans que T2.1
   soit terminé.
4. **Implémenter** en suivant exactement les signatures, types et étapes
   du plan.
5. **Écrire les tests** listés dans les critères d'acceptation de la
   tâche.
6. **Vérifier** `npm test` — tous les tests passent.
7. **Ne pas continuer** à la tâche suivante si un test échoue.

---

## 11. Ce qu'il ne faut jamais faire

| ❌ Interdit                                          | ✅ À la place                                    |
|------------------------------------------------------|--------------------------------------------------|
| Ajouter une dépendance npm                           | Implémenter à la main ou poser la question       |
| Créer un fichier `.vue`, `.ts`, `.jsx`               | Composants Vue 3 en `.js` pur                    |
| `async/await` sur une requête better-sqlite3         | API synchrone : `.get()`, `.all()`, `.run()`     |
| Concaténer des chaînes dans du SQL                   | Paramètres `?` ou `@param`                       |
| Retourner `ai_api_key` dans une réponse HTTP         | Retourner uniquement `ai_api_key_set: bool`      |
| Écrire du texte visible en dur dans un template      | `t('clé')` + entrée dans `locales/fr.json`       |
| Modifier un fichier de migration existant            | Créer un nouveau fichier `NNN_description.sql`   |
| Utiliser `data/workoutbuddy.db` dans un test              | DB en mémoire `:memory:`                         |
| Renommer une entité, route ou composant              | Respecter le glossaire du plan                   |
| Stocker un objet JS dans une colonne JSON            | `JSON.stringify()` avant INSERT                  |
| Créer une deuxième instance `better-sqlite3`         | Utiliser le singleton `getDb()`                  |
| Appeler `fetch()` directement depuis un composant   | Passer par `api.js`                              |

---

## 12. Checklist avant de soumettre une modification

- [ ] Aucune nouvelle dépendance npm ajoutée
- [ ] Aucun fichier créé hors de l'arborescence du plan
- [ ] `npm test` passe sans erreur
- [ ] Toutes les chaînes visibles sont dans `locales/fr.json` et `locales/en.json`
- [ ] Aucune clé API dans les réponses HTTP
- [ ] Aucune concaténation de chaîne dans le SQL
- [ ] Les noms d'entités respectent le glossaire
- [ ] Les colonnes JSON sont sérialisées/désérialisées correctement
- [ ] Les erreurs retournent le bon code HTTP et le format `{ "error": "..." }`

---

## 13. Gestion du contexte — règle de chargement des fichiers

### 13.1 Ne jamais charger le plan complet

Le fichier `plan.md` fait ~3 000 lignes. **Ne jamais le
charger dans ton contexte.** Il existe uniquement comme référence humaine.

### 13.2 Ce que tu charges pour chaque tâche

Pour travailler sur une tâche (ex : T1.5), charge exactement :

| Fichier                              | Pourquoi                        | Taille ~       |
|--------------------------------------|---------------------------------|----------------|
| `AGENT.md`                           | Règles globales (ce fichier)    | ~3 k tokens    |
| `docs/plan/tasks/T1.5_*.md`          | Tâche courante, auto-suffisante | ~2–4 k tokens  |
| Fichiers source à modifier/créer     | Code existant à lire            | variable       |
| Fichiers de test à écrire            | Si déjà partiellement écrits    | variable       |

**Total visé : < 30 k tokens hors fichiers source.**

### 13.3 Workflow de démarrage d'une tâche

```
1. Lire TASKS.md → identifier la prochaine tâche non cochée
2. Vérifier que toutes ses dépendances sont cochées ✅
3. Charger docs/plan/tasks/T{X}.{Y}_*.md
4. Charger uniquement les fichiers source listés dans "Fichiers concernés"
5. Implémenter, tester, cocher la tâche dans TASKS.md
```

### 13.4 Si une information semble manquer dans le fichier de tâche

Le fichier de tâche est censé être auto-suffisant. Si une information
te semble manquante :

- **D'abord** : vérifie si elle n'est pas dans `AGENT.md` (conventions,
  règles, nommage).
- **Ensuite** : vérifie si elle n'est pas dans un fichier source déjà
  créé par une tâche précédente.
- **En dernier recours** : pose la question à l'utilisateur.
- **Ne jamais** charger `PLAN_FULL.md` en entier pour chercher
  une information.

### 13.5 Taille limite des fichiers source à charger

Si un fichier source existant dépasse 500 lignes, ne charge que les
fonctions / sections directement pertinentes pour la tâche (copie-les
en contexte, ne charge pas tout le fichier).