#!/usr/bin/env node
// Reproducible PSI experiments. No deployments, credentials or Sheets writes.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'data/performance/pages.json'), 'utf8'));
const [command, ...args] = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const cycle = option('cycle', 'B00');
if (!/^[A-Z][A-Z0-9_-]{1,30}$/.test(cycle)) throw Error('Invalid cycle ID');
const pages = config.pages.filter(p => !option('page') || option('page').split(',').includes(p.id));
if (!pages.length) throw Error('No matching control pages');
const destination = option('output', path.join(root, 'data/performance/runs', `${cycle}.json`));
const input = option('input', destination);
const save = async (file, data) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(data, null, 2) + '\n'); };
const requestedUrl = (p, run, device) => {
  const url = new URL(p.url);
  url.searchParams.set('psi_cycle', cycle);
  url.searchParams.set('psi_run', `${p.id}-${run}-${device.toLowerCase()}`);
  return url.href;
};
const plan = pages.flatMap(p => p.devices.flatMap(device => Array.from({ length: p.runs }, (_, i) => ({
  cycle, pageId: p.id, page: p.name, device, run: i + 1, canonicalUrl: p.url,
  requestedUrl: requestedUrl(p, i + 1, device), heroPolicy: p.heroPolicy,
}))));
const snapshot = async p => {
  const response = await fetch(p.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`${p.id}: HTTP ${response.status}`);
  const html = await response.text();
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  if (canonical !== p.url || response.url !== p.url) throw Error(`${p.id}: canonical / redirect mismatch`);
  return { pageId: p.id, url: response.url, canonical, checkedAt: new Date().toISOString(),
    sha256: createHash('sha256').update(html).digest('hex'), bytes: Buffer.byteLength(html) };
};
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
};
const metricNames = ['performance', 'fcpMs', 'lcpMs', 'tbtMs', 'cls', 'siMs', 'weightKiB', 'unusedJsKiB'];
const summarize = data => {
  const seen = new Set();
  for (const r of data.runs) {
    const key = `${r.device}:${r.reportId || r.fetchTime}`;
    if (r.status === 'VALID' && seen.has(key)) throw Error(`Duplicate valid report ${key}`);
    if (r.status === 'VALID' && !r.reportId && !r.fetchTime) throw Error('Missing report identity');
    if (r.status === 'VALID') seen.add(key);
    if (r.status === 'VALID' && metricNames.slice(0, 6).some(k => !Number.isFinite(r[k]))) throw Error(`Invalid metrics: ${r.pageId}`);
  }
  return pages.flatMap(p => p.devices.map(device => {
    const records = data.runs.filter(r => r.pageId === p.id && r.device === device && r.status === 'VALID');
    return { cycle: data.cycle, pageId: p.id, page: p.name, device, count: records.length,
      complete: records.length === p.runs,
      median: Object.fromEntries(metricNames.map(k => [k, median(records.map(r => r[k]))])),
      performanceRange: records.length ? [Math.min(...records.map(r => r.performance)), Math.max(...records.map(r => r.performance))] : null,
      lcpRangeMs: records.length ? [Math.min(...records.map(r => r.lcpMs)), Math.max(...records.map(r => r.lcpMs))] : null,
      reportUrls: records.map(r => r.psiUrl).filter(Boolean), heroPolicy: p.heroPolicy,
    };
  }));
};

