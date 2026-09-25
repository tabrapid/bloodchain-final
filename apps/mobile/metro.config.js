const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo so changes to shared packages are picked up.
config.watchFolders = [workspaceRoot];

// Resolve modules from both the app's own node_modules and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Shared @bloodchain/* packages only define "exports" (no "main"), so Metro needs
// package exports resolution enabled or it fails to find their entry files.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

// The visual-QA harness renders these same screens in a browser so they can be
// photographed (apps/mobile/qa/visual). Three modules have no working web
// implementation and throw on boot or draw nothing: expo-secure-store,
// expo-notifications, react-native-maps. Substituting them is a property of the
// harness, not of the app, so it happens here rather than in app code, only for
// the web platform, and only when the harness asks for it by name. A native
// build cannot reach this branch.
if (process.env.BLOODCHAIN_VISUAL_QA === '1') {
  const qaStubs = {
    'expo-secure-store': path.resolve(projectRoot, 'qa/visual/stubs/expo-secure-store.web.js'),
    'expo-notifications': path.resolve(projectRoot, 'qa/visual/stubs/expo-notifications.web.js'),
    'react-native-maps': path.resolve(projectRoot, 'qa/visual/stubs/react-native-maps.web.js'),
  };

  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && qaStubs[moduleName]) {
      return { type: 'sourceFile', filePath: qaStubs[moduleName] };
    }
    return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
