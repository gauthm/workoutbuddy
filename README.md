# IronLog

Web app de musculation locale. Un utilisateur, aucun cloud.

## Démarrage

### Prérequis
- Node.js 20.x LTS (vérifier : `node --version`)
- macOS : Xcode Command Line Tools (`xcode-select --install`)

### Installation et lancement

```bash
git clone <repo> ironlog
cd ironlog
npm install
node scripts/download-vendors.js
npm start
```

Ouvrir : http://localhost:3000

### Accès depuis un téléphone (LAN)

Dans Paramètres > Réseau, passer l'hôte à `0.0.0.0`.
Redémarrer. Accéder via l'IP locale de la machine (ex: `http://192.168.1.X:3000`).
Vérifier que le firewall macOS autorise le port 3000.

### Tests

```bash
npm test
```

### Sauvegarde

La base de données est dans `data/ironlog.db`. Copier ce fichier suffit.
Export complet : Paramètres > Données > Exporter JSON.
