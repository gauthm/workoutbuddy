# Compte, MFA et sessions

[Accueil de la documentation](INDEX.md) · [README](../README.md)

## Configurer le compte dans votre terminal

Exécuter `sudo /usr/local/sbin/workoutbuddy-auth-setup` en SSH interactif : identifiant, mot de
passe unique et varié de 20 caractères minimum, deux saisies masquées. Le script sauvegarde, calcule
Argon2id sans secret en argument ou environnement, active le compte et redémarre Authelia. Le compte
provisoire reste désactivé avant cela.

### Enregistrer le TOTP et tester la déconnexion

Ouvrir `https://auth.DOMAINE`, se connecter et demander l'enregistrement TOTP. Lire le lien de
vérification **dans votre terminal SSH uniquement** : `sudo cat
/var/lib/authelia/notifications.txt`. L'ouvrir, scanner le QR dans votre authentificateur et
confirmer un code. Aucun SMTP ni adresse personnelle requis. Tronquer ensuite ce fichier privé. Ne
transmettre aucun secret par messagerie.

Tester en fenêtre privée : mot de passe seul insuffisant, accès après TOTP, puis déconnexion depuis
**Réglages → Se déconnecter**, ou via `https://auth.DOMAINE/logout`. Le proxy annonce le bouton avec
`X-WorkoutBuddy-Logout: /auth/logout` et renvoie cette route vers le logout natif d’Authelia. La
session mémorisée est révoquée sans supprimer les données SQLite.

### Durée des sessions

Sans **Se souvenir de moi** : 15 min d’inactivité et 1 h maximum. Avec cette case cochée sur un
appareil de confiance : connexion complète mémorisée pendant **60 jours**, sans expiration par
inactivité ; nouveau navigateur, cookie effacé, déconnexion ou expiration imposent mot de passe et
TOTP. Le cookie reste Secure, HttpOnly et SameSite=Lax. Ce mécanisme ne mémorise pas séparément le
MFA.

Voir la [configuration officielle](https://www.authelia.com/configuration/session/introduction/).

### Redis privé et persistance

`workoutbuddy-sessions.service` utilise uniquement un socket Unix 0660, sous un dossier 0750
accessible au groupe dédié d’Authelia. Aucun port TCP Redis. Le mot de passe aléatoire du
fournisseur est généré hors dépôt par `render.py` ; pour une installation existante, l’ajouter sans
changer les clés Authelia ni le compte.

Son stockage `/var/lib/workoutbuddy-sessions` est en 0700, avec AOF synchronisé chaque seconde et
limite Redis de 32 Mio. Le service est plafonné à 128 Mio de RAM au total et 20 % d’un CPU. Au
repos, sa consommation mesurée est d’environ 7 à 8 Mio. Un arrêt propre conserve les sessions ; une
coupure brutale peut perdre la dernière seconde.

Ne pas restaurer les anciennes sessions depuis une sauvegarde : une restauration doit imposer une
reconnexion.

### Tests isolés de l’authentification

Le test `python3 deploy/linux/redhat-based/test-auth-sessions.py` (ou son équivalent
`deploy/linux/debian-based/test-auth-sessions.py`) utilise des services, secrets, utilisateurs,
TOTP et bases intégralement jetables, sur loopback ; il exige les binaires Node, Caddy, Redis et
Authelia, et ne touche pas aux comptes réels.

Avec `WB_PLAYWRIGHT_PATH` défini comme pour les E2E, il ajoute le test navigateur HTTPS
`test-auth-recovery.mjs` : ancien cache et installation du worker anonyme, redirection effective
vers Authelia sans blocage d’activation, puis déconnexion par le bouton des réglages, annulation
d’un brouillon et révocation de l’ancien cookie mémorisé avec données sauvegardées inchangées.

Les deux photos d’un exercice sont aussi décodées derrière le véritable TLS, la CSP et le MFA. Aucun
certificat de test n’est ajouté au système ; le navigateur jetable accepte uniquement ce test avec
sa propre autorité locale et des noms `.test` résolus sur loopback.

### Flux du Coach IA

Les flux IA sont authentifiés à l'ouverture et limités à 30 secondes côté fournisseur ; une
déconnexion ne coupe pas un flux existant, mais interdit les requêtes suivantes. Arrêter Node pour
couper immédiatement.

Avec Valkey, utiliser le drop-in décrit dans l’[installation commune](DEPLOYMENT_LINUX.md).
Le socket privé et la configuration Authelia restent identiques.
