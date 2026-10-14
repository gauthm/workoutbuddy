# Programme algorithmique et conseiller IA

- [x] Créer les programmes avec un questionnaire à choix prédéfinis et une prévisualisation, sans IA.
- [x] Générer des séances selon objectif, niveau, fréquence, durée, priorités, matériel et exclusions.
- [x] Vérifier les prérequis des exercices issus du catalogue importé.
- [x] Garder les exercices stables et adapter les charges/répétitions par les algorithmes.
- [x] Ajouter un bilan hebdomadaire explicable et une semaine allégée temporaire si les données le justifient.
- [x] Supprimer « aime varier les exercices » du profil.
- [x] Transformer le chatbot en conseiller en lecture seule, sans aucune action de configuration.
- [x] Vérifier les parcours mobile/desktop, FR/EN, tests et export/import.

## Ensuite — demandes du 14 octobre

- [x] Réduire Paramètres > Mon profil à prénom, sexe et date de naissance.
- [x] Retirer niveau, objectif, fréquence, durée, poids/taille et les champs liés à un programme du profil éditable.
- [x] Demander poids, taille et objectifs dans le questionnaire de création ; conserver les choix comme données du programme.
- [x] Sauvegarder la progression par exercice indépendamment des programmes. Suppression/recréation d'un programme : garder historique et recommandations fondées sur les performances antérieures.
- [x] Vérifier et adapter les boutons de réinitialisation dans Paramètres > Données, avec une portée clairement annoncée et la prise en charge des nouvelles données.

## Validation

- `npm test` : 341 tests réussis, aucune erreur.
- Matrice de génération : 375 combinaisons objectif/niveau/fréquence/durée sur base en mémoire.
- Playwright : questionnaire, limites de choix, matériel, erreur et nouvelle tentative, retour, création simulée, conseiller sans actions, 4 largeurs (320/390/768/1280), anglais.
- Playwright : profil à trois champs, sauvegarde sans écraser les anciennes contraintes, annulation des resets, confirmation RESET, branchement des deux endpoints de données (API simulée).
- Régression API : séance terminée → suppression du programme → nouveau programme avec autre priorité → progression et historique conservés ; export/import ; trois portées de reset.
- Base utilisateur : sauvegarde avant migrations 009/010, relance serveur, aperçu réel en lecture seule. Aucune réinitialisation ni création de programme de test sur les données utilisateur.

## Décisions

- Le questionnaire ne contacte jamais le fournisseur IA ; une prévisualisation ne modifie aucune donnée.
- `program_plan.parameters` contient les objectifs, contraintes et mesures propres au programme. Le profil personnel n'est pas réécrit lors de la création.
- Le moteur utilise un sous-ensemble vérifié du catalogue importé et les exercices personnalisés explicitement renseignés. Les exercices indisponibles sont signalés.
- Les exercices restent stables ; la progression s'appuie sur les séries réellement effectuées. Les répétitions ne retombent pas au minimum lorsqu'aucune charge supérieure n'est disponible.
- Bilan de la dernière semaine clôturée, une fois par semaine pour les nouveaux programmes ; pas d'ajustement de fatigue sur une seule séance. Semaine allégée temporaire, sans réécrire les objectifs normaux.
- `exercise_progression` conserve les acquis indépendamment des programmes. Un changement de fourchette de répétitions recalcule une cible et respecte les charges disponibles.
- Le conseiller IA n'émet aucune action exécutable. Les anciens endpoints d'actions répondent 403 `COACH_READ_ONLY`, y compris pour les anciennes conversations.
- « Tout effacer » garde explicitement les paramètres de l'application et le catalogue intégré ; le détail est affiché avant confirmation. Les resets de données créent une sauvegarde préalable.

- [x] Ajouter une explication pour chaque objectif, un conseil de choix et préciser que le niveau débutant conserve les progrès déjà acquis.

## Durée illimitée — 14 octobre 2026

- [x] Choix Durée illimitée dans le questionnaire ; explication, récapitulatif et détail du programme.
- [x] `duration_weeks: null` accepté par le moteur et conservé dans program et program_plan ; les durées fixes existantes restent disponibles.
- [x] Aucun changement au moteur de progression ou aux bilans. Le planificateur continue à alimenter les deux semaines à venir pour les programmes actifs.

Validation : 362 tests automatisés ; tests unitaires de stockage/aperçu et API de création/activation/export sur DB isolée ; Playwright du choix à l’aperçu via API simulée, données null vérifiées.

## Modifier la durée uniquement — 14 octobre 2026

- [x] Bouton dédié sur la fiche du programme, dialogue limité au nombre de semaines et au choix Durée illimitée.
- [x] `PUT /programs/:id` accepte uniquement `duration_weeks` : entier positif ou null ; tout autre champ est refusé sans écriture.
- [x] Transaction synchronisant program.duration_weeks et program_plan.parameters.duration_weeks.
- [x] Aucun changement aux templates, objectifs, niveau, fréquence, durée des séances, progressions ou historique.
- [x] Les durées personnalisées restent réutilisables lors de la création suivante : validation et choix prérempli adaptés.

