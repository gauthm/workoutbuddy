# TASKS.md — Index des tâches WorkoutBuddy

> **Pour l'agent IA** : Ce fichier est ton point d'entrée. Lis-le,
> identifie la prochaine tâche non cochée, charge son fichier de tâche
> depuis `docs/plan/tasks/`, puis implémente. Ne charge pas ce fichier
> ET le plan complet en même temps.

---

## Comment utiliser ce fichier

1. Trouver la première tâche sans ✅ dont toutes les dépendances sont ✅.
2. Charger `docs/plan/tasks/<fichier>` — il est auto-suffisant.
3. Implémenter, faire passer les tests.
4. Remplacer `[ ]` par `[x]` sur la ligne de la tâche.
5. Passer à la suivante.

**Légende des statuts :**
- `[ ]` — À faire
- `[x]` — Terminé ✅
- `[~]` — En cours
- `[!]` — Bloqué

---

## Jalon 1 — Socle, exercices, équipement

| ID   | Tâche                              | Dépendances | Fichier de tâche                        | Statut |
|------|------------------------------------|-------------|-----------------------------------------|--------|
| T1.1 | Scaffolding projet                 | —           | `tasks/T1.1_scaffolding.md`             | [x]    |
| T1.2 | Base de données et migrations      | T1.1        | `tasks/T1.2_database.md`               | [x]    |
| T1.3 | Seed des exercices                 | T1.2        | `tasks/T1.3_seed.md`                   | [x]    |
| T1.4 | API Exercices                      | T1.3        | `tasks/T1.4_api_exercises.md`          | [x]    |
| T1.5 | Service calcul charges + API Équipement | T1.2   | `tasks/T1.5_equipment_calc.md`         | [x]    |
| T1.6 | Scaffold frontend Vue 3            | T1.1        | `tasks/T1.6_frontend_scaffold.md`      | [x]    |
| T1.7 | Écrans Exercices + Équipement      | T1.4, T1.5, T1.6 | `tasks/T1.7_screens_exercises.md` | [x]    |
| T1.8 | PWA (manifest + service worker)    | T1.6        | `tasks/T1.8_pwa.md`                    | [x]    |
| T1.9 | Haltères à disques, disques haltères, banc inclinable        | T1.5, T1.7       | `tasks/T1.9_equipment_enhancements.md`      | [x]    |

---

## Jalon 2 — Programmes, mode séance, timers

| ID   | Tâche                                   | Dépendances      | Fichier de tâche                        | Statut |
|------|-----------------------------------------|------------------|-----------------------------------------|--------|
| T2.1 | API Programmes et Templates             | T1.2, T1.4       | `tasks/T2.1_api_programs.md`            | [x]    |
| T2.2 | API Sessions et Sets                    | T2.1             | `tasks/T2.2_api_sessions.md`            | [x]    |
| T2.3 | Écrans Programmes (liste + détail + création) | T2.1, T1.6  | `tasks/T2.3_screens_programs.md`        | [x]    |
| T2.4 | Écran séance active + validation séries | T2.2, T1.6       | `tasks/T2.4_screen_session_active.md`   | [x]    |
| T2.5 | Timers (Web Worker + sons + Wake Lock)  | T2.4             | `tasks/T2.5_timers.md`                  | [x]    |

---

## Jalon 3 — Progression, deload, calendrier

| ID   | Tâche                          | Dépendances  | Fichier de tâche                        | Statut |
|------|--------------------------------|--------------|-----------------------------------------|--------|
| T3.1 | Moteur de progression          | T1.5, T2.2   | `tasks/T3.1_progression_engine.md`      | [x]    |
| T3.2 | Détection de plateau + deload  | T3.1         | `tasks/T3.2_plateau_deload.md`          | [x]    |
| T3.3 | Rotation d'exercices           | T3.1, T2.2   | `tasks/T3.3_rotation.md`                | [x]    |
| T3.4 | Calendrier (API + écran)       | T2.2, T1.6   | `tasks/T3.4_calendar.md`                | [x]    |

