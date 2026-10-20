import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';
import {DEFAULT_FEEDS} from '../src/default-feeds.js';
import {fetchTVBoxJSON,validFeedURL,parseTVBox,sanitizeTVBoxJSON} from '../src/tvbox.js';
const origin='https://songbai.example.org';
const password='long-testing-password';
function dbMock(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../migrations/0001_sources.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0003_security_events.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0002_tvbox_feeds.sql',import.meta.url),'utf8'));
 return {prepare(sql){const run=(args,method)=>db.prepare(sql)[method](...args);return {
  all:async()=>({results:run([],'all')}),first:async()=>run([],'get')||null,run:async()=>run([],'run'),
  bind(...args){return {all:async()=>({results:run(args,'all')}),first:async()=>run(args,'get')||null,run:async()=>run(args,'run')}}
 }},close:()=>db.close()};
}
function request(path,method='GET',payload,cookie){return new Request(origin+path,{method,headers:{origin,...(cookie?{cookie}:{}),...(payload?{'content-type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined})}
function envWithDB(){return {DB:dbMock(),ADMIN_PASSWORD:password,ADMIN_SESSION_SECRET:'long-independent-signature-secret-at-least-32-chars',ASSETS:{fetch:()=>new Response('HTML')}}}
async function login(env){let r=await worker.fetch(request('/api/admin/login','POST',{password}),env);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}

test('migration registers all 10 exact provided URL records as pending, no active CMS',async()=>{
 const env=envWithDB();
 const rows=(await env.DB.prepare('SELECT id,name,url,last_status FROM tvbox_feeds ORDER BY rowid').all()).results;
 assert.equal(rows.length,10);assert.deepEqual(rows.map(r=>r.url),DEFAULT_FEEDS.map(r=>r.url));
 assert.ok(rows.every(r=>r.last_status==='pending'));
 const active=(await env.DB.prepare('SELECT * FROM video_sources WHERE enabled=1').all()).results;
 assert.equal(active.length,0);
 env.DB.close();
});

test('feed URL validator allows legacy HTTP and unicode host but rejects private endpoints',()=>{
 assert.equal(validFeedURL('http://肥猫.net'),true);
 assert.equal(validFeedURL('http://www.饭太硬.cc/tv'),true);
 assert.equal(validFeedURL('https://easyzz.dpdns.org/easytv.jpg'),true);
 for(const u of ['http://127.0.0.1:3000/','http://localhost/','https://10.0.0.1/','https://host.internal/config','https://user:pass@foo.com/config','ftp://foo.com/list'])assert.equal(validFeedURL(u),false,u);
});

test('backup migration updates nine original entries, resets diagnostics and preserves configured sources',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync(new URL('../migrations/0001_sources.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_tvbox_feeds.sql',import.meta.url),'utf8'));
  db.exec("UPDATE tvbox_feeds SET last_status='failed',last_error='old failure',last_candidate_count=0,last_checked_at='2020-01-01'");
  db.exec("UPDATE tvbox_feeds SET last_status='compatible',last_candidate_count=18 WHERE id='hajimi'");
  db.exec("INSERT INTO video_sources(id,name,url,enabled,rights_confirmed) VALUES('owned-source','Owned','https://owned.example.org/vod',1,1)");
  const before=db.prepare('SELECT * FROM video_sources').all(),kept=db.prepare("SELECT * FROM tvbox_feeds WHERE id='hajimi'").get();
  const migration=readFileSync(new URL('../migrations/0005_tvbox_backups.sql',import.meta.url),'utf8');db.exec(migration);
  const rows=db.prepare('SELECT * FROM tvbox_feeds').all(),changed=rows.filter(x=>x.id!=='hajimi');
  assert.equal(rows.length,10);assert.equal(changed.length,9);
  assert.ok(changed.every(x=>x.url.startsWith('https:')&&validFeedURL(x.url)&&x.last_status==='pending'&&x.last_error===null&&x.last_checked_at===null&&x.last_candidate_count===null));
  assert.equal(changed.filter(x=>x.url.includes('cdn.jsdelivr.net')).length,3);
  assert.deepEqual(db.prepare("SELECT * FROM tvbox_feeds WHERE id='hajimi'").get(),kept);
  assert.deepEqual(db.prepare('SELECT * FROM video_sources').all(),before);
  db.exec(migration);assert.deepEqual(db.prepare('SELECT * FROM tvbox_feeds').all(),rows);
 }finally{db.close()}
});

test('backup migration preserves administrator-edited URLs and skips an already registered replacement',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync(new URL('../migrations/0002_tvbox_feeds.sql',import.meta.url),'utf8'));
  db.exec("UPDATE tvbox_feeds SET url='https://owned.example.org/custom.json',last_status='compatible',last_candidate_count=2 WHERE id='sun'");
  db.exec("INSERT INTO tvbox_feeds(id,name,url) VALUES('existing-qist','Existing','https://raw.githubusercontent.com/qist/tvbox/master/jsm.json')");
  const custom=db.prepare("SELECT * FROM tvbox_feeds WHERE id='sun'").get(),duplicate=db.prepare("SELECT * FROM tvbox_feeds WHERE id='easydc'").get();
  db.exec(readFileSync(new URL('../migrations/0005_tvbox_backups.sql',import.meta.url),'utf8'));
  assert.deepEqual(db.prepare("SELECT * FROM tvbox_feeds WHERE id='sun'").get(),custom);
  assert.deepEqual(db.prepare("SELECT * FROM tvbox_feeds WHERE id='easydc'").get(),duplicate);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tvbox_feeds').get().count,11);
 }finally{db.close()}
});

