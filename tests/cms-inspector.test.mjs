import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCMSAddress,cmsIdentity,inspectCMS} from '../src/cms-inspector.js';

test('built-in licensed sample inspection resolves locally and retains unverified playback status',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw Error('Unexpected recursive same-zone fetch')};
  const result=await inspectCMS({url:'https://weiyi.indevs.in/api/open-demo/vod',query:'Big Buck Bunny'});
  assert.equal(result.search.ok,true);assert.equal(result.search.count,1);assert.equal(result.detail.ok,true);assert.ok(result.playback.directCandidates>0);assert.equal(result.playback.verified,false);
 }finally{globalThis.fetch=original}
});

test('collector normalization upgrades HTTP/XML while preserving provider selectors',()=>{
 const result=normalizeCMSAddress('http://api.example.org/api.php/provide/vod/from/ffm3u8/at/xml/?source=7&ac=detail&ids=1&wd=old#fragment');
 assert.equal(result.url,'https://api.example.org/api.php/provide/vod/from/ffm3u8/at/json/?source=7');assert.deepEqual(result.changes,['HTTP → HTTPS','XML → JSON']);
 assert.equal(cmsIdentity('https://api.example.org/vod/at/json/?source=7'),cmsIdentity('https://api.example.org/vod?source=7'));
 assert.notEqual(cmsIdentity('https://api.example.org/vod?source=7'),cmsIdentity('https://api.example.org/vod?source=8'));
});
test('collector normalization rejects private endpoints, embedded credentials and webpage parsers',()=>{
 for(const url of ['http://127.0.0.1/vod','https://localhost/vod','https://u:p@api.example.org/vod','https://api.example.org:8443/vod','https://www.example.org/player/?url=https://media.example.org/a.mp4'])assert.throws(()=>normalizeCMSAddress(url));
});
test('collector inspection separates compatible search and standard URL structure from real playback',async()=>{
 const original=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(input,options)=>{const u=new URL(input);calls.push(u);assert.equal(options.redirect,'manual');return Response.json({list:[{vod_id:1,vod_name:'测试影片',vod_play_from:'web$$$hls',vod_play_url:'正片$https://cdn.example.org/share/1$$$HD中字$https://cdn.example.org/one.m3u8'}]})};
  const result=await inspectCMS({name:'我的接口',url:'http://api.example.org/vod/at/xml/',query:'测试影片'});
  assert.equal(result.compatible,true);assert.equal(result.search.ok,true);assert.equal(result.detail.ok,true);assert.equal(result.playback.directCandidates,1);assert.equal(result.playback.otherCandidates,1);assert.equal(result.playback.verified,false);assert.deepEqual(result.playback.formats,['HLS']);assert.equal(calls.length,2);
 }finally{globalThis.fetch=original}
});
test('redirects and malformed responses remain failed previews; empty results do not claim a checked detail',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'http://localhost/'}});let result=await inspectCMS({url:'https://api.example.org/vod'});assert.equal(result.compatible,false);assert.match(result.search.error,/302/);
  globalThis.fetch=async()=>new Response('<?xml version="1.0"?><rss/>');result=await inspectCMS({url:'https://api.example.org/vod'});assert.equal(result.compatible,false);assert.match(result.search.error,/XML/);
  globalThis.fetch=async()=>Response.json({list:[]});result=await inspectCMS({url:'https://api.example.org/vod'});assert.equal(result.compatible,true);assert.equal(result.detail.checked,false);assert.equal(result.playback.verified,false);
 }finally{globalThis.fetch=original}
});
