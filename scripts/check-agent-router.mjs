import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Validate only references to docs on this checked-out branch.
// EN matching intentionally uses branch-specific docs outside main.
const root = process.cwd();
const source = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
const routes = [...new Set([...source.matchAll(/`(docs\/[a-zA-Z0-9_.\/-]+\.md)`/g)].map(m => m[1]))];
const branchSpecific = new Set(['docs/workflows/english-site.md']);
const missing = routes.filter(path => !branchSpecific.has(path) && !existsSync(resolve(root, path)));

if (missing.length) {
  console.error('Broken agent workflow routes:\n' + missing.map(path => '  - ' + path).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Agent route references OK (' + (routes.length - branchSpecific.size) + ' on this branch; ' + branchSpecific.size + ' branch-specific)');
}
