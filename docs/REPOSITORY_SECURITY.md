# Vérification du dépôt public

[Accueil de la documentation](INDEX.md) · [README](../README.md)

Contrôle effectué le 16 octobre 2026 sur les fichiers versionnés actuels et les 50 commits
accessibles, avant publication des changements d’interface.

### Résultats du contrôle

- Gitleaks 8.30.1 : aucune détection dans l’historique ou les fichiers actuels.
- Aucun fichier de base SQLite, sauvegarde, `.env` réel, clé privée ou fichier
  utilisateur Authelia retrouvé dans l’historique.
- Aucun identifiant spécifique au VPS retrouvé dans les contenus historiques.
- Comparaison en mémoire des secrets présents dans les configurations de
  production avec les contenus Git : aucune correspondance ; aucun secret
  affiché ou enregistré dans un rapport versionné.
- Les adresses des scénarios de test sont des exemples réservés.
- Les métadonnées de 42 anciens commits contiennent une adresse e-mail
  personnelle. L’historique est conservé ; les nouveaux commits utilisent une
  adresse GitHub noreply.

### Limites et fichiers ignorés

Le contrôle automatisé ne garantit pas l’absence de toute donnée sensible. Les données locales,
exports, journaux, variantes `.env.*`, bases SQLite et clés sont ignorés par Git ; `.env.example`
reste volontairement versionné. Ne jamais ajouter ces fichiers avec `git add -f`.

### Répéter le contrôle

Pour répéter le contrôle avec le binaire officiel de
[Gitleaks](https://github.com/gitleaks/gitleaks), depuis le dépôt :

```sh
gitleaks git --redact=100 --log-opts=--all .
```

### En cas de secret publié

Vérifier aussi les nouveaux fichiers avant le commit. Un secret déjà publié doit être révoqué et
remplacé, même après suppression du fichier. Une réécriture de l’historique demande une coordination
avec les autres clones.
