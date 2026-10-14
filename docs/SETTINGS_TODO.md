# Simplification des paramètres — 14 octobre 2026

- [x] Retirer l’interface des seuils Signaux matériel, Progression et Deload ; conserver le fonctionnement automatique et les valeurs existantes.
- [x] Retirer les contrôles sans effet dans le parcours actuel : repos global, incréments linéaires, nombre de séries d’échauffement, affichage RIR.
- [x] Retirer la période d’affichage du poids de corps : l’écran utilise déjà sa propre période explicite.
- [x] Garder les préférences utiles en séance : effort ressenti (RPE), son et vibration ; ajouter des explications.
- [x] Conserver l’unité réellement utilisée pour le suivi du poids de corps, avec un libellé explicite.
- [x] Regrouper formule RM, ses explications et réseau dans Réglages avancés, fermé par défaut.
- [x] Présenter le conseiller IA comme facultatif et conserver sa configuration accessible.
- [x] Conserver profil, matériel et données dans leurs sections dédiées.
- [x] Bumper le cache public vers v37 ; aucune migration ni remise à zéro de configuration.

## Validation

- `npm test` : 352 tests réussis, aucune erreur.
- Playwright sur API simulée : paramètres obsolètes absents du DOM, réglages avancés fermés au chargement, aucune écriture automatique à l’ouverture, sauvegarde ciblée de RPE/son/formule RM, seuils internes conservés, explications RM avant le séparateur.
- Huit présentations sans débordement : 320/390/768/1280 pixels, clair et sombre ; textes FR/EN.

## Rangement des réglages — 14 octobre 2026

- [x] Données (export/import/sauvegardes/réinitialisations) dans Réglages avancés, après le réseau ; les confirmations existantes sont conservées.
- [x] Retirer le bouton de réinitialisation du profil et son dialogue inutilisé, tout en conservant la modification du profil et les réinitialisations globales.
- [x] Renommer les entrées de navigation, titres et explications en Coach IA.

Validation : 360 tests automatisés ; contrôle sur API simulée avec `tests/ui/filter-settings-layout-checks.js`.

## Présentation des réglages avancés — 14 octobre 2026

Trois blocs visuels au même style : Calcul des performances, Réseau, Données. Titres uniformes, libellés des actions en poids normal, séparateurs seulement entre les lignes. Les confirmations de réinitialisation sont conservées. Réinitialiser stats et historique affiche seulement la poubelle.

Vérification Playwright : aucun débordement de 320 à 1280 px.

Le paragraphe introductif sur la formule RM, le réseau et les valeurs actuelles est intégré dans le volet Comprendre les formules RM, pour alléger la présentation initiale.

## Sauvegarde Coach IA — 14 octobre 2026

- [x] Un seul bouton Enregistrer à droite du test de connexion ; supprimer le bouton de la clé et les sauvegardes au blur/sélection du modèle.
- [x] Sauvegarder URL/modèle/clé en une requête ; une clé laissée vide conserve la clé existante. Aucun secret dans les événements du composant ni dans les réponses HTTP.
- [x] Mot de passe toujours vide côté client ; indicateur de clé configurée sous forme de points dans le champ.
- [x] Test de connexion et recherche de modèles utilisent le brouillon sans persistance ; clé enregistrée utilisée si aucune nouvelle clé fournie. Ancien GET modèles conservé, POST ajouté pour ne pas mettre une clé dans l’URL.

Validation : 367 tests automatisés. Serveur IA local simulé pour tester les brouillons, la conservation de clé et l’absence d’écriture ; `tests/ui/coach-save-checks.js` pour le bouton unique, son emplacement, les deux types de sauvegarde et les points du champ ; 320 à 1280 px, aucune erreur JavaScript ou débordement.

## Sauvegarde commune et conditionnelle — 14 octobre 2026

Cette évolution remplace le bouton fixe propre à Coach IA et les sauvegardes individuelles.

- [x] Une barre fixe au-dessus de la navigation, visible seulement si un champ diffère de sa valeur enregistrée ; masquer après remise à l’identique, annulation ou sauvegarde réussie.
- [x] Regrouper préférences générales, profil, Coach IA et réglages avancés dans un seul POST /settings/save, validé avant toute écriture puis appliqué dans une transaction SQLite.
- [x] Exposer les brouillons des sous-formulaires via refs, sans charger la clé API réelle ni émettre le secret ; conserver la clé si le champ reste vide.
- [x] Erreur de sauvegarde : aucun groupe partiellement enregistré ; saisies conservées, nouvelle tentative possible. Messages affichés au-dessus de la barre.
- [x] Supprimer les boutons locaux, conserver le test IA indépendant ; thème/langue appliqués après enregistrement.
- [x] Ordre : Général, Profil, Séance, Coach IA, Réglages avancés.

Validation : 369 tests passent ; API atomique, refus de valeurs invalides et conservation des autres données. `tests/ui/pending-settings-save-checks.js` couvre changement/remise à l’identique, plusieurs groupes, erreur, retry, annulation, clé masquée/conservée, ordre des sections et barre fixe lors du défilement ; 320–1280 px sans erreur ni débordement. Ce script remplace les vérifications de sauvegarde locale du Coach IA.
