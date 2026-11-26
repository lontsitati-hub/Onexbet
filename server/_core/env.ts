export const ENV = {
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "onexbet-7eebd",
  // Compatibility fields used only by the optional legacy database helpers.
  appId: process.env.FIREBASE_PROJECT_ID ?? "onexbet-7eebd",
  cookieSecret: "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.FIREBASE_OWNER_UID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
