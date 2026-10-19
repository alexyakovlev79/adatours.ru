import type {APIRoute} from 'astro';
import {getSearchGeoPlaces} from '../lib/geo-map-astro';

// Static at build time; browser loads it only after selecting the Places tab.
export const GET: APIRoute = async () => new Response(
  JSON.stringify(await getSearchGeoPlaces()),
  {headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'public, max-age=3600',
  }},
);