---

## Jalon 4 — Stats et courbes

| ID   | Tâche                   | Dépendances  | Fichier de tâche                        | Statut |
|------|-------------------------|--------------|-----------------------------------------|--------|
| T4.1 | API Stats + streaks     | T2.2, T3.1   | `tasks/T4.1_api_stats.md`               | [x]    |
| T4.2 | Poids de corps          | T1.6, T4.1   | `tasks/T4.2_bodyweight.md`              | [x]    |
| T4.3 | Écrans statistiques     | T4.1, T4.2   | `tasks/T4.3_screens_stats.md`           | [x]    |

---

## Jalon 5 — Coach IA expert et conseils

| ID   | Tâche                                          | Dépendances           | Fichier de tâche                          | Statut |
|------|------------------------------------------------|-----------------------|-------------------------------------------|--------|
| T5.1 | Service AI Provider + Settings IA              | T1.2                  | `tasks/T5.1_ai_provider.md`               | [x]    |
| T5.2 | Profil utilisateur + migration DB              | T1.2                  | `tasks/T5.2_user_profile.md`              | [x]    |
| T5.3 | API Chat expert + actions enrichies            | T5.1, T5.2, T2.1      | `tasks/T5.3_api_chat_expert.md`           | [x]    |
| T5.4 | Conseiller coaching + génération conseils      | T5.1, T5.3, T3.2      | `tasks/T5.4_coaching_advisor.md`          | [x]    |
| T5.5 | Interface Coach + Onboarding conversationnel   | T5.3, T5.4, T1.6      | `tasks/T5.5_screen_coach.md`              | [x]    |

---

## Jalon 6 — Paramètres, export/import

| ID   | Tâche                              | Dépendances      | Fichier de tâche                        | Statut |
|------|------------------------------------|------------------|-----------------------------------------|--------|
| T6.1 | API Paramètres complète            | T1.2             | `tasks/T6.1_api_settings.md`            | [x]    |
| T6.2 | Écran Paramètres complet           | T6.1, T5.1, T1.6 | `tasks/T6.2_screen_settings.md`         | [x]    |
| T6.3 | Export/Import + sauvegarde auto    | T2.2, T6.1       | `tasks/T6.3_export_import.md`           | [x]    |

---

## Jalon 7 — Expérience séance intelligente

| ID   | Tâche                                                         | Dépendances              | Fichier de tâche                              | Statut |
|------|---------------------------------------------------------------|--------------------------|-----------------------------------------------|--------|
| T7.1 | Suggestion premier essai + bulle progression + colonne 10RM   | T3.1, T5.2, T2.4         | `tasks/T7.1_smart_setrow.md`                  | [x]    |
| T7.2 | Génération automatique séances (semaine courante + suivante)   | T2.1, T2.2               | `tasks/T7.2_session_scheduler.md`             | [x]    |
| T7.3 | Ajustement coach au lancement de séance                        | T7.1, T7.2               | `tasks/T7.3_session_adjustment.md`            | [x]    |
| T7.4 | Historique enrichi, suppression séance, reset stats            | T2.2, T4.1, T6.2         | `tasks/T7.4_history_delete_reset.md`          | [x]    |
| T7.5 | Bibliothèque exercices dans nav, exclusion, programme unique   | T1.4, T1.6, T5.3         | `tasks/T7.5_exercise_library_exclusion.md`    | [x]    |


**Ordre d'exécution recommandé :**
```
T7.1 → T7.2 → T7.3
T7.4  (indépendant de T7.1-T7.3)
T7.5  (indépendant de T7.1-T7.4, mais à faire avant de lancer le coach)
```

---

## Jalon 8 — Historique coach, transparence profil, matériel

