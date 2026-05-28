import { renderHook } from '@testing-library/react-native';

import { saveDownloadMetadata } from '@/lib/download';

import { useVideoDownload } from './use-video-download';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  createDownloadResumable: jest.fn().mockReturnValue({
    downloadAsync: jest.fn().mockResolvedValue({
      uri: 'file:///documents/downloads/test.mp4',
    }),
  }),
}));

jest.mock('./use-download-settings', () => ({
  useDownloadSettings: () => ({ downloadPath: 'downloads' }),
}));

jest.mock('@/lib/download', () => ({
  saveDownloadMetadata: jest.fn().mockResolvedValue(undefined),
}));

describe('useVideoDownload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() =>
      useVideoDownload({
        videoUrl: 'https://example.com/video.mp4',
        videoId: '123',
      })
    );

    expect(result.current.isDownloading).toBe(false);
    expect(result.current.downloadProgress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('does not download when videoUrl is empty', async () => {
    const { result } = renderHook(() =>
      useVideoDownload({
        videoUrl: '',
        videoId: '123',
      })
    );

    await result.current.handleDownload();

    expect(result.current.isDownloading).toBe(false);
  });

  it('persists uploader info in the saved metadata', async () => {
    const { result } = renderHook(() =>
      useVideoDownload({
        videoUrl: 'https://example.com/video.mp4',
        videoId: '123_720p',
        videoTitle: 'My Video',
        videoUploader: 'TestUser',
        videoUploaderMemberId: '99999',
      })
    );

    await result.current.handleDownload();

    expect(saveDownloadMetadata).toHaveBeenCalledTimes(1);
    const saved = (saveDownloadMetadata as jest.Mock).mock.calls[0][0];
    expect(saved.videoId).toBe('123_720p');
    expect(saved.uploader).toBe('TestUser');
    expect(saved.uploaderMemberId).toBe('99999');
  });
});
