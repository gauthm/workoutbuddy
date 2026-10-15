# Parcours de fiabilité

Cette suite exécute les parcours utilisateur avec l’application Express réelle : parseur JSON, validation, routes, SQLite et moteur de programme/progression. Les réponses API et le moteur ne sont pas simulés. Les scénarios créent et modifient leurs données exclusivement via les routes de l’application.

## Lancer

```sh
npm test
```

Inclut les tests unitaires, d’intégration et ces parcours. Pour lancer uniquement les sept parcours :

```sh
npm run test:journeys
```

Chaque processus utilise une base `:memory:`, configurée avant les imports et vérifiée explicitement. Chaque scénario réinitialise ses propres données et configure un inventaire de test. Aucun port n’est ouvert ; le serveur en cours, la base utilisateur et les sauvegardes utilisateur ne sont pas utilisés. Aucun service IA ni accès réseau n’est nécessaire.

## Couverture

1. Questionnaire et aperçu sans écriture, création, activation, modification des jours et durée illimitée, calendrier cohérent ; modifications invalides sans changement de données.
2. Séance réalisée, progression suivante et statistiques ; annulation/rétablissement d’une série, exclusion des séries non réalisées et d’échauffement du volume et des records ; refus d’une double complétion sans deuxième progression.
3. Suppression du programme avec historique conservé, nouveau programme reprenant les acquis d’un exercice, suppression de la performance et remise à jour des statistiques et cibles.
4. Export JSON complet, réinitialisation, import identique et reprise d’une séance avec progression conservée : séances, séries, poids corporel, records, progression par exercice, événements de calcul et réglages.
5. Sauvegarde groupée des réglages et du profil : rejet atomique, correction, nouvelle sauvegarde, conservation de la clé API si omise et absence de cette clé dans les réponses/export.
6. Remplacement d’un exercice avant la séance, prescription et historique préservés ; prochain entraînement sur le nouvel exercice ; remplacement refusé pendant la séance.
7. Import invalide provoquant une erreur de clé étrangère après le début de la transaction : restauration de toutes les données initiales et séance suivante encore utilisable.

## Pendant le développement

Lancer `npm test` après les changements de logique ou de données. Ajouter un cas ciblé pour chaque bug corrigé et étendre ces parcours lorsqu’un changement affecte plusieurs fonctionnalités. Ne pas affaiblir une assertion pour masquer une régression ; adapter une attente uniquement lorsque le comportement attendu ou le contrat API a volontairement changé.

Ces parcours couvrent l’API. Pour les clics, le rendu, les interruptions réseau et les redémarrages du vrai serveur, utiliser les parcours Playwright isolés de `tests/e2e/` : [guide](../e2e/README.md). Ils tournent en formats ordinateur et mobile et sont sélectionnés par domaine avec `npm run test:e2e:affected`.