| ID   | Tâche                                                          | Dépendances        | Fichier de tâche                              | Statut |
|------|----------------------------------------------------------------|--------------------|-----------------------------------------------|--------|
| T8.1 | Conversations coach : migration DB + API CRUD + export/import  | T1.2, T5.3         | `tasks/T8.1_coach_conversations_api.md`       | [x]    |
| T8.2 | Persistance du chat serveur + historique dans la vue Coach     | T8.1, T5.5         | `tasks/T8.2_chat_persistence_coach_ui.md`     | [x]    |
| T8.3 | Paramètres : « Mon profil » (édition, reset) + gate coach : pas de programme sans profil, invitation checklist matériel | T5.2, T5.3, T6.2 | `tasks/T8.3_settings_profile.md`              | [x]    |
| T8.4 | Paramètres : « Matériel » — catalogue par catégories cochables (défaut : tout coché), poids barres/haltères, disques × nombre une ligne par type | T1.7, T6.2 | `tasks/T8.4_settings_equipment.md`            | [x]    |

**Ordre d'exécution recommandé :**
```
T8.1 → T8.2
T8.3, T8.4 (indépendants de T8.1/T8.2, exécutables en parallèle)
⚠️ Tâches touchant public/ : bump CACHE_NAME dans sw.js — incrémenter
   d'une unité au-dessus de la valeur courante au moment du commit
   (les tâches peuvent se suivre dans n'importe quel ordre).
```/new

---

## Récapitulatif des jalons

| Jalon | Thème                        | Tâches | Prérequis         |
|-------|------------------------------|--------|-------------------|
| J1    | Socle, exercices, équipement | 9      | —                 |
| J2    | Programmes, séance, timers   | 5      | J1 complet        |
| J3    | Progression, deload, calendrier | 4   | J2 complet        |
| J4    | Stats et courbes             | 3      | J3 complet        |
| J5    | Coach IA, conseils achat     | 5      | J3 + J4 complets  |
| J6    | Paramètres, export/import    | 3      | J5 complet        |
| J7    | Séance intelligente          | 5      | J6 complet        |
| J8    | Historique coach, profil, matériel | 4  | J5 + J6 complets  |
| **Total** |                         | **38** |                   |

---

## Critères de complétion d'un jalon

Un jalon est **terminé** quand :
- Toutes ses tâches sont cochées `[x]`
- `npm test` passe sans erreur
- La fonctionnalité est testable manuellement sur mobile (Chrome Android
  ou Safari iOS via LAN)

## Évolution demandée — moteur de programmes et conseiller

- [x] Questionnaire de création sans IA, moteur déterministe, aperçu et matériel vérifié.
- [x] Exercices stables, progression conservée par exercice et bilan hebdomadaire.
- [x] Conseiller IA en lecture seule ; anciennes actions de configuration bloquées.
- [x] Profil personnel simplifié ; poids, taille et objectifs propres au programme.
- [x] Réinitialisations adaptées aux nouvelles données, sauvegardes et tests de portée.

Détails et validation : `docs/PROGRAM_ENGINE_TODO.md`.

- [x] Séance : colonne 10RM, tableau des dernières séries sous Échauffement, explications des formules RM et conversion cohérente (détails : `docs/SESSION_UI_TODO.md`).

- [x] Simplifier les paramètres : retirer les seuils internes et options obsolètes, garder les préférences utiles et regrouper RM/réseau dans Réglages avancés (détails : `docs/SETTINGS_TODO.md`).

- [x] Matériel : liste unique de cases sous les élastiques, sans Home gym/Salle ; audit de couverture des besoins des exercices et corrections d’import (détails : `docs/EQUIPMENT_TODO.md`).

- [x] Matériel : familles repliables, recherche et résumé ; catégorie personnalisée séparée ; filtre « Matériel » commun dans Exercices et « Réalisables avec mon matériel » (360 tests, 16 présentations Playwright).

- [x] Déplacer Matériel dans un onglet à droite de Douleurs ; renommer la page et la navigation « Exercices et Matériel » sur deux lignes ; conserver brouillons et anciens liens.

