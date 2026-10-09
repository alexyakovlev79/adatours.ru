# Tour itinerary layout rules

This document fixes the approved layout behavior for the day-by-day tour program.

## Scope

Applies to the itinerary block rendered by:

`src/components/tour/Itinerary.astro`

and therefore to all tour pages that use the shared tour layout.

## Desktop rule: two-column itinerary

At desktop width (`min-width: 1100px`) itinerary cards are arranged in two columns.

All itinerary items are collapsed by default. In the collapsed state the photograph remains visible directly below the summary row, while places/direction and descriptive text stay hidden until the user opens the item.

Collapsed desktop photographs use the same 16:9 presentation, so all closed itinerary cards show media at one consistent size.

The collapsed summary must sit visually halfway between the photograph above and its own photograph below. Keep the outer gap compact and symmetric: desktop uses 18 px below the preceding card media and 18 px above the next collapsed media; mobile uses 10 px + 10 px. On desktop the summary row reserves 126 px, enough for titles up to three lines at the current type scale, so neighboring cards keep one common black-band height instead of forming a staircase. Mobile remains content-driven with a 76 px minimum because it is single-column.

There are no horizontal divider lines above or below itinerary cards. The always-visible photographs themselves separate one itinerary item from the next, on both desktop and mobile.

### Collapsed desktop rows: compact media budget

One full desktop photo slot is the normal 16:9 height of the current itinerary column, capped at 660 px. The 16 px gaps between photographs are added on top of these slots.

While the row is collapsed, preserve its existing compact rules:

- if both cards have photographs and their counts differ, the shared media budget is based on the **smaller photograph count**;
- if both cards have the same count greater than 1, reserve one full slot for **each** photograph;
- an unpaired final card with multiple photographs uses its own photograph count;
- two single-photo cards keep their ordinary collapsed layout;
- a row containing a card without photographs preserves the static text-card behavior.

The collapsed media blocks end on one line. A card with more photographs may show them shorter **only while collapsed**.

### Expanded desktop rows: full-height photographs

Clicking **+** on either interactive card opens the entire pair. Its height is now content-driven, regardless of differences in photo counts or text lengths.

- **All text** of both cards appears in full, including subsections and embedded excursions.
- **Every photo** in both cards uses its own standard desktop 16:9 slot, capped at 660 px per photograph, with 16 px between photos.
- The grid row grows to the taller natural combination of expanded text and full-height photographs. The smaller photo count **never limits** the other card when expanded.
- Both photo blocks end on the same horizontal line. The shorter column can have empty space above its images; neither its text nor images are compressed to equalize heights.
- Expanding never moves the next row upward; there is a 40 px top gap before the photos.

The rule applies to all photo-count combinations, including 1+1, 2+1, 3+2, 5+5 and a single final photo card. Clicking **×** restores the compact closed layout. A desktop text-only card retains its special static behavior.

The invariant is: **closed rows stay compact; opened rows show all content and full-height photos; media bottoms align; mobile is unaffected**.

## Desktop paired toggle behavior

At desktop width, the two itinerary cards occupying one visual row behave as one accordion pair when both cards have photographs and therefore show active plus/cross controls.

- clicking the plus on either card opens both cards in that row;
- clicking the cross on either card closes both cards in that row;
- day/day, excursion/excursion and day/excursion pairs follow the same rule;
- an incomplete final row continues to toggle its single card normally;
- the user's viewport must stay anchored on the summary that was clicked: opening or closing a pair must not jump the page to the next row;
- desktop scroll anchoring is disabled inside the itinerary and the clicked summary position is restored during the row-size recalculation;
- mobile keeps the existing independent single-card accordion behavior.

A no-photo desktop card remains in its existing static-text mode. If such a card shares a row with an interactive photo card, that special no-photo behavior is preserved rather than forcing it into the paired accordion.

## Required DOM structure

Each itinerary item must keep this structure conceptually:

