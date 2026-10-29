#!/usr/bin/env node
// O(1), read-only foundation snapshot. This is not the future live dispatcher.
import { readFile } from 'node:fs/promises';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [status, validation, sites] = await Promise.all([
  read('../../data/i18n/foundation-status.json'),
  read('../../data/i18n/foundation-validation.json'),
  read('../../src/data/i18n/sites.json'),
]);
console.log(JSON.stringify({
  kind: 'foundation_snapshot_not_live_queue',
  snapshotDate: status.snapshotDate,
  sourceCommit: status.sourceCommit,
  phase: status.phase,
  massLaunchAllowed: status.massLaunchAllowed,
  matchingPilotEnabled: status.matchingPilotEnabled,
  matchingDispatcherReady: status.matchingDispatcherReady,
  englishBuildSafetyGateInstalled: status.englishBuildSafetyGateInstalled,
  englishBuildRuntimeReady: status.englishBuildRuntimeReady,
  matchingPilotBranch: status.matchingPilotBranch,
  matchingReaperCronActive: status.matchingReaperCronActive,
  runtimeLocaleAdapterConnected: status.runtimeLocaleAdapterConnected,
  operationalDispatcherReady: status.operationalDispatcherReady,
  automaticTextSynchronizationRunning: status.automaticTextSynchronizationRunning,
  newEnglishSitePublished: status.newEnglishSitePublished,
  englishOrigin: sites.sites.en.origin,
  englishReleaseState: sites.sites.en.releaseState,
  counts: status.counts,
  unitTestsPassed: validation.unitTestsPassed,
  fullAstroBuildRun: validation.fullAstroBuildRun,
  nextGates: status.nextGates,
  resumeDocument: 'docs/plans/english-site/00-progress.md',
}, null, 2));