- [x] Déplacer Données dans Réglages avancés ; supprimer le bouton de réinitialisation du profil ; renommer Conseiller IA en Coach IA.
- [x] Exercices : volet Filtre repliable, quatre lignes Muscle/Mouvement/Matériel/disponibilité ; recherches de matériel et d’exercices au même design (360 tests, contrôle Playwright de 320 à 1280 px).

- [x] Renommer le volet Filtres et aligner l’espacement de la recherche Matériel sur Exercices.
- [x] Programme à durée illimitée : choix explicite, validation, stockage null, aperçu et détail ; progression hebdomadaire inchangée.
- [x] Réglages avancés : trois blocs cohérents Calcul des performances / Réseau / Données, titres et séparateurs harmonisés.
- [x] Recherche d’exercices vide : « Rechercher un exercice… » ; réinitialiser stats et historique : seule icône poubelle.
- [x] Déplacer le texte explicatif des réglages avancés dans « Comprendre les formules RM ».

- [x] Modifier seulement la durée totale du programme (semaines ou illimitée) depuis sa fiche ; autres champs verrouillés aussi dans l’API ; conserver programme, séances et progression.

- [x] Calendrier : afficher uniquement les quatre statuts du programme actif ; retirer les séances planifiées lors de la suppression de leur programme tout en conservant l’historique.
- [x] Création : cocher les jours d’entraînement et planifier les séances sur ces jours.

- [x] Renommer les exports CSV en « Résumé des séances » et « Détail des séries », avec une description du contenu de chaque ligne (FR/EN).

- [x] Réglages : Général replié par défaut.

- [x] Coach IA : un bouton Enregistrer à droite de Tester la connexion, sauvegarde groupée URL/modèle/clé, fin des sauvegardes individuelles ; clé configurée affichée avec des points.

- [x] Réglages : bouton Enregistrer fixe au-dessus de la navbar, visible seulement après une modification ; sauvegarde groupée des préférences/profil/Coach IA/réglages avancés, annulation et brouillons conservés après erreur.
- [x] Réglages : renommer Mon profil en Profil, En séance en Séance ; Profil avant Séance.
- [x] Programme : modifier uniquement sa durée totale et ses jours d’entraînement, avec exactement le même nombre de jours qu’à la création.
- [x] Sauvegarde Réglages « Not found » : relancer le serveur pour charger la nouvelle route atomique.

- [x] Fiche du programme : remplacer un exercice par une alternative similaire compatible avec le matériel ; prochaines séances seulement, historique et progression par exercice conservés.

- [x] Audit : isoler les brouillons des réglages du store, y compris après annulation ou erreur de sauvegarde.
- [x] Audit : recalculer la progression par exercice et les cibles des programmes après suppression d’une séance ; conserver le contexte de calcul dans l’export/import.
- [x] Audit : respecter la durée depuis la première activation, afficher la fin et arrêter les nouvelles séances ; permettre une prolongation ou une durée illimitée.
- [x] Audit : vérifier le nombre d’haltères réglables requis dans le calcul partagé des charges.
- [x] Audit : enregistrer les zones douloureuses en base, migrer les anciennes préférences du navigateur et filtrer la création/remplacement sur les muscles principaux et secondaires.

- [x] Fiabilité : sept parcours API complets sur base isolée (programme/calendrier, séance/progression, suppression/historique, export/import, réglages, remplacement, rollback d’import invalide), intégrés à `npm test` ; commande `npm run test:journeys` et documentation. Validation : 386 tests réussis et contrôles Playwright des réglages sur quatre tailles d’écran.

- [x] Documentation : réduire CODEBASE.md à un index et actualiser le README (installation, fonctionnement actuel, données, sauvegardes et tests).

- [x] Séance hors du jour prévu : déplacer au jour local du premier démarrage, garder original_scheduled_date, conserver les autres séances et empêcher le planificateur de recréer le créneau d’origine. Reprise et export/import compatibles ; migration 014, six tests ciblés et 392 tests réussis. Base sauvegardée et serveur relancé.

