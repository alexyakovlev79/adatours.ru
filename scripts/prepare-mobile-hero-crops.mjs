import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');

// Focus coordinates are reviewed by a person/assistant before this deterministic step.
// Outputs always stay outside the Git checkout; publish only verified storage receipts.
const [pagesPath, decisionsPath, outputDir, sourceDir] = process.argv.slice(2);
if (!pagesPath || !decisionsPath || !outputDir) throw Error('Usage: node scripts/prepare-mobile-hero-crops.mjs PAGES.json FOCUS.json OUTPUT_DIR [SOURCE_DIR]');
if (sharp.versions.sharp !== '0.35.5') throw Error('Reproducing P06 requires Sharp 0.35.5');
const input = JSON.parse(await fs.readFile(pagesPath, 'utf8'));
const pages = (Array.isArray(input) ? input : input.pages).filter(x => !x.control);
const decisions = JSON.parse(await fs.readFile(decisionsPath, 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(outputDir, { recursive: true });
const items = [], uploads = [];
async function encode(item, bytes, crop, width, profile = 'portrait') {
  const key = `media/hero-mobile-p06/${item.id}-${profile}-${width}-20261022-v1.webp`;
  const file = path.join(outputDir, path.basename(key));
  const result = await sharp(bytes).extract(crop).resize({width, withoutEnlargement:true}).webp({quality:78}).toBuffer({resolveWithObject:true});
  if (result.info.width > crop.width || result.info.height > crop.height) throw Error('Upscale: '+item.id);
  await fs.writeFile(file,result.data);
  uploads.push({file:path.resolve(file),key});
  return {key,width:result.info.width,height:result.info.height,bytes:result.data.length,sha256:digest(result.data)};
}
for (const item of pages) {
  const decision = decisions.find(x => x.id === item.id);
  if (!decision) throw Error('Missing reviewed focus: '+item.id);
  const bytes = await fs.readFile(item.localSource ?? path.join(sourceDir ?? '.', item.id + '.webp'));
  if(digest(bytes)!==item.sourceSha256) throw Error('Changed original: '+item.id);
  const metadata = await sharp(bytes).metadata();
  const crop = {left:decision.left,top:0,width:Math.floor(metadata.height*3/4),height:metadata.height};
  if(crop.left<0||crop.left+crop.width>metadata.width) throw Error('Out of bounds: '+item.id);
  const widths = [...new Set([480,720,crop.width].filter(w=>w<=crop.width))].sort((a,b)=>a-b);
  const variants=[];
  for(const width of widths)variants.push(await encode(item,bytes,crop,width));
  const record = {id:item.id,pagePath:item.path,source:item.source,sourceSha256:item.sourceSha256,sourceWidth:metadata.width,sourceHeight:metadata.height,sourceBytes:bytes.length,status:'READY',reason:decision.reason,crop,objectPosition:decision.objectPosition,variants};
  if(item.onHomepage){
    let variant=variants.at(-1),position=decision.objectPosition;
    if(item.id==='p17'){
      // This homepage tile is horizontal at phone widths. A portrait would lose the arch.
      const homeCrop={left:0,top:0,width:metadata.width,height:Math.floor(metadata.width/(412/(412*.53)))};
      variant=await encode(item,bytes,homeCrop,Math.min(824,homeCrop.width),'home-landscape');
      position='center';
      record.homeCrop=homeCrop;
    }
    record.homeCover={...variant,position};
  }
  items.push(record);
}
const manifest={version:1,experiment:'P06-crops20-20261022',media:'(max-width: 479px)',quality:78,sharpVersion:sharp.versions.sharp,scope:'20 exact page heroes and four explicitly selected homepage covers',items};
await fs.writeFile(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(let i=0;i<uploads.length;i+=30)await fs.writeFile(path.join(outputDir,`upload-batch-${1+i/30}.json`),JSON.stringify(uploads.slice(i,i+30),null,2)+'\n');
console.log(JSON.stringify({pages:items.length,files:uploads.length,originalBytes:items.reduce((s,x)=>s+x.sourceBytes,0),largestPortraitBytes:items.reduce((s,x)=>s+x.variants.at(-1).bytes,0),sharp:sharp.versions.sharp}));
