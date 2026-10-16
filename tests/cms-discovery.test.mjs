import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverCMS} from '../src/cms-discovery.js';
import {discover} from '../src/discovery.js';
const source={id:'owned',name:'已授权片源',url:'https://owned.example.org/vod'};
const movie=(id,title,extra={})=>({vod_id:id,vod_name:title,vod_year:'2026',type_name:'剧情片',vod_pic:'https://posters.example.org/'+id+'.jpg',vod_time:'2026-10-15 12:00:00',...extra});

test('four category families retain real genres, regions and safe banners within the free subrequest budget',async()=>{
 const original=globalThis.fetch,requests=[];
 try{
  const names=['剧情片','动作片','喜剧片','爱情片','科幻片','恐怖片','国产剧','欧美剧','日本剧','韩国剧','大陆综艺','日韩综艺','国产动漫','日韩动漫'];
  globalThis.fetch=async input=>{const url=new URL(input);requests.push(url);return Response.json(url.searchParams.get('ac')==='list'?{class:names.map((type_name,i)=>({type_id:i+1,type_name})),list:[]}:{list:[movie(1,'动作电影',{vod_class:'动作,冒险',vod_area:'中国大陆',vod_pic_slide:'https://posters.example.org/banner.jpg'}),movie(2,'连载动漫',{type_name:'国产动漫',vod_class:'动画',vod_area:'中国大陆'}),movie(3,'音乐综艺',{type_name:'大陆综艺',vod_area:'中国大陆',vod_pic_slide:'https://localhost/private.jpg'})]})};
  const snapshot=await discoverCMS({VOD_SOURCES:JSON.stringify([source])},2026,'2026-10-16');
  assert.ok(requests.length<=12);const ids=requests.slice(1).map(u=>u.searchParams.get('t'));for(const id of ['7','11','13'])assert.ok(ids.includes(id));
  assert.equal(snapshot.movie[0].genres,'动作,冒险');assert.equal(snapshot.anime[0].area,'中国大陆');assert.equal(snapshot.variety[0].backdrop,'');
  const {normalizeDiscovery}=await import('../src/discovery.js');const result=normalizeDiscovery({...snapshot,year:2026});
  assert.deepEqual(result.results.map(x=>x.kind),['movie','variety','anime']);assert.equal(result.results[0].backdrop,'https://posters.example.org/banner.jpg');assert.equal(result.results[0].genres,'动作,冒险');assert.ok(result.results.every(x=>!x.playable));
 }finally{globalThis.fetch=original}
});

test('CMS discovery resolves real category IDs, filters years and upcoming entries, and preserves safe cover URLs',async()=>{
 const original=globalThis.fetch,requests=[];
 try{
  globalThis.fetch=async input=>{const u=new URL(input);requests.push(u);return Response.json(u.searchParams.get('ac')==='list'?{list:[],class:[{type_id:101,type_name:'剧情片'},{type_id:102,type_name:'动作片'},{type_id:201,type_name:'国产剧'}]}:{list:[movie(1,'今年新片'),movie(2,'去年电影',{vod_year:'2025'}),movie(3,'未来作品',{vod_pubdate:'2026-12-01'}),movie(4,'无效海报',{vod_pic:'https://localhost/image.jpg'}),movie(5,'预告',{type_name:'预告片'})]})};
  const result=await discoverCMS({VOD_SOURCES:JSON.stringify([source])},2026,'2026-10-16');
  assert.deepEqual(requests.slice(1).map(u=>u.searchParams.get('t')),['101','102','201']);assert.equal(result.movie.length,1);assert.equal(result.movie[0].title,'今年新片');assert.equal(result.movie[0].cover,'https://posters.example.org/1.jpg');
 }finally{globalThis.fetch=original}
});

test('CMS hot recommendations prioritize ongoing episodes and do not fabricate trend metrics',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({list:[movie(1,'最新完结',{type_name:'国产剧',vod_remarks:'全20集',vod_time:'2026-10-16 01:00:00'}),movie(2,'连载新剧',{type_name:'国产剧',vod_remarks:'更新至第06集',vod_time:'2026-10-15 01:00:00'})]});
  const result=await discoverCMS({VOD_SOURCES:JSON.stringify([source])},2026,'2026-10-16');assert.equal(result.tv[0].title,'最新完结');assert.equal(result.hot.tv[0].title,'连载新剧');assert.equal(result.hot.tv[0].trend_info,'连载更新');assert.equal(result.rankingBasis,'source-updates-and-ongoing-episodes');
 }finally{globalThis.fetch=original}
});

test('a rejected upstream annual index falls back to live authorized CMS data instead of a fixed snapshot',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async input=>new URL(input).hostname==='api.bilibili.com'?new Response('blocked',{status:412}):Response.json({list:[movie(1,'自动更新电影'),movie(2,'自动更新剧集',{type_name:'国产剧',vod_remarks:'更新至第08集'})]});
  const result=await discover({VOD_SOURCES:JSON.stringify([source])},'https://cinema.example.org',{now:Date.parse('2026-10-16T00:00:00Z')});
  assert.equal(result.stale,false);assert.equal(result.sourceKind,'cms');assert.equal(result.results.length,2);assert.ok(result.results.every(x=>x.year===2026&&!x.playable));assert.equal(result.results[0].id,'discover:movie:owned:1');assert.equal(result.results[0].image,'https://posters.example.org/1.jpg');
 }finally{globalThis.fetch=original}
});
