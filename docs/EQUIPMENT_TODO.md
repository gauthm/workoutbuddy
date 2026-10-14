# Matériel

- [x] Haltères fixes : lignes quantité / poids complet d’un haltère.
- [x] Haltères à disques : barres quantité / poids, puis disques quantité / poids.
- [x] Kettlebells : quantité / poids, autant de lignes que nécessaire.
- [x] Élastiques : quantité / fourchette de résistance, autant de lignes que nécessaire.
- [x] Chaise romaine : catalogue et disponibilité des tractions / dips.
- [x] Remplacer crayon / poubelle par des cases pour les équipements simples dans la vue complète.
- [x] Renommer l’ajout personnalisé et demander Home gym / Salle de sport ; conserver ce classement entre les vues.
- [x] Employer le même éditeur dans la vue complète et dans Paramètres > Matériel.
- [x] Proposer des équipements home gym et salle de sport, avec sections repliables.
- [x] Supprimer la présélection du catalogue et les lignes de saisie préremplies.
- [x] Sauvegarder et retirer les anciennes fixtures de tests identifiées dans la vraie base.
- [x] Étendre le calcul des charges et les alertes de plafond aux kettlebells / élastiques.
- [x] Anticiper un plafond proche à partir de la progression des dernières séances.
- [x] Corriger les séparateurs et vérifier l’édition sur mobile.

## Validation

318 tests passent avec `npm run test:in-process` (routes Express et bases isolées).
`npm test` a aussi été tenté ; les tests API qui ouvrent un port échouent avec
`listen EPERM` dans cet environnement. Le runner sans port exécute ces mêmes routes.
Playwright : ajouts, modifications, suppressions, fourchettes invalides, cases,
enregistrement global, inventaire identique entre les vues, aucune erreur JavaScript.
16 configurations d’affichage (deux vues × quatre largeurs × deux thèmes), vérifiées
avec deux inventaires différents : 32 scénarios, sans débordement.
Les alertes sans texte IA affichent immédiatement un message utilisable.

Le serveur déjà lancé doit être redémarré pour charger les routes et appliquer les
migrations 007 / 008. Le cache frontend est passé à `workoutbuddy-v25`.

## Nettoyage effectué

171 entrées correspondent exactement aux fixtures des anciens tests API, répétées
le 8 octobre entre 13:07:15 et 13:46:05. Elles ont été retirées après sauvegarde.
Aucune autre entrée n’a été supprimée ; l’inventaire restant est vide.
Sauvegarde complète : `data/backups/workoutbuddy_2026-10-13_1791917709599_6b8aa4c5.db`.
Copie JSON des seules entrées retirées : `data/backups/equipment-fixtures-2026-10-13.json`.

## Suivi du coach

Les kettlebells utilisent les poids réellement possédés. Les élastiques conservent
leurs fourchettes nominales : la tension dépend de l’étirement, donc aucun faux pas
fixe en kg et aucune échéance chiffrée ne sont calculés pour eux.
Une bande ne reçoit pas automatiquement une progression numérique fondée sur les
extrémités de sa fourchette.

Avec au moins trois séances distinctes et une progression positive, le coach émet
une alerte si le plafond paraît proche (jusqu’à environ trois séances à tendance
inchangée). L’estimation ne promet pas une date. Les bandes ont une alerte de
proximité à 85 % de leur borne haute nominale. Les alertes de plafond atteint
vérifient plusieurs séances, et non plusieurs séries d’une seule séance.

Les cases conviennent aux structures et machines. Les poids et résistances
détaillés restent nécessaires pour connaître les possibilités de charge.

Ajout personnalisé : choix de section obligatoire, enregistrement dans les notes
du matériel, case affichée dans la section choisie et ouverte après l’ajout.
Validation Playwright : deux ajouts personnalisés, conservation du classement dans
les paramètres, 16 configurations d’affichage sans erreur ni débordement.

## Liste unique et cohérence du catalogue — 14 octobre 2026

