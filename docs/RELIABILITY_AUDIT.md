# Audit de fiabilité — 15 octobre 2026

Périmètre : séances et séries, progression par exercice, bilan hebdomadaire, historique et export/import. Aucun test ne vise la base personnelle : les tests API utilisent une base isolée et les parcours navigateur un vrai serveur avec un fichier SQLite temporaire par cas.

## Défauts corrigés

| Risque observé dans le code ou reproduit | Correction et vérification |
| --- | --- |
| Une réponse de création de série perdue permettait de créer deux fois le même numéro | Transaction immédiate : un renvoi identique retourne la série existante ; des valeurs différentes produisent un conflit explicite, sans écrasement. Tests API simultanés et navigateur après écriture réelle puis réponse interrompue. |
| Une modification ou suppression de série historique actualisait les records mais conservait une progression devenue fausse | Recalcul des acquis et des cibles des séances types dans la même transaction ; couvre modification, annulation/revalidation, suppression de série et suppression d’exercice. |
| Une nouvelle série arrivée après la clôture pouvait modifier le volume sans appliquer une nouvelle progression | Refus sur séance terminée ou sautée ; le bouton de fin attend aussi les sauvegardes de séries en cours. |
| Un bilan hebdomadaire pouvait décrire des séances ou performances effacées | Invalidation après modification de l’historique, suppression et réinitialisation. Une semaine allégée déjà déclenchée reste conservée par prudence ; supprimer de l’historique ne doit pas accélérer automatiquement la reprise. |
| Le lundi local pouvait encore être traité comme dimanche UTC | Bornes du bilan et appartenance des séances calculées selon la date locale. Sortie de semaine allégée après sept jours calendaires locaux. |
| Certaines dates impossibles et valeurs mal typées étaient acceptées par les routes de séance | Validation avant écriture : création, date planifiée, nom et notes. |
| Un import pouvait introduire des mesures/séries incohérentes ou plusieurs programmes/séances actifs | Refus avant import des dates impossibles, poids négatifs, répétitions fractionnaires, efforts invalides et états actifs incompatibles. Les erreurs de référence gardent le rollback existant. |
| Une réponse perdue après clôture ou abandon laissait l’interface sur une opération déjà réussie | Lecture de l’état sauvegardé pour confirmer la réussite, puis navigation habituelle. Test avec vraie transaction et interruption de sa réponse. |

## Couverture ajoutée

`tests/integration/reliabilityStress.test.js` :

- Douze semaines et vingt-quatre séances avec reprises, volumes, progression, clôtures répétées, bilans mis en cache, export/import intégral, suppression d’une séance puis suppression/recréation du programme.
- Requêtes de démarrage, séries et fin répétées ; une seule séance active et un seul événement de progression.
- Correction, annulation/revalidation et suppression dans l’historique, avec retour aux acquis de la dernière performance restante.
- Erreur SQLite injectée pendant le recalcul : la série, les records et toutes les collections exportées restent identiques à leur état précédent.
- Imports invalides : aucune modification des collections existantes.
- Fatigue répétée, allègement sans perte des acquis et frontières locales de semaine, dont le passage à l’heure d’hiver.

Dans la simulation de durée, seuls les horodatages historiques sont préparés en base et l’heure du bilan est injectée. Les créations, saisies, clôtures, suppressions, imports et calculs utilisent les vraies routes et services. Ce test ne représente pas douze semaines d’exécution continue.

`tests/e2e/sessions.spec.js`, sur ordinateur et mobile : interruption avant écriture, interruption après écriture, renvoi identique ou conflictuel, attente d’une sauvegarde avant fin, perte de réponse de clôture/abandon et arrêt brutal du processus avec récupération de la séance et de la série après redémarrage. Les réponses métier ne sont pas simulées.

## Validation et limites

463 tests métier/API et 66 parcours Playwright ordinateur/mobile réussis. Sauvegarde créée avant redémarrage du serveur personnel ; les 22 rubriques de son export ont été comparées par empreinte et sont restées identiques. Les contrôles du hook avant push exécutent également les suites métier et navigateur concernées.

`npm test` utilise désormais le mode Express direct déjà présent pour éviter les ports TCP éphémères instables dans l’environnement de développement. Playwright conserve les tests du vrai réseau HTTP.

Aucun défaut reproduit n’est laissé ouvert dans ce périmètre. Ces résultats ne démontrent pas l’absence de tout bug : Safari/Firefox, appareils physiques, coupure électrique pendant une écriture disque, stockage défectueux, cache hors ligne du service worker et charge multi-utilisateur ne sont pas couverts. L’arrêt brutal testé intervient après confirmation de l’écriture. Les doublons historiques d’anciens exports ne sont pas fusionnés automatiquement ; la protection empêche d’en créer de nouveaux.
