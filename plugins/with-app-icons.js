/* eslint-env node */
/**
 * Config plugin that registers alternate app icons so they can be switched at
 * runtime by the `app-icon` local Expo module.
 *
 * Android: registers a launcher `<activity-alias>` per icon (the default one is
 * enabled, the rest disabled) and copies each icon PNG into `res/drawable`.
 * The MainActivity keeps its real class; only the launcher intent-filter lives
 * on the aliases so exactly one is enabled at a time.
 *
 * The runtime module name format is `<pkg>.MainActivityIcon<Name>` — keep in
 * sync with modules/app-icon/android/.../AppIconModule.kt.
 */
const {
  withAndroidManifest,
  withGradleProperties,
  withInfoPlist,
  withXcodeProject,
  AndroidConfig: {
    Manifest: { getMainApplication, getMainActivityOrThrow },
  },
} = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// KEEP IN SYNC with modules/app-icon/icons.config.ts (the runtime source of
// truth). Config plugins run in plain Node, so they can't import the .ts file.
const APP_ICONS = [
  { name: 'default', asset: './assets/icon.png' },
  { name: 'sunset', asset: './assets/app-icons/icon-sunset.png' },
  { name: 'ocean', asset: './assets/app-icons/icon-ocean.png' },
  { name: 'forest', asset: './assets/app-icons/icon-forest.png' },
  { name: 'violet', asset: './assets/app-icons/icon-violet.png' },
  { name: 'rose', asset: './assets/app-icons/icon-rose.png' },
];

const LAUNCHER_INTENT_FILTER = {
  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
};

function isLauncherIntentFilter(ifilters) {
  if (!Array.isArray(ifilters?.action) || !Array.isArray(ifilters?.category)) {
    return false;
  }
  return (
    ifilters.action.some((a) => a.$['android:name'] === 'android.intent.action.MAIN') &&
    ifilters.category.some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER')
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildAlias(androidPackage, icon, enabled) {
  return {
    $: {
      'android:name': `${androidPackage}.MainActivityIcon${capitalize(icon.name)}`,
      'android:enabled': enabled ? 'true' : 'false',
      'android:exported': 'true',
      'android:icon': `@drawable/ic_launcher_${icon.name}`,
      'android:label': 'r34',
      'android:targetActivity': '.MainActivity',
    },
    'intent-filter': [LAUNCHER_INTENT_FILTER],
  };
}

function copyIconDrawables(projectRoot) {
  const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');
  fs.mkdirSync(resDir, { recursive: true });
  for (const icon of APP_ICONS) {
    const src = path.resolve(projectRoot, icon.asset);
    if (!fs.existsSync(src)) {
      console.warn(`[with-app-icons] MISSING source icon: ${src}`);
      continue;
    }
    fs.copyFileSync(src, path.join(resDir, `ic_launcher_${icon.name}.png`));
  }
}

/**
 * iOS: registers alternate icons in Info.plist (CFBundleAlternateIcons) and
 * copies the PNGs into the Xcode source directory so they end up in the app
 * bundle. Without this, setAlternateIconName() silently fails on iOS.
 */
function withIosAlternateIcons(config) {
  const withPlist = withInfoPlist(config, (mod) => {
    const altIcons = {};
    for (const icon of APP_ICONS) {
      if (icon.name === 'default') continue;
      const basename = path.basename(icon.asset, '.png'); // e.g. "icon-sunset"
      altIcons[icon.name] = {
        CFBundleIconFiles: [basename],
        UIPrerenderedIcon: false,
      };
    }
    mod.modResults.CFBundleIcons = { CFBundleAlternateIcons: altIcons };
    return mod;
  });

  return withXcodeProject(withPlist, (mod) => {
    const proj = mod.modResults;
    const projectRoot = mod.modRequest.projectRoot;
    const platformRoot = mod.modRequest.platformProjectRoot; // ios/
    const projectName = config.slug || config.name;
    const sourceDir = path.join(platformRoot, projectName);

    for (const icon of APP_ICONS) {
      if (icon.name === 'default') continue;
      const src = path.resolve(projectRoot, icon.asset);
      const basename = path.basename(icon.asset);
      const dest = path.join(sourceDir, basename);
      if (!fs.existsSync(src)) {
        console.warn(`[with-app-icons] MISSING source icon: ${src}`);
        continue;
      }
      fs.copyFileSync(src, dest);
      // Avoid duplicate references on repeat prebuild (--no-clean) runs.
      const refs = proj.pbxFileReferenceSection();
      const alreadyAdded = Object.keys(refs).some((key) => refs[key].path === basename);
      if (!alreadyAdded) {
        // addResourceFile can throw on a freshly-cleaned project before the
        // resource build phase is fully wired up; swallow so a full prebuild
        // still completes (and with it, local-module autolinking on Android).
        try {
          proj.addResourceFile(basename);
        } catch (e) {
          console.warn(`[with-app-icons] could not add resource ${basename}: ${e.message}`);
        }
      }
    }
    return mod;
  });
}

module.exports = function withAppIcons(config) {
  const androidPackage = config.android?.package;
  if (!androidPackage) {
    throw new Error('with-app-icons: android.package is not set');
  }

  // Tell the Expo Android autolinking to scan ./modules so the local `app-icon`
  // module is compiled in. Without this the gradle property defaults to `[]`
  // and the native module is missing at runtime.
  const withGradle = withGradleProperties(config, (mod) => {
    const props = mod.modResults;
    const key = 'expo.inlineModules.watchedDirectories';
    const existing = props.find((p) => p.key === key);
    const value = '["modules"]';
    if (existing) {
      existing.value = value;
    } else {
      props.push({ key, value });
    }
    return mod;
  });

  const withAndroid = withAndroidManifest(withGradle, (mod) => {
    const projectRoot = mod.modRequest.projectRoot;
    const manifest = mod.modResults;
    const mainActivity = getMainActivityOrThrow(manifest);

    // 1. Strip the launcher intent-filter from MainActivity itself — launching
    //    is now handled by the aliases below.
    if (Array.isArray(mainActivity['intent-filter'])) {
      mainActivity['intent-filter'] = mainActivity['intent-filter'].filter(
        (f) => !isLauncherIntentFilter(f)
      );
    }

    // 2. One launcher alias per icon (default enabled, rest disabled).
    const app = getMainApplication(manifest);
    app['activity-alias'] = APP_ICONS.map((icon, i) => buildAlias(androidPackage, icon, i === 0));

    // 3. Copy the icon PNGs into res/drawable so the aliases resolve.
    copyIconDrawables(projectRoot);

    return mod;
  });

  return withIosAlternateIcons(withAndroid);
};
