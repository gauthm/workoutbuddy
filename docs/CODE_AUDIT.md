# Audit du code — 13 octobre 2026

- [x] Étape 1 : démarrage, stockage, migrations, import/export.
- [x] Étape 2 : validation des API et transitions des séances/séries.
- [x] Étape 3 : calculs, progression, planification et statistiques.
- [x] Étape 4 : intégration IA, streaming et cycle de vie frontend.
- [x] Étape 5 : régressions automatisées et vérification finale.
- [x] Ajustement demandé : éloigner le chevron des listes déroulantes du bord droit, en réservant l’espace pour le texte.

Les modifications de l’audit d’interface précédent sont conservées. Chaque défaut
retenu doit être expliqué et vérifié ; les données de l’utilisateur ne servent pas
de base de test et aucune dépendance npm n’est ajoutée.

## Étape 1 — Sauvegardes et imports

- **Sauvegarde SQLite incomplète en mode WAL** : copie du seul fichier `.db` remplacée par une image cohérente `VACUUM INTO`, écrite dans un fichier temporaire puis renommée. Avant import/reset et sur sauvegarde manuelle, un nouvel instantané est créé ; un échec ne produit plus un faux succès de sauvegarde.
- **Import incomplet destructeur** : validation des tables obligatoires avant toute suppression ; identifiants personnalisés dupliqués ou en collision avec les exercices intégrés refusés. La transaction protège toujours les données en cas d’erreur de contenu.
- **Export/import incomplet** : profil, objectifs secondaires et exclusions restaurés. Les anciens exports restent acceptés ; leurs champs optionnels absents ne détruisent pas le profil et les conversations actuelles. La clé API reste locale.
- **Imports bloqués au-delà de 100 ko** : limite JSON dédiée de 20 Mo sur `/api/v1/import`, sans augmenter celle des autres endpoints.
- **Erreurs HTTP HTML et démarrage non maîtrisé** : erreurs JSON structurées pour API inconnue, JSON invalide, charge trop grande ; assets absents en 404 ; port strictement numérique et erreur d’écoute capturée.
- **`:memory:` transformé en nom de fichier** : cette valeur spéciale est désormais conservée ; les nouveaux tests utilisent réellement une base en mémoire.

## Étape 2 — API et intégrité

- **Booléens SQLite** : validation de série existante et mise à jour des options de programme convertissent les booléens en 0/1.
- **Records manquants ou périmés** : création/modification/suppression des séries reconstruit les records depuis les séries restantes, avec la formule configurée, y compris Lombardi. La suppression d’une série, d’un exercice de séance ou d’une séance respecte les références de records.
- **Historique incohérent** : le volume et le RPE d’une séance complétée sont recalculés après modification des séries. Supprimer un programme détache les séances des templates supprimés et conserve l’historique.
- **Transitions incorrectes** : redémarrer une séance déjà en cours conserve son heure de départ ; une séance planifiée/sautée ne peut plus être terminée directement.
- **Entrées invalides** : refus des poids non numériques/négatifs, dates impossibles, valeurs de séries invalides, pas d’haltère nul/négatif et paramètres numériques mal typés. Les actions IA réutilisent la validation du profil, du matériel et des paramètres.

## Étape 3 — Calculs et planification

- **Performance inventée par deux MAX SQL** : la progression journalière choisit maintenant une série réellement effectuée, selon son RM, au lieu de combiner le poids maximal avec les répétitions maximales d’une autre série.
- **Boucle infinie du moteur de charges** : un pas nul ou trop petit pouvait empêcher la charge arrondie d’avancer. La génération utilise un nombre borné de pas, et ignore les inventaires invalides.
- **Rendez-vous recréés au démarrage** : les séances terminées et sautées occupent aussi leurs dates dans le scheduler.
- **Dates et timestamps** : planification/streak utilisent le jour local ; les chronomètres acceptent SQLite UTC et ISO avec fuseau sans ajouter un second `Z`.

## Étape 4 — IA et frontend

- **Actions IA perdues selon la découpe réseau** : nouveau parseur incrémental testé à chaque frontière possible de chunk, y compris plusieurs blocs dans un chunk et JSON invalide.
- **Actions en lot partiellement appliquées** : validation/application séquentielle dans une transaction ; si une action échoue, le lot est annulé. Les actions restent disponibles côté UI après un échec, pour pouvoir réessayer.
- **Lecteurs et requêtes abandonnés** : fermeture du lecteur SSE, annulation du provider à la déconnexion, annulation de la requête navigateur et des navigations différées au démontage du coach. Les appels du composant passent désormais par `api.js`.
- **Réponses de recherche hors ordre** : une ancienne réponse ne remplace plus une recherche plus récente ; saisie temporisée et nettoyage au démontage.
- **Repos inactif ou doublonné** : démarrage dès le montage actif, redémarrage à chaque série, un seul exercice propriétaire du repos ; réglages son/vibration respectés et arrêt des workers à la fin de séance.
- **Dérive des minuteurs** : temps calculé depuis une échéance/heure de départ plutôt que le nombre de ticks reçus. Les tests exécutent maintenant le vrai code du worker.
- **Chevron demandé** : flèche native remplacée visuellement par un chevron à 0,9 rem du bord ; 2,5 rem réservés à droite. Le select natif et le clavier sont conservés ; rendu natif rétabli en couleurs forcées.
- Sur les écrans de 360 px ou moins, les selects des paramètres passent sous leur label pour préserver la lisibilité des options longues.
- Cache frontend final : `workoutbuddy-v20`.

## Vérification et limites

- `npm run test:in-process` : **293 tests passent, 0 échec**. Ce mode exécute les vrais middlewares et routes Express sans TCP ; le fournisseur IA des tests est simulé. `npm test` reste disponible pour l’exécution standard avec Supertest.
- **16 parcours Playwright simulés** passent, avec vérification que le compte à rebours diminue réellement après validation d’une série.
- **8 parcours et 272 combinaisons d’affichage sur le serveur réel** passent ; les réglages de langue/thème du navigateur sont restaurés et aucune donnée utilisateur n’a été enregistrée.
- Régression de dates, intégrité référentielle, import/export >100 ko, snapshots, rollback des actions et fragmentation SSE couverts par les nouveaux tests.
- Syntaxe JavaScript et `git diff --check` vérifiés ; aucune migration existante modifiée et aucune dépendance ajoutée.
- Le serveur lancé avant ces corrections doit être redémarré pour charger les changements backend. Les corrections frontend sont servies directement et renouvelées via le cache du service worker.
- Audit statique et régressions ciblées : cela ne constitue pas une preuve exhaustive de l’absence de défaut. Aucun appel à un fournisseur IA réel ni import destructeur sur la base utilisateur n’a été exécuté.
