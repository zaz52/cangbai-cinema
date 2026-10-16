import test from 'node:test';
import assert from 'node:assert/strict';
import {demoCMS,OPEN_DEMO} from '../src/open-demo.js';
import {parseCmsPlay,searchCMS} from '../src/providers.js';
test('open demo provides searchable attributed content and two same-film format candidates',()=>{
 assert.equal(demoCMS(new URL('https://cinema.example.org/api/open-demo/vod?wd=大雄兔')).total,1);
 assert.equal(demoCMS(new URL('https://cinema.example.org/api/open-demo/vod?wd=unmatched')).total,0);
 assert.equal(demoCMS(new URL('https://cinema.example.org/api/open-demo/vod?ids=unknown')).total,0);
 assert.match(OPEN_DEMO.vod_creator,/Blender Foundation/);assert.match(OPEN_DEMO.vod_license,/creativecommons.org\/licenses\/by\/3.0/);
 const files=parseCmsPlay(OPEN_DEMO,{id:'open-demo',name:'Open Demo'});assert.equal(files.length,2);assert.equal(files[0].episodeKey,files[1].episodeKey);
});
test('built-in source resolves locally without a recursive same-zone Worker fetch',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('unexpected recursive request')};
 try{const result=await searchCMS({id:'demo',name:'demo',url:'https://weiyi.indevs.in/api/open-demo/vod'},'大雄兔',1);assert.equal(result.results.length,1)}finally{globalThis.fetch=old}
});
