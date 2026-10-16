import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {providersFromEnv,parseCmsPlay,episodeKey,groupResults,mapDirectory,cmsSearchUrl,aggregateSearch,aggregateDetail} from '../src/providers.js';
const config=[{id:'studio-one',name:'合法片库 A',url:'https://media-one.example/api.php/provide/vod'},{id:'studio-two',name:'合法片库 B',url:'https://media-two.example/api.php/provide/vod'}];
const env={VOD_SOURCES:JSON.stringify(config)};
const res=(v)=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
test('provider config is fixed, no dynamic arbitrary URL input',()=>{
 const p=providersFromEnv({VOD_SOURCES:JSON.stringify([...config,{id:'private',name:'Blocked',url:'http://127.0.0.1/private'},{id:'bad',name:'Blocked',url:'http://example.com/api'}])});
 assert.equal(p.length,2);assert.ok(cmsSearchUrl(p[0],'你好',1).href.includes('wd=%E4%BD%A0%E5%A5%BD'));
});
test('CMS parser creates playable episodes and drops web pages',()=>{
 const files=parseCmsPlay({vod_play_from:'HLS$$$MP4',vod_play_url:'第01集$https://cdn.example/01.m3u8#第02集$https://cdn.example/02.m3u8$$$正片$https://cdn.example/movie.mp4#广告$javascript:alert(1)#网站$https://cdn.example/detail.html'},config[0]);
 assert.equal(files.length,3);assert.equal(files[0].episodeKey,'ep-1');assert.equal(files[1].episodeKey,'ep-2');assert.equal(files[2].episodeKey,'movie');assert.equal(episodeKey('第02集'),'ep-2');
});
test('same film is grouped; conflicting release years remain separate',()=>{
 const g=groupResults([{id:'a',title:'示例电影',year:2020,source:'甲'},{id:'b',title:'示例电影',year:null,source:'乙'},{id:'c',title:'示例电影',year:2022,source:'丙'}]);
 assert.equal(g.length,2);assert.equal(g[0].sourceCount,2);assert.equal(g[1].sourceCount,1);
});
test('movie quality labels share fallback candidates while numbered episodes and split parts stay distinct',()=>{
 for(const label of ['HD中字','HD国语','BD中英双字','1080P','蓝光高清','正片'])assert.equal(episodeKey(label),'movie',label);
 assert.equal(episodeKey('第02集'),'ep-2');assert.notEqual(episodeKey('HD中字上'),episodeKey('HD中字下'));
 const a=parseCmsPlay({vod_play_url:'HD中字$https://cdn.example.org/one.m3u8'},config[0]);
 const b=parseCmsPlay({vod_play_url:'正片$https://cdn.example.org/two.mp4#第02集$https://cdn.example.org/other.mp4'},config[1]);
 assert.equal(a[0].episodeKey,b[0].episodeKey);assert.notEqual(a[0].episodeKey,b[1].episodeKey);
});
test('awesome directory is a curated web catalog, not falsely playable data',()=>{
 const d={resources:[{id:'a',name:'测试站点',url:'https://movies.example',category:'online_video',summary:'电影电视剧',verification:{status:'verified',last_checked:'2026-10-10'},scores:{more:4},risks:{copyright:'unknown'}},{id:'b',name:'已下架',url:'https://dead.example',category:'online_video',verification:{status:'removed'}}]};
 const x=mapDirectory(d,'测试','online_video');assert.equal(x.length,1);assert.equal(x[0].playable,false);assert.equal(x[0].searchable,false);
});
test('failing source does not break simultaneous source search',async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async url=>{const u=new URL(String(url));if(u.hostname==='archive.org')return res({response:{numFound:0,docs:[]}});if(u.hostname==='media-one.example')return res({list:[{vod_id:1,vod_name:'示例电影',vod_year:'2020'}]});return new Response('fail',{status:502})};
 try{const out=await aggregateSearch('示例电影',1,env);assert.equal(out.results.length,1);assert.equal(out.sourceStatus.length,2);assert.equal(out.sourceStatus.find(x=>x.name==='合法片库 B').ok,false);assert.equal(out.results[0].sourceCount,1)}finally{globalThis.fetch=old}
});
test('multiple APIs supply switchable candidate streams for the same episode',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async url=>{const u=new URL(String(url));if(u.hostname==='media-one.example')return res({list:[{vod_id:1,vod_name:'示例电影',vod_play_from:'线路 1',vod_play_url:'第01集$https://cdn-one.example/1.m3u8'}]});if(u.hostname==='media-two.example')return res({list:[{vod_id:2,vod_name:'示例电影',vod_play_from:'线路 2',vod_play_url:'第01集$https://cdn-two.example/1.mp4'}]});throw Error('unexpected')};
 try{const result=await aggregateDetail(['cms:studio-one:1','cms:studio-two:2'],env);assert.equal(result.videos.length,2);assert.equal(result.videos[0].episodeKey,result.videos[1].episodeKey);assert.equal(result.sourceCount,2);}finally{globalThis.fetch=old}
});
test('catalog endpoint uses repo JSON and discloses directory-only purpose',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async url=>{assert.match(String(url),/laoma528\/awesome-zhuiju-free/);return res({updated_at:'2026-10-12',resources:[{id:'one',name:'测试站点',category:'online_video',url:'https://movies.example',summary:'站点导航',verification:{status:'verified'},risks:{copyright:'unknown'},scores:{more:3}}]})};
 try{let r=await worker.fetch(new Request('https://songbai.example/api/catalog?q='),{ASSETS:{fetch:()=>new Response('OK')}});assert.equal(r.status,200);let v=await r.json();assert.equal(v.results[0].playable,false);assert.match(v.note,/目录仅表示/)}finally{globalThis.fetch=old}
});
