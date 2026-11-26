# Plan — application OneXBet permanente sur WebDev Hosting et serveur Manus

## Approche et architecture

Reprendre la source Expo Router/React Native incluse dans l’archive, plutôt que reconstruire ou redessiner l’application. Garder ses routes, contenus, comportements, thèmes, assets et dépendances autant que possible. Produire le bundle Web Expo depuis le dépôt et conserver le serveur Express déjà utilisé par les API sportives, tRPC, l’authentification applicative et le stockage.

WebDev Hosting publie le bundle Web Expo sous HTTPS et le serveur Express/tRPC dans le même projet Manus. Firebase Authentication et Firestore gardent les comptes, profils, rôles, abonnements et restrictions d’appareils. La base MySQL managée conserve les coupons reçus par le serveur Manus. Le frontend transmet le Firebase ID token au serveur Manus dans `Authorization: Bearer …`; celui-ci valide l’émetteur, le projet Firebase `onexbet-7eebd`, l’audience et la signature du JWT. Il ne crée ni session Manus ni fournisseur d’identité supplémentaire.

Sur le Web, le client utilise par défaut l’origin Hosting Manus courant; `EXPO_PUBLIC_COUPON_API_URL` reste disponible pour les builds natifs qui ciblent une origin HTTPS dédiée. Les nouvelles publications Web sont envoyées à Manus; les lectures appellent Manus et se replient vers Firestore uniquement sur la réponse métier `404` avec `code: "coupon_not_found"`, jamais sur une route invalide ou une panne. Avant chaque publication Manus, le client lit le document Firestore correspondant et refuse un code possédé par un autre UID; les documents existants restent intacts. Une panne réseau, une erreur d’authentification ou une erreur serveur ne provoque pas de double-écriture silencieuse dans Firestore.

Les API de l’application restent servies par le serveur Manus (`/api/health`, API-Football, tRPC, authentification, coupons et `/manus-storage/**`). Les règles Hosting envoient les routes API vers le conteneur serveur et le reste vers le bundle statique Expo; le CORS accepte l’origin same-origin HTTPS et les origins Preview explicitement configurées.

## Préservation et API sportives

Conserver API-Football comme source principale prévue de matchs réels. En Web, ses requêtes passent par le proxy serveur existant à liste blanche; la clé `API_FOOTBALL_KEY` n’entre pas dans le bundle client. Le repli TheSportsDB utilise la clé publique V1 gratuite officielle `123`.

Dans les écrans de matchs de football réels, les écussons proviennent uniquement des champs de logo HTTPS renvoyés par API-Football ou TheSportsDB. Si un champ est absent, invalide ou inaccessible, aucun drapeau, catalogue local, logo fictif ou autre image de remplacement ne doit être rendu. Les ressources locales restent autorisées pour le branding, les jeux et les combattants, mais pas comme écussons d’une équipe de football réelle.

## Installation PWA et Hosting

Servir le site WebDev Hosting sous HTTPS avec le manifeste PWA existant, l’icône native OneXBet et les métadonnées Apple déjà présentes. Le serveur de Preview écoute sur le port Manus `3000` et son conteneur publié honore le `PORT` fourni. La publication hybride fournit `dist/client` au Hosting et réécrit `/api/**` et `/manus-storage/**` vers le serveur Manus; le fallback Expo reste statique. Le mode Reserved/always-on maintient le processus serveur Manus résident.

Avant publication, vérifier que le build contient `index.html`, que `/manus-routes.json` est servi comme JSON statique, que `/api/health` retourne 2xx, que le serveur répond sur `0.0.0.0:$PORT`, que CORS autorise l’origin Hosting same-origin et que `API_FOOTBALL_KEY` reste côté serveur. La publication réussie sera observée via l’état infra Hosting; une déclaration Reserved seule ne sera pas présentée comme preuve de déploiement actif avant vérification.

## Structure et responsabilités

- `src/app/` : routes et écrans Expo Router, dont Championnats et les écrans de match.
- `src/components/`, `src/constants/`, `src/services/`, `src/utils/` : interface, Firebase, service client des coupons, APIs sportives et validation des URL d’écussons.
- `assets/` et `public/` : ressources d’interface et PWA existantes.
- `server/_core/` : serveur Express existant, proxy API-Football, tRPC, authentification Firebase et routes de service; aucun endpoint OAuth Manus.
- `lib/_core/` et `hooks/use-auth.ts` : compatibilité client basée sur Firebase, sans stockage de session Manus.
- `server/couponShares.ts` et `drizzle/schema.ts` : API de coupons authentifiée par Firebase ID token et stockage MySQL durable, avec Firestore conservé comme fallback historique côté client.
- `firebase.hosting.template.json` et `FIREBASE_DEPLOY.md` : préparation Hosting et conservation des routes backend déjà existantes; ne configurent ni ne publient automatiquement l’API Manus.
- `public/manus-routes.json` : manifeste des routes de pages Web existantes.

## Préservation visuelle et ajustements approuvés

Réutiliser strictement le design présent dans le code et les assets de l’application. Aucun nouveau système visuel, palette, typographie ou disposition n’est ajouté. Conserver les boutons « Vendre pour … ₣ » puis « Dupliquer le coupon de pari », dans cet ordre et empilés; lors d’une duplication depuis l’historique, faire glisser la vue précédente vers le haut pour révéler le nouveau coupon.

Le menu trois points à côté de la corbeille ouvre une feuille d’actions compacte et thémée avec les icônes bleues de la capture et les quatre libellés existants. La fenêtre d’enregistrement affiche immédiatement code, « Annuler » et « Copier », sans « Patienter/Patientez »; après copie, afficher « Coupon » / « Code copié » et « OK ».

Pour le footer, animer le transfert de l’état actif entre les icônes, y compris Menu et Coupon, mais afficher un seul libellé par onglet pendant toute la transition. Conserver la taille originale des libellés; ne pas faire apparaître un deuxième texte superposé. Animer séparément les icônes d’aide sans inventer une destination de contact.

## Performance du catalogue de logos

Le catalogue contient 4 765 références, dont les logos sont des SVG distants, et non des fichiers locaux. Garder le chargement à la demande, ne jamais précharger tous les logos au démarrage, limiter le rendu à la fenêtre visible, utiliser un cache SVG borné et différer les recherches distantes d’au moins 300 ms en ignorant les réponses obsolètes.

## Préparation et publication WebDev/Manus

Le projet est géré par WebDev avec `server:true` et `database:true`. Le contrat de build produit `dist/client`; le contrat de déploiement utilise `Dockerfile` et `/api/health`; les routes publiées dirigent `/api/*` vers le serveur et le reste vers le bundle statique. Le mode Hosting `always_on`/Reserved est demandé pour le serveur permanent. Les anciens coupons Firestore restent lisibles en fallback; aucun document Firestore n’est supprimé.