```
.day-card
  <details class="day">
    summary
    .day__content
  </details>
  .day__media
```

The media block must remain a **sibling of `<details>` inside `.day-card`**.

Do not move `.day__media` back inside `<details>`. When media is nested inside `<details>`, the browser does not allow the outer grid row to distribute the remaining vertical space correctly, and the two neighboring images end at different vertical positions.

The `.day-card` itself stretches to the full height of its CSS Grid row. Closed multi-photo cards share a fixed media budget; opened media keeps its full intrinsic slot count, the grid row grows naturally, and photo blocks remain anchored at the bottom.

## Image behavior

Desktop:

- every item is collapsed by default;
- collapsed media remains visible;
- a single full photo slot uses the normal 16:9 column height, capped at 660 px;
- collapsed multi-photo rows use the compact shared media budget above;
- opening a pair shows both cards' full text, places/direction and subsections;
- expanded photos retain individual full 16:9 heights regardless of their neighbor's photo count;
- use `object-fit: cover`;
- keep the bottom edge aligned across the desktop row.

Mobile:

- itinerary is single-column;
- every itinerary item is **collapsed by default**;
- the collapsed state shows the summary row only (day number when present, title, and the plus control) plus the item's photograph directly below it;
- places/direction, descriptive text, and subsections stay hidden until the user opens the item;
- the photograph remains visible in both collapsed and expanded states because `.day__media` stays outside `<details>`;
- ordinary days keep their two-digit day number; additional-excursion items keep the number position empty;
- opening the plus reveals the same full content as before; closing it hides the text again but never hides the mobile photograph;
- the desktop paired-card alignment rule does not apply;
- mobile itinerary photos keep their **original source aspect ratio**;
- do not crop, stretch, compress, or force any common aspect ratio on mobile;
- the image is rendered as `width: 100%` and `height: auto`; therefore different source photos may legitimately have different heights;
- do not put `aspect-ratio: 16 / 9`, a fixed height, `height: 100%`, or `object-fit: cover` on mobile itinerary media;
- itinerary photographs are full-bleed: each photo reaches both the left and right viewport edges, with no content gutter on either side.

## Additional excursions

Optional excursions that belong in the chronological itinerary are standalone itinerary entries, not subsections or extra images of a day.

Examples:

- «Макуко Сафари», дополнительно;
- «Парк птиц», дополнительно.

They use the same visual card structure as ordinary days, may have their own photograph, and are inserted at the same point in the sequence as in the source program. They do not increase the advertised number of tour days.

Additional-excursion cards have no visible numeric/day label. Do not render «ДОП.» or any other gold label in the number column; keep that position visually empty.

## Duplicate headings inside descriptions

The itinerary card already renders the day or excursion title in its summary row. Therefore a day description or canonical Excursion Markdown body must not begin with another Markdown/HTML heading that repeats that same title.

Content maintenance removes such leading duplicates from source MD. The shared itinerary renderer also strips a matching leading rendered heading from canonical excursion HTML as a defensive fallback, so a repeated source heading can never become a second oversized title inside a tour.

## Inline bold

Structured text may contain Markdown-style `**bold text**`.

The shared inline renderer converts these markers to ordinary HTML `<strong>` without displaying the asterisks. Do not add special visual styling for `<strong>`; use the site's normal typography.

If the source did not contain bold, do not introduce it merely for formatting.

## Approved reference

The behavior was visually accepted on the 17-day Brazil tour after refactoring the itinerary card so that media is outside `<details>` and aligned by the outer `.day-card`.

Reference page while the site is on GitHub Pages:

https://alexyakovlev79.github.io/adatours.ru/brazil/tour/grand-brazil-adventure-17-days/



## Tour gallery block

The standalone «Фотографии маршрута» / route-photo gallery is not rendered on tour pages. Legacy gallery media may remain in structured data when needed for other editorial slots, but do not output a separate route-photo gallery block in the tour layout.