test('JSON comments and trailing commas parsed safely, Spider excluded',()=>{
 const s=`{
 // comment
 "sites": [
  {"name":"Licensed", "type":1,"api":"https://media.example.org/api.php/provide/vod",},
  {"name":"Spider", "type":3,"api":"csp_abc",},
 ],
}`;
 const fixed=sanitizeTVBoxJSON(s);assert.equal(JSON.parse(fixed).sites.length,2);
 const result=parseTVBox(s);
 assert.equal(result.candidates.length,1);assert.equal(result.skipped.spider,1);
});

test('misleading image extension is decoded by returned content, real image rejected',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response('{"sites":[{"name":"OK","type":1,"api":"https://media.example.org/api.php/provide/vod"}]}',{headers:{'content-type':'image/jpeg'}});
  let result=await fetchTVBoxJSON('https://example.org/file.jpg');assert.equal(result.candidates.length,1);
  globalThis.fetch=async()=>new Response(Uint8Array.from([0xff,0xd8,0xff,0xe0,4,5,6,7]),{headers:{'content-type':'image/jpeg'}});
  await assert.rejects(fetchTVBoxJSON('https://example.org/file.jpg'),/真实图片/);
 }finally{globalThis.fetch=old}
});

test('an HTML navigation homepage and unsupported multiwarehouse cannot become CMS sources',()=>{
 assert.throws(()=>parseTVBox('<!doctype html><html>hello</html>'),/网页/);
 assert.throws(()=>parseTVBox({urls:[{name:'a',url:'https://example.com/config.json'}]}),/多仓/);
});

test('admin can preview a seeded feed, persist status, but no source is imported without confirmation',async()=>{
 const env=envWithDB(),cookie=await login(env),saved=globalThis.fetch;
 try{
  let response=await worker.fetch(request('/api/admin/feeds'),env);
  assert.equal(response.status,401);
  response=await worker.fetch(request('/api/admin/feeds','GET',null,cookie),env);
  let data=await response.json();assert.equal(data.feeds.length,10);
  const id='easydc';
  globalThis.fetch=async()=>new Response(JSON.stringify({sites:[
   {name:'Public CMS',type:1,searchable:1,api:'https://media.example.org/api.php/provide/vod'},
   {name:'Spider',type:3,api:'csp_test'}
  ]}),{status:200});
  response=await worker.fetch(request('/api/admin/feeds/'+id+'/preview','POST',{},cookie),env);
  assert.equal(response.status,200);
  data=await response.json();assert.equal(data.candidates.length,1);assert.equal(data.status,'compatible');
  let feeds=(await env.DB.prepare('SELECT last_status,last_candidate_count FROM tvbox_feeds WHERE id=?').bind(id).first());
  assert.equal(feeds.last_candidate_count,1);assert.equal(feeds.last_status,'compatible');
  assert.equal((await env.DB.prepare('SELECT * FROM video_sources').all()).results.length,0);
  response=await worker.fetch(request('/api/admin/import/confirm','POST',{rightsConfirmed:true,sources:data.candidates},cookie),env);
  assert.equal(response.status,200);
  const row=(await env.DB.prepare('SELECT enabled,rights_confirmed FROM video_sources').all()).results[0];
  assert.equal(row.enabled,0);assert.equal(row.rights_confirmed,1);
 }finally{globalThis.fetch=saved;env.DB.close()}
});

test('unsupported Spider-only content and network errors are recorded without affecting active sources',async()=>{
 const env=envWithDB(),cookie=await login(env),saved=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({sites:[{name:'nope',type:3,api:'csp_test'}]}));
  let resp=await worker.fetch(request('/api/admin/feeds/xc/preview','POST',{},cookie),env);
  assert.equal((await resp.json()).status,'unsupported');
  globalThis.fetch=async()=>{throw Error('connection timed out')};
  resp=await worker.fetch(request('/api/admin/feeds/aowu/preview','POST',{},cookie),env);
  let result=await resp.json();assert.equal(result.status,'failed');assert.match(result.error,/timed out/);
  assert.equal((await env.DB.prepare('SELECT * FROM video_sources').all()).results.length,0);
 }finally{globalThis.fetch=saved;env.DB.close()}
});
