export function getActivitySyncUrl(
  baseUrl: string | undefined = process.env.EXPO_PUBLIC_API_BASE_URL
): string | null {
  const value = baseUrl?.trim();
  if (!value) return null;

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an HTTP(S) base URL without a query or fragment.');
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}/activities`;
}
