import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {aggregateSearch} from '../src/providers.js';

test('public search uses configured CMS sources and makes no archive requests',async()=>{
 const saved=globalThis.fetch,requests=[];
 try{
  globalThis.fetch=async input=>{const u=new URL(input);requests.push(u.hostname);assert.equal(u.hostname,'owned.example.org');return Response.json({list:[{vod_id:1,vod_name:'热门影片'}]})};
  const result=await aggregateSearch('热门影片',1,{VOD_SOURCES:JSON.stringify([{id:'owned',name:'我的片源',url:'https://owned.example.org/vod'}])});
  assert.deepEqual(requests,['owned.example.org']);assert.equal(result.results.length,1);assert.equal(result.sourceStatus.length,1);
  requests.length=0;const empty=await aggregateSearch('nature',1,{});assert.equal(empty.results.length,0);assert.deepEqual(requests,[]);
 }finally{globalThis.fetch=saved}
});

test('public providers and old detail IDs cannot expose retired archive movies',async()=>{
 const saved=globalThis.fetch;let requests=0;
 try{
  globalThis.fetch=async()=>{requests++;throw Error('Unexpected network access')};
  const providers=await (await worker.fetch(new Request('https://cinema.example.org/api/providers'),{})).json();assert.deepEqual(providers.connected,[]);
  const response=await worker.fetch(new Request('https://cinema.example.org/api/detail?id=old-archive-film'),{});
  assert.equal(response.status,502);assert.match((await response.json()).detail,/旧馆藏条目已下线/);assert.equal(requests,0);
 }finally{globalThis.fetch=saved}
});
