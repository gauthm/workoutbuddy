# Interface en séance

- [x] Conserver le moteur de progression existant ; adaptation calculée, sans nouvel appel IA par série.
- [x] Afficher les séries prévues, la performance précédente et la cible du jour.
- [x] Présenter un exercice ouvert à la fois, avec avancement par exercice et par séance.
- [x] Permettre la saisie, la validation et la correction d’une série enregistrée.
- [x] Préremplir les séries suivantes sans écraser les champs modifiés par l’utilisateur.
- [x] Échauffement : consignes refermables sans création de ligne ; conservation des anciens échauffements enregistrés.
- [x] Garder le repos visible au changement d’exercice, avec ajustement ±15 secondes.
- [x] Passer à l’exercice suivant et confirmer la fin, avec avertissement si des séries restent prévues.
- [x] Retirer Blessures / limitations de Mon profil ; ne plus réécrire injury_notes lors de sa sauvegarde.
- [x] Vérifier le parcours complet sur un aperçu isolé et relancer le serveur en arrière-plan.

## Validation

`npm test` : 325 tests passent, zéro échec. Test ajouté pour les métadonnées de
séries/repos du template et tests des ajustements du chronomètre.
Playwright : parcours simulé de deux exercices / cinq séries de travail, correction,
consignes d’échauffement, annulation/revalidation, repos, reprise, fin de séance et sauvegarde du profil sans altération
des blessures. 16 configurations (quatre largeurs, deux thèmes, RPE activé/désactivé),
sans erreur JavaScript ni débordement. Les écritures restent sur l’origine isolée
`http://workoutbuddy.test`, aucune séance de test dans la base réelle.

Le serveur a été relancé et répond HTTP 200 sur le port 3000. Le cache frontend
est `workoutbuddy-v30`. La disparition du champ a été vérifiée sur le serveur réel.
Aperçu : `docs/session-ui-mobile.png`.

## Inspiration

Les principes de saisie et de rappel de performance s’appuient sur le
[guide officiel Alpha Progression](https://alphaprogression.com/en/blog/alpha-progression-guide).
Les règles linéaires, de double progression et de progression RPE de WorkoutBuddy
restent celles du moteur existant ; il ne s’agit pas d’une reproduction de l’algorithme propriétaire.

Ajustements supplémentaires : ajout libre de séries supprimé, coche verte cliquable
pour annuler une validation, arrêt du seul repos associé à la série annulée,
poids et répétitions explicitement affichés dans Précédent.
Les consignes préparent progressivement le mouvement sans rechercher la fatigue,
suivant les principes généraux décrits par la
[NSCA](https://www.nsca.com/education/articles/kinetic-select/introduction-to-dynamic-warm-up/).
Le choix des charges de préparation à partir de l’inventaire est une heuristique
de l’application, testée séparément ; il ne modifie pas la progression du programme.

## Tableau de séance et estimation RM — 14 octobre

- [x] Colonne 10RM à droite des répétitions, calculée en direct depuis les champs saisis.
- [x] Retirer la colonne « précédent » des séries ; tableau # / KG / REPS / 10RM sous Échauffement, avec la dernière séance et sa date.
- [x] Estimations absentes sans charge externe ou pour les élastiques ; valeurs conservant la convention de saisie.
- [x] Explications des cinq formules dans Réglages > Général, sous le choix de formule RM.
- [x] Conversion de 1RM vers 10RM et autres nombres de reps avec la formule choisie, côté client et serveur.
- [x] Vérifier saisie, correction, annulation, repos et fin de séance ; 16 combinaisons largeur/thème/RPE sans débordement.
