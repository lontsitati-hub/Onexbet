# Protection Firebase des abonnements

## État de cette livraison

`firestore.rules`, `firebase.json` et `tests/firestore-subscription-rules.test.js` sont conservés dans le dépôt. La version des règles revue a été publiée dans le projet Firebase `onexbet-7eebd`, base Firestore `(default)`, le 2 novembre 2026 ; le contenu a été rechargé et confirmé dans la console. Les tests automatisés utilisent séparément le projet de démonstration `demo-onexbet-subscriptions` et n’écrivent aucune donnée de production.

Ce guide décrit les règles Firestore et leur intégration à Expo. La création des comptes, l’écoute de session, le formulaire administrateur et l’écran « Mon abonnement » sont aussi présents. Aucun compte réel n’a été créé, renouvelé ou supprimé pendant l’audit ; aucun APK, AAB ou IPA n’a été produit.

## Modèle sécurisé

- Le rôle admin est lu dans `users/{uid}.role` par une lecture serveur de la règle. Les claims client ne sont jamais utilisés pour obtenir des privilèges.
- `users/{uid}` est lisible par son propriétaire si le profil est complet ou legacy valide, y compris après expiration. Les admins peuvent lire un profil et lister `users`.
- Seuls les admins existants peuvent créer, mettre à jour ou supprimer des profils.
- Les profils `role: "user"` nouvellement créés doivent avoir `status`, `subscriptionStartedAt` de type timestamp égal à `request.time`, et `subscriptionDurationDays` entier entre 1 et 36500. Les profils `role: "admin"` peuvent rester sans abonnement.
- Un profil legacy possède les deux champs d’abonnement absents. Un seul champ présent, un type incorrect ou une durée hors limites est refusé.
- L’accès actif d’un utilisateur est `status == "active"` et `request.time < subscriptionStartedAt + duration.value(subscriptionDurationDays, 'd')`. Une réactivation avec une ancienne date ne rallonge donc pas un abonnement expiré.
- Toute modification de `subscriptionStartedAt` ou `subscriptionDurationDays` est un renouvellement : les deux champs doivent être valides, `status` doit être `active`, et `subscriptionStartedAt` doit être exactement `request.time` (le client doit utiliser `serverTimestamp()`).
- `users/{uid}/accessClock/current` est lisible par le propriétaire et les admins. Son écriture est autorisée même après expiration, mais le document ne peut contenir que `{ at }`, avec `at == request.time`, et une mise à jour doit avancer l’horloge. Le document ne confère aucun accès.
- `users/{uid}/security/deviceBinding` et `users/{uid}/devices/{id}` sont écrits par le propriétaire authentifié seulement si son accès est actif, ou par un admin. Le champ `uid` doit toujours égaler le `uid` du chemin. Un propriétaire expiré peut uniquement effectuer une mise à jour de libération compatible (`active: false` et champs de logout autorisés), sans changer son identité.
- `fastGamesGrants` est lisible par un compte actif ou un admin et modifiable uniquement par un admin. Cette lecture de collection est intentionnelle : les clients existants interrogent toute la collection et les règles Firestore ne filtrent pas les résultats comme une requête SQL.
- Toute autre collection ou sous-collection est refusée par défaut.

## Test local

Prérequis utilisés : Java 21 et Node 22. Le dépôt principal n’est pas modifié avec des dépendances de test. Installer les outils dans un dossier séparé :

```bash
mkdir -p /home/ubuntu/firebase_subscription_checks
cd /home/ubuntu/firebase_subscription_checks
npm init -y
npm install --save-dev firebase-tools@14.16.0 @firebase/rules-unit-testing@5.0.2 firebase@12.16.0
```

Depuis la racine du dépôt, lancer uniquement l’émulateur Firestore avec l’identifiant de démonstration, puis arrêter automatiquement l’émulateur à la fin :

```bash
cd /home/ubuntu/work_onexbet
NODE_PATH=/home/ubuntu/firebase_subscription_checks/node_modules \
FIREBASE_TEST_NODE_MODULES=/home/ubuntu/firebase_subscription_checks/node_modules \
  /home/ubuntu/firebase_subscription_checks/node_modules/.bin/firebase emulators:exec \
  --only firestore --project demo-onexbet-subscriptions \
  "node tests/firestore-subscription-rules.test.js"
```

Cette commande n’utilise pas de credential et ne cible pas un projet Firebase live. Les 12 groupes de tests couvrent notamment : le payload réel de création d’un compte actif, sa première lecture de profil et l’écriture de l’horloge/appareil, création admin, accès anonyme, lecture/liste non-admin, auto-extension et auto-rôle, profil expiré, renouvellement, horloge forgée, compatibilité legacy et propriété des appareils.

