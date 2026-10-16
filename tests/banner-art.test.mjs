import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBannerPage,matchBannerArt,loadBannerArt} from '../src/banner-art.js';
import {imageDimensions} from '../scripts/refresh-banners.mjs';
const link=(title='美人余',image='/static/images/20261009/test.webp',href='/tv/meirenyu')=>`<a class="swiper-lazy" data-slide-bg="${image}" href="${href}" title="${title}"></a>`;

test('banner extraction keeps title-image associations and rejects third-party URLs and script attributes',()=>{
 const rows=parseBannerPage(link()+link()+link('危险','https://localhost/private.jpg')+link('其他','https://other.example.org/static/images/test.jpg')+link('跳转','/static/images/valid.jpg','javascript:alert(1)')+link('测试 &amp; 剧集'));
 assert.equal(rows.length,2);assert.equal(rows[0].title,'美人余');assert.equal(rows[0].image,'https://fdzys.com/static/images/20261009/test.webp');assert.equal(rows[1].title,'测试 & 剧集');
});

test('banner matching requires current year, same media kind and exact title with an optional current-year suffix',()=>{
 const art=[{title:'美人余',kind:'tv',image:'/assets/banners/0123456789abcdef.webp',sourceUrl:'https://fdzys.com/tv/meirenyu'}];
 const items=[{title:'美人余2026',kind:'tv',year:2026},{title:'美人余',kind:'movie',year:2026},{title:'美人余2',kind:'tv',year:2026},{title:'美人余',kind:'tv',year:2025}];
 const result=matchBannerArt(items,art,2026);assert.equal(result[0].backdrop,art[0].image);assert.ok(result.slice(1).every(x=>!x.backdrop));
 assert.ok(!matchBannerArt(items,[{...art[0],image:'https://localhost/banner.jpg'}],2026)[0].backdrop);
});

test('live banner refresh prefers an identical local backup and retains backup metadata on upstream failure',async()=>{
 const original=globalThis.fetch,rows=parseBannerPage(link()),backup={...rows[0],image:'/assets/banners/0123456789abcdef.webp',width:1800,height:750};
 const env={ASSETS:{fetch:async()=>Response.json({items:[backup]})}};
 try{
  globalThis.fetch=async()=>new Response(link());const live=await loadBannerArt(env,'https://cinema.example.org');assert.equal(live.mode,'live');assert.equal(live.items[0].image,backup.image);
  globalThis.fetch=async()=>new Response('unavailable',{status:503});const fallback=await loadBannerArt(env,'https://cinema.example.org');assert.equal(fallback.mode,'backup');assert.equal(fallback.items[0].image,backup.image);
 }finally{globalThis.fetch=original}
});

test('every shipped banner is an original landscape image whose measured dimensions match the manifest',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/data/banners.json',import.meta.url),'utf8'));
 assert.ok(manifest.items.length>=2);
 for(const row of manifest.items){const data=readFileSync(new URL('../public'+row.image,import.meta.url)),size=imageDimensions(data);assert.equal(size.width,row.width);assert.equal(size.height,row.height);assert.ok(size.width>=1280&&size.width/size.height>=1.5);assert.equal(data.length,row.bytes)}
});
