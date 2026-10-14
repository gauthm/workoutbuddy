# Ajustements demandés

## Séance

- [x] Retirer l’ajout libre de séries : conserver les séries prévues par le programme / coach.
- [x] Échauffement : afficher des consignes refermables, sans ajouter de ligne.
- [x] Annuler une série validée par erreur, avec correction de l’avancement et du repos associé.

## Accueil et statistiques

- [x] Revoir la page Statistiques pour rendre les informations plus claires et utiles.
- [x] Afficher le bouton Historique des séances uniquement sur l’accueil.
- [x] Afficher le calendrier directement et en permanence sur l’accueil.
- [x] Retirer les boutons ouvrant le calendrier sur l’accueil et la séance.

- [x] Harmoniser les badges du détail de programme : objectif, niveau, fréquence et Actif (forme, hauteur et centrage).

- [x] Afficher explicitement le poids (kg) et les répétitions dans Précédent pendant la séance.

Validation : `npm test` passe (325 tests). Playwright vérifie le parcours de séance,
les annulations/revalidations, la fenêtre d’échauffement et les pages accueil, stats
et programme dans 40 configurations d’affichage, sans erreur JavaScript ni
débordement. Toutes les écritures simulées utilisent `workoutbuddy.test`.

- [x] Corriger le retour après suppression d’une séance ouverte depuis le calendrier.
  L’entrée du détail est remplacée dans la navigation ; les liens obsolètes reviennent
  à l’historique avec un message compréhensible. Playwright vérifie la suppression
  depuis l’accueil et l’historique, Retour/Avancer et le rechargement du calendrier.
  Deux suppressions simulées sur l’origine isolée, aucune donnée réelle supprimée.
  `npm test` : 325 tests passent. Cache frontend : `workoutbuddy-v31`.
