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

La création suit un questionnaire avec des choix prédéfinis : objectif, niveau, jours d’entraînement, durée de séance, durée totale, priorités musculaires et mesures personnelles. Des explications accompagnent les objectifs et un aperçu permet de consulter les séances avant de créer le programme.

Un seul programme est actif à la fois. Son activation planifie les séances sur les jours choisis ; le calendrier de l’accueil montre les séances complétées, en cours, planifiées ou sautées de ce programme.

La durée totale peut être limitée ou illimitée. Une durée limitée est comptée depuis la première activation ; une réactivation conserve ce point de départ. À la fin, les nouvelles séances sont bloquées et l’historique reste accessible. Prolonger le programme reprend la planification.

Depuis la fiche du programme, deux paramètres sont modifiables : la durée totale et les jours d’entraînement, en conservant le nombre de jours initial. Le niveau, l’objectif et la durée de séance restent ceux du programme créé.

### Exercices et matériel

La page **Exercices et Matériel** regroupe trois onglets : Exercices, Douleurs et Matériel. La recherche et les filtres permettent de choisir un muscle, un mouvement, une famille de matériel ou les exercices réalisables avec l’inventaire.

L’inventaire regroupe le matériel par familles, sans distinction domicile/salle. Il permet de renseigner :

- Haltères fixes : quantité et poids d’un haltère.
- Haltères à disques : nombre et poids des barres, quantité et poids des disques.
- Kettlebells : quantité et poids.
- Élastiques : quantité et fourchette de résistance.
- Autres équipements : cases à cocher, avec une catégorie pour le matériel personnalisé.

Les lignes de poids et résistances sont ajoutables. Les charges proposées tiennent compte du matériel et des quantités nécessaires au mouvement. La résistance des élastiques reste une approximation.

Les zones douloureuses sont sauvegardées et filtrent les muscles principaux et secondaires lors de la création des programmes et du choix des alternatives. Les séances déjà prévues restent inchangées.

Depuis la fiche du programme, un exercice peut être remplacé par une alternative similaire compatible avec le matériel et les contraintes. Ce remplacement est bloqué lorsque sa séance type est en cours. L’historique conserve le mouvement réellement effectué.

### Séances et progression

Une séance peut être démarrée un autre jour que celui prévu. Elle apparaît alors au jour réel de son démarrage ; sa date prévue d’origine reste enregistrée, sans recréer de séance à cette date ni déplacer les autres séances. Reprendre une séance en cours conserve son jour de démarrage.

Pendant une séance, saisir la charge et les répétitions des séries proposées, puis les valider. Une série validée par erreur peut être annulée. Le bouton Échauffement affiche les consignes sans ajouter de série au programme.

La dernière séance du même exercice est présentée dans un tableau séparé. Une colonne 10RM compare les performances selon la formule sélectionnée ; les formules sont expliquées dans les réglages avancés.

La progression utilise les performances réellement enregistrées. Elle ajuste les cibles de charge et de répétitions tout en gardant une continuité des exercices ; les bilans peuvent proposer une semaine allégée. Le Coach IA ne décide pas de ces changements.

Les acquis d’un exercice sont conservés indépendamment du programme : supprimer un programme puis en créer un autre permet de reprendre la progression des mouvements déjà pratiqués. Supprimer une séance recalcule les acquis à partir de l’historique restant. Pour les anciennes séances sans contexte de calcul enregistré, la récupération s’appuie conservativement sur leurs performances réelles.

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
| Export JSON | Programmes, séances types, séances, séries, poids corporel, records, progressions, contexte de calcul, bilans, inventaire, exercices personnalisés, profil, conversations et réglages ; clé API exclue |
| CSV résumé des séances | Une ligne par séance, avec ses informations et totaux |
| CSV détail des séries | Une ligne par série, avec exercice, charge, répétitions et autres mesures |
| Import JSON | Restaure les données d’un export en remplaçant les données couvertes ; sauvegarde préalable et restauration transactionnelle |
| Sauvegarde locale | Copie cohérente de SQLite dans `data/backups/`, ou le dossier `backups/` voisin de la base configurée |
| Réinitialiser stats et historique | Efface séances, séries, records, poids corporel, acquis et bilans ; conserve programmes, inventaire, profil, réglages et douleurs |
| Réinitialisation générale | Efface les données utilisateur et les douleurs ; conserve le catalogue intégré et les paramètres de l’application |

La base utilise le journal SQLite WAL. Pour une copie manuelle, arrêter le serveur avant de copier la base et ses éventuels fichiers `-wal`/`-shm`. Le bouton de sauvegarde crée un fichier cohérent même si le serveur tourne. Pour restaurer une sauvegarde SQLite, arrêter le serveur puis remplacer la base en évitant de conserver les anciens journaux du fichier remplacé.

L’export JSON et la sauvegarde locale contiennent des données personnelles ; les conserver dans un emplacement approprié. La base, les sauvegardes, `.env` et les exports locaux sont exclus de Git.

## Tests et développement

```sh
npm test                  # Tests unitaires, API et parcours complets
npm run test:journeys     # Sept parcours de fiabilité
npm run test:in-process   # Suite avec requêtes Express sans port TCP
```

Les tests utilisent des bases isolées en mémoire ou temporaires. Les parcours complets exécutent l’API et le moteur réels sans service IA : programme/calendrier, séance/progression, suppressions/historique, export/import, réglages, remplacement et rollback d’un import invalide. Voir [leur guide](tests/journeys/README.md).

Les scénarios de `tests/ui/` complètent la couverture avec Playwright ; ils ne sont pas lancés par `npm test`. Certains utilisent un aperçu et des réponses API simulées. Les vérifications visuelles couvrent notamment les réglages, les dialogues, les séances et les tailles d’écran mobiles.

Le frontend utilise des modules JavaScript et des composants Vue avec templates, sans fichiers `.vue` ni compilation. Le backend utilise Express et SQLite synchrone. Les migrations existantes restent immuables ; les nouveaux changements de schéma prennent la forme d’une migration numérotée. Toute modification de `public/` doit mettre à jour le cache du service worker.

Pour naviguer dans le dépôt : [CODEBASE.md](CODEBASE.md) est l’index du code, [AGENT.md](AGENT.md) contient les règles de développement et [TASKS.md](TASKS.md) suit les tâches. Les audits et suivis détaillés sont dans [docs/](docs/).
