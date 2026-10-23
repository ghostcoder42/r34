import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { RenderOptions } from '@testing-library/react-native';
import { render, userEvent } from '@testing-library/react-native';
import type React from 'react';
import type { ReactElement } from 'react';

const createAppWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
  );
};

// RNTL v14: render is async (React 19 concurrent root) — helpers must await
// before spreading the result.
const customRender = async (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  const Wrapper = createAppWrapper(); // make sure we have a new wrapper for each render
  return await render(ui, { wrapper: Wrapper, ...options });
};

// use this if you want to test user events
export const setup = async (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  const Wrapper = createAppWrapper();
  return {
    user: userEvent.setup(),
    ...(await render(ui, { wrapper: Wrapper, ...options })),
  };
};

export * from '@testing-library/react-native';
export { customRender as render };
