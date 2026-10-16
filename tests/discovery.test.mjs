import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDiscovery,discover,discoveryCalendar,discoveryIndexURL} from '../src/discovery.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
const entry=(id,title)=>({id,title,year:2026,rate:'8.6',cover:`https://i0.hdslb.com/view/photo/s_ratio_poster/public/p${id}.jpg`,playable:true});
const now=Date.parse('2026-10-16T00:00:00Z');
test('popular metadata interleaves films and shows, validates posters and omits upstream playback flags',()=>{
 const result=normalizeDiscovery({updatedAt:'2026-10-16',movie:[entry('123','电影'),entry('123','重复'),{...entry('4','非法海报'),cover:'http://127.0.0.1/private'}],tv:[entry('456','剧集')]});
 assert.equal(result.results.length,2);assert.deepEqual(result.results.map(x=>x.kind),['movie','tv']);
 assert.equal(result.results[0].rating,8.6);assert.equal(result.results[0].discovery,true);assert.equal(result.results[0].playable,undefined);
 assert.equal(result.results[0].sourceCount,0);
});
test('discovery falls back to the packaged snapshot when public metadata requests fail',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('unavailable',{status:503});
 const snapshot={year:2026,updatedAt:'2026-10-16T00:00:00Z',movie:[entry('123','快照电影')],tv:[entry('456','快照剧集')]};
 try{const result=await discover({ASSETS:{fetch:async()=>Response.json(snapshot)}},'https://cinema.example.org',{now});assert.equal(result.results.length,2);assert.equal(result.stale,true);assert.equal(result.updatedAt,snapshot.updatedAt)}finally{globalThis.fetch=original}
});
test('discovery endpoint loads public metadata without a D1 or admin secret',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'manual');const type=(new URL(url).searchParams.get('season_type')==='2'?'movie':'tv');return Response.json({code:0,data:{list:[{season_id:type==='movie'?123:456,title:type==='movie'?'热门电影':'热播剧集',cover:'https://i0.hdslb.com/bfs/bangumi/example.jpg',score:'8.6'}]}})};
 try{const response=await worker.fetch(new Request('https://cinema.example.org/api/discover'),{});assert.equal(response.status,200);assert.equal((await response.json()).results.length,2)}finally{globalThis.fetch=original}
});

test('annual calendar rolls over at midnight Shanghai and uses the upstream release-date filter',()=>{
 assert.equal(discoveryCalendar(Date.parse('2026-12-31T15:59:59Z')).year,2026);
 assert.deepEqual(discoveryCalendar(Date.parse('2026-12-31T16:00:00Z')),{year:2027,today:'2027-01-01'});
 const url=discoveryIndexURL('movie',2027);assert.equal(url.searchParams.get('release_date'),'[2027-01-01 00:00:00,2028-01-01 00:00:00)');assert.equal(url.searchParams.get('order'),'6');
 assert.equal(discoveryIndexURL('tv',2027,true).searchParams.get('order'),'3');
});

test('current-year lists exclude upcoming releases and mismatched years',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({code:0,data:{list:[
   {season_id:1,title:'已上映',cover:entry('1','').cover,index_show:'2026年10月1日上映'},
   {season_id:2,title:'未来影片',cover:entry('2','').cover,index_show:'2026年12月18日上映'},
   {season_id:3,title:'往年作品',cover:entry('3','').cover,index_show:'2025年10月1日上映'},
   {season_id:4,title:'待上映',cover:entry('4','').cover,order:'敬请期待'}
  ]}});
  const result=await discover({},'https://cinema.example.org',{now});
  assert.deepEqual(result.results.map(x=>x.title),['已上映','已上映']);assert.ok(result.results.every(x=>x.year===2026));assert.equal(result.hotResults.length,2);
 }finally{globalThis.fetch=original}
});

test('D1 snapshots survive requests, refresh after an hour, and provide the last successful catalog on outage',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0004_discovery_snapshots.sql',import.meta.url),'utf8'));
 const env={DB:{prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args),run:async()=>db.prepare(sql).run(...args)}}}}}};
 const original=globalThis.fetch;let requests=0,generation=1;
 try{
  globalThis.fetch=async()=>{requests++;return Response.json({code:0,data:{list:[{season_id:generation,title:'自动上新'+generation,cover:entry('1','').cover}]}})};
  const first=await discover(env,'https://cinema.example.org',{now});assert.equal(requests,4);assert.equal(first.results[0].title,'自动上新1');assert.equal(first.nextRefreshAt,new Date(now+3600000).toISOString());
  const cached=await discover(env,'https://cinema.example.org',{now:now+1800000});assert.equal(requests,4);assert.equal(cached.updatedAt,first.updatedAt);
  generation=2;const fresh=await discover(env,'https://cinema.example.org',{now:now+3660000});assert.equal(requests,8);assert.equal(fresh.results[0].title,'自动上新2');
  generation=3;const forced=await discover(env,'https://cinema.example.org',{now:now+3720000,force:true});assert.equal(requests,12);assert.equal(forced.results[0].title,'自动上新3');
  globalThis.fetch=async()=>{throw Error('upstream offline')};const stale=await discover(env,'https://cinema.example.org',{now:now+8000000});assert.equal(stale.stale,true);assert.equal(stale.results[0].title,'自动上新3');assert.equal(stale.updatedAt,forced.updatedAt);
 }finally{globalThis.fetch=original;db.close()}
});

test('old-year fallback data cannot be relabeled as a new-year release',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw Error('offline')};
  const result=await discover({ASSETS:{fetch:async()=>Response.json({year:2026,updatedAt:new Date(now).toISOString(),movie:[entry('1','旧年影片')]})}},'https://cinema.example.org',{now:Date.parse('2026-12-31T16:00:00Z')});
  assert.equal(result.year,2027);assert.equal(result.results.length,0);assert.equal(result.stale,true);assert.equal(result.updatedAt,null);
 }finally{globalThis.fetch=original}
});
test('hourly scheduled refresh updates the snapshot while source probes retain their six-hour interval',async()=>{
 const original=globalThis.fetch,sql=[];let upstreamCalls=0;
 const env={DB:{prepare(query){sql.push(query);return {bind(){return {first:async()=>null,run:async()=>({})}},all:async()=>({results:[]})}}}};
 try{
  globalThis.fetch=async()=>{upstreamCalls++;return Response.json({code:0,data:{list:[]}})};
  await worker.scheduled({scheduledTime:Date.parse('2026-10-16T01:15:00Z'),cron:'15 * * * *'},env);
  assert.equal(upstreamCalls,4);assert.ok(sql.some(x=>x.startsWith('INSERT INTO discovery_snapshots')));assert.ok(sql.every(x=>!/^UPDATE video_sources/.test(x)));
  sql.length=0;await worker.scheduled({scheduledTime:Date.parse('2026-10-16T06:15:00Z'),cron:'15 * * * *'},env);
  assert.ok(sql.some(x=>x.includes('video_sources')));
 }finally{globalThis.fetch=original}
});
