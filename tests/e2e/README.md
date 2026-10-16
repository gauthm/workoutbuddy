# Parcours navigateur isolés

Ces tests lancent le **vrai `server.js`**, le vrai frontend, les migrations et le catalogue. Chaque cas reçoit une base SQLite neuve dans un dossier temporaire et un port libre lié à `127.0.0.1`. Les variables `DB_PATH`, `HOST` et `PORT` du serveur sont imposées par la fixture ; aucune URL ou base personnelle n’est acceptée. La base fichier permet de redémarrer le serveur et vérifier la persistance. Le navigateur, le serveur, la base et les sauvegardes temporaires sont nettoyés après chaque cas, même en échec. Deux cas peuvent tourner en parallèle sans partager leurs données.

Les actions testées passent par les boutons et champs de l’application. Les appels HTTP directs servent à préparer les préconditions et à vérifier les données sauvegardées. Par exemple, le test du questionnaire crée le programme dans l’interface ; les tests de séance préparent leur programme par l’API, puis effectuent les séries dans l’interface. Aucune réponse de l’API de l’application n’est simulée. Les tests de panne interrompent une véritable requête, puis réessaient contre le serveur.

## Prérequis

- Installer normalement le projet et ses ressources locales (README principal).
- Disposer de Playwright et de Google Chrome. Sur cette machine, le Playwright fourni par `@playwright/mcp` est réutilisé. Aucune dépendance npm n’est ajoutée au projet.
- Le résolveur essaie un Playwright disponible localement, puis les installations globales `playwright` et `@playwright/mcp` obtenues avec `npm root -g`.
- Si l’installation est ailleurs, définir `WB_PLAYWRIGHT_PATH` vers son `package.json` (celui de `playwright` ou de `@playwright/mcp`). Son environnement doit fournir `playwright/test` et le CLI de Playwright. Un Playwright installé ailleurs par l’équipe convient aussi ; le résolveur ne télécharge rien.
- `WB_E2E_BROWSER_CHANNEL=chromium` permet d’utiliser le Chromium déjà installé avec cette même version de Playwright. Le défaut est le canal `chrome` installé sur la machine. `WB_E2E_HEADED=1` affiche les fenêtres.

## Commandes

Depuis la racine du dépôt :

```sh
npm run test:e2e
npm run test:e2e -- programs
npm run test:e2e -- sessions history
npm run test:e2e -- equipment --project=mobile
npm run test:e2e -- settings --project=desktop
npm run test:e2e -- --list
npm run test:e2e:affected
npm run test:e2e:affected -- --base origin/main
```

Chaque fichier tourne sur deux projets : ordinateur 1280×900 et mobile 390×844, avec Chrome, locale française et fuseau Europe/Paris. Les scénarios privilégient les rôles et libellés accessibles, les attentes sur l’état visible et les données réellement persistées. Pas de temporisations arbitraires ni de réessais automatiques masquant les échecs.

## Choisir le bon domaine

| Fichier | Parcours et cas limites |
| --- | --- |
| `programs.spec.js` | Questionnaire, aperçu, activation, durée illimitée, jours valides/invalides, remplacement compatible |
| `sessions.spec.js` | Validation/annulation, reprise après reload et redémarrage, séance complète, cible suivante du même exercice, requête interrompue avant/après écriture sans doublon, conflit de réessai, fin bloquée pendant sauvegarde, réponses de fin/annulation perdues, arrêt brutal, continuer/quitter sans enregistrer |
| `history.spec.js` | Suppression persistante et recalcul des acquis, annulation du statut Sautée, déplacement, réinitialisation d’une séance terminée |
| `equipment.spec.js` | Ajout quantité/poids, sauvegarde persistante, saisie invalide et annulation du brouillon |
| `settings.spec.js` | Sauvegarde groupée profil/préférences, thème, redémarrage, échec réseau et reprise |
| `data.spec.js` | Téléchargement JSON, confirmation RESET, réinitialisation/import et reprise, rollback sur référence invalide |
| `exercises.spec.js` | Recherche, filtres, disponibilité avec matériel, retour de fiche, exclusion et compteur |
| `motion.spec.js` | Photos réelles en alternance, pause/reprise, réduction des animations, arrêt hors écran et aide en séance |
| `security.spec.js` | CSP, séance et graphiques sous protection, origines étrangères, JSON obligatoire, limite IA, import en cours/interrompu et service worker |
| `stats.spec.js` | Compteurs et graphique après séance, regroupement, état vide |

`scripts/e2e-selection.js` décrit les dépendances. Une modification du moteur de progression lance séances, historique, données et statistiques ; une modification du matériel lance aussi les programmes et les exercices. Un fichier partagé (API, store, navigation, styles, traductions, base…) ou un nouveau fichier source déclenche toute la suite. Les changements purement documentaires ne déclenchent pas le navigateur. Sans `--base`, la sélection tient compte des fichiers modifiés, indexés et nouveaux ; avec `--base`, elle compare les commits à cette référence, et ajoute les nouveaux fichiers non suivis.

## Contrôle avant push

```sh
npm run hooks:install
```

Cette commande active `.githooks` **pour ce dépôt seulement**. Elle refuse de remplacer un autre chemin de hooks ou un hook pre-push existant. Ensuite chaque push lance `npm run test:in-process`, puis les domaines Playwright concernés par les commits effectivement poussés. Le mode in-process, également utilisé par défaut par `npm test`, exécute Express et ses routes sans ouvrir de ports TCP éphémères pour les tests métier/API ; le réseau HTTP réel reste testé par Playwright. Une nouvelle branche ou une référence distante indisponible déclenche toute la suite. Un échec empêche le push. Une suppression de branche ne lance pas les tests.

Pour le développement courant, lancer le domaine touché ou `test:e2e:affected`, en plus des tests métier. Les changements de tests se vérifient aussi en exécutant le fichier concerné.

## Résultats et diagnostic

La dernière exécution produit un rapport HTML dans `test-results/report/`. Les traces, captures en échec et journaux du serveur sont dans `test-results/e2e/`. Ces fichiers ne sont pas versionnés ; ils ne contiennent que les données des tests.

```sh
npm run test:e2e:report
npm run test:e2e:trace -- test-results/e2e/chemin-du-cas/trace.zip
```

La [documentation du trace viewer](https://playwright.dev/docs/trace-viewer) explique comment retrouver les actions, captures et requêtes d’un échec.

## Limites explicites

Cette suite couvre des parcours fonctionnels sous Chrome, avec une taille mobile émulée. Elle ne valide pas Safari/Firefox, les téléphones physiques, les performances sous charge ou toutes les possibilités d’erreur. Le service worker est bloqué par défaut pour interroger les fichiers et le serveur de la version testée. Un cas de sécurité l’autorise explicitement pour vérifier son installation et le rechargement sous CSP ; cela ne couvre pas tous les comportements hors ligne. Aucun service d’IA externe n’est sollicité. Les tests unitaires/API restent nécessaires pour explorer finement les règles du moteur.
