# WorkoutBuddy

Application locale de musculation pour un utilisateur, avec programmes personnalisés, suivi des séances et progression par exercice. Les algorithmes créent les programmes et calculent leur progression ; un Coach IA facultatif apporte des conseils.

Les données sont stockées dans SQLite sur la machine qui lance le serveur. Si le Coach IA est activé, les informations nécessaires à ses réponses sont envoyées au fournisseur configuré.

## Installation

Prérequis : Node.js 20.x LTS et npm. Sur macOS, installer les Xcode Command Line Tools si nécessaires à la compilation de SQLite : `xcode-select --install`.

```sh
git clone https://github.com/gauthm/workoutbuddy.git
cd workoutbuddy
npm ci
node scripts/download-vendors.js
npm start
```

Ouvrir [http://localhost:3000](http://localhost:3000). `npm start` lance le serveur et applique les migrations et le catalogue intégré. Aucun build frontend n’est nécessaire. Les bibliothèques Vue et Chart.js sont téléchargées une fois, puis servies localement.

## Utilisation

### Programme

La création suit un questionnaire avec des choix prédéfinis : objectif, niveau, jours d’entraînement, durée de séance, durée totale, priorités musculaires et mesures personnelles. Les priorités musculaires sont regroupées en haut et bas du corps, avec sélection de tout un groupe ou de plusieurs muscles sans limite de deux. Le moteur cherche à utiliser le temps de séance choisi avec des séries et exercices supplémentaires adaptés, sans dépasser ce temps ni ses limites de volume ; un avertissement explique les séances plus courtes. Des explications accompagnent les objectifs et un aperçu permet de consulter les séances avant de créer le programme.

Un seul programme est actif à la fois. Son activation planifie les séances sur les jours choisis ; le calendrier de l’accueil montre les séances réellement complétées ou en cours, même hors programme, et les séances planifiées ou sautées du seul programme actif. Quand le nombre de séances terminées du lundi au dimanche atteint celui prévu par le programme, l’accueil et la fiche du programme indiquent que toutes les séances de la semaine sont faites.

La durée totale peut être limitée ou illimitée. Une durée limitée est comptée depuis la première activation ; une réactivation conserve ce point de départ. À la fin, les nouvelles séances sont bloquées et l’historique reste accessible. Prolonger le programme reprend la planification.

Depuis la fiche du programme, deux paramètres sont modifiables : la durée totale et les jours d’entraînement, en conservant le nombre de jours initial. Le niveau, l’objectif et la durée de séance restent ceux du programme créé.

### Exercices et matériel

L’interface et le moteur utilisent uniquement le catalogue importé de free-exercise-db. L’ajout et la modification d’exercices personnalisés sont bloqués côté API. Les anciens doublons « Curl marteau » sont rattachés à Hammer Curls, avec conservation des séances, séries, exclusions et de la progression la plus récente.

La page **Exercices et Matériel** regroupe trois onglets : Exercices, Douleurs et Matériel. La recherche et les filtres permettent de choisir un muscle, un mouvement, une famille de matériel ou les exercices réalisables avec l’inventaire. Le compteur de l’onglet Exercices indique le nombre de mouvements restants après les filtres, douleurs et exclusions ; les exclusions sont signalées séparément. Consulter une fiche puis revenir conserve les filtres et la position de défilement. Les photos disposent de boutons précédent et suivant.

L’inventaire regroupe le matériel par familles, sans distinction domicile/salle. Il permet de renseigner :

- Haltères fixes : quantité et poids d’un haltère.
- Haltères à disques : nombre et poids des barres, quantité et poids des disques.
- Kettlebells : quantité et poids.
- Élastiques : quantité et fourchette de résistance.
- Autres équipements : cases à cocher, avec une catégorie pour le matériel personnalisé.

Les lignes de poids et résistances sont ajoutables. Les changements de matériel restent en brouillon : une barre flottante « Modifications non enregistrées » permet de tout enregistrer ou d’annuler. Les croix retirent les lignes du brouillon ; les cases et les ajouts personnalisés suivent la même sauvegarde groupée. Les charges proposées tiennent compte du matériel et des quantités nécessaires au mouvement. La résistance des élastiques reste une approximation.

Les zones douloureuses sont sauvegardées et filtrent les muscles principaux et secondaires lors de la création des programmes et du choix des alternatives. Les séances déjà prévues restent inchangées.

Depuis la fiche du programme, un exercice peut être remplacé par une alternative similaire compatible avec le matériel et les contraintes. Ce remplacement est bloqué lorsque sa séance type est en cours. L’historique conserve le mouvement réellement effectué.

### Séances et progression

Une séance peut être démarrée un autre jour que celui prévu. Elle apparaît alors au jour réel de son démarrage ; sa date prévue d’origine reste enregistrée, sans recréer de séance à cette date ni déplacer les autres séances. Reprendre une séance en cours conserve son jour de démarrage. Une séance marquée « Sautée » peut être remise en planifiée depuis le calendrier, puis démarrée ou déplacée ; elle conserve sa date et ses données.

Pendant une séance, saisir la charge et les répétitions des séries proposées, puis les valider. Une série validée par erreur peut être annulée. Si tu quittes une séance sans la terminer, elle reste en cours et les séries validées sont conservées. Une saisie non validée peut être perdue au rechargement. L’onglet Séance permet de reprendre ; une autre séance ne peut pas démarrer tant que la première reste en cours. Le chronomètre mesure le temps depuis le démarrage, y compris lorsque l’application est fermée, et la progression attend la fin de la séance. Le bouton Échauffement affiche les consignes sans ajouter de série au programme.

La dernière séance du même exercice est présentée dans un tableau séparé. Une colonne 10RM compare les performances selon la formule sélectionnée ; les formules sont expliquées dans les réglages avancés.

La progression utilise les performances réellement enregistrées. Elle ajuste les cibles de charge et de répétitions tout en gardant une continuité des exercices ; les bilans peuvent proposer une semaine allégée. Le Coach IA ne décide pas de ces changements. La fin de séance et l’enregistrement des progrès forment une seule transaction : en cas d’échec du calcul, la séance reste en cours et peut être terminée à nouveau.

Pour débuter, le moteur limite chaque exercice à trois séries et utilise la double progression, y compris pour un objectif de force, avec une plage initiale de 8–12 répétitions. Les poids des haltères sont exprimés par haltère ; le calcul de départ distingue un mouvement à deux haltères d’un mouvement à un bras. Les hausses automatiques restent limitées à 10 % de la charge ou 1 kg pour les petites charges ; si le matériel impose un saut supérieur, la charge est maintenue. Une série menée à l’échec (RPE ≥ 9,5 ou RIR = 0) bloque une nouvelle hausse immédiate. Les cibles s’ajustent au matériel actuel sans effacer les performances passées.

Ces règles sont des choix de programmation, avec des repères issus des recommandations [ACSM 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) : entraînement progressif des grands groupes musculaires, volume adapté et absence d’obligation d’aller à l’échec. Elles ne constituent pas une validation individuelle des charges de départ.

À la création, le moteur privilégie les exercices utilisant le matériel disponible et répartit les variantes entre les séances, par exemple développé à plat en A et incliné en B avec un banc réglable. La sélection inclut notamment le squat et le soulevé de terre avec haltères, le développé au sol et le rowing avec une kettlebell. Les exigences matérielles restent propres à chaque mouvement du catalogue : un haltère ne remplace pas automatiquement une kettlebell. Des exercices au poids du corps restent possibles quand ils sont pertinents ou que le matériel manque. L’estimation du temps compte les deux côtés des exercices unilatéraux. Une charge ajoutée manuellement à un exercice au poids du corps est enregistrée ; le moteur ne propose pas encore automatiquement de lest optionnel.

Les acquis d’un exercice sont conservés indépendamment du programme : supprimer un programme puis en créer un autre permet de reprendre la progression des mouvements déjà pratiqués. Supprimer une séance recalcule les acquis à partir de l’historique restant. Son créneau est conservé comme supprimé pour empêcher la planification automatique de la recréer, y compris pour une ancienne séance de test complétée à une date future. Pour les anciennes séances sans contexte de calcul enregistré, la récupération s’appuie conservativement sur leurs performances réelles.

L’accueil donne accès à l’historique. Les statistiques présentent le volume, la progression, les records et le suivi du poids corporel.

### Réglages et Coach IA

Les réglages regroupent Général, Profil, Séance, Coach IA et Réglages avancés. Le profil conserve le prénom, le sexe et la date de naissance ; les paramètres d’entraînement sont propres au programme.

Après une modification, une barre de sauvegarde apparaît au-dessus de la navigation. **Enregistrer** sauvegarde les changements de la page ensemble ; **Annuler** restaure les valeurs enregistrées. Un échec conserve les brouillons pour permettre de réessayer.

Le Coach IA utilise une API compatible OpenAI, configurée avec une URL, un modèle et éventuellement une clé API. Le test de connexion et la liste des modèles peuvent utiliser la saisie avant sa sauvegarde. Le coach conseille et dialogue ; il ne configure pas l’application et ne crée pas les programmes.

La clé est stockée côté serveur, masquée dans l’interface et absente des réponses API et de l’export JSON. Une clé existante est conservée lorsqu’une sauvegarde ne fournit pas de nouvelle clé.

## Accès depuis un téléphone

Dans **Réglages → Réglages avancés**, configurer l’hôte réseau sur `0.0.0.0`, enregistrer et redémarrer le serveur. Depuis un téléphone sur le même réseau, ouvrir l’adresse IP locale de la machine, par exemple `http://192.168.1.10:3000`. Le pare-feu doit autoriser le port choisi.

L’application est prévue pour un usage personnel sur un réseau de confiance : elle n’a pas d’authentification et ne doit pas être exposée directement à Internet.

## Configuration du serveur

Les variables d’environnement priment sur les réglages enregistrés. Elles peuvent être définies dans un fichier `.env` à la racine, en s’appuyant sur [.env.example](.env.example).

| Variable | Valeur par défaut | Usage |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Adresse d’écoute |
| `PORT` | `3000` | Port HTTP |
| `DB_PATH` | `data/workoutbuddy.db` | Base SQLite, chemin relatif au lancement ou absolu |

Si `HOST` ou `PORT` figure dans `.env`, modifier le réglage correspondant dans l’interface ne remplace pas cette variable. Redémarrer le serveur après un changement réseau. Configurer la clé du Coach IA dans l’application.

## Sauvegarde, export et réinitialisation

Ces fonctions se trouvent dans **Réglages → Réglages avancés → Données**.

| Action | Contenu ou effet |
| --- | --- |
| Export JSON | Programmes, séances types, séances, créneaux supprimés, séries, poids corporel, records, progressions, contexte de calcul, bilans, inventaire, exclusions d’exercices, profil, conversations et réglages ; clé API exclue |
| CSV résumé des séances | Une ligne par séance, avec ses informations et totaux |
| CSV détail des séries | Une ligne par série, avec exercice, charge, répétitions et autres mesures |
| Import JSON | Restaure les données d’un export en remplaçant les données couvertes ; sauvegarde préalable et restauration transactionnelle. Les doublons historiques reconnus sont fusionnés avec le catalogue ; un exercice custom sans équivalent reconnu bloque l’import avant toute modification |
| Sauvegarde locale | Copie cohérente de SQLite dans `data/backups/`, ou le dossier `backups/` voisin de la base configurée |
| Réinitialiser stats et historique | Efface séances, séries, records, poids corporel, acquis et bilans ; conserve programmes, inventaire, profil, réglages et douleurs |
| Réinitialisation générale | Efface les données utilisateur et les douleurs ; conserve le catalogue intégré et les paramètres de l’application |

La base utilise le journal SQLite WAL. Pour une copie manuelle, arrêter le serveur avant de copier la base et ses éventuels fichiers `-wal`/`-shm`. Le bouton de sauvegarde crée un fichier cohérent même si le serveur tourne. Pour restaurer une sauvegarde SQLite, arrêter le serveur puis remplacer la base en évitant de conserver les anciens journaux du fichier remplacé.

L’export JSON et la sauvegarde locale contiennent des données personnelles ; les conserver dans un emplacement approprié. La base, les sauvegardes, `.env` et les exports locaux sont exclus de Git.

## Tests et développement

```sh
npm test                  # Tests unitaires, API et parcours complets
npm run test:journeys     # Sept parcours de fiabilité
npm run test:e2e          # Vrais parcours navigateur, ordinateur et mobile
npm run test:e2e -- sessions  # Domaine séance uniquement
npm run test:e2e:affected # Domaines concernés par les fichiers modifiés
npm run hooks:install    # Contrôles avant push pour ce dépôt
npm run test:in-process   # Suite avec requêtes Express sans port TCP
```

Les tests utilisent des bases isolées en mémoire ou temporaires. Les parcours complets exécutent l’API et le moteur réels sans service IA : programme/calendrier, séance/progression, suppressions/historique, export/import, réglages, remplacement et rollback d’un import invalide. Voir [leur guide](tests/journeys/README.md).

Les tests de `tests/e2e/` pilotent le navigateur contre le vrai serveur et une base temporaire indépendante pour chaque cas, sans réponses API simulées. Ils sont séparés par domaine : programmes, séances, historique/calendrier, matériel, réglages, données, exercices et statistiques. Les parcours vérifient aussi rechargements, redémarrages et erreurs réseau ; ils tournent sous Chrome en formats ordinateur et mobile. Le hook avant push lance `npm test` puis les domaines concernés par les commits. Voir [installation, sélection et rapports](tests/e2e/README.md).

Les anciens scénarios de `tests/ui/` servent aux contrôles visuels complémentaires ; certains utilisent des réponses API simulées. Les tests navigateur restent séparés de `npm test`.

Le frontend utilise des modules JavaScript et des composants Vue avec templates, sans fichiers `.vue` ni compilation. Le backend utilise Express et SQLite synchrone. Les migrations existantes restent immuables ; les nouveaux changements de schéma prennent la forme d’une migration numérotée. Toute modification de `public/` doit mettre à jour le cache du service worker.

Pour naviguer dans le dépôt : [CODEBASE.md](CODEBASE.md) est l’index du code, [AGENT.md](AGENT.md) contient les règles de développement et [TASKS.md](TASKS.md) suit les tâches. Les audits et suivis détaillés sont dans [docs/](docs/).
