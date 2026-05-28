export const createMMKV = jest.fn(() => ({
  set: jest.fn(),
  getString: jest.fn(),
  getAllKeys: jest.fn().mockReturnValue([]),
  remove: jest.fn(),
}));
