import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';
import {parseTVBox,normalizeSource,validSourceURL} from '../src/tvbox.js';
import {activeSources} from '../src/source-db.js';
const origin='https://songbai.example.org';
const password='long-testing-password';
const envBase={ADMIN_PASSWORD:password,ADMIN_SESSION_SECRET:'a-session-secret-of-at-least-thirty-two-characters',ASSETS:{fetch:()=>new Response('asset')}};
function fakeDB(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_sources.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0003_security_events.sql',import.meta.url),'utf8'));
 return {
 prepare(sql){return {all:async()=>({results:db.prepare(sql).all()}),first:async()=>db.prepare(sql).get()||null,run:async()=>db.prepare(sql).run(),bind(...args){return {
 all:async()=>({results:db.prepare(sql).all(...args)}),
 first:async()=>db.prepare(sql).get(...args)||null,
 run:async()=>db.prepare(sql).run(...args)
 }}}},
 end(){db.close()}
 };
}
function request(path,method='GET',data,cookie,withOrigin=true){return new Request(origin+path,{method,headers:{...(data?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{}),...(withOrigin?{'origin':origin}:{})},body:data?JSON.stringify(data):undefined})}
async function login(env){const r=await worker.fetch(request('/api/admin/login','POST',{password}),env);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}

test('TVBox selects only searchable JSON CMS, skips spiders and private addresses',()=>{
 const list={sites:[
 {name:'Licensed public media',type:1,api:'https://media.example.org/api.php/provide/vod',searchable:1},
 {name:'Spider',type:3,api:'https://media.example.org/parse.js',searchable:1},
 {name:'not searchable',type:1,api:'https://no.example.org/api.php/provide/vod',searchable:0},
 {name:'private',type:1,api:'http://127.0.0.1:8080/api.php/provide/vod'},
 {name:'duplicate',type:1,api:'https://media.example.org/api.php/provide/vod'}
 ]};
 const a=parseTVBox(list);assert.equal(a.candidates.length,1);assert.equal(a.skipped.spider,1);assert.equal(a.skipped.notSearchable,1);assert.equal(a.skipped.invalid,1);assert.equal(a.skipped.duplicate,1);
 assert.equal(validSourceURL('https://example.org/path'),true);assert.equal(validSourceURL('http://127.0.0.1'),false);assert.equal(validSourceURL('https://localhost/x'),false);
 assert.match(normalizeSource({name:'A',url:'https://example.org/api.php/provide/vod'}).id,/^s-/);
});

test('dashboard auth protects all write APIs and denies cross-origin requests',async()=>{
 const DB=fakeDB();const env={...envBase,DB};
 let r=await worker.fetch(request('/api/admin/sources'),env);assert.equal(r.status,401);
 r=await worker.fetch(request('/api/admin/login','POST',{password:'wrong'}),env);assert.equal(r.status,401);
 r=await worker.fetch(request('/api/admin/login','POST',{password},undefined,false),env);assert.equal(r.status,403);
 const cookie=await login(env);assert.match(cookie,/sb_admin/);
 r=await worker.fetch(request('/api/admin/sources','POST',{name:'A',url:'https://media.example.org/api.php/provide/vod',rightsConfirmed:true},cookie,false),env);assert.equal(r.status,403);
 r=await worker.fetch(request('/api/admin/sources','POST',{name:'A',url:'https://media.example.org/api.php/provide/vod',rightsConfirmed:false},cookie),env);assert.equal(r.status,400);
 DB.prepare('select 1');
});

