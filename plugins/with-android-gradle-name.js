/* eslint-env node */
/**
 * Sanitizes the Gradle root project name: prebuild writes config.name (which
 * carries an env suffix like "r34 dev") into settings.gradle, but Gradle
 * cannot evaluate a project name containing spaces.
 */
const { withSettingsGradle } = require('@expo/config-plugins');

const withAndroidGradleName = (config) =>
  withSettingsGradle(config, (mod) => {
    mod.modResults.contents = mod.modResults.contents.replace(
      /rootProject\.name = '([^']*)'/,
      (_match, name) => `rootProject.name = '${name.replace(/\s+/g, '')}'`
    );
    return mod;
  });

module.exports = withAndroidGradleName;
