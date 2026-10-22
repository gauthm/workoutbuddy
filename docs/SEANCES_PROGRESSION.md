# Séances et progression

[Accueil de la documentation](INDEX.md) · [README](../README.md)

- [Planification et séance sautée](#planification-et-séance-sautée)
- [Saisir et reprendre une séance](#saisir-et-reprendre-une-séance)
- [Terminer, abandonner ou réinitialiser](#terminer-abandonner-ou-réinitialiser)
- [Aide à l’exercice](#aide-à-lexercice)
- [Comparer les performances](#comparer-les-performances)
- [Calcul de la progression](#calcul-de-la-progression)
- [Débuter et ajuster les charges](#débuter-et-ajuster-les-charges)
- [Repères de programmation](#repères-de-programmation)
- [Matériel et choix des variantes](#matériel-et-choix-des-variantes)
- [Historique et acquis](#historique-et-acquis)
- [Requêtes répétées et interruptions réseau](#requêtes-répétées-et-interruptions-réseau)
- [Statistiques](#statistiques)

## Planification et séance sautée

Une séance peut être démarrée un autre jour que celui prévu. Elle apparaît alors au jour réel de son
démarrage ; sa date prévue d’origine reste enregistrée, sans recréer de séance à cette date ni
déplacer les autres séances. Reprendre une séance en cours conserve son jour de démarrage.

Une séance marquée « Sautée » peut être remise en planifiée depuis le calendrier, puis démarrée ou
déplacée ; elle conserve sa date et ses données.

## Saisir et reprendre une séance

Pendant une séance, saisir la charge et les répétitions des séries proposées, puis les valider. Une
série validée par erreur peut être annulée. Si tu quittes une séance sans la terminer, elle reste en
cours et les séries validées sont conservées. Une saisie non validée peut être perdue au
rechargement. L’onglet Séance permet de reprendre ; une autre séance ne peut pas démarrer tant que
la première reste en cours.

Le chronomètre mesure le temps depuis le démarrage, y compris lorsque l’application est fermée, et
la progression attend la fin de la séance. Le bouton Échauffement affiche les consignes sans ajouter
de série au programme.

## Terminer, abandonner ou réinitialiser

Le bouton Terminer propose **Continuer la séance**, **Quitter sans enregistrer** et **Terminer et
enregistrer**. Quitter sans enregistrer efface les séries de cet essai et remet la même séance en
planifiée, à sa date prévue d’origine. Terminer enregistre les séries validées et met à jour la
progression.

Depuis la fiche d’une séance terminée dans l’historique, **Réinitialiser la séance** efface ses
résultats et la remet en planifiée ; les records et les acquis sont recalculés sur les séances
restantes. Une confirmation et une sauvegarde précèdent la réinitialisation. Les anciennes requêtes
de saisie de séries sont rejetées pour empêcher leur réapparition après remise à zéro.

## Aide à l’exercice

L’aide d’un exercice en séance sépare les instructions numérotées, la charge à saisir, les conseils
pour trouver sa charge de départ et le tableau RM lorsqu’il est disponible. Les conseils invitent à
commencer léger, garder 2 à 3 répétitions en réserve et ajuster par petits paliers ; sans matériel,
commencer sans lest et choisir une variante plus facile si nécessaire.

## Comparer les performances

La dernière séance du même exercice est présentée dans un tableau séparé. Une colonne 10RM compare
les performances selon la formule sélectionnée ; les formules sont expliquées dans les réglages
avancés.

## Calcul de la progression

La progression utilise les performances réellement enregistrées. Elle ajuste les cibles de charge et
de répétitions tout en gardant une continuité des exercices ; les bilans peuvent proposer une
semaine allégée. Le Coach IA ne décide pas de ces changements. La fin de séance et l’enregistrement
des progrès forment une seule transaction : en cas d’échec du calcul, la séance reste en cours et
peut être terminée à nouveau.

## Débuter et ajuster les charges

Pour débuter, le moteur limite chaque exercice à trois séries et utilise la double progression, y
compris pour un objectif de force, avec une plage initiale de 8–12 répétitions. Les poids des
haltères sont exprimés par haltère. Les consignes le rappellent sur la fiche et dans l’aide en
séance (2 haltères de 10 kg → saisir 10 kg). Le calcul de départ distingue un mouvement à deux
haltères d’un mouvement à un bras.

Les hausses automatiques restent limitées à 10 % de la charge ou 1 kg pour les petites charges ; si
le matériel impose un saut supérieur, la charge est maintenue. Une série menée à l’échec (RPE ≥ 9,5
ou RIR = 0) bloque une nouvelle hausse immédiate. Les cibles s’ajustent au matériel actuel sans
effacer les performances passées.

## Repères de programmation

Ces règles sont des choix de programmation, avec des repères issus des recommandations [ACSM
2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) : entraînement progressif des grands
groupes musculaires, volume adapté et absence d’obligation d’aller à l’échec. Elles ne constituent
pas une validation individuelle des charges de départ.

## Matériel et choix des variantes

À la création, le moteur privilégie les exercices utilisant le matériel disponible et répartit les
variantes entre les séances, par exemple développé à plat en A et incliné en B avec un banc
réglable. La sélection inclut notamment le squat et le soulevé de terre avec haltères, le développé
au sol et le rowing avec une kettlebell.

Les exigences matérielles restent propres à chaque mouvement du catalogue : un haltère ne remplace
pas automatiquement une kettlebell. Des exercices au poids du corps restent possibles quand ils sont
pertinents ou que le matériel manque. L’estimation du temps compte les deux côtés des exercices
unilatéraux.

Une charge ajoutée manuellement à un exercice au poids du corps est enregistrée ; le moteur ne
propose pas encore automatiquement de lest optionnel.

## Historique et acquis

Les acquis d’un exercice sont conservés indépendamment du programme : supprimer un programme puis en
créer un autre permet de reprendre la progression des mouvements déjà pratiqués. Corriger, annuler
ou supprimer une série historique, retirer son exercice ou supprimer sa séance recalcule les acquis
à partir de l’historique restant et invalide le bilan hebdomadaire concerné. Les semaines suivent le
calendrier local.

Son créneau est conservé comme supprimé pour empêcher la planification automatique de la recréer, y
compris pour une ancienne séance de test complétée à une date future. Pour les anciennes séances
sans contexte de calcul enregistré, la récupération s’appuie conservativement sur leurs performances
réelles.

## Requêtes répétées et interruptions réseau

Une série déjà enregistrée peut être renvoyée à l’identique sans doublon ; un renvoi avec des
valeurs différentes est refusé pour éviter un écrasement silencieux. La fin de séance attend les
sauvegardes en cours. Si la réponse réseau de fin ou d’annulation est perdue, l’interface vérifie
l’état réellement enregistré avant de poursuivre.

## Statistiques

L’accueil donne accès à l’historique. Les statistiques présentent le volume, la progression, les
records et le suivi du poids corporel.
