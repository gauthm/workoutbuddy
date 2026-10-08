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
| T6.1 | API Paramètres complète            | T1.2             | `tasks/T6.1_api_settings.md`            | [ ]    |
| T6.2 | Écran Paramètres complet           | T6.1, T5.1, T1.6 | `tasks/T6.2_screen_settings.md`         | [ ]    |
| T6.3 | Export/Import + sauvegarde auto    | T2.2, T6.1       | `tasks/T6.3_export_import.md`           | [ ]    |

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
| **Total** |                         | **29** |                   |

---

## Critères de complétion d'un jalon

Un jalon est **terminé** quand :
- Toutes ses tâches sont cochées `[x]`
- `npm test` passe sans erreur
- La fonctionnalité est testable manuellement sur mobile (Chrome Android
  ou Safari iOS via LAN)