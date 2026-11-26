# OneXBet Mobile — projet complet

Cette archive contient le projet Expo complet : code actif, routes et écrans, assets, configuration, sources conservées et tests. Les jeux intégrés passent par un écran de chargement animé natif avant leur ouverture ; aucun lecteur vidéo de transition n’est utilisé.

## Installation et démarrage

Le projet utilise `pnpm` 9.12.0 (déclaré dans `package.json`) et Corepack. À la racine du dossier extrait :

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

La commande `dev` lance le serveur du projet sur le port 3000 et l’aperçu Expo Web sur le port 8081. En développement, ouvrez l’aperçu local sur `http://localhost:8081`.

Pour contrôler le projet et le routage des jeux :

```bash
corepack pnpm check
corepack pnpm test:game-launch
```

Les cibles natives se lancent avec `corepack pnpm android` ou `corepack pnpm ios`, sous réserve des outils de développement et appareils/simulateurs correspondants.

## Configuration externe

Le ZIP inclut le fichier de verrouillage `pnpm-lock.yaml`, mais pas `node_modules`, les caches, ni les fichiers `.env`/secrets. Les dépendances sont donc réinstallées de manière reproductible avec la commande ci-dessus. L’authentification applicative utilise Firebase Authentication et Firestore. Le serveur accepte uniquement les jetons ID Firebase Bearer. La version Web utilise le proxy serveur API-Football ; configurez `API_FOOTBALL_KEY` comme secret WebDev pour afficher les matchs réels, les écussons de clubs et les drapeaux de pays. La recherche du sélecteur administrateur interroge alors les endpoints `teams?search=` et `countries?search=` avec cache, puis conserve TheSportsDB, ESPN, Sofascore et le catalogue local en complément. Les secrets de serveur ou de base de données ne sont volontairement pas inclus. Configurez uniquement les valeurs dont votre environnement a besoin, via votre fichier `.env` local ou votre gestionnaire de secrets, sans publier les clés.

## Fonctionnement Web hors connexion

Après une première connexion Firebase réussie en ligne, l’application Web conserve l’identité Firebase et un instantané minimal du profil déjà vérifié. Si le réseau est ensuite indisponible, elle peut restaurer le shell Web, le thème, les coupons et les données locales déjà enregistrées. Le service worker PWA met également en cache l’interface et les fichiers statiques après la première visite.

La première connexion, la vérification du profil et de l’abonnement, les opérations administrateur, les mises à jour de solde, les retraits, les jeux temps réel et les appels API-Football nécessitent toujours une connexion serveur. Au retour du réseau, Firebase revalide automatiquement le profil, l’abonnement, le verrouillage d’appareil et les permissions. Le cache de session hors connexion est limité à 24 heures et ne prolonge jamais un abonnement.
