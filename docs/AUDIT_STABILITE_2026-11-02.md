# Audit de stabilité et de préparation multi-plateforme — 2 novembre 2026

## Conclusion

Le projet Expo est **cohérent et compilable au niveau JavaScript et du prebuild natif** : l’installation verrouillée, le typage, Expo Doctor, les tests présents, les exports Web/Android/iOS et la génération temporaire des projets natifs ont réussi. La configuration Android/iOS utilise l’identifiant `com.rayan45.onexbetarn`.

Cela ne permet pas de garantir l’absence de tout blocage en production ni de déclarer des binaires installables prêts : aucun APK/AAB/IPA n’a été compilé ou installé sur appareil. La création d’un nouvel utilisateur passe les règles et tests simulés **si un administrateur valide existe déjà dans Firestore** ; la présence de ce profil dans la base de production et un parcours Auth complet n’ont pas été revérifiés pendant cet audit.

## Contrôles réussis

- `npm ci --no-audit --no-fund` : installation propre depuis le lockfile, 737 paquets.
- `npx tsc --noEmit` : aucune erreur TypeScript.
- Expo Doctor : **21/21 contrôles réussis** après alignement des versions Expo recommandées.
- Tests de souscription : **43 cas** de durée, échéance, renouvellement et profils existants.
- Tests de session Firebase simulée : **12 scénarios**, dont création sans déconnecter l’admin, renouvellement, compte expiré/suspendu et reprise au premier plan.
- Navigation/couleurs : **200 cas**, cinq thèmes et quatre fonds.
- Logos de marque : **100 transitions** ; aucun mélange ni logo de repli inattendu.
- Firestore Emulator : **12 groupes de tests réussis**. Le payload réel d’un compte actif est accepté, puis le nouvel utilisateur peut lire son profil et écrire son horloge serveur et son premier lien d’appareil. Les scénarios négatifs de refus d’accès sont également passés.
- Exports Expo JavaScript : **Web, Android et iOS réussis**, avec les routes Web exportées.
- `expo prebuild --platform all --no-install --clean` : projets Android et iOS générés avec succès dans un dossier temporaire. Les identifiants Android et iOS générés correspondent à `com.rayan45.onexbetarn`.
- Les règles Firestore avaient été publiées dans le projet `onexbet-7eebd`, base `(default)`, puis rechargées et vérifiées dans la console. Aucun compte de production n’a été créé, modifié ou supprimé lors des tests de cet audit.

Ces vérifications n’incluent pas un benchmark de fluidité sur téléphone, un test réseau de bout en bout contre des comptes réels, ni une compilation native signée.

## Modifications apportées pendant l’audit

Les dépendances Expo ont été alignées sur les versions compatibles avec le SDK 57 et les correctifs npm non majeurs disponibles ont été appliqués. Une installation propre avec `npm ci` a ensuite confirmé que le lockfile est réutilisable.

L’ancien bootstrap d’administrateur côté client, qui contenait des identifiants réutilisables, a été désactivé. Il n’était appelé nulle part dans l’application ; la fonction restante échoue désormais avec une instruction de provisionnement sécurisé hors client. **Cette modification ne change ni ne réinitialise un éventuel compte Auth déjà existant** : s’il a été créé à partir des anciens identifiants embarqués, son mot de passe doit être renouvelé séparément dans Firebase Authentication.

L’identifiant iOS a été inscrit explicitement dans `app.json`, avec la valeur qu’Expo dérivait déjà du package Android. Les tests de création active et de sécurité empêchent aussi la régression du bootstrap avec secret codé en dur. Le guide Firebase et le TODO ont été actualisés.

La gestion utilisateur admin écrit directement le nom affiché dans Firestore. La suppression actuelle supprime uniquement le profil Firestore, conformément au mode sans opération Auth privilégiée.

## Points de vigilance avant ouverture ou distribution

1. **Administrateur initial.** Le profil `users/{uid}` doit déjà exister avec `role: "admin"` et un statut valide. Le premier admin doit être créé depuis Firebase Console ou un environnement Admin SDK de confiance, jamais depuis le client. Vérifier ce prérequis dans le projet live avant le premier compte actif.
2. **Suppression et mot de passe.** Les règles Firestore ne peuvent ni supprimer l’identité Authentication d’un autre utilisateur ni modifier son mot de passe. Après suppression du profil, l’identité Auth et les sous-collections restent présentes ; le nom de connexion virtuel demeure réservé et sa réutilisation peut échouer avec `auth/email-already-in-use`. Le formulaire ne modifie que le nom affiché, pas le login.
3. **Avis npm restants.** Après les corrections compatibles, `npm audit --omit=dev` rapporte encore **21 avis** (0 critique, 10 hauts, 9 modérés et 2 faibles). Les correctifs recommandés par npm touchent notamment aux versions Expo/Expo Router et Firebase qui demanderaient une migration majeure ou un changement de génération. Le SDK n’a pas été forcé vers une version majeure pendant cet audit ; prévoir une migration distincte avec tests complets.
4. **Binaires natifs.** L’environnement ne possède ni Android SDK/ADB ni Xcode. Les exports et le prebuild ne sont pas des APK/AAB/IPA. La distribution exige un build EAS authentifié, des credentials/signatures Android, ainsi que l’équipe et le provisioning Apple pour iOS.
5. **Fonctions héritées.** Le dossier `functions/` contient toujours une callable historique `deleteUserAccount`, mais le code de gestion admin actuel ne l’appelle pas. Son état de déploiement n’a pas été vérifié ; une publication limitée à `firestore:rules` n’exécute pas ce code.
6. **Performance.** Le bundling, les vérifications de dépendances et les scénarios logiques sont réussis, mais la fluidité dépend aussi des appareils, du réseau et des services Firebase. Elle reste à valider sur appareils réels.

## À faire pour la livraison installable

- Vérifier, en lecture seule, qu’un document administrateur valide existe dans Firebase production ; ensuite tester le parcours avec un compte de test dédié et ne publier l’application qu’après validation.
- Décider séparément si la suppression doit être complète et si le mot de passe Auth doit être modifiable par un admin. Ces fonctions demandent une voie privilégiée Firebase sécurisée, ou doivent rester explicitement hors périmètre.
- Lancer les builds EAS de prévisualisation Android/iOS avec les comptes de signature configurés, puis installer et tester les artefacts sur appareils réels.
- Planifier une migration Expo SDK 58 afin de réévaluer les avis de dépendances non corrigibles dans la branche actuelle.

## Contrôle du catalogue 1xGames

Le catalogue de référence a été vérifié séparément : **23 identifiants visuels sur 23 uniques et 23 assets sur 23 uniques**, et « Apple Of Fortune » n’apparaît qu’une fois dans `PopularTab`. Aucun doublon d’identifiant, de titre ou de visuel n’a été détecté dans les sections 1xGames.
