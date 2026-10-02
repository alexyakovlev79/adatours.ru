#!/usr/bin/env python3
"""Administrative, offline assembly of the 2026-10-02 source index.

This is not a build hook or an ingestion step. It reads the explicit, prepared
input JSON files supplied with --inputs and the current repository frontmatter.
It makes no network requests and never writes content Markdown or media files.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit, urlunsplit

import yaml


DATE = "2026-10-02"
VERSION = 1
COLLECTIONS = {"country": "countries", "destination": "destinations", "tour": "tours", "excursion": "excursions"}
SHEET = {"spreadsheetId": "1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc", "sheetName": "Страницы"}
FOLDERS = {
    "original": {"id": "1zbcua6J4CzYyay9kYMGQeyvHQ_gGj1Vl", "path": "page_texts_original"},
    "cleanedTours": {"id": "1qJ4nY892iSINyc4E2b394H3xmnLRaEDU", "path": "page_texts_newstep"},
    "cleanedExcursions": {"id": "1qtRfOWgew62WFk9IsCDGPVD_giO8Pcvh", "path": "page_texts_newstep/Excursions"},
    "rewriteV2": {"id": "1-9mtF_QMc3oFgRiwmNU8ZNo8lWFEA0Rs", "path": "page_texts_rewrite_v2"},
    "unversionedExcursionRewrite": {"id": "1RgV9IvknAKOqwvJyrl_kg-LwRSUDRFuZ", "path": "page_texts_rewrite_excursions"},
    "rewriteV1Archive": {"id": "1HQsgzuoIPDMFQAQ8QXQGX0h_kLWtdJbC", "path": "page_texts_rewrite"},
}


def norm_url(url):
    if not url:
        return None
    parsed = urlsplit(url)
    return urlunsplit(("https", parsed.netloc.lower().removeprefix("www."), parsed.path.rstrip("/") or "/", parsed.query, ""))


def raw_url(url):
    return isinstance(url, str) and url.startswith("https://brasiltours.ru/image/") and "/image/cache/" not in url.lower()


def unique(values):
    return list(dict.fromkeys(v for v in values if isinstance(v, str) and v.strip()))


def key_label(value):
    return re.sub(r"[\s\-–—]+", " ", value.strip().casefold())


def text_pointer(pointer):
    fields = ("driveId", "url", "name", "kind", "folderId", "folderPath", "mimeType", "containerKind", "parentTourId")
    return {key: pointer[key] for key in fields if key in pointer}


def dump_json(path, value, *, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    options = {"ensure_ascii": False}
    if compact:
        options["separators"] = (",", ":")
    else:
        options["indent"] = 2
    path.write_text(json.dumps(value, **options) + "\n")


def current_identity(entity_id, entity_type, source, production, current_entries, current_catalog):
    """Never reconstruct an existing identity from a pre-migration snapshot URL."""
    live = production.get(entity_id)
    data = live["data"] if live else {}
    previous = current_entries.get(entity_id, {})
    catalog = current_catalog.get(entity_id, {})
    slug = data.get("slug") or previous.get("slug") or catalog.get("slug")
    assert isinstance(slug, str) and re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug), \
        f"An explicit current English slug is required; the snapshot URL is not a slug source: {entity_id}"
    content_path = live["path"] if live else previous.get("contentPath") or catalog.get("contentPath")
    if not content_path:
        assert not previous, f"Existing source entry is missing its exact contentPath: {entity_id}"
        content_path = f"src/content/{COLLECTIONS[entity_type]}/{slug}.md"
    # A snapshot URL is retained only as a historical alias, never as identity.
    url = previous.get("url") or catalog.get("url") or source.get("url")
    legacy_urls = unique([
        *previous.get("legacyUrls", []), *catalog.get("legacyUrls", []), *data.get("legacyUrls", []),
        source.get("url"), previous.get("url"), catalog.get("url"),
    ])
    return {"slug": slug, "contentPath": content_path, "url": url, "legacyUrls": legacy_urls}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, default=Path(__file__).resolve().parents[2] / "data")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    repo = args.repo.resolve()
    inputs = args.inputs.resolve()
    output = repo / "data/source-index"
    input_paths = {key: inputs / filename for key, filename in {
        "textSources": "text-sources-by-id.json", "rawMedia": "raw-media-by-source.json",
        "excursionGeography": "excursion-geography.json",
    }.items()}
    sources = json.loads(input_paths["textSources"].read_text())
    raw_media_input = json.loads(input_paths["rawMedia"].read_text())
    geography = json.loads(input_paths["excursionGeography"].read_text())
    catalog_path = repo / "src/data/catalog/destinations.json"
    destination_catalog = json.loads(catalog_path.read_text())
    destinations = {record["id"]: record for record in destination_catalog}
    current_entries = {record["id"]: record for path in sorted((output / "entries").glob("*.json"))
                       for record in [json.loads(path.read_text())]}
    current_catalog = {record["id"]: record for path in sorted((output / "catalogs").glob("*.json"))
                       for record in json.loads(path.read_text()).get("entries", [])}
    for entity_id, destination in destinations.items():
        current_catalog[entity_id] = {**current_catalog.get(entity_id, {}), **destination}
    assert len(destinations) == len(destination_catalog)
    assert len(sources) == 722, "Inspect inventory additions explicitly before changing the fixed population"
    assert len(geography) == 140

    media_by_url = {}
    for url, record in raw_media_input.items():
        key = norm_url(url)
        if key in media_by_url:
            assert media_by_url[key] == record, f"Conflicting normalized media source: {url}"
        media_by_url[key] = record

    production = {}
    for collection in COLLECTIONS.values():
        for path in (repo / "src/content" / collection).glob("*.md"):
            content = path.read_text()
            assert content.startswith("---"), f"Missing frontmatter: {path}"
            frontmatter = yaml.safe_load(content.split("---", 2)[1])
            entity_id = frontmatter["id"]
            assert entity_id not in production, f"Duplicate production ID: {entity_id}"
            production[entity_id] = {"path": path.relative_to(repo).as_posix(), "data": frontmatter}

    countries = {entity_id: live["data"] for entity_id, live in production.items() if entity_id.startswith("country_")}
    country_names = {}
    for entity_id, data in countries.items():
        for alias in [data["name"], *data.get("searchAliases", [])]:
            label = key_label(alias)
            assert label not in country_names or country_names[label] == entity_id
            country_names[label] = entity_id

    enhancements_path = repo / "src/data/media/photo-enhancements.json"
    enhancements = json.loads(enhancements_path.read_text()).get("enhancements", [])
    enhancement_sources = defaultdict(list)
    for record in enhancements:
        if record.get("enhanced") and record.get("source"):
            enhancement_sources[record["enhanced"]].append(record["source"])
    legacy_path = inputs.parent / "legacy-media-audit/legacy-local-to-raw.json"
    legacy_map = json.loads(legacy_path.read_text()) if legacy_path.is_file() else {}

    def existing_raw(source, seen=None):
        if raw_url(source):
            return source
        seen = set() if seen is None else set(seen)
        if not source or source in seen:
            return None
        seen.add(source)
        if raw_url(legacy_map.get(source)):
            return legacy_map[source]
        candidates = unique(existing_raw(parent, seen) for parent in enhancement_sources.get(source, []))
        return candidates[0] if len(candidates) == 1 else None

    def actual_images(data):
        result = []
        hero = data.get("hero")
        if isinstance(hero, dict) and hero.get("src"):
            result.append({"url": hero["src"], "role": "hero", "order": 1, "alt": hero.get("alt", "")})
        for image in data.get("gallery", []):
            if isinstance(image, dict) and image.get("src"):
                result.append({"url": image["src"], "role": "gallery", "order": len(result) + 1, "alt": image.get("alt", "")})
        for band in data.get("featureBands", []):
            image = band.get("image") if isinstance(band, dict) else None
            image_url = image.get("src") if isinstance(image, dict) else image
            if isinstance(image_url, str) and image_url and not any(row["url"] == image_url for row in result):
                result.append({"url": image_url, "role": "gallery", "order": len(result) + 1, "alt": band.get("title", "")})
        return result

    entries = []
    full_records = []
    catalog_rows = defaultdict(list)
    for entity_id, source in sorted(sources.items(), key=lambda item: item[1]["sheetRow"]):
        entity_type = source["entityType"]
        live = production.get(entity_id)
        data = live["data"] if live else {}
        previous = current_entries.get(entity_id, {})
        current = {**current_catalog.get(entity_id, {}), **previous}
        identity = current_identity(entity_id, entity_type, source, production, current_entries, current_catalog)
        slug, content_path = identity["slug"], identity["contentPath"]
        entry_path = f"data/source-index/entries/{entity_id}.json"
        stored_aliases = unique([*current_catalog.get(entity_id, {}).get("aliases", []), *previous.get("aliases", [])])
        aliases = unique([*stored_aliases, *data.get("searchAliases", []), data.get("title"), data.get("name")])
        aliases = [alias for alias in aliases if alias != source["name"] or alias in stored_aliases]

        geographic_evidence = []
        if entity_type == "country":
            country_ids, destination_ids = [entity_id], []
            geography_state = "fixed"
        elif entity_type == "destination":
            item = destinations[entity_id]
            country_ids, destination_ids = [item["countryId"]], [entity_id]
            # Current live/entry identity and the canonical catalog must agree;
            # the fixed snapshot is not authoritative after a URL migration.
            assert item["slug"] == slug, f"Destination slug disagrees with catalog: {entity_id}"
            geography_state = "fixed"
        elif entity_type == "excursion":
            geo = geography[entity_id]
            country_ids = geo["countryIds"]
            destination_ids = geo["destinationIds"]
            geographic_evidence = [geo["evidence"]]
            geography_state = "fixed" if destination_ids else "no_destination_asserted"
            if live:
                assert [data["country"]] == country_ids, f"Excursion country snapshot is stale: {entity_id}"
                assert ([data["destination"]] if data.get("destination") else []) == destination_ids, f"Excursion destination snapshot is stale: {entity_id}"
        elif live:
            country_ids = data.get("countries", [])
            destination_ids = data.get("destinations", [])
            geographic_evidence = [{"kind": "production_frontmatter", "path": content_path}]
            geography_state = "fixed"
        elif "countryIds" in current:
            country_ids = current["countryIds"]
            destination_ids = current.get("destinationIds", [])
            geographic_evidence = current.get("geographicEvidence", [])
            geography_state = current.get("readiness", {}).get("geography", "fixed" if country_ids else "resolve_when_creating_tour")
        else:
            country_ids = []
            for evidence in source.get("geographicEvidence", []):
                label = evidence.get("countryName")
                if label and key_label(label) in country_names:
                    country_ids.append(country_names[key_label(label)])
                    geographic_evidence.append(evidence)
            country_ids = unique(country_ids)
            destination_ids = []
            geography_state = "resolve_when_creating_tour"
        country_ids, destination_ids = unique(country_ids), unique(destination_ids)
        assert all(country_id in countries for country_id in country_ids), f"Unknown country: {entity_id}"
        assert all(destination_id in destinations for destination_id in destination_ids), f"Unknown destination: {entity_id}"
        destination_details = [{key: destinations[destination_id][key] for key in ("id", "name", "url", "countryId")} for destination_id in destination_ids]

        text_record = {
            "selected": text_pointer(source["selected"]), "original": text_pointer(source["original"]),
            "verification": source["verification"],
        }
        for key in ("sourceScope", "provenance"):
            if key in source:
                text_record[key] = source[key]

        current_images = actual_images(data) if live else []
        if source["sourceUrl"] and source.get("sourceScope") != "destination_excerpt":
            source_media = media_by_url[norm_url(source["sourceUrl"])]
            assert source_media["resolutionStatus"] == "ready" and not source_media.get("unresolved"), f"Media not ready: {entity_id}"
            images = [{key: image.get(key, "") for key in ("url", "role", "order", "alt")} for image in source_media["images"]]
            media_record = {"images": images, "status": "ready", "sourceUrl": norm_url(source["sourceUrl"]),
                            "provenance": {"kind": "donor_page_inventory", "selection": source_media.get("selection", "own-page-carousel")}}
        else:
            assert live, f"An excerpt entity must already have canonical media: {entity_id}"
            images = []
            for image in current_images:
                recovered = existing_raw(image["url"])
                if recovered:
                    images.append({**image, "url": recovered})
            images = [dict(image, order=index + 1) for index, image in enumerate(images)]
            has_raw_hero = any(image["role"] == "hero" for image in images)
            media_record = {
                "images": images, "status": "ready" if has_raw_hero else "existing_enhanced_preserved",
                "sourceUrl": source["sourceUrl"], "current": current_images,
                "provenance": {"kind": "existing_canonical_media", "contentPath": content_path,
                               "parentTourId": source.get("provenance", {}).get("parentTourId"),
                               "enhancementRegistry": "src/data/media/photo-enhancements.json",
                               "rule": "Preserve current media. Empty raw images do not request regeneration or a replacement donor."},
            }
        assert all(raw_url(image["url"]) for image in media_record["images"]), f"Non-raw image entered constants: {entity_id}"
        if media_record["status"] == "ready":
            assert sum(image["role"] == "hero" for image in media_record["images"]) == 1, f"Expected one raw hero: {entity_id}"

        record = {
            "id": entity_id, "type": entity_type, "name": source["name"], **identity,
            "sourceUrl": source["sourceUrl"],
            "countryIds": country_ids, "destinationIds": destination_ids, "destinations": destination_details,
            "aliases": aliases, "text": text_record, "media": media_record,
            "readiness": {"sources": "ready", "text": source["readiness"], "media": media_record["status"], "geography": geography_state},
            "sheet": {**SHEET, "row": source["sheetRow"]},
        }
        route_fields = {"tour": {"routeCountryIds": "routeCountries", "routeDestinationIds": "routeDestinations"},
                        "excursion": {"relatedDestinationIds": "relatedDestinations"}}
        for entry_key, content_key in route_fields.get(entity_type, {}).items():
            value = data.get(content_key) if live else current.get(entry_key)
            if value:
                record[entry_key] = value
        if entity_type == "destination":
            record["destinationType"] = destinations[entity_id]["destinationType"]
        if entity_type == "excursion":
            record["destinationName"] = destination_details[0]["name"] if destination_details else None
        if geographic_evidence:
            record["geographicEvidence"] = geographic_evidence
        full_records.append(record)

    # Later user-provided places and tour-derived excursions are not part of
    # the original snapshot. An administrative replay must retain them.
    for previous in current_entries.values():
        if previous["id"] not in sources:
            record = deepcopy(previous)
            record.update(current_identity(record["id"], record["type"], {}, production, current_entries, current_catalog))
            full_records.append(record)
    # Use the shared route helper with today's country/catalog objects. The
    # catalogs on disk are outputs of this run and may still hold older slugs.
    resolver = """
