# Validation du déploiement Rocky

- 477 tests unitaires, intégration et parcours métier passent, bases isolées.
- Suite navigateur complète : 68 parcours passent sur 76 ; les huit échecs
  concernent uniquement les photos absentes (voir ci-dessous).
- 10 parcours navigateur de sécurité passent (ordinateur et mobile) : zone sûre iOS, CSP,
  service worker, origines étrangères, JSON, limitations IA et import interrompu.
- HTTPS public, redirection HTTP, UI/API/export/IA protégés, en-têtes d'identité
  forgés refusés ; mot de passe seul insuffisant, TOTP accepté, déconnexion et
  expirations vérifiées avec une identité jetable. Compte personnel à enrôler.
- Import/export/sauvegarde derrière TLS testés avec une base jetable. Redémarrage
  propre, reprise après incident, persistance, restauration depuis un instantané
  et rétention de sept sauvegardes sur neuf essais synthétiques vérifiés.
- Coach IA non configuré : aucun appel réel à un fournisseur validé.

La première exécution navigateur était faussée par l'absence de polices système
sur le serveur minimal : certains textes n'avaient pas de dimensions. Après
installation des polices, les parcours de réglages/import, matériel et charges
de séance précédemment signalés passent. Ce n'étaient pas des régressions de
l'application démontrées par ces tests.

Les parcours d'animation des photos restent non validés : les fichiers sous
`public/exercises/images/` sont absents de cette installation. Playwright utilise
un Chromium headless de secours sur Rocky, qui ne fait pas partie de ses
distributions officiellement prises en charge. La marge haute est testée avec
les safe-area insets simulés au chargement, au défilement, après navigation et
changement des insets ; le rendu réel d'une webapp Safari iPhone reste à confirmer
sur un appareil Apple.
