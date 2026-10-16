import {readText} from './http.js';
import {cleanText} from './providers.js';
import {discoverCMS} from './cms-discovery.js';
import {validSourceURL} from './tvbox.js';
const SOURCE_URL='https://www.bilibili.com/',REFRESH_MS=60*60*1000;
export function discoveryCalendar(now=Date.now()){
 const today=new Date(Number(now)+8*60*60*1000).toISOString().slice(0,10);
 return {year:Number(today.slice(0,4)),today};
}
export function discoveryIndexURL(kind,year,hot=false){
 const url=new URL('https://api.bilibili.com/pgc/season/index/result');
 for(const [key,value] of Object.entries({season_type:kind==='movie'?2:5,release_date:`[${year}-01-01 00:00:00,${year+1}-01-01 00:00:00)`,order:hot?(kind==='movie'?2:3):(kind==='movie'?6:0),sort:0,page:1,pagesize:24,type:1}))url.searchParams.set(key,String(value));
 return url;
}
function normalizeGroups(snapshot,hot=false){
 const groups={movie:[],tv:[]},year=Number(snapshot.year)||null;
 for(const kind of ['movie','tv']){
  const seen=new Set(),items=hot?snapshot.hot?.[kind]:snapshot[kind];
  for(const item of (Array.isArray(items)?items:[]).slice(0,48)){
   const id=String(item?.id||''),title=cleanText(item?.title,100);let image;
   try{image=new URL(item.cover)}catch{continue}
   const cms=/^[a-z0-9-]{2,48}$/.test(String(item.providerId||''));
   if(!/^\d{1,12}$/.test(id)||!title||seen.has((item.providerId||'')+id)||image.protocol!=='https:'||!(cms?validSourceURL(image.href):/^i\d+\.hdslb\.com$/.test(image.hostname))||image.username||image.password||image.port)continue;
   if(year&&Number(item.year)!==year)continue;
   seen.add((item.providerId||'')+id);const rate=Number.parseFloat(item.rate);
   if(!cms&&!image.pathname.includes('@'))image.pathname+='@400w_600h_1c.webp';
   groups[kind].push({id:`discover:${kind}:${cms?item.providerId+':':''}${id}`,title,image:image.href,kind,year,type:kind==='movie'?'年度新片':'年度新剧',rating:rate>0&&rate<=10?rate:null,episodesInfo:cleanText(item.episodes_info,50),releaseInfo:cleanText(item.release_info,60),trendInfo:cleanText(item.trend_info,50),source:cms?cleanText(item.providerName,60):'哔哩哔哩年度影视资料',sourceUrl:cms?'':SOURCE_URL+'bangumi/play/ss'+id,discovery:true,sourceCount:0});
   if(groups[kind].length>=12)break;
  }
 }
 const results=[];
 for(let i=0;i<Math.max(groups.movie.length,groups.tv.length);i++){if(groups.movie[i])results.push(groups.movie[i]);if(groups.tv[i])results.push(groups.tv[i])}
 return results;
}
export function normalizeDiscovery(snapshot){
 const updatedAt=snapshot.updatedAt||null,updated=Date.parse(updatedAt);
 return {results:normalizeGroups(snapshot),hotResults:normalizeGroups(snapshot,true),year:Number(snapshot.year)||null,updatedAt,nextRefreshAt:Number.isFinite(updated)?new Date(updated+REFRESH_MS).toISOString():null,refreshMinutes:60,source:snapshot.sourceKind==='cms'?'已接入影视源的年度更新':'哔哩哔哩年度影视资料',sourceKind:snapshot.sourceKind||'bilibili',sourceUrl:snapshot.sourceKind==='cms'?'':SOURCE_URL};
}
async function fetchGroup(kind,year,today,hot){
 const response=await fetch(discoveryIndexURL(kind,year,hot),{headers:{accept:'application/json','user-agent':'Mozilla/5.0 (compatible; SongbaiCinema/0.6)','referer':SOURCE_URL},redirect:'manual',signal:AbortSignal.timeout(5000)});
 if(!response.ok){await response.body?.cancel();throw Error('年度片单 HTTP '+response.status)}
 const data=JSON.parse(await readText(response,350000));
 if(data.code!==0||!Array.isArray(data.data?.list))throw Error('年度片单异常：'+String(data.code)+' '+cleanText(data.message,90));
 return data.data.list.filter(item=>{
  if(/敬请期待|即将上线/.test(String(item.order||'')+' '+String(item.index_show||'')))return false;
  const date=String(item.index_show||'').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if(date){const release=`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`;if(Number(date[1])!==year||release>today)return false}
  return true;
 }).map(item=>({id:String(item.season_id),title:item.title,cover:String(item.cover||'').replace(/^http:/,'https:'),rate:item.score,episodes_info:kind==='tv'?item.index_show:'',release_info:kind==='movie'?item.index_show:item.order,trend_info:hot?item.order:'',year}));
}
async function readSnapshot(env,year){
 try{const row=await env.DB?.prepare('SELECT payload FROM discovery_snapshots WHERE year=?').bind(year).first();const data=row?JSON.parse(row.payload):null;return Number(data?.year)===year?data:null}catch{return null}
}
async function saveSnapshot(env,snapshot){
 if(!env.DB)return;
 try{await env.DB.prepare('INSERT INTO discovery_snapshots(year,payload,updated_at) VALUES(?,?,?) ON CONFLICT(year) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(snapshot.year,JSON.stringify(snapshot),snapshot.updatedAt).run()}catch{}
}
export async function discover(env,origin,{now=Date.now(),force=false}={}){
 const {year,today}=discoveryCalendar(now),cache=globalThis.caches?.default,key=new Request(new URL(`/__cache/discover-v5/${year}`,origin));
 if(cache&&!force){try{const hit=await cache.match(key);if(hit)return await hit.json()}catch{}}
 const remember=async(result,ttl)=>{if(cache){try{await cache.put(key,new Response(JSON.stringify(result),{headers:{'content-type':'application/json','cache-control':`public,max-age=${ttl}`}}))}catch{}}return result};
 const stored=await readSnapshot(env,year),age=stored?Number(now)-Date.parse(stored.updatedAt):Infinity;
 if(!force&&age>=0&&age<REFRESH_MS)return remember({...normalizeDiscovery(stored),stale:false},Math.max(1,Math.floor((REFRESH_MS-age)/1000)));
 let backup=stored;
 const fallback=async()=>{
  if(!backup){try{const response=await env.ASSETS.fetch(new Request(new URL('/data/popular.json',origin)));const data=JSON.parse(await readText(response,250000));if(Number(data.year)===year)backup=data}catch{}}
  return backup||{year,movie:[],tv:[],hot:{movie:[],tv:[]},updatedAt:null};
 };
 const sections=[['movie',false],['tv',false],['movie',true],['tv',true]];
 const settled=await Promise.allSettled(sections.map(([kind,hot])=>fetchGroup(kind,year,today,hot)));
 let cms=null;
 if(settled.some(x=>x.status==='rejected')){try{cms=await discoverCMS(env,year,today)}catch{}}
 const snapshot={year,updatedAt:new Date(Number(now)).toISOString(),movie:[],tv:[],hot:{movie:[],tv:[]}};let stale=false;
 for(let i=0;i<sections.length;i++){
  const [kind,hot]=sections[i];let items;
  if(settled[i].status==='fulfilled')items=settled[i].value;
  else if((hot?cms?.hot?.[kind]:cms?.[kind])?.length){items=hot?cms.hot[kind]:cms[kind];snapshot.sourceKind='cms'}
  else{const old=await fallback();items=hot?old.hot?.[kind]:old[kind];stale=true}
  if(hot)snapshot.hot[kind]=items||[];else snapshot[kind]=items||[];
 }
 if(!cms&&settled.every(x=>x.status==='rejected'))snapshot.updatedAt=(await fallback()).updatedAt;
 if(!stale)await saveSnapshot(env,snapshot);
 const result={...normalizeDiscovery(snapshot),stale,catalogStatus:settled.map((x,i)=>({kind:sections[i][0],hot:sections[i][1],ok:x.status==='fulfilled',error:x.status==='rejected'?String(x.reason?.message||x.reason).slice(0,150):''}))};
 if(stale)result.nextRefreshAt=new Date(Number(now)+300000).toISOString();
 return remember(result,stale?300:3600);
}
