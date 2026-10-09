import { execFileSync } from 'node:child_process';
const anchor = process.env.MEDIA_LEGACY_CUTOFF;
if (!/^[0-9a-f]{40}$/.test(anchor || ''))
  throw new Error('Missing immutable MEDIA_LEGACY_CUTOFF commit SHA');
const result = execFileSync('git',
  ['diff', '--name-only', '--no-renames', '--diff-filter=AM', '-z', anchor, 'HEAD', '--', 'public/media/'],
  { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const changed = result.split('\0').filter(Boolean);
if (changed.length) {
  console.error('New or modified binary media in Git are forbidden. Upload to S3 first, then commit only MD/JSON.');
  console.error(changed.slice(0, 40).join('\n'));
  process.exit(1);
}
console.log('Git media freeze verified: 0 added or modified assets since ' + anchor.slice(0, 12));
