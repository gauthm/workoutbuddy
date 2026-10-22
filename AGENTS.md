# AGENTS.md

[Accueil de la documentation](docs/INDEX.md) · [README](README.md)

- [1. Projet](#1-projet)
- [2. Stack — versions figées](#2-stack--versions-figées)
- [3. Règles absolues](#3-règles-absolues)
- [4. Conventions essentielles](#4-conventions-essentielles)
- [5. Comment trouver l'information](#5-comment-trouver-linformation)
- [6. Checklist avant de soumettre](#6-checklist-avant-de-soumettre)
- [7. Parcours navigateur isolés](#7-parcours-navigateur-isolés)
- [8. Déploiement après validation](#8-déploiement-après-validation)
- [9. Déployer sur un nouvel hôte](#9-déployer-sur-un-nouvel-hôte)
Lire ces consignes avant de travailler. Les instructions explicites de l’utilisateur priment sur les conventions du dépôt.

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

Le script natif de `better-sqlite3` est autorisé pour sa version verrouillée via
`package.json#allowScripts`. Lors d’une mise à jour de cette dépendance, réviser aussi
cette autorisation ; ne pas autoriser globalement tous les scripts d’installation.

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

- [INDEX.md](docs/INDEX.md) : guides par thème ; [README.md](README.md) : démarrage rapide.
- [INSTALLATION.md](docs/INSTALLATION.md), [DEVELOPPEMENT.md](docs/DEVELOPPEMENT.md) : installation et commandes de test.
- [CODEBASE.md](docs/CODEBASE.md) : index pour trouver les fichiers concernés.
- [TASKS.md](docs/TASKS.md) : travail en cours ou restant à faire.
- [Tests navigateur](docs/TESTS_E2E.md) et [Parcours métier](docs/TESTS_JOURNEYS.md) : guides des tests.

Pour chaque demande : lire les tâches en cours, identifier les fichiers concernés dans l’index, puis
charger seulement les sources utiles. Implémenter, exécuter les contrôles adaptés et retirer les
tâches terminées après validation. Ne pas recréer les anciens plans ni dupliquer le fonctionnement
dans des comptes rendus.

Si aucune tâche n’est en attente, travailler uniquement sur la demande explicite de l’utilisateur.
L’historique des changements et anciennes tâches se trouve dans Git. Chercher les informations
manquantes dans les guides puis les sources avant de poser une question.

Tous les chemins de code et commandes de cette documentation se lisent depuis la racine du dépôt.
Les liens Markdown sont relatifs au document. Conserver les guides Markdown dans `docs/`. Le README, la licence et ce fichier
`AGENTS.md` restent à la racine pour rendre les consignes du dépôt découvrables.

**Taille cible par session :** `AGENTS.md` + tâche en cours + fichiers source concernés = **< 30
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
4. Déployer directement la version validée selon les guides `docs/DEPLOYMENT_LINUX.md` et de la famille du serveur (`docs/DEPLOYMENT_REDHAT.md` ou `docs/DEPLOYMENT_DEBIAN.md`), ou `docs/DEPLOYMENT_DOCKER.md` pour une installation Docker. Pour une modification de l’interface uniquement, utiliser `/usr/local/sbin/workoutbuddy-deploy-assets /usr/local/src/workoutbuddy/public`. Pour le backend ou des migrations, suivre la procédure correspondante, avec sauvegarde SQLite avant migration.
5. Vérifier les fichiers ou la version réellement servis en production et l’état du service. Indiquer explicitement dans la réponse finale que le déploiement a été effectué, ou expliquer le blocage si la livraison n’a pas abouti.

Une modification purement documentaire ne nécessite ni tests applicatifs ni redéploiement de
l’application.

## 9. Déployer sur un nouvel hôte

### Source des fichiers et choix de la variante

**Toujours partir du contenu versionné de `deploy/` dans ce dépôt Git.** Le dossier de travail
voisin contient des rendus, sauvegardes de configuration et rapports propres à l’hôte ; il ne
remplace jamais les modèles du dépôt. Ne pas réutiliser les secrets d’un autre serveur.

1. Inspecter l’hôte : `uname -s`, `uname -m`, `/etc/os-release`, gestionnaire de paquets,
   services déjà présents et mode d’hébergement existant. Une application déjà installée
   conserve son mode natif ou Docker ; ne pas la migrer implicitement.
2. Pour une installation Linux native, choisir d’après `ID` et `ID_LIKE` : famille RHEL/Fedora
   → `deploy/linux/redhat-based/` ; Debian/Ubuntu → `deploy/linux/debian-based/`.
   Vérifier les prérequis et paquets dans le guide de cette famille, puis exécuter son
   `check-platform.py`. Ne pas forcer une variante pour un OS incompatible.
3. Pour Docker, partir de `deploy/docker/` et du guide `docs/DEPLOYMENT_DOCKER.md`.
   Ne pas installer les unités systemd de l’application dans les conteneurs. Sur macOS/Windows,
   utiliser Docker ou l’installation locale documentée ; les scripts Linux natifs n’y sont pas applicables.

### Emplacement Linux et permissions

La disposition native de référence est la suivante :

| Emplacement | Rôle | Propriétaire et droits |
| --- | --- | --- |
| `/usr/local/src/workoutbuddy` | Clone Git, développement, tests et construction | Administrateur du déploiement ; `0700` sur ce serveur mono-administrateur |
| `/usr/local/src/workoutbuddy-deploy` | Travail privé de déploiement, voisin du clone | Même administrateur, `0700` ; jamais versionné ni servi en HTTP |
| `/usr/local/lib/workoutbuddy` | Copie exécutée du code validé | `root:root`, dossiers `0755`, fichiers ordinaires `0644`, exécutables seuls `0755` ; aucun droit d’écriture pour le service |
| `/var/lib/workoutbuddy` | SQLite, journaux et sauvegardes internes | `workoutbuddy:workoutbuddy`, dossiers `0700`, bases et journaux `0600` |
| `/etc/workoutbuddy` | Configuration de l’instance | Dossier `root:workoutbuddy` `0750` ; environnement `root:root` `0600`, lu par systemd |
| `/var/backups/workoutbuddy` | Instantanés privés des bases et configurations | `root:root`, dossier `0700`, fichiers privés `0600` |

`/usr/local/src` convient aux sources locales : conserver ce chemin sur un Linux natif neuf.
Si le clone est ailleurs, vérifier ses usages et déplacer le clone dans ce répertoire avant
la première installation, puis corriger les chemins dépendants. Ne pas déplacer un clone déjà
correctement placé. Le dossier `workoutbuddy-deploy` doit **toujours être créé dans le même parent
que le clone** ; sur ce serveur les deux restent donc sous `/usr/local/src`.

Sur le serveur actuel, les deux dossiers appartiennent à root et leurs entrées sont limitées à
`0700` ; `.git/` est également `0700`. Les fichiers sources peuvent garder leurs modes Git : la
restriction sur le dossier parent protège tout l’arbre, y compris les fichiers locaux ignorés.
Conserver les bits d’exécution des scripts ; ne pas appliquer un `chmod -R 644` ou `chmod -R 777`.
Ne pas modifier les droits globaux de `/usr/local/src`, ni ceux de l’installation active par
une commande récursive appliquée au clone. Pour un autre administrateur, utiliser son compte
pour le clone et le travail privé, et sudo seulement pour les opérations système.

Exemple **pour un nouvel hôte administré en root**, sans écraser un clone existant :

```sh
umask 077
install -d -o root -g root -m 0700 /usr/local/src/workoutbuddy
git clone https://github.com/gauthm/workoutbuddy.git /usr/local/src/workoutbuddy
cd /usr/local/src/workoutbuddy
WB_REPO="$(pwd -P)"
WB_WORK="$(dirname "$WB_REPO")/workoutbuddy-deploy"
install -d -o root -g root -m 0700 "$WB_WORK"
```

Ne jamais faire pointer un site web vers le clone ou le dossier de travail. Les secrets générés,
archives privées, `.env`, exports et bases restent hors Git. Répertoire de travail `0700`, rendus
privés `0600`, `umask 077` pour leur création ; aucun secret dans les journaux de validation.

### Première installation native et livraisons suivantes

1. Installer les prérequis de la famille et les binaires vérifiés. Suivre ensuite
   `docs/DEPLOYMENT_LINUX.md` pour créer les comptes dédiés, répertoires, règles réseau,
   configurations et unités. Les guides de famille et le guide commun font partie du dépôt :
   ils donnent les paquets, commandes et destinations à suivre, sans dépendre d’une conversation.
2. Définir `WB_DEPLOY_DIR` sur la variante choisie. Pour une instance neuve uniquement,
   rendre ses modèles dans un sous-dossier privé de `WB_WORK`, puis installer chaque rendu
   avec les propriétaires et droits indiqués. Ne jamais régénérer les clés d’une instance existante.
3. Copier le code validé dans `/usr/local/lib/workoutbuddy` en excluant `.git`, `.env`,
   données locales, résultats de tests et dépendances de développement. Installer les dépendances
   verrouillées et ressources dans cette copie, puis imposer les droits de code ci-dessus.
   La base personnelle reste dans `/var/lib/workoutbuddy`, séparée du clone et du code exécuté.
4. Valider Caddy/Authelia et les unités, démarrer les services, configurer le compte/MFA depuis
   le terminal privé et vérifier l’accès HTTPS authentifié. Activer les sauvegardes et un seul
   planificateur de maintenance selon `docs/DEPLOYMENT_OPERATIONS.md`.
5. Pour les changements ultérieurs : tests ciblés du code et de l’UI modifiés, documentation,
   commit/push, puis déploiement direct autorisé (§8). Pour l’interface seule, utiliser le
   `workoutbuddy-deploy-assets` de la variante choisie pour publier le `public/` validé.
   Installer les outils système depuis ces sources versionnées ; ne pas inventer une autre procédure
   à partir d’anciens fichiers de `WB_WORK`. Pour le backend ou une migration, créer d’abord une
   sauvegarde SQLite cohérente hors rétention, garder le code précédent et contrôler le service
   après livraison. Vérifier la version réellement servie et conserver un retour arrière exploitable.

Références de placement : [FHS, hiérarchie locale](https://specifications.freedesktop.org/fhs/latest-single/).
Convention des consignes à la racine : [documentation officielle OpenAI](https://developers.openai.com/blog/custom-code-review-rules-for-codex).
