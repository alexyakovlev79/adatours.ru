const base = import.meta.env.BASE_URL || '/';

export function withBase(path: string): string {
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:') ||
    path.startsWith('#')
  ) {
    return path;
  }

  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path === '/' ? '' : path.replace(/^\/+/, '');

  return `${normalizedBase}${cleanPath}`;
}
