/** Reproducible, chunked full-text inventory from one frozen main source snapshot. */
export async function seedAdaEnFulltextChunk(tools,opts={}) {
 const repo="alexyakovlev79/adatours.ru",api="https://api.github.com/repos/"+repo;
 const stage="i18n/translation-mass-staging",main="16dc9cdb6f029c0d16445966521338cacf353771";
 const root="data/i18n/fulltext-swarm/v1",chunk=opts.chunk;
 if(!Number.isInteger(chunk)||chunk<0||chunk>7)throw Error("chunk must be 0..7");
 const un=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result?.content??r?.result??r?.structuredContent??r};
 const fetchJ=async url=>JSON.parse(un(await tools.mcp__GitHub__fetch({url})));
 const fileJ=async path=>JSON.parse(un(await tools.mcp__GitHub__fetch_file({repository_full_name:repo,path,ref:main})));
 const pilot=new Set([
 "src/content/excursions/akivi-hanga-pukure-puna-pau-tahai-private.md",
 "src/content/excursions/south-coast-moai-anakena-private.md",
 "src/content/excursions/colombia-san-pedro-majagua-day-trip.md",
 "src/content/excursions/orongo-rano-kau-tour.md",
 "src/content/excursions/corcovado-tijuca-four-hours.md",
 "src/content/excursions/rio-night-show-churrascaria-dinner.md",
 "src/content/excursions/rocinha-private-walk.md",
 "src/content/excursions/sugarloaf-urca-four-hours.md",
 "src/content/excursions/colombia-bogota-zipaquira-con-guatavita.md",
 "src/content/excursions/siti-tur-po-kartakhene.md",
 "src/content/excursions/siti-tur-v-bogote.md",
 "src/content/destinations/rio-de-janeiro.md",
 "src/content/destinations/ostrov-pashi.md",
 "src/content/destinations/bogota.md",
 "src/content/destinations/kartahena.md",
 "src/content/countries/brazil.md",
 "src/content/countries/chile.md",
 "src/content/countries/colombia.md"
 ]);
 const hashes=[
 "22f8dad442d645287f8a2abee66eb0db5244d2d7",
 "9d91bb2a752d425085b29b2efb55fcc6d2e2fcae",
 "720b65aace0f7e6e3a7e2fb14daf9caa51542b3",
 "a7311f2b450443acc9e06b86800d8a70c55bb5b5",
 "730ef0a361aa431e43350b0c91a63d199b2e463",
 "c0116112e9cfb58914f3aab6a7a42b90b6a46d8a"
 ];
 const [seoParent,archive,...trees]=await Promise.all([
  fetchJ(api+"/contents/data/seo-geo?ref="+main),fileJ("data/catalog-archive.json"),
  ...hashes.map(sha=>fetchJ(api+"/git/trees/"+sha+"?recursive=1"))
 ]);
 const seoRoot=seoParent.find(x=>x.name==="articles").sha;
 const seoTree=await fetchJ(api+"/git/trees/"+seoRoot+"?recursive=1");
 if([...trees,seoTree].some(x=>x.truncated))throw Error("Truncated source tree");
 const archivePaths=new Set(archive.entries.map(x=>x.contentPath).filter(Boolean));
 const archiveSeo=new Set(archive.entries.map(x=>"data/seo-geo/articles"+x.url+"index.md"));
 const types=[
  ["excursion",trees[0],"src/content/excursions/"],
  ["destination",trees[1],"src/content/destinations/"],
  ["seo_geo_article",seoTree,"data/seo-geo/articles/"],
  ["country",trees[2],"src/content/countries/"],
  ["theme",trees[3],"src/content/themes/"],
  ["case",trees[4],"src/content/cases/"],
  ["person",trees[5],"src/content/people/"]
 ];
 const inventory=[],ordering=[],excluded={pilot:0,archive:0};
 for(const [type,tree,prefix] of types){
  const from=inventory.length+1;
  const sorted=tree.tree.filter(x=>x.type==="blob"&&x.path.endsWith(".md")).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  for(const item of sorted){
   const path=prefix+item.path;
   if(pilot.has(path)){excluded.pilot++;continue}
   if(archivePaths.has(path)||archiveSeo.has(path)){excluded.archive++;continue}
   const number=inventory.length+1;
   inventory.push({number,packet:Math.ceil(number/5),type,path,sha:item.sha});
  }
  ordering.push({type,from,to:inventory.length,count:inventory.length-from+1});
 }
 if(inventory.length!==7056||excluded.pilot!==18||excluded.archive!==6)throw Error("Unexpected inventory "+JSON.stringify({count:inventory.length,excluded,ordering}));
 const count=Math.ceil(inventory.length/5),all=Array.from({length:count},(_,i)=>({
  number:i+1,id:"ADAEN-P"+String(i+1).padStart(5,"0"),sourceMainSha:main,items:inventory.slice(i*5,i*5+5)
 }));
 const clean=x=>JSON.stringify(x,null,2)+"\n",el=[];
 for(let j=chunk*10;j<Math.min(chunk*10+10,Math.ceil(count/20));j++){
  el.push({path:root+"/definitions/"+String(j).padStart(4,"0")+".json",mode:"100644",type:"blob",content:clean({schemaVersion:1,part:j,packets:all.slice(j*20,j*20+20)})});
 }
 const packets=all.slice(chunk*200,Math.min((chunk+1)*200,count));
 el.push({path:root+"/listings/"+String(chunk).padStart(4,"0")+".tsv",mode:"100644",type:"blob",
  content:["TextNo\tPacketNo\tType\tSourcePath\tSourceGitBlobSha",...packets.flatMap(p=>p.items.map(x=>[x.number,x.packet,x.type,x.path,x.sha].join("\t")))].join("\n")+"\n"});
 el.push({path:root+"/seeded/"+String(chunk).padStart(4,"0")+".json",mode:"100644",type:"blob",content:clean({
  chunk,firstPacket:packets[0]?.number,lastPacket:packets.at(-1)?.number,
  firstText:packets[0]?.items[0].number,lastText:packets.at(-1)?.items.at(-1).number,sourceMainSha:main
 })});
 if(chunk===0){
  const states=Array.from({length:16},(_,i)=>({schemaVersion:1,shard:i,packets:{}}));
  for(const p of all)states[(p.number-1)%16].packets[String(p.number)]={status:"queued",generation:0,attempts:0};
  for(let i=0;i<16;i++)el.push({path:root+"/state/"+i.toString(16).padStart(2,"0")+".json",mode:"100644",type:"blob",content:clean(states[i])});
  el.push({path:root+"/manifest.json",mode:"100644",type:"blob",content:clean({
   schemaVersion:1,name:"Ada Tours EN full-text translation swarm",
   sourceMainSha:main,stageBranch:stage,items:inventory.length,packets:count,
   itemsPerPacket:5,leaseMinutes:90,maxPacketsPerChat:10,stateShards:16,definitionsPerFile:20,
   chunks:8,ordering,excluded,enabled:false,reason:"Awaiting all inventory chunks and worker tests",
   writesToMain:false,publication:"existing noindex EN staging only",independentSemanticQA:false
  })});
  const doc=[
   "# Ada Tours EN: numbered full-text translation inventory",
   "",
   "Source main SHA: "+main+". Queue branch: "+stage+".",
   "",
   "First, number each text in exact sorted repository-path order within its category. Then form packet N from texts 5N-4 through min(5N,7056).",
   "",
   "| Category order | Kind | Text numbers | Count |",
   "|---:|---|---|---:|",
   ...ordering.map((o,i)=>"| "+(i+1)+" | "+o.type+" | "+o.from+"–"+o.to+" | "+o.count+" |"),
   "",
   "Total: "+inventory.length+" individual texts and "+count+" five-text packets; final packet contains one text.",
   "Machine-readable full listing: "+root+"/listings/0000.tsv ... listings/0007.tsv.",
   "Immutable packet definitions: "+root+"/definitions/0000.json ... definitions/0070.json (20 packets per file).",
   "Already translated and source-SHA-checked: 18 pilots (11 excursions, 4 destinations, 3 countries).",
   "Archived exclusions: 1 excursion and 5 SEO/GEO articles. Existing tour v2 translation queue is not duplicated.",
   "One CAS lease for one numbered packet for 90 minutes; only after reservation reveal five precise source paths.",
   "One result commit for all five texts; at most ten consecutive packets per chat. No independent semantic QA.",
   "No writes to main, RU, prices, media, published pages, or existing tour v2 queue.",
   "",
   "Astro templates and hard-coded service-page UI texts require separate safe string extraction; executable source code must not be presented as translatable Markdown.",
   ""
  ].join("\n");
  el.push({path:"docs/plans/english-site/39-full-text-inventory.md",mode:"100644",type:"blob",content:doc});
 }
 if(opts.dryRun)return{status:"dry_run",chunk,items:inventory.length,packets:count,ordering,excluded,entries:el.length,bytes:el.reduce((sum,x)=>sum+x.content.length,0),samples:packets.slice(0,1)};
 const marker=root+"/seeded/"+String(chunk).padStart(4,"0")+".json";
 const checkMarker=async()=>{try{return await fetchJ(api+"/contents/"+marker+"?ref="+encodeURIComponent(stage))}catch(e){if(/404|NOT_FOUND|Not Found/.test(String(e)))return null;throw e}};
 let head=await fetchJ(api+"/git/ref/heads/"+stage);
 if(await checkMarker())return{status:"already_seeded",chunk,head:head.object.sha,packets:count};
 for(let retry=0;retry<3;retry++){
  const parent=await fetchJ(api+"/git/commits/"+head.object.sha);
  const tree=un(await tools.mcp__GitHub__create_tree({repository_full_name:repo,base_tree_sha:parent.tree.sha,tree_elements:el}));
  const commit=un(await tools.mcp__GitHub__create_commit({repository_full_name:repo,tree_sha:tree.sha,parent_sha:head.object.sha,message:"i18n: seed immutable full-text packets "+chunk}));
  try{
   const r=un(await tools.mcp__GitHub__update_ref({repository_full_name:repo,branch_name:stage,sha:commit.sha,expected_sha:head.object.sha,force:false}));
   return{status:"saved",chunk,commit:commit.sha,updated:r.success,packets:count,range:packets.length?[packets[0].number,packets.at(-1).number]:[],entries:el.length};
  }catch(err){
   head=await fetchJ(api+"/git/ref/heads/"+stage);
   if(await checkMarker())return{status:"already_seeded",chunk,head:head.object.sha};
   if(retry===2)throw err;
  }
 }
}