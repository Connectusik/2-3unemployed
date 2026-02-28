const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || '';
const normalizedApiUrl = rawApiUrl.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedApiUrl ? `${normalizedApiUrl}${normalizedPath}` : normalizedPath;
}
