/* eslint-env node */
/**
 * Enables the Gradle build cache (`org.gradle.caching=true`) so task outputs
 * (compilation, etc.) are stored under ~/.gradle/caches and reused across
 * builds. Pair with the actions/cache step on ~/.gradle in CI to speed up
 * repeat Android builds (first run still compiles everything; later runs reuse).
 */
const { withGradleProperties } = require('@expo/config-plugins');

const withGradleBuildCache = (config) =>
  withGradleProperties(config, (mod) => {
    const props = mod.modResults;
    const existing = props.find((p) => p.type === 'property' && p.key === 'org.gradle.caching');
    if (existing) {
      existing.value = 'true';
    } else {
      props.push({ type: 'property', key: 'org.gradle.caching', value: 'true' });
    }
    return mod;
  });

module.exports = withGradleBuildCache;
