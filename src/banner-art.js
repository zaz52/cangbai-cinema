import {cleanText} from './providers.js';
import {readText} from './http.js';
export const BANNER_PAGE='https://fdzys.com/';
const decode=value=>String(value||'').replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|\d+);/gi,entity=>({ '&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>' }[entity.toLowerCase()]||String.fromCodePoint(Math.min(0x10ffff,parseInt(entity.slice(2,-1).replace(/^x/i,''),/^&#x/i.test(entity)?16:10)))));
const titleKey=(value,year)=>cleanText(value,100).normalize('NFKC').toLowerCase().replace(new RegExp('(?:[（(]?'+year+'[）)]?)$'),'').replace(/[\s\p{P}]/gu,'');
export function parseBannerPage(html){
 const rows=[],seen=new Set();
 for(const match of String(html).matchAll(/<a\b[^>]*>/gi)){
  const attrs=Object.fromEntries([...match[0].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map(x=>[x[1].toLowerCase(),decode(x[3])]));
  if(!String(attrs.class).split(/\s+/).includes('swiper-lazy'))continue;
  const title=cleanText(attrs.title,100);let image,page;
  try{image=new URL(attrs['data-slide-bg'],BANNER_PAGE);page=new URL(attrs.href,BANNER_PAGE)}catch{continue}
  if(!title||image.origin!==BANNER_PAGE.slice(0,-1)||page.origin!==image.origin||!/^\/static\/images\/[\w/.-]+\.(?:jpg|jpeg|png|webp)$/i.test(image.pathname)||!/^\/(tv|movie)\/[\w-]+$/.test(page.pathname)||seen.has(title))continue;
  seen.add(title);rows.push({title,kind:page.pathname.startsWith('/tv/')?'tv':'movie',image:image.href,sourceImage:image.href,sourceUrl:page.href});if(rows.length>=6)break;
 }
 return rows;
}
export function matchBannerArt(items,art,year){
 return items.map(item=>{
  const match=(Array.isArray(art)?art:[]).find(row=>row.kind===item.kind&&Number(item.year)===Number(year)&&titleKey(row.title,year)===titleKey(item.title,year));
  if(!match)return item;
  let url;try{url=new URL(match.image,'https://cinema.example.org')}catch{return item}
  const local=/^\/assets\/banners\/[a-f0-9]{16}\.(?:jpg|jpeg|png|webp)$/.test(match.image||'');
  const remote=url.origin===BANNER_PAGE.slice(0,-1)&&/^\/static\/images\/[\w/.-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname);
  if(!local&&!remote)return item;
  return {...item,backdrop:match.image,backdropSourceUrl:String(match.sourceUrl||''),backdropWidth:Number(match.width)||null,backdropHeight:Number(match.height)||null};
 });
}
export async function loadBannerArt(env,origin,previous=[]){
 let packaged=[];
 try{const r=await env.ASSETS?.fetch(new Request(new URL('/data/banners.json',origin)));if(r?.ok){const data=JSON.parse(await readText(r,30000));if(Array.isArray(data.items))packaged=data.items}}catch{}
 try{
  const response=await fetch(BANNER_PAGE,{headers:{accept:'text/html','user-agent':'Mozilla/5.0'},redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(!response.ok){await response.body?.cancel();throw Error('Banner metadata HTTP '+response.status)}
  const live=parseBannerPage(await readText(response,900000));
  if(live.length)return {items:live.map(row=>packaged.find(x=>x.sourceImage===row.sourceImage&&x.title===row.title)||row),mode:'live'};
 }catch{}
 return {items:[...packaged,...(Array.isArray(previous)?previous:[])].slice(0,18),mode:'backup'};
}
