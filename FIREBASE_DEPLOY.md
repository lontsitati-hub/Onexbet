# Préparer Firebase Hosting et l’API Manus de coupons

## Architecture retenue

Firebase Hosting reste l’hébergement du client Expo Web et Firebase Authentication reste l’identité. Le nouveau service Manus/MySQL ne remplace que le stockage des coupons partagés. Les routes déjà utilisées par le reste de l’application (`/api/sports/football/**`, `/api/trpc`, authentification, `/manus-storage/**`) doivent continuer à être servies par leur backend actuel; ne les redirigez pas vers l’API de coupons Manus.

Le client peut contacter l’API Manus par `EXPO_PUBLIC_COUPON_API_URL`, configurée au moment du build et contenant l’origin HTTPS du service sans suffixe `/api`. Si elle est vide sur le Web, le client essaie `window.location.origin` (qui peut être l’origin Metro en aperçu); sur natif, il utilise directement Firestore. Avec une API Web configurée, avant chaque publication Manus le client lit le document Firestore correspondant et refuse le code s’il appartient à un autre UID; un ancien document du même propriétaire reste intact.

Les fallbacks Firestore se déclenchent si la requête API échoue au niveau réseau, si la route API renvoie un 404 HTML manifestement absent, et, pour la lecture seulement, si elle renvoie `404` avec `code: "coupon_not_found"`. Les erreurs d’authentification/serveur, conflits et réponses malformées ne sont pas masqués. Ce fallback n’est ni une double-écriture planifiée ni une réplication atomique : si Manus a enregistré une publication mais que sa réponse est perdue, le client peut aussi écrire dans Firestore; les stores peuvent ensuite diverger. Aucun document Firestore n’est supprimé par ce mécanisme.

## Préparation actuelle

- Le projet Firebase confirmé est `onexbet-7eebd`; le service Manus vérifie le Firebase ID token de ce projet.
- Les origines par défaut `https://onexbet-7eebd.web.app` et `https://onexbet-7eebd.firebaseapp.com` sont autorisées par CORS. Ajouter séparément tout domaine Hosting personnalisé réellement utilisé.
- L’API vérifie le jeton Firebase, mais ne vérifie actuellement pas le statut actif du profil ni l’abonnement avant GET/PUT. Ne pas considérer les routes comme soumises aux droits d’abonnement tant que ce contrôle serveur n’est pas implémenté et testé.
- Le build Expo Web produit le client dans `dist/client`; la sortie du serveur OneXBet existant et ses routes métier restent distinctes de la nouvelle API Manus.
- `firebase.hosting.template.json` est un fragment d’exemple et n’active rien dans `firebase.json`. Il garde des réécritures Cloud Run pour les routes backend existantes, puis le fallback SPA. Ne pas les remplacer par la nouvelle API des coupons.
- Le site Firebase public testé renvoyait actuellement du HTML pour `/api/health` et `/data/club-logos-index.json`; vérifier ces deux chemins avant toute nouvelle publication, car la réponse HTML ne prouve pas qu’une API ou l’index JSON fonctionne.

## Étapes de mise en service

1. L’export/import Firestore est facultatif : sans migration, le client continue de lire les anciens coupons sur Firestore quand Manus répond `404 coupon_not_found`. Ne supprimer aucun document historique.
2. Si une copie de l’historique dans MySQL est souhaitée, exporter `coupon_shares`, garder l’export brut en lieu sûr puis le normaliser selon le document `FIRESTORE_IMPORT_FORMAT.md` fourni avec le backend Manus séparé. Vérifier les codes, UIDs, payloads et dates avant revue; le script insère les codes absents, conserve les enregistrements identiques et annule en cas de collision. Il n’écrit jamais dans Firestore.
3. L’infrastructure Manus signale un déploiement réussi au checkpoint `36fead2`, mais l’origin HTTPS permanente n’est pas encore confirmée : le domaine candidat historique répond `404` à `/api/health`. Vérifier le domaine exact avant de configurer le client; la page Preview n’est pas une URL de production et ne pas lancer de publication redondante avant ce contrôle.
4. Autoriser les origines Firebase exactes dans CORS, puis définir `EXPO_PUBLIC_COUPON_API_URL` pour le build de production. Cette valeur est publique et doit être l’origin seulement, par exemple `https://api.example.tld`.
5. Garder les réécritures Hosting actuelles pour les API existantes de l’application. Conserver les sections `functions` et `firestore` dans `firebase.json` et vérifier que le fallback SPA ne masque pas leurs routes.
6. Avant une mise en service, utiliser un environnement de test et deux comptes dédiés : vérifier l’authentification, la publication puis le chargement inter-comptes, le contrôle d’abonnement côté serveur et le repli Firestore sur un ancien code. Le test authentifié inter-comptes n’a pas encore été effectué; aucune écriture réelle Firebase ni test en production n’est couvert par cet audit. Ne pas supprimer de document Firestore.

Pour le fragment Hosting, les URL propres et les en-têtes de cache, voir la [documentation officielle Firebase Hosting](https://firebase.google.com/docs/hosting/full-config). Le format et le script d’import contrôlé sont documentés dans le dépôt backend Manus séparé; aucune migration n’est requise pour continuer à lire les anciens codes.
