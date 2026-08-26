/**
 * Rewrites rule34video.com URLs into in-app paths before expo-router's
 * built-in linking parses them. Covers both the cold-start launch URL and
 * `url` events while the app is running (onNewIntent), so navigation is
 * handled by expo-router itself instead of racing with a separate listener.
 */
import { parseSiteUrl, siteRouteToPath } from '@/lib/r34/site-links';

export const redirectSystemPath = ({ path }: { path: string; initial: boolean }) => {
  try {
    const route = parseSiteUrl(path);
    if (route) return siteRouteToPath(route);
  } catch {
    // Never break navigation because of a bad URL — fall through unchanged.
  }
  return path;
};
