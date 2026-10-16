import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTVBox,parseTVBox,probeSource} from '../src/tvbox.js';
const site=(api,name='API')=>({name,type:1,searchable:1,api});

test('HTTP CMS remains pending until the exact HTTPS search URL passes; query selectors survive',async()=>{
 const data={sites:[site('http://owned.example.org/api/provide/vod?source=123')]};
 const parsed=parseTVBox(data);assert.equal(parsed.candidates.length,0);assert.equal(parsed.pendingHTTPS.length,1);
 const saved=globalThis.fetch,requests=[];
 try{
  globalThis.fetch=async(input,init)=>{const u=new URL(input);requests.push(u);assert.equal(init.redirect,'manual');return Response.json({list:[{vod_id:1,vod_name:'测试作品'}]})};
  const result=await resolveTVBox(data);
  assert.equal(requests.length,1);assert.equal(requests[0].protocol,'https:');assert.equal(requests[0].searchParams.get('source'),'123');assert.equal(requests[0].searchParams.get('wd'),'测试');
  assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].url,'https://owned.example.org/api/provide/vod?source=123');assert.equal(result.candidates[0].transportUpgraded,true);
  assert.equal(result.checks[0].scope,'search-json');assert.equal(result.candidates[0].playable,undefined);assert.equal(result.pendingHTTPS,undefined);
 }finally{globalThis.fetch=saved}
});

test('XML, no-search text, upstream errors and redirects each produce specific failed diagnostics',async()=>{
 const saved=globalThis.fetch;
 const responses=[()=>new Response('<?xml version="1.0"?><rss/>'),()=>new Response('暂不支持搜索'),()=>Response.json({code:0,msg:'采集站直连失败: HTTP 403'}),()=>new Response('',{status:302,headers:{location:'http://localhost/'}})];
 try{
  globalThis.fetch=async input=>responses[Number(new URL(input).searchParams.get('source'))]();
  const result=await resolveTVBox({sites:responses.map((_,i)=>site('http://owned.example.org/vod?source='+i,'源'+i))});
  assert.equal(result.candidates.length,0);assert.equal(result.skipped.incompatible,4);
  for(const [i,pattern] of [/XML/,/暂不支持搜索/,/403/,/302/].entries())assert.match(result.checks[i].error,pattern);
 }finally{globalThis.fetch=saved}
});

test('unsafe HTTP candidates cannot trigger requests; upgrades are deduplicated and capped at 16',async()=>{
 const saved=globalThis.fetch;let active=0,max=0,count=0;
 try{
  globalThis.fetch=async input=>{assert.equal(new URL(input).hostname,'owned.example.org');active++;max=Math.max(max,active);count++;await new Promise(resolve=>setTimeout(resolve,5));active--;return Response.json({list:[]})};
  const sites=[site('http://localhost/vod'),site('http://127.0.0.1/vod'),site('http://owned.example.org:8080/vod'),...Array.from({length:20},(_,i)=>site('http://owned.example.org/vod?source='+i)),site('http://owned.example.org/vod?source=0')];
  const result=await resolveTVBox({sites});
  assert.equal(count,16);assert.ok(max<=3);assert.equal(result.candidates.length,16);assert.equal(result.skipped.invalid,3);assert.equal(result.skipped.limit,4);assert.equal(result.skipped.duplicate,1);
 }finally{globalThis.fetch=saved}
});

test('health checks reject arrays whose entries cannot be used for CMS title search',async()=>{
 const saved=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({list:[{title:'unrelated'}]});const result=await probeSource({url:'https://owned.example.org/vod'});assert.equal(result.ok,false);assert.match(result.error,/vod_id/)}finally{globalThis.fetch=saved}
});
