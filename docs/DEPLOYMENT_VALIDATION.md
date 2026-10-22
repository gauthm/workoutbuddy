# Validation du déploiement Rocky

[Accueil de la documentation](INDEX.md) · [README](../README.md)

### Résultats globaux

- 477 tests unitaires, intégration et parcours métier passent, bases isolées.

### Interface et appareils

- Accueil : six formats iPhone simulés, portrait/paysage et zones de sécurité,
  mois de six semaines, aucun programme, semaine accomplie et tous les statuts
  du jour. Grille plafonnée à une hauteur compacte et boutons d’en-tête avec
  fond et contour visibles en thèmes clair/sombre. Aucun défilement de page ni
  action masquée ; pagination des séances,
  reprise prioritaire et libellé exact des cinq objectifs en français/anglais
  sur l’accueil et dans le titre de fiche ; rappel d’un seul programme actif.
- Coach : saisie courte sans barre, croissance avec Majuscule + Entrée jusqu’à
  120 px, défilement des textes longs, réduction après effacement et envoi.
  Requête réelle sur API isolée sans fournisseur configuré, aucun appel externe.
- Zoom mobile : gestes tactiles vérifiés avec Chromium (pincement, double tap,
  balayage natif), échelle conservée à 1 et champ d’effort à 16 px avec saisie
  sans débordement. Le comportement réel de Safari reste à confirmer sur iPhone.
- 112 parcours navigateur passent, ordinateur et mobile, avec les 1 746 photos.
  Alternance des deux positions des photos, pause/reprise,
  réduction des animations, arrêt hors écran et aide en séance sont couverts.
- Thème clair : contrastes mesurés dans les réglages, l’accueil et la séance,
  textes contrôlés à 4,5:1 minimum, contours des champs à 3:1, focus visible,
  préférence persistante et valeurs validées lisibles ; captures examinées.
- Réglages : bouton de déconnexion seul, sans titre ni texte explicatif,
  confirmation de déconnexion,
  annulation avec brouillon intact,
  retour au portail et données sauvegardées conservées. Bouton absent sans proxy
  d’authentification. Icônes SVG/ICO décodées, dimensions et opacité des PNG
  Apple/manifeste contrôlées ; fichiers publics limités aux chemins explicites.

### Photos et publication

- Photos : les 1 746 JPEG du catalogue sont présents, environ 101 Mio sur disque,
  avec contrôle de format hors ligne. Installation reproductible à une révision
  source figée, sans modifier le catalogue ni SQLite. Une publication avec photo
  manquante est refusée avant tout échange de répertoire ; garde vérifiée sur
  une copie synthétique, puis livraison complète validée.

### Livraison, authentification et sécurité

- Livraison et sécurité :
  Publication sans hard refresh, API jamais cachée, vraie panne réseau distinguée
  d’un 401, brouillon conservé, rejet des assets de connexion et retour au portail
  après expiration sur navigation, API, premier plan ou ancien worker.
- Test TLS intégral jetable Caddy/Authelia/Redis/Node : mot de passe seul refusé,
  TOTP accepté, cookie Secure/HttpOnly de 60 jours, persistance après redémarrage
  des deux services, reprise avec cookie conservé, déconnexion par le bouton
  des réglages et révocation même avec une copie antérieure du cookie,
  expiration des sessions ordinaires. CSP Vue et nonce Authelia préservés,
  authentification avec no-referrer et IP pure transmise sans en-tête forgé.
  Photos affichées derrière le véritable TLS, la CSP et le MFA, refusées sans
  connexion ; icônes d’installation accessibles sans cookie partagé.
- Site public vérifié sans identité personnelle : renvoi vers Authelia et case
  Se souvenir de moi visible. Un navigateur à ancien cache synthétique atteint le
  portail réel après installation du worker de réparation. Le worker, le manifeste,
  les icônes listées et les renvois de connexion/déconnexion sont publics ;
  les pages, photos d’exercices, autres assets et API restent protégés.

### Maintenance et exploitation

- Maintenance nocturne : configuration DNF parsée, timer en heure de Paris et
  absence de rattrapage diurne contrôlés. Sept tests simulés vérifient le garde
  horaire, la sauvegarde préalable, le report d’un reboot et la reprise de Node/Redis.
  Lancement réel de l’unité en journée : aucune mutation ni aucun reboot.
  Audit npm exécuté sans privilèges, aucun accès aux bases/secrets, aucune
  vulnérabilité de production signalée. Aucun redémarrage réel du VPS effectué
  pour ces tests ; le prochain créneau nocturne reste à observer dans les journaux.

### Contrôles de sécurité et de données

- 12 parcours navigateur de sécurité passent (ordinateur et mobile) : icônes, zone sûre iOS, CSP,
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

### Diagnostic des premiers essais

La première exécution navigateur était faussée par l'absence de polices système sur le serveur
minimal : certains textes n'avaient pas de dimensions. Après installation des polices, les parcours
de réglages/import, matériel et charges de séance précédemment signalés passent. Ce n'étaient pas
des régressions de l'application démontrées par ces tests.

### Limites du navigateur de test

Playwright utilise un Chromium headless de secours sur Rocky, qui ne fait pas partie de ses
distributions officiellement prises en charge. La marge haute est testée avec les safe-area insets
simulés au chargement, au défilement, après navigation et changement des insets ; le rendu réel
d'une webapp Safari iPhone reste à confirmer sur un appareil Apple.