- [x] Semaine accomplie : message sur l’accueil et la fiche du programme quand les séances terminées du programme actif atteignent la fréquence prévue, du lundi au dimanche. Trois tests API (frontières de semaines et reprise d’une séance inachevée), contrôle Playwright sur quatre tailles d’écran ; ancien test de statistiques isolé en mémoire et sans port TCP.

- [x] Matériel : supprimer les coches de validation par ligne et le gros bouton de sauvegarde ; brouillons communs pour lignes, cases, ajouts personnalisés et suppressions ; barre flottante conditionnelle identique aux réglages avec Annuler/Enregistrer. Sauvegarde atomique PUT /equipment/inventory, protection des inventaires modifiés ailleurs et reprise après erreur. Validation : 399 tests et parcours Playwright à 320/390/768/1280 px.

- [x] Création : priorités musculaires regroupées haut/bas avec sélection de groupe et autant de muscles que souhaité ; validation serveur adaptée. Remplir davantage le temps de séance choisi, avec limites de volume et explication des durées plus courtes.
- [x] Exercices : conserver filtres/recherche/panneau et scroll au retour d’une fiche ; boutons photos précédente/suivante ; compteur permanent des exercices restants, exclusions signalées séparément.
- [x] Historique : suppression durable d’une séance complétée dans le futur ; migration 015 des créneaux supprimés, respect par le planificateur et export/import, effacement à la réinitialisation des statistiques. Tests de suppression répétée, reprise du planificateur, autres séances préservées et mémoire de progression.
- [x] Validation : 405 tests réussis et parcours Playwright complet sur choix musculaires, 45/60 min, compteurs, photos et retour à la liste, contrôles à 320/390/768/1280 px. Règles de progression sur charge réellement abaissée et échecs répétés, et compatibilité banc réglable/plat vérifiées.

- [x] Historique : légende des points de statut, avec Complétée/En cours/Planifiée et Sautée si présente ; En cours en bleu, Planifiée en orange, même repère dans le calendrier. Libellés accessibles sur les points. Validation : 405 tests et contrôle navigateur à 320/390/768/1280 px.

- [x] Retirer l’ajout d’exercices personnalisés : utiliser le catalogue intégré provenant de la base gratuite.
- [x] Calendrier : vérifier pourquoi la séance complétée aujourd’hui « Séance découverte » n’affiche pas de point vert.

- [x] Générateur : privilégier le matériel utilisable et varier les mouvements principaux entre séances, développé à plat A / incliné B avec haltères à disques et banc réglable. Garder des mouvements au poids du corps pertinents, sans retirer les contrôles de niveau, disponibilité, volume et exclusions. Quatre nouveaux tests API ; 409 tests passent.
- [x] Calendrier : montrer les séances réellement complétées/en cours, y compris « Séance découverte » sans programme, tout en réservant les plans et séances sautées au programme actif.
- [x] Création : un seul bouton Nouveau programme sur la page Programmes vide ; même libellé dans la vue Séance. Vérifications navigateur des états vides, de l’absence d’ajout d’exercice et du point vert de la séance sans programme.

- [x] Messages sans programme : « Aucun programme actif. » sur accueil/programmes/séance, suppression des anciennes références à la création par le coach dans les libellés de création.

- [x] États vides : même alignement du bouton Nouveau programme dans Programmes et Séance (marge spécifique retirée, accueil harmonisé) ; corriger aussi la destination du bouton de Séance vers le questionnaire. 409 tests et position identique vérifiée à 320/390/768/1280 px.