test('sources persist, are disabled by default, can be tested and toggled',async()=>{
 const DB=fakeDB(),env={...envBase,DB};const cookie=await login(env);
 const addr='https://media.example.org/api.php/provide/vod';
 let r=await worker.fetch(request('/api/admin/sources','POST',{name:'授权线路一',url:addr,rightsConfirmed:true},cookie),env);
 assert.equal(r.status,201);const {id}=await r.json();assert.ok(id);
 assert.equal((await activeSources(env)).length,0);
 const old=globalThis.fetch;globalThis.fetch=async u=>new Response(JSON.stringify({list:[]}),{headers:{'content-type':'application/json'}});
 try{r=await worker.fetch(request(`/api/admin/sources/${id}/test`,'POST',{},cookie),env);assert.equal(r.status,200);assert.equal((await r.json()).ok,true)}finally{globalThis.fetch=old}
 r=await worker.fetch(request(`/api/admin/sources/${id}`,'PATCH',{enabled:true},cookie),env);assert.equal(r.status,200);
 assert.equal((await activeSources(env)).length,1);
 r=await worker.fetch(request('/api/providers'),env);assert.equal((await r.json()).connected.length,1);
 r=await worker.fetch(request(`/api/admin/sources/${id}`,'PATCH',{enabled:false},cookie),env);assert.equal(r.status,200);
 assert.equal((await activeSources(env)).length,0);
 r=await worker.fetch(request(`/api/admin/sources/${id}`,'DELETE',{},cookie),env);assert.equal(r.status,200);
 assert.equal((await DB.prepare('SELECT * FROM video_sources').bind().all()).results.length,0);
});

test('TVBox import is preview-only until user confirms rights',async()=>{
 const DB=fakeDB(),env={...envBase,DB},cookie=await login(env);
 const config={sites:[{name:'Licensed',type:1,api:'https://media.example.org/api.php/provide/vod',searchable:1},{name:'Spider',type:3,api:'https://c.example.org/spider.js'}]};
 let r=await worker.fetch(request('/api/admin/import/tvbox','POST',{raw:JSON.stringify(config)},cookie),env);assert.equal(r.status,200);
 let data=await r.json();assert.equal(data.candidates.length,1);assert.equal((await DB.prepare('SELECT * FROM video_sources').bind().all()).results.length,0);
 r=await worker.fetch(request('/api/admin/import/confirm','POST',{rightsConfirmed:false,sources:data.candidates},cookie),env);assert.equal(r.status,400);
 r=await worker.fetch(request('/api/admin/import/confirm','POST',{rightsConfirmed:true,sources:data.candidates},cookie),env);assert.equal(r.status,200);assert.equal((await r.json()).imported,1);
 assert.equal((await DB.prepare('SELECT * FROM video_sources').bind().all()).results[0].enabled,0);
});

test('scheduled probe stores statuses and never auto-enables a source',async()=>{
 const DB=fakeDB(),env={...envBase,DB};const cookie=await login(env);
 const create=await worker.fetch(request('/api/admin/import/confirm','POST',{rightsConfirmed:true,sources:[{name:'Documentary API',url:'https://docs.example.org/api.php/provide/vod'}]},cookie),env);
 assert.equal(create.status,200);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({list:[]}),{status:200});
 try{await worker.scheduled({cron:'15 */6 * * *'},env,{});}finally{globalThis.fetch=old}
 const rs=(await DB.prepare('SELECT last_status,enabled FROM video_sources').all()).results;
 assert.equal(rs[0].last_status,'healthy');assert.equal(rs[0].enabled,0);
});
test('collector inspection is authenticated and read-only, and finds equivalent existing JSON addresses',async()=>{
 const DB=fakeDB(),env={...envBase,DB},cookie=await login(env),original=globalThis.fetch;
 try{
  const addr='https://owned.example.org/api.php/provide/vod';
  globalThis.fetch=async()=>Response.json({list:[{vod_id:1,vod_name:'授权样片',vod_play_url:'正片$https://cdn.example.org/one.m3u8'}]});
  const created=await worker.fetch(request('/api/admin/sources','POST',{name:'已有源',url:addr,rightsConfirmed:true},cookie),env);const id=(await created.json()).id;
  const before=JSON.stringify((await DB.prepare('SELECT * FROM video_sources').all()).results);
  let r=await worker.fetch(request('/api/admin/sources/inspect','POST',{url:addr}),env);assert.equal(r.status,401);
  r=await worker.fetch(request('/api/admin/sources/inspect','POST',{url:addr},cookie,false),env);assert.equal(r.status,403);
  r=await worker.fetch(request('/api/admin/sources/inspect','POST',{url:addr+'/at/xml/'},cookie),env);assert.equal(r.status,200);const inspected=await r.json();assert.equal(inspected.existing.id,id);assert.equal(inspected.playback.verified,false);
  assert.equal(JSON.stringify((await DB.prepare('SELECT * FROM video_sources').all()).results),before);
 }finally{globalThis.fetch=original;DB.end()}
});
