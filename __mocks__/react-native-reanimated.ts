type Callback = () => void;

const Animated = {
  Value: class {
    setValue() {}
    interpolate() {
      return this;
    }
  },
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  timing: () => ({ start: (cb: Callback) => cb?.() }),
  spring: () => ({ start: (cb: Callback) => cb?.() }),
  decay: () => ({ start: (cb: Callback) => cb?.() }),
  sequence: () => ({ start: (cb: Callback) => cb?.() }),
  parallel: () => ({ start: (cb: Callback) => cb?.() }),
  loop: () => ({ start: (cb: Callback) => cb?.() }),
  createAnimatedComponent: (c: unknown) => c,
};

module.exports = Animated;
module.exports.default = Animated;
module.exports.useSharedValue = (v: unknown) => ({ value: v });
module.exports.useAnimatedStyle = (cb: () => unknown) => cb();
module.exports.useAnimatedProps = (cb: () => unknown) => cb();
module.exports.withTiming = (v: unknown) => v;
module.exports.withSpring = (v: unknown) => v;
module.exports.withDelay = (_d: unknown, v: unknown) => v;
module.exports.withSequence = (...args: unknown[]) => args[args.length - 1];
module.exports.withRepeat = (v: unknown) => v;
module.exports.runOnJS = (fn: unknown) => fn;
module.exports.runOnUI = (fn: unknown) => fn;
module.exports.Easing = {
  linear: (v: number) => v,
  ease: (v: number) => v,
  bezier: () => (v: number) => v,
  in: (v: number) => v,
  out: (v: number) => v,
  inOut: (v: number) => v,
};
module.exports.Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
module.exports.interpolate = (v: unknown) => v;
module.exports.cancelAnimation = () => {};
module.exports.measure = () => ({ x: 0, y: 0, width: 0, height: 0, pageX: 0, pageY: 0 });
module.exports.scrollTo = () => {};
module.exports.FadeIn = { duration: () => ({ build: () => ({}) }) };
module.exports.FadeOut = { duration: () => ({ build: () => ({}) }) };
module.exports.FadeInDown = { duration: () => ({ build: () => ({}) }) };
module.exports.FadeInUp = { duration: () => ({ build: () => ({}) }) };
module.exports.SlideInRight = { duration: () => ({ build: () => ({}) }) };
module.exports.SlideOutLeft = { duration: () => ({ build: () => ({}) }) };
module.exports.Layout = { duration: () => ({ build: () => ({}) }) };
