# Sauvegarde, export et réinitialisation

[Accueil de la documentation](INDEX.md) · [README](../README.md)

- [Actions disponibles](#actions-disponibles)
- [Permissions des fichiers](#permissions-des-fichiers)
- [Stockage personnalisé et confidentialité](#stockage-personnalisé-et-confidentialité)
- [Copier et restaurer SQLite](#copier-et-restaurer-sqlite)
- [Fichiers personnels et Git](#fichiers-personnels-et-git)

## Actions disponibles

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

## Permissions des fichiers

La base et ses journaux `-wal`/`-shm`/`-journal` ainsi que les sauvegardes SQLite reçoivent les
permissions POSIX `0600` (lecture/écriture du propriétaire seulement). Le dossier `data/` du projet,
les nouveaux dossiers de stockage et le dossier `backups/` reçoivent `0700`. Le démarrage corrige
aussi les fichiers existants ; la création d’une sauvegarde restreint les anciennes copies avant de
poursuivre.

Un lien symbolique utilisé comme fichier sensible ou dossier final est refusé.

## Stockage personnalisé et confidentialité

Avec un `DB_PATH` personnalisé, les permissions d’un dossier parent déjà existant ne sont pas
modifiées : utiliser un dossier dédié, appartenant au compte du service. Un parent personnalisé
modifiable par le groupe ou les autres utilisateurs est refusé. Ces permissions ne chiffrent pas les
données et ne protègent pas contre root ou un processus exécuté sous le même compte.

La clé API reste dans SQLite et ses sauvegardes ; les exports téléchargés sont soumis aux
permissions de l’appareil qui les reçoit.

## Copier et restaurer SQLite

La base utilise le journal SQLite WAL. Pour une copie manuelle, arrêter le serveur avant de copier
la base et ses éventuels fichiers `-wal`/`-shm`. Le bouton de sauvegarde crée un fichier cohérent
même si le serveur tourne. Pour restaurer une sauvegarde SQLite, arrêter le serveur puis remplacer
la base en évitant de conserver les anciens journaux du fichier remplacé.

## Fichiers personnels et Git

L’export JSON et la sauvegarde locale contiennent des données personnelles ; les conserver dans un
emplacement approprié. La base, les sauvegardes, `.env` et les exports locaux sont exclus de Git.