- [x] Audit Coach IA : retirer les anciens composants/actions de configuration et les formulaires inutilisés ; conserver uniquement le conseil, supprimer les blocs d’action du flux et des réponses sauvegardées, refuser les appels historiques de configuration.
- [x] Catalogue : fusionner les huit curls personnalisés dans Hammer Curls ; migration 016 et import d’anciennes sauvegardes préservant séries, historique, exclusions, contexte et progression la plus récente. Catalogue seul dans la liste, le générateur et les remplacements ; création et édition custom bloquées.
- [x] Réseau : élargir le champ du port ; 65535 entièrement visible et aucun débordement à 320/390/768/1280 px.
- [x] Moteur : corriger les références et exigences de matériel, intégrer squat/charnière de hanches avec haltères et mouvements simples avec une kettlebell ; compter les deux côtés dans la durée, limiter le débutant à trois séries et démarrer la force en double progression à 8–12 reps.
- [x] Séances : charges de départ par haltère, hausses automatiques bornées, maintien après effort à l’échec, aucune hausse lors d’une réduction/allègement, adaptation des cibles à l’inventaire actuel et semaines comptées depuis l’activation. Complétion et progression atomiques avec test d’échec et de reprise.
- [x] Validation : 424 tests réussis, dont 15 nouveaux cas ; navigation et champ réseau vérifiés avec Playwright. Base sauvegardée avant migration, serveur relancé, catalogue revenu à 876 entrées et historique inchangé après fusion.

- [x] Calendrier : « Remettre en planifiée » pour annuler le statut Sautée, puis démarrer ou déplacer la séance. Route dédiée ne modifiant que le statut, sans doublon ni perte de date/séries/progression ; refus des autres statuts, protection contre double clic. 426 tests réussis et parcours Playwright à 320/390/768/1280 px.

- [x] Bout en bout : environnement Playwright avec vrai serveur, port libre et base SQLite temporaire par cas, nettoyage automatique et tests de persistance après redémarrage ; aucun ajout de dépendance projet ni utilisation du serveur personnel.
- [x] Parcours séparés programmes, séances, historique/calendrier, matériel, réglages, données, exercices et statistiques ; cas normaux, annulation, échecs réseau, imports invalides, validations et suppression durable. 18 scénarios × ordinateur/mobile : 36 réussites, plus 429 tests métier/API réussis.
- [x] Commandes par domaine et sélection par fichiers/dépendances ; hook local avant push activé, tests métier puis domaines concernés ; rapport HTML, captures, traces et journaux en échec. Guide E2E, README, index et consignes de développement actualisés.

- [x] Photos : composant partagé d’alternance des images dans la fiche et l’aide en séance, sans précédent/suivant ; pause/reprise, réduction des animations respectée, arrêt hors écran/onglet masqué et nettoyage à la fermeture. Deux images chargées une seule fois, sans vidéo générée.
- [x] Fin de séance : proposer Continuer la séance, Quitter sans enregistrer, Terminer et enregistrer. Quitter sans enregistrer efface l’essai et remet la même séance en planifiée ; compteurs et chronomètres libérés.
- [x] Historique : réinitialiser une séance terminée avec confirmation et sauvegarde, conserver sa planification d’origine et permettre de la recommencer ; recalcul des records/progrès, invalidation du bilan de la semaine concernée et rejet des requêtes tardives des anciennes séries. Opération atomique, autres séances conservées.
- [x] Validation : 436 tests métier/API et 48 parcours Playwright réussis sur ordinateur/mobile, dont remise à zéro/reprise, progression antérieure conservée, rollback, archive sans programme, animation/pause et arrêt hors écran.

- [x] Traductions : 876 noms et fiches FR, anglais conservé, vocabulaire courant de musculation ; 71 fiches du générateur relues. Affichage selon la langue dans catalogue, programmes, séances, aides, repos et statistiques ; recherche FR/EN sans accents ni casse. Synchronisation des champs FR sans changement des identifiants, exclusions ou acquis. Validation : 440 tests métier/API et 52 parcours Playwright réussis ; sauvegarde, serveur relancé et 20 collections utilisateur vérifiées identiques.
- [ ] Détail du programme : ne plus afficher le poids et la taille.
- [ ] Poids corporel : ajouter au suivi la mesure saisie à la création du programme ; conserver séparément le poids de référence utilisé pour créer le programme, même si cette mesure est ensuite supprimée depuis le suivi du poids.
