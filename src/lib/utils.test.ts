import type { StoreApi, UseBoundStore } from 'zustand';
import { createSelectors } from './utils';

describe('utils', () => {
  describe('createSelectors', () => {
    it('creates selectors from a zustand store', () => {
      const state = { count: 0, name: 'test' };
      const storeFn = jest.fn((selector: (s: typeof state) => unknown) => selector(state));
      const mockStore = Object.assign(storeFn, {
        getState: () => state,
        subscribe: jest.fn(),
      }) as unknown as UseBoundStore<StoreApi<typeof state>>;

      const result = createSelectors(mockStore);

      expect(result.use).toBeDefined();
      expect(result.use.count).toBeInstanceOf(Function);
      expect(result.use.name).toBeInstanceOf(Function);
    });

    it('selectors return correct values', () => {
      const state = { count: 42, name: 'hello' };
      const storeFn = jest.fn((selector: (s: typeof state) => unknown) => selector(state));
      const mockStore = Object.assign(storeFn, {
        getState: () => state,
        subscribe: jest.fn(),
      }) as unknown as UseBoundStore<StoreApi<typeof state>>;

      const result = createSelectors(mockStore);

      expect(result.use.count()).toBe(42);
      expect(result.use.name()).toBe('hello');
    });
  });
});
