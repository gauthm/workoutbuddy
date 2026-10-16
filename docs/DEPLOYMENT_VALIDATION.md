# Validation du déploiement Rocky

- 477 tests unitaires, intégration et parcours métier passent, bases isolées.
- 8 parcours navigateur de sécurité passent (ordinateur et mobile) : CSP,
  service worker, origines étrangères, JSON, limitations IA et import interrompu.
- HTTPS public, redirection HTTP, UI/API/export/IA protégés, en-têtes d'identité
  forgés refusés ; mot de passe seul insuffisant, TOTP accepté, déconnexion et
  expirations vérifiées avec une identité jetable. Compte personnel à enrôler.
- Import/export/sauvegarde derrière TLS testés avec une base jetable. Redémarrage
  propre, reprise après incident, persistance, restauration depuis un instantané
  et rétention de sept sauvegardes sur neuf essais synthétiques vérifiés.
- Coach IA non configuré : aucun appel réel à un fournisseur validé.

La suite navigateur complète n'est pas verte : deux cas `data.spec.js` ciblent
un libellé masqué des réglages ; un cas `equipment.spec.js` conserve la barre de
modifications après sauvegarde ; deux cas `sessions.spec.js` retrouvent des
charges différentes des attentes après saisie/progression. Les cas représentatifs
réglages, matériel et les deux cas séance échouent également avec `server.js`
d'origine, sans le changement d'arrêt propre. Ces résultats restent à investiguer
côté application/tests et ne sont pas présentés comme des parcours validés.
Playwright utilise un Chromium headless de secours sur Rocky, qui ne fait pas
partie de ses distributions officiellement prises en charge.
