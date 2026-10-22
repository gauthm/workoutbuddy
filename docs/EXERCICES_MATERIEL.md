# Exercices et matériel

[Accueil de la documentation](INDEX.md) · [README](../README.md)

- [Catalogue et compatibilité](#catalogue-et-compatibilité)
- [Langues et recherche](#langues-et-recherche)
- [Maintenance des traductions](#maintenance-des-traductions)
- [Navigation et démonstrations](#navigation-et-démonstrations)
- [Inventaire](#inventaire)
- [Douleurs et exclusions](#douleurs-et-exclusions)
- [Remplacer un exercice](#remplacer-un-exercice)

## Catalogue et compatibilité

L’interface et le moteur utilisent uniquement le catalogue importé de free-exercise-db. L’ajout et
la modification d’exercices personnalisés sont bloqués côté API. Les anciens doublons « Curl marteau
» sont rattachés à Hammer Curls, avec conservation des séances, séries, exclusions et de la
progression la plus récente.

## Langues et recherche

Les 876 exercices disposent de noms et de consignes en français et en anglais, selon la langue
choisie dans Réglages. Les noms français gardent les termes courants comme curl, rowing, dips ou
kettlebell. La recherche couvre les deux langues et ignore les accents et la casse. Les identifiants
restent identiques : changer de langue conserve l’historique et la progression.

## Maintenance des traductions

Le catalogue source reste dans `src/seed/exercises.json` ; les traductions statiques sont dans
`src/seed/exercises.fr.json`. Les noms ont été rédigés en français ; les consignes ont été traduites
avec assistance locale, avec relecture des 71 fiches du générateur et corrections de vocabulaire
technique. Aucun traducteur ou modèle supplémentaire n’est nécessaire pour utiliser l’application.

Au démarrage et avec `npm run load:exercises`, seuls les champs français des exercices existants
sont actualisés. L’empreinte de chaque entrée vérifie sa correspondance avec la source anglaise :
après un réimport modifiant un nom ou des consignes EN, actualiser aussi la traduction et son
empreinte (`translationSource` dans `seed.js`). Les tests vérifient la couverture du catalogue.

## Navigation et démonstrations

La page **Exercices et Matériel** regroupe trois onglets : Exercices, Douleurs et Matériel. La
recherche et les filtres permettent de choisir un muscle, un mouvement, une famille de matériel ou
les exercices réalisables avec l’inventaire. Le compteur de l’onglet Exercices indique le nombre de
mouvements restants après les filtres, douleurs et exclusions ; les exclusions sont signalées
séparément.

Consulter une fiche puis revenir conserve les filtres et la position de défilement. Les deux photos
alternent automatiquement pour montrer les positions du mouvement, dans la fiche et dans l’aide en
séance. Un bouton permet de mettre en pause ou de reprendre ; les images sont chargées une seule
fois et l’animation s’arrête hors écran, quand l’onglet est masqué ou à la fermeture.

La préférence de réduction des animations est respectée.

## Inventaire

L’inventaire regroupe le matériel par familles, sans distinction domicile/salle. Il permet de
renseigner :

- Haltères fixes : quantité et poids d’un haltère.
- Haltères à disques : nombre et poids des barres, quantité et poids des disques.
- Kettlebells : quantité et poids.
- Élastiques : quantité et fourchette de résistance.
- Autres équipements : cases à cocher, avec une catégorie pour le matériel personnalisé.

Les lignes de poids et résistances sont ajoutables. Les changements de matériel restent en brouillon
: une barre flottante « Modifications non enregistrées » permet de tout enregistrer ou d’annuler.
Les croix retirent les lignes du brouillon ; les cases et les ajouts personnalisés suivent la même
sauvegarde groupée. Les charges proposées tiennent compte du matériel et des quantités nécessaires
au mouvement.

La résistance des élastiques reste une approximation.

## Douleurs et exclusions

Les zones douloureuses sont sauvegardées et filtrent les muscles principaux et secondaires lors de
la création des programmes et du choix des alternatives. Les séances déjà prévues restent
inchangées.

## Remplacer un exercice

Depuis la fiche du programme, un exercice peut être remplacé par une alternative similaire
compatible avec le matériel et les contraintes. Ce remplacement est bloqué lorsque sa séance type
est en cours. L’historique conserve le mouvement réellement effectué.