- [x] Retirer Home gym / Salle de sport, le titre Autre et les volets de la checklist.
- [x] Afficher directement les cases après les élastiques, triées selon leur libellé FR/EN.
- [x] Retirer le choix de section du formulaire personnalisé ; les anciens équipements restent affichés et leurs notes sont préservées.
- [x] Registre commun des catégories pour le frontend et l’API ; toutes les catégories ont leurs libellés FR/EN et sont acceptées par SQLite.
- [x] Ajouter les accessoires, appareils cardio, machines et matériels spécifiques requis par le catalogue.
- [x] Revoir l’import des besoins de matériel à partir du catalogue source et des supports explicites ; corriger 389 exercices intégrés sans modifier les personnalisés.
- [x] Migrations 011/012 : conserver l’inventaire, les programmes et l’historique ; pas de matériel présélectionné ajouté.
- [x] Vérifier les stations de tirage : une poulie peut satisfaire le tirage vertical/horizontal, sans être assimilée à une presse à cuisses.

Validation : 355 tests réussis ; Playwright sur API simulée (16 présentations), ajout/retrait des cases, kettlebells et élastiques, formulaire personnalisé et concordance entre vue Matériel et Paramètres. Audit réel de 884 exercices : aucune catégorie requise absente ; inventaire et statistiques terminées inchangés après sauvegarde et migration. Rapport : `docs/equipment-catalog-audit.json`.

Source confrontée au catalogue local : https://github.com/yuhonas/free-exercise-db (données structurées et premières consignes explicites ; aucun téléchargement d’image ni nouvelle dépendance).

## Familles de matériel — 14 octobre 2026

Cette évolution remplace la checklist entièrement dépliée demandée précédemment.

- [x] Regrouper le matériel en huit familles repliables, sans distinction domicile/salle.
- [x] Afficher le nombre de types de matériel renseignés dans chaque famille (les lignes de poids d’un même type comptent une seule fois).
- [x] Recherche sans distinction d’accents, par équipement ou famille ; conserver les brouillons lors des recherches et fermetures.
- [x] Catégorie « Équipement personnalisé » indépendante du strongman ; ouverture après ajout, reprise des équipements existants sans migration.
- [x] Dans Exercices, filtre « Matériel » avec les mêmes familles et « Sans matériel ».
- [x] Option « Réalisables avec mon matériel » : vérifier toutes les catégories requises, équivalences et charges atteignables ; filtres combinables et réinitialisables.
- [x] Sauvegarde globale des familles fermées et éditeur identique dans Réglages.

Validation : 360 tests passent. `tests/ui/equipment-family-checks.js` sur origine et API simulées : recherche, brouillon sauvegardé fermé, résumé, cases, ajout personnalisé, paramètres, filtres API, 16 présentations (320–1280 px, clair/sombre), aucune erreur JavaScript ni débordement.

## Onglet Matériel dans Exercices — 14 octobre 2026

- [x] Déplacer l’éditeur des réglages vers un troisième onglet « Matériel », à droite de Douleurs.
- [x] Page « Exercices et Matériel » ; navigation sur deux lignes « Exercices » / « et Matériel ».
- [x] Liens directs vers les onglets et prise en charge de l’ancien lien `#/equipment`.
- [x] Conserver les brouillons de matériel en passant d’un onglet à l’autre ; actualiser les exercices au retour pour recalculer leur disponibilité.
- [x] Conseils matériels dirigés vers le nouvel onglet.

Validation : 360 tests automatisés ; Playwright vérifie l’ordre des onglets, les liens, la conservation d’un brouillon, la suppression de la section des réglages et le libellé de navigation de 320 à 1280 px. Vérifications des familles et filtres également adaptées à la nouvelle page.

## Filtres et recherches — 14 octobre 2026

- [x] Recherche d’exercices toujours visible ; volet Filtre fermé au départ.
- [x] Quatre lignes : Muscle, Mouvement, Matériel, Réalisables avec mon matériel ; effacement accessible lorsque le volet est fermé.
- [x] Même enveloppe `.catalog-search` pour les deux recherches et style identique des champs.

Validation Playwright : combinaisons de filtres envoyées à l’API, fermeture/réinitialisation, quatre lignes distinctes, styles calculés des recherches identiques sur 320/390/768/1280 px, aucune erreur JavaScript ni débordement.

Recherche Matériel : marge supérieure de 12 px et marges latérales identiques à la recherche Exercices ; volet renommé Filtres. Recherche d’exercices vide : Rechercher un exercice… . Validation : `tests/ui/unlimited-layout-checks.js`, quatre tailles d’écran et styles calculés.