Pour éviter les tests de temps lents ou non déterministes, les timestamps clients de frontière sont générés avec `Timestamp.fromMillis(Date.now() ± 1)`, tandis que les écritures autorisées utilisent `serverTimestamp()` afin de comparer à `request.time` côté émulateur.

## Déploiement des règles et mises à jour ultérieures

La version locale a été comparée à la version de production avant sa publication. Pour toute modification ultérieure, comparer à nouveau la politique active et préserver les autorisations historiques nécessaires aux collections et sous-collections utilisées par l’application.

Après revue et approbation, une future publication par CLI peut être réalisée depuis l’environnement Firebase autorisé :

```bash
firebase use <projet-live-confirmé>
firebase deploy --only firestore:rules
```

La publication du 2 novembre a été faite depuis Firebase Console, et non par ces commandes. Aucune migration de données n’est requise ; aucune donnée de compte existant n’a été réécrite. Les profils legacy restent lisibles/actifs uniquement lorsqu’ils ont les deux champs d’abonnement absents et un statut `active` ; toute conversion vers le nouveau modèle doit être faite par un admin avec `serverTimestamp()`.

## Bilan d’intégration dans le projet principal

La navigation conserve la distinction demandée : les icônes et textes du header/footer ne prennent l’accent du thème que lorsqu’ils sont sélectionnés ; tous les assets et libellés « Types de sports » prennent cet accent immédiatement, sans clic. Les logos de marque et la logique Poker ont été conservés.

Le formulaire administrateur exige une durée pour les nouveaux utilisateurs et propose « Renouveler » ou « Définir durée ». La période démarre au moment où Firebase valide l’écriture, et non au premier login. Le renouvellement redémarre une période complète à sa validation ; il n’ajoute pas implicitement des jours à l’ancienne échéance. Le compte administrateur n’est pas soumis à expiration. L’écran utilisateur « Mon abonnement » affiche les jours restants et les dates en lecture seule. Les anciens utilisateurs sans période restent identifiés sans modification automatique de leur accès.

L’expiration est une restriction d’accès calculée, pas une suppression du compte ni une modification du drapeau Firebase Authentication `disabled`. L’application ferme le panel à l’échéance et revalide sur le serveur ; les règles publiées refusent les opérations distantes protégées selon `request.time`. Le profil et l’horloge restent lisibles pour diagnostiquer l’accès. La période ne peut être prolongée que par l’administrateur.

Contrôles finaux du 2 novembre 2026 : `npm ci` propre ; TypeScript sans erreur ; Expo Doctor 21/21 ; 43 cas de souscription ; 12 scénarios de session simulée ; 200 cas de couleurs ; 100 transitions de logos ; 12 groupes de tests Firestore Emulator réussis, dont création active et premier accès ; exports JavaScript Web/Android/iOS réussis ; prebuild Android/iOS réussi dans un répertoire temporaire. La prévisualisation Web charge l’écran de connexion. Ces contrôles ne constituent pas une compilation ou une installation native.

### Limites connues

La création d’un nouvel utilisateur actif est autorisée par les règles et le payload réel passe l’émulateur, **à condition qu’un document `users/{uid}` avec `role: admin` existe déjà**. Cette présence et un parcours Auth/Firestore complet n’ont pas été revalidés sur la production lors du présent audit. Le premier administrateur doit être provisionné dans Firebase Console ou par un environnement Admin SDK de confiance ; le bootstrap client avec secret codé en dur a été désactivé. Les exports natifs JavaScript et le prebuild passent, mais ce sandbox ne dispose pas d’Android SDK/ADB ni de Xcode : aucune APK/AAB/IPA ni installation sur appareil n’a été vérifiée. Les avis npm ont été réduits par les mises à jour compatibles ; `npm audit --omit=dev` signale encore 21 vulnérabilités (0 critique, 10 hautes, 9 modérées, 2 faibles), dont certaines exigent une migration Expo majeure. Les anciennes versions de l’application ne reçoivent pas le nouveau contrôle local.

La suppression depuis l’interface efface uniquement le profil Firestore, pas l’identité Firebase Authentication ni ses sous-collections ; le nom de connexion reste donc réservé et sa recréation peut échouer avec `auth/email-already-in-use`. Une suppression complète ou une modification du mot de passe Auth d’un autre utilisateur n’est pas possible avec des règles Firestore seules. Le nom modifié par l’interface est le nom affiché Firestore, pas l’identifiant de connexion. En cas d’échec d’écriture du profil lors d’une création, l’inscription tente de supprimer l’identité Auth secondaire et signale explicitement l’échec de compensation. Une ancienne fonction `deleteUserAccount` existe encore dans le dossier `functions/`, mais l’interface actuelle ne l’appelle pas ; son état de déploiement n’a pas été vérifié.
