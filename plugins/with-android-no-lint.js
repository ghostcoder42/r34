/* eslint-env node */
/**
 * Disables Android lint on release builds. `lintVitalAnalyzeRelease` runs for
 * every native module, is memory-heavy (Metaspace OOM on CI) and slow; lint is
 * a dev-time concern and shouldn't gate or slow release APK builds.
 *
 * Injects `lint { checkReleaseBuilds = false; abortOnError = false }` into the
 * `android {}` block of app/build.gradle during prebuild.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const LINT_BLOCK = `    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }`;

const withAndroidNoLint = (config) =>
  withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults;
    if (!/checkReleaseBuilds\s*=/.test(gradle.contents)) {
      gradle.contents = gradle.contents.replace(/^android\s*\{/m, `android {\n${LINT_BLOCK}`);
    }
    return mod;
  });

module.exports = withAndroidNoLint;
