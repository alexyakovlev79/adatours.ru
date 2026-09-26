import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const locale = z.enum(['ru', 'en', 'cn']);
const status = z.enum(['draft', 'review', 'approved', 'published', 'archived']);

const mediaObject = z.object({
  src: z.string(),
  alt: z.string().default(''),
  caption: z.string().optional(),
  status: z.enum(['approved', 'needs_replacement', 'replaced']).optional(),
  replacementReason: z.enum([
    'low_resolution',
    'upscaled',
    'blur',
    'jpeg_artifacts',
    'bad_crop',
    'blacklist',
    'duplicate_on_page',
    'outdated_visual',
    'other',
  ]).optional(),
  intendedSlot: z.string().optional(),
  sourceWidth: z.number().int().positive().optional(),
  sourceHeight: z.number().int().positive().optional(),
});
const media = mediaObject.optional();

const common = {
  id: z.string(),
  locale,
  slug: z.string(),
  status,
  searchAliases: z.array(z.string()).default([]),
  sourceUrl: z.string().url().optional(),
  sourceSnapshot: z.string().optional(),
  updatedAt: z.coerce.date().optional(),
};

const editorialBand = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  text: z.string(),
  image: z.string(),
  imageStatus: z.enum(['approved', 'needs_replacement', 'replaced']).optional(),
  imageReplacementReason: z.enum([
    'low_resolution',
    'upscaled',
    'blur',
    'jpeg_artifacts',
    'bad_crop',
    'blacklist',
    'duplicate_on_page',
    'outdated_visual',
    'other',
  ]).optional(),
  href: z.string().optional(),
});

const countries = defineCollection({
  loader: glob({ base: './src/content/countries', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    name: z.string(),
    summary: z.string(),
    hero: media,
    gallery: z.array(mediaObject).default([]),
    regions: z.array(z.string()).default([]),
    bestTime: z.string().optional(),
    entryNotes: z.string().optional(),
    currency: z.string().optional(),
    languages: z.array(z.string()).default([]),
    relatedThemes: z.array(z.string()).default([]),
    featuredTours: z.array(z.string()).default([]),
    featuredExcursions: z.array(z.string()).default([]),
    featureBands: z.array(editorialBand).default([]),
  }),
});

const destinations = defineCollection({
  loader: glob({ base: './src/content/destinations', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    name: z.string(),
    countryId: z.string(),
    destinationType: z.enum([
      'city',
      'region',
      'island',
      'national_park',
      'resort',
      'natural_area',
      'route_cluster',
    ]),
    summary: z.string(),
    hero: media,
    gallery: z.array(mediaObject).default([]),
    themes: z.array(z.string()).default([]),
    relatedDestinations: z.array(z.string()).default([]),
    featuredTours: z.array(z.string()).default([]),
    featuredExcursions: z.array(z.string()).default([]),
    featureBands: z.array(editorialBand).default([]),
    facts: z.array(z.object({
      value: z.string(),
      label: z.string(),
    })).default([]),
  }),
});

const tours = defineCollection({
  loader: glob({ base: './src/content/tours', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    title: z.string(),
    countries: z.array(z.string()).min(1),
    destinations: z.array(z.string()).default([]),
    themes: z.array(z.string()).default([]),
    audiences: z.array(z.string()).default([]),
    format: z.string().optional(),
    durationDays: z.number().int().positive().optional(),
    durationNights: z.number().int().nonnegative().optional(),
    route: z.array(z.string()).default([]),
    priceFrom: z.number().nonnegative().nullable().optional(),
    currency: z.string().optional(),
    priceNote: z.string().optional(),
    dates: z.array(z.string()).default([]),
    hero: media,
    gallery: z.array(mediaObject).default([]),
    featured: z.boolean().default(false),
    priority: z.number().int().default(0),
    lead: z.string(),
    highlights: z.array(z.object({
      title: z.string(),
      text: z.string(),
    })).default([]),
    itinerary: z.array(z.object({
      day: z.number().int().positive(),
      title: z.string(),
      places: z.array(z.string()).default([]),
      text: z.string(),
      image: z.union([z.string(), mediaObject]).optional(),
    })).default([]),
    included: z.array(z.string()).default([]),
    notIncluded: z.array(z.string()).default([]),
    notes: z.array(z.string()).default([]),
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).default([]),
  }),
});

const excursions = defineCollection({
  loader: glob({ base: './src/content/excursions', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    title: z.string(),
    country: z.string(),
    destination: z.string().optional(),
    themes: z.array(z.string()).default([]),
    duration: z.string().optional(),
    format: z.string().optional(),
    language: z.array(z.string()).default([]),
    priceFrom: z.number().nonnegative().nullable().optional(),
    currency: z.string().optional(),
    hero: media,
    gallery: z.array(mediaObject).default([]),
    route: z.array(z.string()).default([]),
  }),
});

const themes = defineCollection({
  loader: glob({ base: './src/content/themes', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    name: z.string(),
    summary: z.string(),
    hero: media,
    featuredCountries: z.array(z.string()).default([]),
    featuredDestinations: z.array(z.string()).default([]),
    featuredTours: z.array(z.string()).default([]),
  }),
});

const cases = defineCollection({
  loader: glob({ base: './src/content/cases', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    title: z.string(),
    segment: z.string(),
    countries: z.array(z.string()).default([]),
    cities: z.array(z.string()).default([]),
    groupSize: z.string().optional(),
    duration: z.string().optional(),
    year: z.number().int().optional(),
    nda: z.boolean().default(false),
    hero: media,
    gallery: z.array(mediaObject).default([]),
    proof: z.array(z.string()).default([]),
    relatedServices: z.array(z.string()).default([]),
  }),
});

const people = defineCollection({
  loader: glob({ base: './src/content/people', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    name: z.string(),
    role: z.string(),
    photo: media,
    languages: z.array(z.string()).default([]),
    expertise: z.array(z.string()).default([]),
    externalProfiles: z.array(z.string().url()).default([]),
  }),
});

const articles = defineCollection({
  loader: glob({ base: './src/content/articles', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    ...common,
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date().optional(),
    authorId: z.string().optional(),
    hero: media,
    themes: z.array(z.string()).default([]),
  }),
});

export const collections = {
  countries,
  destinations,
  tours,
  excursions,
  themes,
  cases,
  people,
  articles,
};
