export const CATALOG_PAGE_SIZE = 10;

export interface CatalogPagination {
  rootPath: string;
  canonical: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  offset: number;
  from: number;
  to: number;
  previousPath?: string;
  nextPath?: string;
}

/** Page one has only the root URL. Invalid and out-of-range routes are never generated. */
export function catalogPagePath(rootPath: string, page: number): string {
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+$/.test(rootPath)) {
    throw new Error(`Invalid catalogue root: ${rootPath}`);
  }
  if (!Number.isSafeInteger(page) || page < 1) throw new Error(`Invalid catalogue page: ${page}`);
  return page === 1 ? rootPath : `${rootPath}page/${page}/`;
}

/** Slice only after the caller has filtered and sorted the complete collection. */
export function paginateCatalog<T>(entries: readonly T[], rootPath: string): Array<{ entries: T[]; pagination: CatalogPagination }> {
  catalogPagePath(rootPath, 1);
  const totalPages = Math.ceil(entries.length / CATALOG_PAGE_SIZE);
  return Array.from({ length: totalPages }, (_, index) => {
    const currentPage = index + 1;
    const offset = index * CATALOG_PAGE_SIZE;
    return {
      entries: entries.slice(offset, offset + CATALOG_PAGE_SIZE),
      pagination: {
        rootPath,
        canonical: catalogPagePath(rootPath, currentPage),
        currentPage,
        totalPages,
        totalItems: entries.length,
        offset,
        from: offset + 1,
        to: Math.min(offset + CATALOG_PAGE_SIZE, entries.length),
        previousPath: currentPage > 1 ? catalogPagePath(rootPath, currentPage - 1) : undefined,
        nextPath: currentPage < totalPages ? catalogPagePath(rootPath, currentPage + 1) : undefined,
      },
    };
  });
}

/** Always keep the first and last page reachable; keep the mobile navigation compact. */
export function paginationNumbers(currentPage: number, totalPages: number): Array<number | 'gap'> {
  if (!Number.isSafeInteger(currentPage) || !Number.isSafeInteger(totalPages)
    || currentPage < 1 || totalPages < currentPage) throw new Error('Invalid pagination range');
  const visible = new Set([1, totalPages]);
  const start = Math.max(1, Math.min(currentPage - 1, totalPages - 4));
  const end = Math.min(totalPages, Math.max(currentPage + 1, 5));
  for (let page = start; page <= end; page++) visible.add(page);
  const result: Array<number | 'gap'> = [];
  let previous = 0;
  for (const page of [...visible].sort((a, b) => a - b)) {
    if (previous && page - previous === 2) result.push(previous + 1);
    else if (previous && page - previous > 2) result.push('gap');
    result.push(page);
    previous = page;
  }
  return result;
}