Validation : 363 tests automatisés, dont modification fixe/illimitée, invariants complets et rejets de champs protégés/valeurs invalides sur DB isolée. `tests/ui/program-duration-edit-checks.js` : deux écritures simulées de la seule durée, affichage actualisé, annulation, invalidité et quatre paramètres de formation inchangés, aucune erreur JavaScript.

## Jours d’entraînement et calendrier actif — 14 octobre 2026

- [x] Remplacer le choix de fréquence par sept cases de jours ; 2 à 6 jours, fréquence automatiquement déduite.
- [x] Conserver `training_days` (0=lundi à 6=dimanche) dans les paramètres du plan, afficher les jours dans le récapitulatif et la fiche.
- [x] Affecter les templates aux jours triés et respecter cette sélection dans le planificateur ; les anciens programmes gardent leur répartition habituelle.
- [x] Calendrier : `GET /sessions?active_program=1` limite les quatre statuts au programme actif ; aucun actif donne un calendrier vide. Historique global conservé.
- [x] Suppression d’un programme : supprimer ses plans, conserver ses séances réalisées/sautées et les progressions par exercice. Les anciennes séances orphelines sont exclues du calendrier.
- [x] Démarrer la prochaine séance réutilise le plan existant ; préparer les exercices au premier démarrage d’une séance planifiée pour éviter les séances vides.

Validation : 365 tests passent sur DB isolée. Jours mardi/dimanche, mapping des templates, idempotence du planificateur, préparation des exercices sans duplication, validation des jours, filtrage actif, changement de programme et suppression avec conservation d’historique. `tests/ui/calendar-training-days-checks.js` : cases, refus d’un choix vide, fréquence déduite, jours transmis et récapitulatif, calendrier filtré ; 320 à 1280 px sans erreur ni débordement.

## Modifier les jours à fréquence constante — 14 octobre 2026

- [x] Le formulaire Modifier le programme expose uniquement la durée totale et les jours ; il impose exactement days_per_week cases cochées.
- [x] L’API accepte exclusivement duration_weeks/training_days ; valide le nombre exact, l’unicité et les indices de jour, sans permettre un changement de fréquence ou de paramètres de formation.
- [x] Synchroniser paramètres et jour des templates ; remplacer les séances futures encore planifiées lorsque les jours changent, dans la même transaction. Séances réalisées/en cours/sautées et progression conservées.
- [x] Pas de remplacement des plans si les jours n’ont pas changé ; prise en charge des anciens programmes sans plan, sans inventer leur durée de séance.
- [x] Échec de planification : rollback de la durée, des jours et du calendrier.

Validation : 371 tests passent, y compris nombre fixe, données protégées, calendrier actualisé et rollback. `tests/ui/program-edit-days-checks.js` : contrôles 1/2/3 jours pour un programme à deux séances, deux seules données éditables, annulation, sauvegarde combinée, paramètres inchangés, 320–1280 px sans erreur ni débordement. Ce contrôle remplace celui du dialogue de durée seule.

## Alternatives d’exercices sur la fiche — 14 octobre 2026

Cette demande étend l’édition du programme : les paramètres généraux restent limités aux jours et à la durée totale ; les exercices peuvent être remplacés individuellement sur la fiche.

- [x] Bouton Remplacer à côté de chaque exercice de chaque séance du programme ; aucun ajout à la séance active.
- [x] Proposer des exercices du même type de mouvement et du même muscle principal, compatibles avec leur rôle composé/isolation, la direction d’effort et le matériel réellement disponible ; exclure les exercices exclus et les doublons de la séance.
- [x] Recherche locale sans accents, badge Déjà pratiqué, choix explicite et confirmation ; liste vide et erreurs gérées.
- [x] Bloquer l’édition du modèle de la séance en cours, dans l’UI et l’API. Revalider les propositions lors de l’enregistrement et vérifier l’exercice attendu pour les demandes devenues obsolètes.
- [x] Remplacement transactionnel : préserver prescription et ordre, reprendre la progression propre au nouvel exercice, conserver celle de l’ancien.
- [x] Adapter les séances futures planifiées déjà préparées et conserver leurs dates ; les plans sans exercices chargés utilisent le modèle à leur démarrage.
- [x] Anciennes séances : conserver identifiants d’exercices et séries réellement effectuées, détacher la référence au modèle modifié. Plans déjà dotés de séries protégés par un refus explicite.

Validation : 375 tests passent. Les tests API vérifient la conservation de l’historique, le remplacement des plans, la reprise de progression et le retour à l’ancien exercice ; matériel, doublons, choix obsolète, séance en cours et données déjà saisies. `tests/ui/program-exercise-replacement-checks.js` couvre choix/recherche, historique, annulation/erreur, réussite, prescription inchangée, liste vide et verrouillage ; 320–1280 px sans erreur ni débordement.
