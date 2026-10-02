import countrySourceCatalog from '../../data/source-index/catalogs/countries.json' with { type: 'json' };
import destinationSourceCatalog from '../../data/source-index/catalogs/destinations.json' with { type: 'json' };
import tourSourceCatalog from '../../data/source-index/catalogs/tours.json' with { type: 'json' };
import excursionSourceCatalog from '../../data/source-index/catalogs/excursions.json' with { type: 'json' };
import destinationCatalog from '../data/catalog/destinations.json' with { type: 'json' };

export interface CountryRoute {
  id: string;
  name: string;
  slug: string;
}

export interface DestinationRoute {
  id: string;
  name: string;
  slug: string;
  countryId: string;
  countrySlug: string;
}

export interface CanonicalRouteInput {
  type: 'country' | 'destination' | 'tour' | 'excursion' | 'theme';
  id?: string;
  slug: string;
  countryIds?: readonly string[];
  routeCountryIds?: readonly string[];
  destinationIds?: readonly string[];
}

export type RoutedEntityType = Exclude<CanonicalRouteInput['type'], 'theme'>;
export interface AliasSourceEntry extends CanonicalRouteInput {
  type: RoutedEntityType;
  id: string;
  legacyUrls?: readonly string[];
}

export interface TourRouteInput {
  slug: string;
  title?: string;
  countries: readonly string[];
  routeCountries?: readonly string[];
}

export interface ExcursionRouteInput {
  slug: string;
  title?: string;
  country: string;
  destination?: string;
}

export interface BreadcrumbLink {
  label: string;
  href: string;
}

export type BreadcrumbItem = BreadcrumbLink | { links: BreadcrumbLink[] };

export const routeCountries: CountryRoute[] = countrySourceCatalog.entries.map(({ id, name, slug }) => ({ id, name, slug }));
export const routeCountryById = new Map(routeCountries.map((item) => [item.id, item]));
export const routeDestinationById = new Map<string, DestinationRoute>(
  destinationCatalog.map((item) => [item.id, item]),
);

