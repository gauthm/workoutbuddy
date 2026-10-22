# Réglages et Coach IA

[Accueil de la documentation](INDEX.md) · [README](../README.md)

- [Réglages, profil et écran allumé](#réglages-profil-et-écran-allumé)
- [Enregistrer les modifications](#enregistrer-les-modifications)
- [Thème clair](#thème-clair)
- [Déconnexion](#déconnexion)
- [Configurer le Coach](#configurer-le-coach)
- [Navigation pendant une réponse](#navigation-pendant-une-réponse)
- [Affichage du chat](#affichage-du-chat)
- [Saisie et raccourcis](#saisie-et-raccourcis)
- [Clé API](#clé-api)

## Réglages, profil et écran allumé

Les réglages regroupent Général, Profil, Séance, Coach IA et Réglages avancés. Général propose «
Empêcher le téléphone de se verrouiller », désactivé par défaut et appliqué après enregistrement. Le
maintien de l’écran reste actif pendant la navigation interne et est redemandé au retour dans
l’application.

Il nécessite un navigateur compatible en contexte sécurisé et une page visible ; le navigateur peut
le suspendre, notamment en économie d’énergie. Les réglages signalent les navigateurs incompatibles
ou un maintien suspendu ; aucun texte de confirmation permanent n’est affiché quand le maintien est
actif. Voir la [documentation Screen Wake
Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

Le profil conserve le prénom, le sexe et la date de naissance ; les paramètres d’entraînement sont
propres au programme.

## Enregistrer les modifications

Après une modification, une barre de sauvegarde apparaît au-dessus de la navigation. **Enregistrer**
sauvegarde les changements de la page ensemble ; **Annuler** restaure les valeurs enregistrées. Un
échec conserve les brouillons pour permettre de réessayer.

## Thème clair

Le thème clair distingue les sections sur fond blanc, renforce les contours des champs et conserve
des textes, états et graphiques lisibles. Les valeurs des séries validées restent visibles sur
mobile.

## Déconnexion

Sur le déploiement Authelia, **Réglages → Se déconnecter** ferme la session de cet appareil, même
mémorisée. La section affiche uniquement le bouton. Une confirmation permet de conserver un
brouillon en annulant. Les données sauvegardées et la séance en cours restent sur le serveur ; une
reconnexion permet de les retrouver. Le bouton apparaît uniquement si le proxy fournit cette
intégration.

## Configurer le Coach

Le Coach IA utilise une API compatible OpenAI, configurée avec une URL, un modèle et éventuellement
une clé API. Le test de connexion et la liste des modèles peuvent utiliser la saisie avant sa
sauvegarde. Le coach conseille et dialogue ; il ne configure pas l’application et ne crée pas les
programmes.

## Navigation pendant une réponse

Le chat reste actif pendant la navigation dans l’application : le coach continue sa réponse sur les
autres écrans. Chaque retour au chat affiche la fin de la conversation, même si la réponse est
encore en cours. À chaque ajout de texte, le chat défile immédiatement jusqu’en bas, sans retard
d’animation ; il se réajuste également quand sa zone visible change de taille.

La création et la suppression de conversations sont bloquées pendant une réponse. Cette continuité
concerne la navigation interne, pas la fermeture ou le rechargement de l’application.

## Affichage du chat

Pendant la réflexion, trois points s’animent en cascade ; l’animation respecte la préférence de
mouvement réduit. Le chat affiche uniquement les bulles, sans emoji robot ni avatar utilisateur.

## Saisie et raccourcis

Le champ de message grandit avec le texte jusqu’à 120 px, puis permet de faire défiler les messages
longs. Il rétrécit après effacement ou envoi ; aucune barre de défilement n’apparaît pour une saisie
courte. Sur ordinateur, Entrée envoie le message et Majuscule + Entrée ajoute une ligne. Sur mobile,
Entrée ajoute toujours une ligne ; le bouton d’envoi permet d’envoyer sur tous les appareils.

## Clé API

La clé est stockée côté serveur, masquée dans l’interface et absente des réponses API et de l’export
JSON. Une clé existante est conservée lorsqu’une sauvegarde ne fournit pas de nouvelle clé.
