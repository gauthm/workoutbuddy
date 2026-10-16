# Validation du déploiement Rocky

- 477 tests unitaires, intégration et parcours métier passent, bases isolées.
- Couverture navigateur : 82 cas validés au total après suite complète et
  contrôles ciblés ; huit cas restent bloqués par les photos absentes. Une attente
  de test pendant un rechargement a été corrigée après la suite complète.
- Dernier contrôle ciblé : 18 cas sécurité/mise à jour passent, ordinateur et mobile.
  Publication sans hard refresh, API jamais cachée, vraie panne réseau distinguée
  d’un 401, brouillon conservé, rejet des assets de connexion et retour au portail
  après expiration sur navigation, API, premier plan ou ancien worker.
- Test TLS intégral jetable Caddy/Authelia/Redis/Node : mot de passe seul refusé,
  TOTP accepté, cookie Secure/HttpOnly de 60 jours, persistance après redémarrage
  des deux services, reprise avec cookie conservé, déconnexion et révocation,
  expiration des sessions ordinaires. CSP Vue et nonce Authelia préservés,
  authentification avec no-referrer et IP pure transmise sans en-tête forgé.
- Site public vérifié sans identité personnelle : renvoi vers Authelia et case
  Se souvenir de moi visible. Un navigateur à ancien cache synthétique atteint le
  portail réel après installation du worker de réparation. Le worker et le renvoi
  de connexion sont publics ; les pages, autres assets et API restent protégés.
- Maintenance nocturne : configuration DNF parsée, timer en heure de Paris et
  absence de rattrapage diurne contrôlés. Sept tests simulés vérifient le garde
  horaire, la sauvegarde préalable, le report d’un reboot et la reprise de Node/Redis.
  Lancement réel de l’unité en journée : aucune mutation ni aucun reboot.
  Audit npm exécuté sans privilèges, aucun accès aux bases/secrets, aucune
  vulnérabilité de production signalée. Aucun redémarrage réel du VPS effectué
  pour ces tests ; le prochain créneau nocturne reste à observer dans les journaux.
- 10 parcours navigateur de sécurité passent (ordinateur et mobile) : zone sûre iOS, CSP,
  service worker, origines étrangères, JSON, limitations IA et import interrompu.
- HTTPS public, redirection HTTP, UI/API/export/IA protégés, en-têtes d'identité
  forgés refusés ; mot de passe seul insuffisant, TOTP accepté, déconnexion et
  expirations vérifiées avec une identité jetable.
- Import/export/sauvegarde derrière TLS testés avec une base jetable. Redémarrage
  propre, reprise après incident, persistance, restauration depuis un instantané
  et rétention de sept sauvegardes sur neuf essais synthétiques vérifiés.
- Compte réel du processus vérifié : `workoutbuddy`, sans capacités effectives,
  `NoNewPrivileges` et seccomp actifs. Protections `/proc`, noyau, horloge,
  nom d’hôte, espaces de noms et core dumps vérifiées sur le service effectif.
  Import/export, sauvegarde SQLite, redémarrage et DNS/HTTPS sortant testés
  dans une instance à base jetable avec les mêmes restrictions.
- Permissions contrôlées : répertoires privés 0700, bases et WAL/SHM 0600,
  propriétaires dédiés ; archives de sauvegarde réservées à root. Les deux
  bases passent `quick_check`, accès direct refusé à Caddy et aux comptes ordinaires.
- En-têtes Caddy contrôlés sur HTTPS : HSTS, nosniff, DENY, no-referrer,
  Permissions Policy et absence des en-têtes Server/X-Powered-By. CSP de Vue
  et nonce Authelia préservés, CSP de secours testée sur une réponse sans politique.
- Aucun appel réel au fournisseur du Coach IA validé lors de ces contrôles.

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