function segment(value: string): string {
  if (!value || /[\/?#]/.test(value)) throw new Error(`Invalid route segment: ${value}`);
  return value;
}

export function countryRoute(id: string): CountryRoute {
  const country = routeCountryById.get(id);
  if (!country) throw new Error(`Unknown country route ID: ${id}`);
  return country;
}

export function destinationRoute(id: string): DestinationRoute {
  const destination = routeDestinationById.get(id);
  if (!destination) throw new Error(`Unknown destination route ID: ${id}`);
  return destination;
}

export function countryPath(country: { slug: string }): string {
  return `/${segment(country.slug)}/`;
}

export function destinationCountryPath(country: { slug: string }): string {
  return `${countryPath(country)}place/`;
}

export function destinationPath(destination: { slug: string; countryId: string }): string {
  return `${destinationCountryPath(countryRoute(destination.countryId))}${segment(destination.slug)}/`;
}

export function tourCountryPath(country: { slug: string }): string {
  return `${countryPath(country)}tour/`;
}

export function mainTourCountries(tour: TourRouteInput): CountryRoute[] {
  const allIds = new Set(tour.countries);
  const ids = [...new Set(tour.routeCountries ?? tour.countries)];
  if (!ids.length) throw new Error(`Tour has no route countries: ${tour.slug}`);
  if (ids.some((id) => !allIds.has(id))) throw new Error(`routeCountries must be a subset of countries: ${tour.slug}`);
  return ids.map(countryRoute);
}

export function tourPath(tour: TourRouteInput): string {
  const countries = mainTourCountries(tour);
  const group = countries.length === 1 ? countries[0].slug : 'multi-country';
  return `/${segment(group)}/tour/${segment(tour.slug)}/`;
}

export function excursionGeography(excursion: ExcursionRouteInput): { country: CountryRoute; destination?: DestinationRoute } {
  if (excursion.destination) {
    const destination = destinationRoute(excursion.destination);
    return { country: countryRoute(destination.countryId), destination };
  }
  return { country: countryRoute(excursion.country) };
}

export function excursionCountryPath(country: { slug: string }): string {
  return `${countryPath(country)}excursion/`;
}

export function excursionDestinationPath(destination: DestinationRoute): string {
  return `${countryPath(countryRoute(destination.countryId))}${segment(destination.slug)}/`;
}

export function excursionPath(excursion: ExcursionRouteInput): string {
  const { country, destination } = excursionGeography(excursion);
  const parent = destination ? excursionDestinationPath(destination) : excursionCountryPath(country);
  return `${parent}${segment(excursion.slug)}/`;
}

export function themePath(theme: { slug: string }): string {
  return `/po-interesam/${segment(theme.slug)}/`;
}

/** Data-only contract shared by Astro and source-index migrations. No I/O or page lookup. */
export function canonicalPath(input: CanonicalRouteInput): string {
  switch (input.type) {
    case 'country': return countryPath(input);
    case 'theme': return themePath(input);
    case 'destination': {
      if (input.countryIds?.length !== 1) throw new Error(`Destination requires exactly one country: ${input.slug}`);
      if (input.id && routeDestinationById.has(input.id)) {
        const destination = destinationRoute(input.id);
        if (destination.countryId !== input.countryIds[0] || destination.slug !== input.slug) {
          throw new Error(`Destination route differs from its reserved catalog entry: ${input.id}`);
        }
        return destinationPath(destination);
      }
      return destinationPath({ slug: input.slug, countryId: input.countryIds[0] });
    }
    case 'tour': return tourPath({ slug: input.slug, countries: input.countryIds ?? [], routeCountries: input.routeCountryIds });
    case 'excursion': {
      if ((input.destinationIds?.length ?? 0) > 1) throw new Error(`Excursion requires at most one destination: ${input.slug}`);
      if (input.countryIds?.length !== 1) throw new Error(`Excursion requires one product country: ${input.slug}`);
      return excursionPath({ slug: input.slug, country: input.countryIds[0], destination: input.destinationIds?.[0] });
    }
    default: throw new Error(`Unsupported route entity type: ${(input as CanonicalRouteInput).type}`);
  }
}

export function legacyEntityPath(type: 'country' | 'tour' | 'excursion', slug: string): string {
  const collection = { country: 'strany', tour: 'tury', excursion: 'ekskursii' }[type];
  return `/${collection}/${segment(slug)}/`;
}

export function legacyDestinationPath(destination: { slug: string; countryId: string }): string {
  return `/napravleniya/${segment(countryRoute(destination.countryId).slug)}/${segment(destination.slug)}/`;
}

export function assertUniqueRoutePaths<T extends { params: { path: string } }>(routes: T[]): T[] {
  const seen = new Set<string>();
  for (const route of routes) {
    if (seen.has(route.params.path)) throw new Error(`Route collision: ${route.params.path}`);
    seen.add(route.params.path);
  }
  return routes;
}

function logicalPath(pathname: string, base = '/'): string {
  const prefix = base === '/' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;
  const logical = prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? pathname.slice(prefix.length) || '/'
    : pathname;
  return logical.endsWith('/') ? logical : `${logical}/`;
}

/** One alias registry drives both generated redirects and sitemap exclusion. */
export function createEntityAliasRegistry(entries: readonly AliasSourceEntry[]) {
  const aliasesByKey = new Map<string, Set<string>>();
  for (const entry of entries) {
    const key = `${entry.type}:${entry.id}`;
    const canonical = canonicalPath(entry);
    const oldPath = entry.type === 'destination'
      ? legacyDestinationPath({ slug: entry.slug, countryId: entry.countryIds![0] })
      : legacyEntityPath(entry.type, entry.slug);
    const aliases = aliasesByKey.get(key) ?? new Set<string>();
    for (const path of [oldPath, ...(entry.legacyUrls ?? [])]) {
      if (!path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) throw new Error(`Invalid legacy route: ${path}`);
      aliases.add(logicalPath(path));
    }
    aliases.delete(canonical);
    aliasesByKey.set(key, aliases);
  }
  const paths = new Set([...aliasesByKey.values()].flatMap((aliases) => [...aliases]));
  return {
    aliasesForEntity(type: RoutedEntityType, entity: { id: string; slug: string; countryId?: string }, canonical: string): string[] {
      const oldPath = type === 'destination'
        ? legacyDestinationPath({ slug: entity.slug, countryId: entity.countryId ?? destinationRoute(entity.id).countryId })
        : legacyEntityPath(type, entity.slug);
      return [...new Set([oldPath, ...(aliasesByKey.get(`${type}:${entity.id}`) ?? [])])].filter((path) => path !== canonical);
    },
    isLegacyRedirectPath(pathname: string, base = '/'): boolean {
      return paths.has(logicalPath(pathname, base));
    },
  };
}

const aliasRegistry = createEntityAliasRegistry([
  // The reserved destination catalog also covers existing places without a source snapshot.
  ...destinationCatalog.map((item) => ({ type: 'destination', id: item.id, slug: item.slug, countryIds: [item.countryId] })),
  ...countrySourceCatalog.entries,
  ...destinationSourceCatalog.entries,
  ...tourSourceCatalog.entries,
  ...excursionSourceCatalog.entries,
] as AliasSourceEntry[]);
export const aliasesForEntity = aliasRegistry.aliasesForEntity;
export const isLegacyRedirectPath = aliasRegistry.isLegacyRedirectPath;

export function countryBreadcrumbs(country: { name: string; slug: string }): BreadcrumbItem[] {
  return [{ label: 'Страны', href: '/strany/' }, { label: country.name, href: countryPath(country) }];
}

export function destinationBreadcrumbs(destination: { name: string; slug: string; countryId: string }): BreadcrumbItem[] {
  const country = countryRoute(destination.countryId);
  return [
    { label: 'Направления', href: '/napravleniya/' },
    { label: country.name, href: destinationCountryPath(country) },
  ];
}

export function tourBreadcrumbs(tour: TourRouteInput & { title: string }): BreadcrumbItem[] {
  const links = mainTourCountries(tour).map((country) => ({ label: country.name, href: tourCountryPath(country) }));
  return [
    { label: 'Туры', href: '/tury/' },
    links.length === 1 ? links[0] : { links },
  ];
}

export function excursionBreadcrumbs(excursion: ExcursionRouteInput & { title: string }): BreadcrumbItem[] {
  const { country, destination } = excursionGeography(excursion);
  return [
    { label: 'Экскурсии', href: '/ekskursii/' },
    { label: country.name, href: excursionCountryPath(country) },
    ...(destination ? [{ label: destination.name, href: excursionDestinationPath(destination) }] : []),
  ];
}

/** Expand parallel links into valid alternative trails without choosing a primary country. */
export function expandBreadcrumbTrails(items: BreadcrumbItem[]): BreadcrumbLink[][] {
  return items.reduce<BreadcrumbLink[][]>((trails, item) => {
    const alternatives = 'links' in item ? item.links : [item];
    return trails.flatMap((trail) => alternatives.map((link) => [...trail, link]));
  }, [[]]);
}