import { canonicalPath, routeCountryById, routeDestinationById } from './src/lib/routes.ts';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { records, countries, destinations } = JSON.parse(input);
for (const country of countries) routeCountryById.set(country.id, country);
for (const destination of destinations) routeDestinationById.set(destination.id, destination);
process.stdout.write(JSON.stringify(records.map((entry) => ({ id: entry.id, url: canonicalPath(entry) }))));
"""
    resolved = subprocess.run(
        ["node", "--input-type=module", "--eval", resolver],
        input=json.dumps({"records": full_records, "countries": list(countries.values()), "destinations": destination_catalog}, ensure_ascii=False), text=True,
        capture_output=True, check=True, cwd=repo,
    )
    canonical_urls = {item["id"]: item["url"] for item in json.loads(resolved.stdout)}
    for record in full_records:
        old_url = record["url"]
        record["url"] = canonical_urls[record["id"]]
        legacy_urls = [url for url in unique([*record.get("legacyUrls", []), old_url]) if url != record["url"]]
        if legacy_urls:
            record["legacyUrls"] = legacy_urls
        else:
            record.pop("legacyUrls", None)
        dump_json(output / "entries" / f"{record['id']}.json", record)
        compact = {key: record[key] for key in ("id", "type", "name", "url", "slug", "contentPath", "countryIds", "destinationIds", "sourceUrl")}
        compact["entryPath"] = f"data/source-index/entries/{record['id']}.json"
        for key in ("aliases", "routeCountryIds", "routeDestinationIds", "relatedDestinationIds", "legacyUrls"):
            if record.get(key):
                compact[key] = record[key]
        entries.append(compact)
        catalog_rows[COLLECTIONS[record["type"]]].append(compact)

    metadata = {
        "schemaVersion": VERSION, "preparedAt": DATE, "entityCount": len(entries),
        "sourcePolicy": "Use the per-entity selected Drive file and raw URLs. No source discovery, donor crawl, photo download, or whole-index rebuild during ordinary ingestion.",
        "sheet": SHEET, "folders": FOLDERS,
        "counts": {
            "types": dict(Counter(record["type"] for record in entries)),
            "media": dict(Counter(json.loads((output / record["entryPath"].removeprefix("data/source-index/")).read_text())["media"]["status"] for record in entries)),
            "rawDonorUrls": len({norm_url(record["sourceUrl"]) for record in entries if record["sourceUrl"]}),
        },
        "indexingScope": "Constants prepared on this date. Current publication existence and successful enhanced media remain authoritative in the exact contentPath and photo registry; these indexes do not require status maintenance for each new page.",
        "inputsSha256": {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in input_paths.items()},
        "destinationCatalogSha256": hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
    }
    dump_json(output / "index.json", {"metadata": metadata, "entries": entries}, compact=True)
    for collection, rows in catalog_rows.items():
        dump_json(output / "catalogs" / f"{collection}.json", {"preparedAt": DATE, "entries": rows}, compact=True)
    # A new excursion changes only its entry, the main index and one type catalog.
    # Avoid extra country copies that would also require maintenance through APIs.
    if (output / "catalogs/by-country").exists():
        shutil.rmtree(output / "catalogs/by-country")

    # Identity lives only in the canonical catalog; content preparation is a
    # queue referencing those IDs. Never regenerate a second reserved catalog.
    reserved = [item["id"] for item in destination_catalog if item["id"] not in sources]
    dump_json(output / "reserved-destinations.json", {
        "canonicalCatalog": "src/data/catalog/destinations.json",
        "preparationQueue": "src/data/catalog/destination-reservations.json",
        "rule": "Resolve queue records by canonical ID. This pointer contains no independent identity or content records.",
    })
    actual_ids = {path.stem for path in (output / "entries").glob("*.json")}
    assert actual_ids == {record["id"] for record in full_records}, "Stale or missing per-entry files"
    total_bytes = sum(path.stat().st_size for path in output.rglob("*") if path.is_file())
    print(json.dumps({"entries": len(entries), "reserved": len(reserved), "counts": metadata["counts"],
                      "files": sum(path.is_file() for path in output.rglob("*")), "bytes": total_bytes}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
