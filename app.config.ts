// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "space.manus.onexapp.t233838180102903";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "1xbet.cm",
  appSlug: "oneXbet-arn",
  // Durable CDN copy of the exact square icon used by the native Android and iOS app.
  logoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663306997020/YkxUUgXZkKGdRean.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config = {
  name: env.appName,
  slug: env.appSlug,
  logoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663306997020/YkxUUgXZkKGdRean.png",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/app-icon-1xbet-cm.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    icon: "./assets/images/app-icon-1xbet-cm.png",
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#03346D",
      foregroundImage: "./assets/images/app-icon-1xbet-adaptive-foreground.png",
      monochromeImage: "./assets/images/app-icon-1xbet-monochrome.png",
    },
    predictiveBackGestureEnabled: true,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/app-icon-1xbet-favicon.png",
  },
  extra: {
    eas: {
      projectId: "6b044653-0a0c-4d2f-a7b5-b76a4dba4336",
    },
  },
  plugins: [
    "expo-asset",
    "expo-router",
    "expo-sqlite",
    "expo-image",
    "expo-web-browser",
    "expo-font",
    "expo-status-bar",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/native-neutral-splash.png",
        imageWidth: 1,
        resizeMode: "contain",
        backgroundColor: "#101820",
        dark: {
          backgroundColor: "#101820",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
} as ExpoConfig & { logoUrl: string };

export default config;
