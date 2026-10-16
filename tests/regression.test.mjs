import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../src/index.js';
import {groupResults,aggregateDetail,archiveLicenseAllowed} from '../src/providers.js';
import {readText} from '../src/http.js';
const origin='https://cinema.example.org';
function setup(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../migrations/',import.meta.url)).sort())sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(sql){function bound(args=[]){return {first:async()=>sqlite.prepare(sql).get(...args)||null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>sqlite.prepare(sql).run(...args),bind:(...values)=>bound(values)}}return bound()}};
 return {DB,ADMIN_PASSWORD:'test-only-password-long',ADMIN_SESSION_SECRET:'test-only-independent-signature-secret-long'};
}
const request=(path,method='GET',body,cookie)=>new Request(origin+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
async function login(env){const r=await worker.fetch(request('/api/admin/login','POST',{password:env.ADMIN_PASSWORD}),env);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
test('logout revokes copied cookies and password rotation invalidates sessions',async()=>{
 const env=setup(),first=await login(env),second=await login(env);assert.notEqual(first,second);
 assert.equal((await worker.fetch(request('/api/admin/logout','POST',{},first),env)).status,200);
 assert.equal((await worker.fetch(request('/api/admin/sources','GET',null,first),env)).status,401);
 assert.equal((await worker.fetch(request('/api/admin/sources','GET',null,second),env)).status,200);
 env.ADMIN_PASSWORD='another-test-password-long';
 assert.equal((await worker.fetch(request('/api/admin/sources','GET',null,second),env)).status,401);
});
test('login attempts are limited across requests in D1',async()=>{
 const env=setup();
 for(let i=0;i<10;i++)assert.equal((await worker.fetch(request('/api/admin/login','POST',{password:'wrong'}),env)).status,401);
 const result=await worker.fetch(request('/api/admin/login','POST',{password:env.ADMIN_PASSWORD}),env);
 assert.equal(result.status,429);assert.equal(result.headers.get('retry-after'),'900');
});
test('untested source cannot be enabled; URL edit disables and resets health; logs persist',async()=>{
 const env=setup(),cookie=await login(env);
 let r=await worker.fetch(request('/api/admin/import/confirm','POST',{rightsConfirmed:true,sources:[{name:'Owned',url:'https://owned.example.org/api.php/provide/vod'}]},cookie),env);
 const id=(await r.json()).results[0].id;
 assert.equal((await worker.fetch(request('/api/admin/sources/'+id,'PATCH',{enabled:true},cookie),env)).status,400);
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"list":[]}');
 try{assert.equal((await worker.fetch(request('/api/admin/sources/'+id+'/test','POST',{},cookie),env)).status,200)}finally{globalThis.fetch=original}
 assert.equal((await worker.fetch(request('/api/admin/sources/'+id,'PATCH',{enabled:true},cookie),env)).status,200);
 assert.equal((await worker.fetch(request('/api/admin/sources/'+id,'PATCH',{url:'https://other.example.org/api.php/provide/vod'},cookie),env)).status,200);
 const source=await env.DB.prepare('SELECT * FROM video_sources WHERE id=?').bind(id).first();
 assert.equal(source.enabled,0);assert.equal(source.last_status,'untested');assert.equal(source.last_checked_at,null);
 const logs=await worker.fetch(request('/api/admin/logs','GET',null,cookie),env);assert.equal((await logs.json()).logs.length,1);
});
test('health fails closed with missing migrations and succeeds with complete schema',async()=>{
 assert.equal((await worker.fetch(request('/api/health'),{})).status,503);
 const r=await worker.fetch(request('/api/health'),setup());assert.equal(r.status,200);assert.equal((await r.json()).databaseReady,true);
});
test('stream limits apply to actual UTF-8 bytes',async()=>{
 const response=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('你好世界'));controller.close()}}));
 await assert.rejects(readText(response,8),/过大/);
});
test('different TV seasons remain separate',()=>{
 const result=groupResults([{id:'a',title:'故事第一季',year:2026},{id:'b',title:'故事第二季',year:2026}]);assert.equal(result.length,2);
});
test('CMS bulk requests enforce a bound within the Free D1 query limit',async()=>{
 const env=setup(),cookie=await login(env);
 const result=await worker.fetch(request('/api/admin/import/confirm','POST',{rightsConfirmed:true,sources:Array.from({length:21},(_,i)=>({name:'owned '+i,url:`https://owned-${i}.example.org/api.php/provide/vod`}))},cookie),env);
 assert.equal(result.status,400);
 assert.equal((await env.DB.prepare('SELECT * FROM video_sources').all()).results.length,0);
});
test('archive playback requires recognized license metadata',()=>{
 assert.equal(archiveLicenseAllowed({}),false);
 assert.equal(archiveLicenseAllowed({licenseurl:'public domain'}),false);
 assert.equal(archiveLicenseAllowed({licenseurl:'https://creativecommons.org/publicdomain/mark/1.0/'}),true);
 assert.equal(archiveLicenseAllowed({licenseurl:'https://creativecommons.org/licenses/by/4.0/'}),true);
 assert.equal(archiveLicenseAllowed({licenseurl:'http://creativecommons.org/licenses/publicdomain/'}),true);
 assert.equal(archiveLicenseAllowed({licenseurl:'https://creativecommons.org.evil.org/licenses/by/4.0/'}),false);
});
test('CMS requests use the redirect mode supported by workerd and reject redirects',async()=>{
 const {probeSource}=await import('../src/admin-api.js');
 const old=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://other.example.org'}})};
 try{const result=await probeSource({url:'https://owned.example.org/api.php/provide/vod'});assert.equal(result.ok,false);assert.match(result.error,/302/)}finally{globalThis.fetch=old}
});
test('detail aggregation rejects unrelated titles and deduplicates media addresses',async()=>{
 const old=globalThis.fetch;
 const providers=[{id:'one',name:'one',url:'https://one.example.org/api.php/provide/vod'},{id:'two',name:'two',url:'https://two.example.org/api.php/provide/vod'}];
 globalThis.fetch=async url=>Response.json({list:[{vod_id:1,vod_name:new URL(url).hostname.startsWith('one')?'故事第一季':'故事第二季',vod_year:'2026',vod_play_url:'第01集$https://cdn.example.org/a.mp4'}]});
 try{const data=await aggregateDetail(['cms:one:1','cms:two:1'],{VOD_SOURCES:JSON.stringify(providers)});assert.equal(data.sourceCount,1);assert.equal(data.videos.length,1)}finally{globalThis.fetch=old}
});
