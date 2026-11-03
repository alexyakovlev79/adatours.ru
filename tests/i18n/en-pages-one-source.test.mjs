import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('.github/workflows/en-pages-reusable-deploy.yml','utf8');
const target=fs.readFileSync('infra/en-pages-repository/.github/workflows/deploy.yml','utf8');
test('dedicated EN Pages repo contains only an invocation of the single-source workflow',()=>{
 assert.match(target,/uses: alexyakovlev79\/adatours\.ru\/\.github\/workflows\/en-pages-reusable-deploy\.yml@main/);
 assert.doesNotMatch(target,/actions\/checkout|npx astro|npm install|src\/content|prices/);
 assert.match(source,/workflow_call:/);
 assert.match(source,/github-pages/);
 assert.match(source,/alexyakovlev79\/adatours-en/);
 assert.match(source,/ref: main\s+path: website/);
 assert.doesNotMatch(source,/schedule:/);
 assert.doesNotMatch(source,/path: canonical-main/);
 assert.match(source,/git -C website rev-parse HEAD/);
 assert.match(source,/EN_SHARED_CONTENT: '1'/);
});

