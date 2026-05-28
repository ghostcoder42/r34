module.exports = {
  createWorkletRuntime: () => ({ execute: () => {} }),
  runOnWorklet: (fn: unknown) => fn,
  Worklets: {
    createSharedValue: (v: unknown) => ({ value: v }),
    createWorkletRuntime: () => ({ execute: () => {} }),
  },
};
