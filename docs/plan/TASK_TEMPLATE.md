# T{X}.{Y} — {Titre}

> **Fichier auto-suffisant.** Toutes les informations nécessaires sont
> ici. Ne pas charger le plan complet.

---

## Métadonnées

| Champ        | Valeur                                      |
|--------------|---------------------------------------------|
| ID           | T{X}.{Y}                                    |
| Jalon        | {N} — {Nom du jalon}                        |
| Dépendances  | T{A}.{B}, T{C}.{D}                          |
| Estimation   | ~{N} h (session LLM unique)                 |

---

## Objectif

{Description précise de ce que cette tâche produit. Une phrase par
livrable concret.}

---

## Fichiers concernés

### À créer
```
chemin/vers/fichier.js     ← rôle du fichier
chemin/vers/autre.js       ← rôle du fichier
```

### À modifier
```
chemin/vers/existant.js    ← ce qui change : {description}
```

---

## Contexte et extraits du plan

{Coller ici directement les extraits pertinents du plan :
schéma SQL concerné, signatures d'API, algorithmes, types.
PAS de "voir Partie X". Tout est ici.}

### Schéma DB impliqué

```sql
-- Uniquement les tables concernées par cette tâche
```

### Endpoints API à implémenter

```
METHODE  /chemin
  Body: { ... }
  Response 201: { ... }
  Erreur 400: { error: "..." }
```

### Algorithme / Pseudo-code

```
FUNCTION nomFonction(params):
  ...
```

### Signatures des fonctions à créer

```javascript
// fichier.js
export function nomFonction(param1: type, param2: type): ReturnType
// Description précise du contrat : ce qu'elle fait, ce qu'elle retourne,
// cas limites.
```

### Types de données

```javascript
// Type X tel qu'attendu en entrée/sortie
{
  "champ": "type et description",
}
```

---

## Étapes d'implémentation

1. {Étape atomique et précise}
2. {Étape suivante}
3. ...

**Points d'attention :**
- {Cas limite 1}
- {Cas limite 2}

---

## Tests à écrire

Fichier : `tests/unit/{nom}.test.js` ou `tests/integration/{nom}.test.js`

```javascript
// Cas 1 — {description}
test('{description}', () => {
  // arrange
  // act
  // assert
})

// Cas 2 — {description}
test('{description}', () => { ... })
```

---

## Critères d'acceptation

- [ ] {Comportement observable 1}
- [ ] {Comportement observable 2}
- [ ] `npm test` passe sans erreur
- [ ] {Critère fonctionnel spécifique}