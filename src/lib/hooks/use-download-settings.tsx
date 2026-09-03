import { useMMKVString } from 'react-native-mmkv';

import { storage } from '../storage';

const DOWNLOAD_PATH_KEY = 'settings.download_path';
const WIFI_ONLY_KEY = 'settings.wifi_only';

export const useDownloadSettings = () => {
  const [path, setPath] = useMMKVString(DOWNLOAD_PATH_KEY, storage);
  const [wifiOnly, setWifiOnly] = useMMKVString(WIFI_ONLY_KEY, storage);

  return {
    downloadPath: path ?? 'videos',
    setDownloadPath: setPath,
    wifiOnly: wifiOnly === 'true',
    setWifiOnly: (v: boolean) => setWifiOnly(v ? 'true' : 'false'),
  };
};

/** The configured download folder, readable outside React (e.g. retry flows). */
export function getDownloadPath(): string {
  return storage.getString(DOWNLOAD_PATH_KEY) ?? 'videos';
}
