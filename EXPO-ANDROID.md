# OneXBet — compilation Android avec un nouveau compte Expo

Ce projet est prêt pour une compilation Android avec Expo Application Services (EAS). La référence `extra.eas.projectId` de l’ancien projet Expo a été retirée de `app.config.ts`. Le projet ne contient pas de compte Expo, de jeton Expo ou de clé Android d’un ancien compte.

## 1. Installer les dépendances

```bash
corepack pnpm install
```

## 2. Se connecter avec le nouveau compte Expo

Utilisez le nouveau compte Expo qui doit posséder l’application :

```bash
npx expo login
npx eas whoami
```

Vous pouvez aussi utiliser un jeton CI au lieu d’une connexion interactive :

```bash
export EXPO_TOKEN="votre_token_du_nouveau_compte"
npx eas whoami
```

## 3. Créer le projet EAS du nouveau compte

Depuis la racine de OneXBet :

```bash
npx eas init
```

Quand Expo demande de créer ou de lier un projet, choisissez **Create a new project** avec le nouveau compte. Cette commande générera un nouvel identifiant EAS dans la configuration locale ou dans le projet lié. Ne réutilisez pas l’ancien `projectId`.

Le package Android actuel est :

```text
space.manus.onexapp.t233838180102903
```

Il est défini dans `app.config.ts`. Changez-le avant `eas init` uniquement si vous souhaitez un nouvel identifiant Android unique.

## 4. Construire un APK installable

Le profil `preview` est configuré en APK interne :

```bash
npx eas build --platform android --profile preview
```

À la fin, Expo fournit une URL de téléchargement de l’APK. Le profil `production` produit un artefact destiné à la distribution Play Store ou à une distribution signée :

```bash
npx eas build --platform android --profile production
```

## 5. Compilation locale facultative

Une compilation locale nécessite le SDK Android, Java et Gradle configurés sur la machine :

```bash
npx expo prebuild --platform android
npx expo run:android --variant release
```

Pour générer un APK local avec la configuration du projet :

```bash
corepack pnpm run build:apk:local
```

La compilation EAS distante est recommandée pour éviter les différences de SDK et de keystore.

## Fichiers importants

- `app.config.ts` : identité Android, icônes, splash screen et plugins Expo ; aucune référence à l’ancien compte EAS.
- `eas.json` : profils `development`, `preview` et `production`.
- `google-services.json` : configuration Firebase Android conservée volontairement ; elle n’est pas une dépendance au compte Expo.
- `package.json` et `pnpm-lock.yaml` : versions Expo et dépendances verrouillées.

Ne partagez jamais un mot de passe Expo, un `EXPO_TOKEN`, un keystore ou un fichier `.env` dans le ZIP.
