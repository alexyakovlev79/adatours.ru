import { canonicalPath } from '../src/lib/routes.ts';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const records = JSON.parse(input);
const result = (Array.isArray(records) ? records : [records]).map((entry) => ({
  id: entry.id,
  url: canonicalPath(entry),
}));
process.stdout.write(`${JSON.stringify(result)}\n`);
