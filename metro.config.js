const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'expo-sqlite') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/services/sqlite.web.ts'),
    };
  }

  if (
    platform === 'web' &&
    (moduleName === '@/services/db' || moduleName.endsWith('/services/db'))
  ) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/services/db.web.ts'),
    };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));
config.resolver.sourceExts = config.resolver.sourceExts.filter((extension) => extension !== 'wasm');

module.exports = withNativeWind(config, {
  input: './global.css',
});
