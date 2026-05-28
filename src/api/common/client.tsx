const BASE_URL = 'https://rule34video.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export const headers = {
  'User-Agent': USER_AGENT,
  Referer: BASE_URL,
};

export async function fetchWithHeaders(url: string): Promise<Response> {
  return await fetch(url, {
    headers,
  });
}

export { BASE_URL };
