# Audit de l’interface

- [x] Parcourir les routes : accueil, séance, historique/détail, exercices/liste/détail/création/édition, programmes/liste/détail, calendrier, statistiques/progression/poids, coach, paramètres et matériel.
- [x] Tester les interactions : recherche, filtres, onglets douleurs, accordéons, formulaires, modales, navigation, séries et historique du coach.
- [x] Vérifier les largeurs 320, 390, 768 et 1280 px, les thèmes clair/sombre et les langues français/anglais.
- [x] Corriger les parcours de création de programme obsolètes et le lien de records cassé.
- [x] Corriger le rendu initial des graphiques et les changements de formule.
- [x] Corriger les colonnes de séries/RPE, les infobulles et les débordements.
- [x] Améliorer les commandes au clavier, les noms accessibles et la fermeture des dialogues.
- [x] Relancer les vérifications Playwright et les tests unitaires.
- [x] Vérifier les parcours disponibles sur le serveur réel démarré par l’utilisateur à `http://localhost:3000`.
- [ ] Relancer la suite complète `npm test` dans un environnement autorisant les sockets du processus de test : toujours bloqué par `listen EPERM` dans le terminal de cette session.
- [x] Suite complète exécutée sans TCP pendant l’audit de code : `npm run test:in-process`, 293 tests passent. Voir `CODE_AUDIT.md`.

## Environnement

Le lancement initial avec `npm start` échouait dans la session avec `listen EPERM`.
La première passe d’aperçu Playwright utilisait les vrais fichiers statiques et des réponses GET exportées
depuis Express sans socket, sur une copie SQLite dans `/tmp/workoutbuddy-ui-audit`.
Les interactions d’écriture sont vérifiées avec des réponses simulées ; aucune donnée
de l’utilisateur ni appel à un fournisseur IA n’a été modifié par l’audit.

L’utilisateur a ensuite démarré le serveur. La seconde passe accède directement à
`http://localhost:3000`, après suppression de toutes les interceptions Playwright.
Le terminal sandboxé reste sans accès réseau au serveur, mais Playwright y accède.

## Vérification sur le serveur réel — 13 octobre 2026

- 884 exercices disponibles ; aucun programme, aucune séance et aucune entrée de poids dans la base au moment de l’audit.
- 8 parcours réels passent : raccourcis et création via coach, recherche/filtres, fiche et images d’exercice, validation de formulaire, calendrier au clavier, dialogue matériel, paramètres/confirmation de profil, historique et saisie du coach.
- 272 combinaisons d’affichage passent : 17 routes disponibles × 4 largeurs × 2 thèmes × 2 langues. Aucun débordement, aucune traduction brute, aucune erreur JavaScript et aucune réponse HTTP en échec.
- Les valeurs de langue et de thème ont été modifiées uniquement dans le navigateur puis restaurées ; aucun formulaire n’a été enregistré et aucun message IA n’a été envoyé.
- Les parcours de séance et les graphiques avec données restent validés par la première passe simulée : les données nécessaires sont absentes sur le serveur réel.
- Aucun nouveau défaut identifié dans cette passe. Résultats détaillés : `ui-live-results.json`.

## Résultats

- 304 combinaisons contrôlées : 19 routes × 4 largeurs × 2 thèmes × 2 langues. Aucun débordement horizontal, aucune clé de traduction brute, aucune erreur JavaScript ; un onglet de navigation actif par écran.
- 16 parcours d’interaction passent, avec des données fictives : création/édition d’exercices, recherche/douleurs, séance/RPE/repos/aide, calendrier/replanification, historique, programme, records, graphiques, poids, chat, matériel, paramètres et changements de langue.
- 121 tests unitaires passent. Le test de date locale passe aussi explicitement dans les fuseaux Europe/Paris et Pacific/Honolulu.
- La réponse réelle `GET /programs/:id` est vérifiée sans socket sur la copie SQLite, dans une transaction annulée : identifiants conservés et noms français/anglais présents.
- `npm test` a été tenté : les tests d’intégration qui ouvrent un socket échouent avec `EPERM` ; leur réussite ne peut pas être affirmée.
- Syntaxe des modules JavaScript, JSON des traductions et `git diff --check` vérifiés.

## Corrections

- Création de programme redirigée vers le coach, conformément aux API disponibles ; raccourcis programmes/calendrier/historique ajoutés.
- Dépliage des records sur place ; affichage des noms d’exercices dans le détail des programmes.
- Graphiques rendus après l’apparition du canvas ; sélecteur de formule fonctionnel ; couleurs adaptées au thème et légendes musculaires traduites.
- Grilles des séries alignées, RPE adapté aux petits écrans, infobulles positionnées dans le viewport et saisie du coach intégrée à la mise en page.
- Réservation de l’espace de navigation et de la zone sûre mobile ; bouton de suppression du détail de séance sans débordement ; notifications non bloquantes.
- Dialogues réutilisables avec bouton fermer, touche Échap, maintien/restauration du focus et verrouillage du défilement de fond.
- Labels associés aux champs, noms accessibles des boutons, calendrier accessible au clavier, contraste du texte secondaire et respect des animations réduites.
- Dates du calendrier et de saisie du poids locales ; traduction réactive et formulaires d’exercices traduits.
- Cache du service worker passé à `workoutbuddy-v16`, nouveaux modules précachés.

## Rejouer

`tests/ui/interaction-checks.js` et `tests/ui/layout-checks.js` sont des fonctions
pour l’outil `browser_run_code_unsafe` du MCP Playwright. Elles nécessitent l’aperçu
`http://workoutbuddy.test` alimenté par interception des assets/API ; exécuter les
interactions avant la matrice d’affichage pour installer les données fictives.
Ce ne sont pas des tests exécutés par `npm test` et ils ne valident pas des écritures réelles.

`tests/ui/live-checks.js` s’exécute avec le même outil MCP, sur la page réelle
`http://localhost:3000`, sans interception réseau. Il vérifie les données existantes
et les formulaires sans soumission ; la langue/thème du navigateur sont restaurés à la fin.

Le détail des résultats est dans `ui-audit-results.json` ; la capture mobile de
séance est dans `ui-session-mobile.png`.