if (command === 'plan') {
  console.log(JSON.stringify({ cycle, count: plan.length, jobs: plan }, null, 2));
} else if (command === 'snapshot') {
  const snapshots = [];
  for (const p of pages) snapshots.push(await snapshot(p));
  await save(destination, snapshots);
  console.log(`${snapshots.length} checked URLs: ${destination}`);
} else if (command === 'summarize') {
  const data = JSON.parse(await readFile(input, 'utf8'));
  const summary = summarize(data);
  const compareFile = option('compare');
  if (compareFile) {
    const previous = summarize(JSON.parse(await readFile(compareFile, 'utf8')));
    for (const row of summary) {
      const ref = previous.find(r => r.pageId === row.pageId && r.device === row.device);
      row.deltaPerformance = ref?.median.performance == null || row.median.performance == null ? null : row.median.performance - ref.median.performance;
      row.deltaLcpFraction = ref?.median.lcpMs > 0 && row.median.lcpMs != null ? row.median.lcpMs / ref.median.lcpMs - 1 : null;
      row.deltaTbtFraction = ref?.median.tbtMs > 0 && row.median.tbtMs != null ? row.median.tbtMs / ref.median.tbtMs - 1 : null;
    }
  }
  const subset = option('page') ? `-${pages.map(p => p.id).join('_')}` : '';
  const summaryFile = option('summary-output', path.join(root, 'data/performance/summaries', `${data.cycle}${subset}.json`));
  await save(summaryFile, summary);
  console.log(JSON.stringify({ groups: summary.length, complete: summary.filter(r => r.complete).length, file: summaryFile }, null, 2));
  if (summary.some(r => !r.complete)) process.exitCode = 1;
} else if (command === 'collect') {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) throw Error('PAGESPEED_API_KEY required. Use the official PSI UI when API quota is unavailable.');
  const version = option('version');
  if (!version) throw Error('--version must name the successfully deployed commit / experiment state');
  let data;
  try { data = JSON.parse(await readFile(destination, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; data = { schemaVersion: 1, cycle, version, source: 'Google PageSpeed Insights API v5', runs: [] }; }
  if (data.cycle !== cycle || data.version !== version) throw Error('Existing cycle has a different version; choose a new cycle');
  for (const p of pages) {
    const before = await snapshot(p);
    if (data.runs.some(r => r.pageId === p.id && r.status === 'VALID' && r.htmlSha256 !== before.sha256)) {
      for (const r of data.runs.filter(r => r.pageId === p.id && r.status === 'VALID')) { r.status = 'DRIFT'; r.note = 'HTML changed between checkpoints'; }
      await save(destination, data);
      throw Error(`${p.id}: published HTML changed since checkpoint; choose a fresh stable cycle`);
    }
    for (const job of plan.filter(j => j.pageId === p.id)) {
      if (data.runs.some(r => r.pageId === job.pageId && r.device === job.device && r.run === job.run && r.status === 'VALID' && r.htmlSha256 === before.sha256)) continue;
      const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
      endpoint.searchParams.set('url', job.requestedUrl);
      endpoint.searchParams.set('strategy', job.device.toLowerCase());
      endpoint.searchParams.set('category', 'performance');
      endpoint.searchParams.set('key', key);
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(180000) });
      const raw = await response.json();
      const lighthouse = raw.lighthouseResult;
      if (!response.ok || !lighthouse || lighthouse.runtimeError) {
        data.runs.push({ ...job, status: 'ERROR', observedAt: new Date().toISOString(), error: raw.error?.message || lighthouse?.runtimeError?.message || `HTTP ${response.status}` });
        await save(destination, data);
        throw Error('PSI request failed; saved the error. Check quota / report without retrying a failed run as valid.');
      }
      const a = lighthouse.audits;
      const value = id => Number.isFinite(a[id]?.numericValue) ? a[id].numericValue : null;
      const fetchTime = raw.analysisUTCTimestamp || lighthouse.fetchTime;
      const reused = data.runs.some(r => r.device === job.device && r.fetchTime === fetchTime);
      const rawFile = path.join(root, 'data/performance/raw', cycle, `${p.id}-${job.device}-${job.run}-${Date.now()}.json`);
      await save(rawFile, raw);
      const unused = a['unused-javascript']?.details?.items;
      data.runs.push({ ...job, version, status: reused ? 'REUSED' : 'VALID', fetchTime, observedAt: new Date().toISOString(),
        htmlSha256: before.sha256, lighthouseVersion: lighthouse.lighthouseVersion,
        finalUrl: lighthouse.finalDisplayedUrl || lighthouse.finalUrl, rawFile: path.relative(root, rawFile),
        performance: Math.round(lighthouse.categories.performance.score * 100), fcpMs: value('first-contentful-paint'),
        lcpMs: value('largest-contentful-paint'), tbtMs: value('total-blocking-time'), cls: value('cumulative-layout-shift'), siMs: value('speed-index'),
        weightKiB: value('total-byte-weight') == null ? null : value('total-byte-weight') / 1024,
        unusedJsKiB: Array.isArray(unused) ? unused.reduce((sum, item) => sum + (item.wastedBytes || 0), 0) / 1024 : null,
        lcpDetails: a['lcp-breakdown-insight']?.details || null });
      await save(destination, data);
    }
    const after = await snapshot(p);
    if (before.sha256 !== after.sha256) {
      for (const r of data.runs.filter(r => r.pageId === p.id && r.status === 'VALID')) { r.status = 'DRIFT'; r.note = 'HTML changed during the three-run series'; }
      await save(destination, data);
      throw Error(`${p.id}: HTML drift; repeat three runs on a stable published state`);
    }
  }
  console.log(`${data.runs.length} rows saved: ${destination}`);
} else {
  console.log('Usage: node scripts/pagespeed.mjs plan|snapshot|collect|summarize --cycle B00 [--page brazil] [--version SHA] [--input FILE] [--compare FILE]');
  process.exitCode = 1;
}
