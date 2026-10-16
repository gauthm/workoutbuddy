# WorkoutBuddy

Application locale de musculation pour un utilisateur, avec programmes personnalisés, suivi des séances et progression par exercice. Les algorithmes créent les programmes et calculent leur progression ; un Coach IA facultatif apporte des conseils.

Les données sont stockées dans SQLite sur la machine qui lance le serveur. Si le Coach IA est activé, les informations nécessaires à ses réponses sont envoyées au fournisseur configuré.

## Installation

Prérequis : Node.js 24.x LTS (version sélectionnée dans `.nvmrc`) et npm. Sur macOS, installer les Xcode Command Line Tools si nécessaires à la compilation de SQLite : `xcode-select --install`.

```sh
git clone https://github.com/gauthm/workoutbuddy.git
cd workoutbuddy
npm ci
node scripts/download-vendors.js
node scripts/download-exercise-images.js
npm start
```

Ouvrir [http://localhost:3000](http://localhost:3000). `npm start` lance le serveur et applique les migrations et le catalogue intégré. Aucun build frontend n’est nécessaire. Les bibliothèques Vue et Chart.js sont téléchargées une fois, puis servies localement.

Les photos sont téléchargées une fois depuis [free-exercise-db](https://github.com/yuhonas/free-exercise-db), à une révision figée, puis servies localement avec l’application. Le script récupère uniquement les 1 746 JPEG référencés par le catalogue : il reprend les fichiers manquants, vérifie leur format et ne modifie ni le catalogue ni SQLite. `node scripts/download-exercise-images.js --check` vérifie l’installation sans réseau. Ces fichiers régénérables sont exclus de Git et doivent être installés sur chaque nouvelle machine.

## Utilisation

### Programme

La création suit un questionnaire avec des choix prédéfinis : objectif, niveau, jours d’entraînement, durée de séance, durée totale, priorités musculaires et mesures personnelles. Les priorités musculaires sont regroupées en haut et bas du corps, avec sélection de tout un groupe ou de plusieurs muscles sans limite de deux. Le moteur cherche à utiliser le temps de séance choisi avec des séries et exercices supplémentaires adaptés, sans dépasser ce temps ni ses limites de volume ; un avertissement explique les séances plus courtes. Des explications accompagnent les objectifs et un aperçu permet de consulter les séances avant de créer le programme.

Un focus conserve du travail de base pour l’autre partie du corps. Sur deux ou trois jours, les séances réservent d’abord une poussée ou un tirage et du travail des jambes, avec alternance sur la semaine ; le temps restant va aux priorités, réparties entre les séances selon leur travail direct déjà prévu. Les formats sur quatre à six jours conservent leurs séances haut/bas ou poussée/tirage/jambes. La durée, la fréquence, les repos, le matériel, les douleurs et les exclusions restent respectés. Les messages jaunes distinguent travail direct limité, sollicitation indirecte et absence d’exercice compatible, et proposent moins de priorités ou des séances plus longues plutôt que d’ajouter des jours. Le travail indirect est compté séparément, sans être présenté comme un focus direct. Les repères de répartition sont des heuristiques de planification, pas une garantie de volume optimal pour chaque personne.

Le poids saisi à la création est ajouté au suivi du poids corporel à la date locale du jour. Une mesure déjà présente ce jour-là est conservée, avec avertissement si sa valeur diffère. Le poids et la taille de référence restent enregistrés dans les paramètres du programme, indépendamment du suivi : supprimer une mesure ne les efface pas et ne la recrée pas au redémarrage ou à l’import. Ils ne sont plus affichés sur la fiche du programme. Ces changements s’appliquent aux nouvelles créations ; les programmes déjà enregistrés gardent leurs exercices et leurs données.

Un seul programme est actif à la fois ; un rappel apparaît dans la liste et sur chaque fiche. Son activation planifie les séances sur les jours choisis ; le calendrier de l’accueil montre les séances réellement complétées ou en cours, même hors programme, et les séances planifiées ou sautées du seul programme actif. Quand le nombre de séances terminées du lundi au dimanche atteint celui prévu par le programme, l’accueil et la fiche du programme indiquent que toutes les séances de la semaine sont faites.

L’accueil et le titre de la fiche programme reprennent le libellé exact de l’objectif choisi dans le formulaire, selon la langue de l’interface, et l’accueil indique la fréquence hebdomadaire. Le calendrier garde des cases compactes, sans s’étirer sur les grands écrans, et s’adapte à la hauteur disponible, aux zones de sécurité iPhone et à l’orientation : état sans programme, semaine terminée et actions du jour restent visibles sans faire défiler la page. Les raccourcis Programmes et Historique sont des boutons à fond et contour visibles dans l’en-tête. En paysage, les informations du jour apparaissent à côté du calendrier.

Si plusieurs séances partagent une date, des flèches permettent de les consulter une par une, avec un compteur. La séance en cours apparaît en priorité, puis les séances planifiées ; toutes les actions restent accessibles. Le calendrier ouvert séparément conserve sa liste complète.

La durée totale peut être limitée ou illimitée. Une durée limitée est comptée depuis la première activation ; une réactivation conserve ce point de départ. À la fin, les nouvelles séances sont bloquées et l’historique reste accessible. Prolonger le programme reprend la planification.

Depuis la fiche du programme, deux paramètres sont modifiables : la durée totale et les jours d’entraînement, en conservant le nombre de jours initial. Le niveau, l’objectif et la durée de séance restent ceux du programme créé.

### Exercices et matériel

L’interface et le moteur utilisent uniquement le catalogue importé de free-exercise-db. L’ajout et la modification d’exercices personnalisés sont bloqués côté API. Les anciens doublons « Curl marteau » sont rattachés à Hammer Curls, avec conservation des séances, séries, exclusions et de la progression la plus récente.

Les 876 exercices disposent de noms et de consignes en français et en anglais, selon la langue choisie dans Réglages. Les noms français gardent les termes courants comme curl, rowing, dips ou kettlebell. La recherche couvre les deux langues et ignore les accents et la casse. Les identifiants restent identiques : changer de langue conserve l’historique et la progression.

Le catalogue source reste dans `src/seed/exercises.json` ; les traductions statiques sont dans `src/seed/exercises.fr.json`. Les noms ont été rédigés en français ; les consignes ont été traduites avec assistance locale, avec relecture des 71 fiches du générateur et corrections de vocabulaire technique. Aucun traducteur ou modèle supplémentaire n’est nécessaire pour utiliser l’application. Au démarrage et avec `npm run load:exercises`, seuls les champs français des exercices existants sont actualisés. L’empreinte de chaque entrée vérifie sa correspondance avec la source anglaise : après un réimport modifiant un nom ou des consignes EN, actualiser aussi la traduction et son empreinte (`translationSource` dans `seed.js`). Les tests vérifient la couverture du catalogue.

La page **Exercices et Matériel** regroupe trois onglets : Exercices, Douleurs et Matériel. La recherche et les filtres permettent de choisir un muscle, un mouvement, une famille de matériel ou les exercices réalisables avec l’inventaire. Le compteur de l’onglet Exercices indique le nombre de mouvements restants après les filtres, douleurs et exclusions ; les exclusions sont signalées séparément. Consulter une fiche puis revenir conserve les filtres et la position de défilement. Les deux photos alternent automatiquement pour montrer les positions du mouvement, dans la fiche et dans l’aide en séance. Un bouton permet de mettre en pause ou de reprendre ; les images sont chargées une seule fois et l’animation s’arrête hors écran, quand l’onglet est masqué ou à la fermeture. La préférence de réduction des animations est respectée.

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

Le bouton Terminer propose **Continuer la séance**, **Quitter sans enregistrer** et **Terminer et enregistrer**. Quitter sans enregistrer efface les séries de cet essai et remet la même séance en planifiée, à sa date prévue d’origine. Terminer enregistre les séries validées et met à jour la progression. Depuis la fiche d’une séance terminée dans l’historique, **Réinitialiser la séance** efface ses résultats et la remet en planifiée ; les records et les acquis sont recalculés sur les séances restantes. Une confirmation et une sauvegarde précèdent la réinitialisation. Les anciennes requêtes de saisie de séries sont rejetées pour empêcher leur réapparition après remise à zéro.

La dernière séance du même exercice est présentée dans un tableau séparé. Une colonne 10RM compare les performances selon la formule sélectionnée ; les formules sont expliquées dans les réglages avancés.

La progression utilise les performances réellement enregistrées. Elle ajuste les cibles de charge et de répétitions tout en gardant une continuité des exercices ; les bilans peuvent proposer une semaine allégée. Le Coach IA ne décide pas de ces changements. La fin de séance et l’enregistrement des progrès forment une seule transaction : en cas d’échec du calcul, la séance reste en cours et peut être terminée à nouveau.

Pour débuter, le moteur limite chaque exercice à trois séries et utilise la double progression, y compris pour un objectif de force, avec une plage initiale de 8–12 répétitions. Les poids des haltères sont exprimés par haltère ; le calcul de départ distingue un mouvement à deux haltères d’un mouvement à un bras. Les hausses automatiques restent limitées à 10 % de la charge ou 1 kg pour les petites charges ; si le matériel impose un saut supérieur, la charge est maintenue. Une série menée à l’échec (RPE ≥ 9,5 ou RIR = 0) bloque une nouvelle hausse immédiate. Les cibles s’ajustent au matériel actuel sans effacer les performances passées.

Ces règles sont des choix de programmation, avec des repères issus des recommandations [ACSM 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) : entraînement progressif des grands groupes musculaires, volume adapté et absence d’obligation d’aller à l’échec. Elles ne constituent pas une validation individuelle des charges de départ.

À la création, le moteur privilégie les exercices utilisant le matériel disponible et répartit les variantes entre les séances, par exemple développé à plat en A et incliné en B avec un banc réglable. La sélection inclut notamment le squat et le soulevé de terre avec haltères, le développé au sol et le rowing avec une kettlebell. Les exigences matérielles restent propres à chaque mouvement du catalogue : un haltère ne remplace pas automatiquement une kettlebell. Des exercices au poids du corps restent possibles quand ils sont pertinents ou que le matériel manque. L’estimation du temps compte les deux côtés des exercices unilatéraux. Une charge ajoutée manuellement à un exercice au poids du corps est enregistrée ; le moteur ne propose pas encore automatiquement de lest optionnel.

Les acquis d’un exercice sont conservés indépendamment du programme : supprimer un programme puis en créer un autre permet de reprendre la progression des mouvements déjà pratiqués. Corriger, annuler ou supprimer une série historique, retirer son exercice ou supprimer sa séance recalcule les acquis à partir de l’historique restant et invalide le bilan hebdomadaire concerné. Les semaines suivent le calendrier local. Son créneau est conservé comme supprimé pour empêcher la planification automatique de la recréer, y compris pour une ancienne séance de test complétée à une date future. Pour les anciennes séances sans contexte de calcul enregistré, la récupération s’appuie conservativement sur leurs performances réelles.

Une série déjà enregistrée peut être renvoyée à l’identique sans doublon ; un renvoi avec des valeurs différentes est refusé pour éviter un écrasement silencieux. La fin de séance attend les sauvegardes en cours. Si la réponse réseau de fin ou d’annulation est perdue, l’interface vérifie l’état réellement enregistré avant de poursuivre.

L’accueil donne accès à l’historique. Les statistiques présentent le volume, la progression, les records et le suivi du poids corporel.

### Réglages et Coach IA

Les réglages regroupent Général, Profil, Séance, Coach IA et Réglages avancés. Le profil conserve le prénom, le sexe et la date de naissance ; les paramètres d’entraînement sont propres au programme.

Après une modification, une barre de sauvegarde apparaît au-dessus de la navigation. **Enregistrer** sauvegarde les changements de la page ensemble ; **Annuler** restaure les valeurs enregistrées. Un échec conserve les brouillons pour permettre de réessayer.

Le thème clair distingue les sections sur fond blanc, renforce les contours des champs et conserve des textes, états et graphiques lisibles. Les valeurs des séries validées restent visibles sur mobile.

Sur le déploiement Authelia, **Réglages → Se déconnecter** ferme la session de cet appareil, même mémorisée. La section affiche uniquement le bouton. Une confirmation permet de conserver un brouillon en annulant. Les données sauvegardées et la séance en cours restent sur le serveur ; une reconnexion permet de les retrouver. Le bouton apparaît uniquement si le proxy fournit cette intégration.

Le Coach IA utilise une API compatible OpenAI, configurée avec une URL, un modèle et éventuellement une clé API. Le test de connexion et la liste des modèles peuvent utiliser la saisie avant sa sauvegarde. Le coach conseille et dialogue ; il ne configure pas l’application et ne crée pas les programmes.

Le champ de message grandit avec le texte jusqu’à 120 px, puis permet de faire défiler les messages longs. Il rétrécit après effacement ou envoi ; aucune barre de défilement n’apparaît pour une saisie courte. Majuscule + Entrée ajoute une ligne, Entrée envoie le message.

La clé est stockée côté serveur, masquée dans l’interface et absente des réponses API et de l’export JSON. Une clé existante est conservée lorsqu’une sauvegarde ne fournit pas de nouvelle clé.

## Accès depuis un téléphone

Dans **Réglages → Réglages avancés**, configurer l’hôte réseau sur `0.0.0.0`, enregistrer et redémarrer le serveur. Depuis un téléphone sur le même réseau, ouvrir l’adresse IP locale de la machine, par exemple `http://192.168.1.10:3000`. Le pare-feu doit autoriser le port choisi.

L’application est prévue pour un usage personnel sur un réseau de confiance : elle n’a pas d’authentification et ne doit pas être exposée directement à Internet.

Le logo haltère apparaît dans l’onglet du navigateur et lors de **Partager → Sur l’écran d’accueil** dans Safari. Une icône Apple PNG 180×180 et les icônes du manifeste 192/512 complètent le favicon SVG/ICO. Leur source est `public/icons/workoutbuddy.svg` ; `node scripts/generate-icons.js` régénère les fichiers avec le Playwright déjà disponible pour les tests, sans dépendance ajoutée. iOS peut conserver l’ancienne icône d’un raccourci déjà installé : si nécessaire, retirer ce raccourci et l’ajouter à nouveau depuis Safari, sans effacer les données du site.

Sur mobile, le pincement et le double tap ne zooment
plus la page ; le défilement tactile reste natif et les champs compacts utilisent
au moins 16 px pour éviter le zoom à la saisie de Safari. Les options d’accessibilité
du navigateur ou du système peuvent toutefois primer sur ces règles.

En HTTPS, Safari et l’application ajoutée à l’écran d’accueil vérifient les nouvelles
versions à l’ouverture, au retour au premier plan et toutes les cinq minutes pendant
l’utilisation. Une version complète se charge automatiquement sur un écran de
consultation. Pendant une séance ou une saisie, une notification propose **Mettre à
jour**, avec confirmation avant de perdre une saisie non enregistrée. Aucun hard
refresh ni effacement des données du site n’est nécessaire. Le cache accélère les
fichiers statiques, mais les navigations passent par le réseau : une session
expirée renvoie vers le portail d’authentification, sans interface hors ligne
trompeuse. Les appels API distinguent aussi une session expirée d’une panne réseau.
Chaque livraison doit changer la version du cache.

## Configuration du serveur

Les variables d’environnement priment sur les réglages enregistrés. Elles peuvent être définies dans un fichier `.env` à la racine, en s’appuyant sur [.env.example](.env.example).

| Variable | Valeur par défaut | Usage |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Adresse d’écoute |
| `PORT` | `3000` | Port HTTP |
| `DB_PATH` | `data/workoutbuddy.db` | Base SQLite, chemin relatif au lancement ou absolu |
| `NODE_ENV` | développement | `production` exige une origine HTTPS explicite |
| `PUBLIC_ORIGIN` | origine HTTP locale de la requête | URL publique exacte, par exemple `https://workout.example.com` |
| `TRUST_PROXY` | désactivé | `loopback` uniquement si le proxy est local, protégé et réécrit les en-têtes transmis |

Si `HOST` ou `PORT` figure dans `.env`, modifier le réglage correspondant dans l’interface ne remplace pas cette variable. Redémarrer le serveur après un changement réseau. Configurer la clé du Coach IA dans l’application.

### Protections HTTP et hébergement

Les réponses portent une politique CSP, des protections contre les iframes et le sniffing de contenu et une politique de référent restrictive. Les données API ne sont pas mises en cache. Les appels API avec une origine étrangère ou signalés comme provenant d’un autre site sont refusés ; les écritures avec un corps exigent du JSON. Sans `PUBLIC_ORIGIN`, seuls les hôtes `localhost` et les adresses IP sont acceptés pour bloquer le DNS rebinding ; pour un nom local personnalisé, définir son origine HTTP exacte. Les clients sans en-tête Origin (CLI et outils locaux) restent possibles : ces contrôles ne remplacent pas une authentification.

La CSP autorise `unsafe-eval` pour la compilation des templates Vue actuels et les styles en ligne utilisés par l’interface ; les scripts en ligne sont interdits. Retirer `unsafe-eval` demanderait de précompiler les templates. L’enregistrement du service worker est dans le module externe de l’application. HSTS s’applique à l’origine HTTPS configurée ou à une connexion reconnue HTTPS, sans forcer le HTTPS sur le LAN HTTP.

Limites par IP et par minute : 600 appels API ; dans ce total, 60 créations/aperçus de programme, 30 imports/sauvegardes/réinitialisations et 12 appels IA (chat, connexion, modèles, conseils). Deux appels IA et une seule importation peuvent être en cours au maximum pour l’instance mono-utilisateur ; la réservation d’import intervient avant la lecture du corps volumineux. Une réponse 429 indique `Retry-After` ; les limites coûtent une mémoire bornée et sont remises à zéro au redémarrage. Les corps JSON sont limités à 100 Ko, sauf l’import à 20 Mo ; les corps compressés sont refusés. Le serveur borne également les délais de réception des requêtes/en-têtes.

Sur un VPS, faire écouter Node sur `127.0.0.1`, derrière un proxy ou tunnel avec HTTPS **et une authentification externe**. Définir `NODE_ENV=production` et `PUBLIC_ORIGIN=https://workout.example.com`. Le proxy doit conserver le champ Host public et rediriger HTTP vers HTTPS ; ne pas exposer directement le port de Node. `TRUST_PROXY=loopback` permet de lire l’IP transmise uniquement depuis un proxy local de confiance ; celui-ci doit supprimer ou réécrire les en-têtes fournis par le client. Par défaut, les en-têtes de proxy ne sont pas utilisés. Ne pas exécuter l’application en root.

Les dépendances serveur sont verrouillées dans `package-lock.json`. Vérifier avec `npm audit`, installer avec `npm ci` et tester les mises à jour avant déploiement. La cible est Node 24 LTS ; Node 20 n’est plus pris en charge.

Le [guide Rocky Linux](docs/DEPLOYMENT_ROCKY.md) et `deploy/rocky/` décrivent
l’hébergement public gratuit avec Caddy et Authelia, les sauvegardes, les protections
systemd et la maintenance nocturne. Les RPM stables et Node restent suivis par DNF
sur la branche 24 ; les paquets npm sont audités chaque semaine puis mis à jour
après tests, sans modification automatique des dépendances en production.
Sur un appareil de confiance, cocher **Se souvenir de moi** dans Authelia conserve
la connexion complète pendant 60 jours, y compris après maintenance. Sans cette
option : 15 minutes d’inactivité, une heure maximum. Une déconnexion invalide la
session mémorisée ; le navigateur peut aussi supprimer son cookie plus tôt.

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

La base et ses journaux `-wal`/`-shm`/`-journal` ainsi que les sauvegardes SQLite reçoivent les permissions POSIX `0600` (lecture/écriture du propriétaire seulement). Le dossier `data/` du projet, les nouveaux dossiers de stockage et le dossier `backups/` reçoivent `0700`. Le démarrage corrige aussi les fichiers existants ; la création d’une sauvegarde restreint les anciennes copies avant de poursuivre. Un lien symbolique utilisé comme fichier sensible ou dossier final est refusé.

Avec un `DB_PATH` personnalisé, les permissions d’un dossier parent déjà existant ne sont pas modifiées : utiliser un dossier dédié, appartenant au compte du service. Un parent personnalisé modifiable par le groupe ou les autres utilisateurs est refusé. Ces permissions ne chiffrent pas les données et ne protègent pas contre root ou un processus exécuté sous le même compte. La clé API reste dans SQLite et ses sauvegardes ; les exports téléchargés sont soumis aux permissions de l’appareil qui les reçoit.

La base utilise le journal SQLite WAL. Pour une copie manuelle, arrêter le serveur avant de copier la base et ses éventuels fichiers `-wal`/`-shm`. Le bouton de sauvegarde crée un fichier cohérent même si le serveur tourne. Pour restaurer une sauvegarde SQLite, arrêter le serveur puis remplacer la base en évitant de conserver les anciens journaux du fichier remplacé.

L’export JSON et la sauvegarde locale contiennent des données personnelles ; les conserver dans un emplacement approprié. La base, les sauvegardes, `.env` et les exports locaux sont exclus de Git.

## Tests et développement

```sh
npm test                  # Tests unitaires, API et parcours complets sans port TCP
npm run test:journeys     # Sept parcours de fiabilité
npm run test:e2e          # Vrais parcours navigateur, ordinateur et mobile
npm run test:e2e -- sessions  # Domaine séance uniquement
npm run test:e2e:affected # Domaines concernés par les fichiers modifiés
npm run hooks:install    # Contrôles avant push pour ce dépôt
npm run test:in-process   # Même suite que npm test, alias du hook
```

Les tests utilisent des bases isolées en mémoire ou temporaires. Par défaut, `npm test` exécute les requêtes Express directement, sans ports TCP éphémères ; les vrais échanges HTTP sont couverts par Playwright. Les parcours complets exécutent l’API et le moteur réels sans service IA : programme/calendrier, séance/progression, suppressions/historique, export/import, réglages, remplacement et rollback d’un import invalide. Voir [leur guide](tests/journeys/README.md). `tests/integration/reliabilityStress.test.js` ajoute une simulation de 24 séances sur douze semaines, doubles requêtes, corrections historiques, imports incohérents, rollback et allègement après fatigue. Le temps historique y est préparé dans les fixtures ; le serveur et les calculs restent réels. Résultats et limites : [audit de fiabilité](docs/RELIABILITY_AUDIT.md).

Les tests de `tests/e2e/` pilotent le navigateur contre le vrai serveur et une base temporaire indépendante pour chaque cas, sans réponses API simulées. Ils sont séparés par domaine : programmes, séances, historique/calendrier, matériel, réglages, données, exercices et statistiques. Les parcours vérifient aussi rechargements, redémarrages et erreurs réseau ; ils tournent sous Chrome en formats ordinateur et mobile. Le hook avant push lance les tests métier/API avec `test:in-process` (sans ouvrir de ports TCP), puis les domaines navigateur concernés par les commits, contre de vrais serveurs HTTP. Voir [installation, sélection et rapports](tests/e2e/README.md).

Les anciens scénarios de `tests/ui/` servent aux contrôles visuels complémentaires ; certains utilisent des réponses API simulées. Les tests navigateur restent séparés de `npm test`.

Le frontend utilise des modules JavaScript et des composants Vue avec templates, sans fichiers `.vue` ni compilation. Le backend utilise Express et SQLite synchrone. Les migrations existantes restent immuables ; les nouveaux changements de schéma prennent la forme d’une migration numérotée. Toute modification de `public/` doit mettre à jour le cache du service worker.

Pour naviguer dans le dépôt : [CODEBASE.md](CODEBASE.md) est l’index du code, [AGENT.md](AGENT.md) contient les règles de développement et [TASKS.md](TASKS.md) suit les tâches. Le [dernier audit de fiabilité](docs/RELIABILITY_AUDIT.md) précise la couverture et ses limites. Les tâches terminées et anciens plans restent consultables dans l’historique Git.

Le [contrôle du dépôt public](docs/REPOSITORY_SECURITY.md) décrit la recherche de secrets dans les fichiers et l’historique, ses limites et la commande pour la répéter.
