import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{searchUrl,searchIA,detailIA,selectVideoFiles,safeQuery} from '../src/index.js';
const mockFiles=[{name:'sample.mp4',format:'h.264',size:'2000'},{name:'short.webm',format:'WebM',size:'500'},{name:'notes.txt',format:'Text'},{name:'meta.xml',source:'metadata'}];
test('prevents search-query injection and constructs archive-only search',()=>{
 const u=searchUrl('nature AND collection:other');
 assert.equal(u.hostname,'archive.org');assert.match(u.searchParams.get('q'),/collection:prelinger/);
 assert.doesNotMatch(safeQuery('nature: +[*]'),/[:\[\]*]/);
});
test('supports single video file selection and safe paths',()=>{
 const f=selectVideoFiles(mockFiles,'film-example');
 assert.equal(f.length,2);assert.match(f[0].url,/sample.mp4$/);
});
test('calls Archive search endpoint and normalizes public metadata',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async url=>{assert.match(String(url),/advancedsearch.php/);return new Response(JSON.stringify({response:{numFound:1,docs:[{identifier:'film123',title:'Test Film',year:'1940',downloads:22}]}}),{status:200})};
 try{const v=await searchIA('test',1);assert.equal(v.results.length,1);assert.equal(v.results[0].year,1940);}finally{globalThis.fetch=old}
});
test('details include playable direct URLs without proxying media',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async url=>new Response(JSON.stringify({metadata:{title:'Example',year:'1950',licenseurl:'https://creativecommons.org/publicdomain/mark/1.0/'},files:mockFiles}),{status:200});
 try{const v=await detailIA('film-example');assert.equal(v.videos.length,2);assert.equal(v.playable,true);assert.match(v.videos[0].url,/archive.org\/download/);}finally{globalThis.fetch=old}
});
test('Worker returns health and blocks other methods',async()=>{
 const env={ASSETS:{fetch:()=>new Response('index')}};
 let r=await worker.fetch(new Request('https://example.workers.dev/api/health'),env);assert.equal(r.status,503);assert.equal((await r.json()).databaseReady,false);
 r=await worker.fetch(new Request('https://example.workers.dev/api/search',{method:'POST'}),env);assert.equal(r.status,405);
});
