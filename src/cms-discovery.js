import {activeSources} from './source-db.js';
import {providersFromEnv,cleanText} from './providers.js';
import {validSourceURL} from './tvbox.js';
import {isDemoAPI} from './open-demo.js';
import {readText} from './http.js';

async function catalog(source,category){
 const url=new URL(source.url);url.searchParams.set('ac',category==null?'list':'detail');url.searchParams.set('pg','1');if(category!=null)url.searchParams.set('t',String(category));
 const response=await fetch(url,{headers:{accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(6500)});
 if(!response.ok){await response.body?.cancel();throw Error('片源更新 HTTP '+response.status)}
 const data=JSON.parse(await readText(response,700000));if(!Array.isArray(data.list))throw Error('片源未返回列表');return data;
}
function updatedTime(value){const text=String(value||'').replace(' ','T');const parsed=Date.parse(/[zZ]|[+]\d{2}:?\d{2}$/.test(text)?text:text+'+08:00');return Number.isFinite(parsed)?parsed:0}
export async function discoverCMS(env,year,today){
 const sources=(env.DB?await activeSources(env):providersFromEnv(env)).filter(s=>validSourceURL(s.url)&&!isDemoAPI(s.url));
 const unique=sources.filter((s,i,a)=>a.findIndex(x=>new URL(x.url).hostname===new URL(s.url).hostname)===i).slice(0,3);
 const settled=await Promise.allSettled(unique.map(async source=>{
  const root=await catalog(source),classes=Array.isArray(root.class)?root.class:[];
  const categoryNames=['剧情片','动作片','喜剧片','爱情片','科幻片','恐怖片','国产剧','欧美剧','日本剧','韩国剧','港台剧','大陆综艺','日韩综艺','欧美综艺','港台综艺','国产动漫','日韩动漫','欧美动漫'];
  // Select across all four families before filling remaining slots; at most 12 requests per source.
  const families=[/片|电影/,/剧/,/综艺/,/动漫|动画/];
  const candidates=categoryNames.map(name=>classes.find(x=>x.type_name===name)).filter(Boolean);
  const selected=families.flatMap(pattern=>candidates.filter(x=>pattern.test(x.type_name)&&!(/动画|动漫/.test(x.type_name)&&pattern.source==='片|电影')).slice(0,2));
  const ids=[...new Set([...selected,...candidates].map(x=>x.type_id).filter(id=>/^\d{1,8}$/.test(String(id))))].slice(0,11);
  const lists=await Promise.allSettled((ids.length?ids:[null]).map(id=>catalog(source,id)));
  const docs=[...root.list,...lists.flatMap(x=>x.status==='fulfilled'?x.value.list:[])];
  return docs.map(item=>{
   const type=cleanText(item.type_name,40),title=cleanText(item.vod_name,100),id=String(item.vod_id||'');
   if(Number(item.vod_year)!==year||!title||!/^\d{1,12}$/.test(id)||/伦理|情色|成人|写真|预告|解说|漫剧/.test(type))return null;
   const kind=/综艺/.test(type)?'variety':/动漫|动画/.test(type)?'anime':/片|电影/.test(type)?'movie':/剧/.test(type)?'tv':null;if(!kind)return null;
   const cover=String(item.vod_pic||'').replace(/^http:/,'https:');if(!validSourceURL(cover))return null;
   const release=String(item.vod_pubdate||'').match(/\d{4}-\d{2}-\d{2}/)?.[0];if(release&&release>today)return null;
   const remarks=cleanText(item.vod_remarks,50),time=updatedTime(item.vod_time);
   const backdrop=String(item.vod_pic_slide||'').replace(/^http:/,'https:');
   return {id,title,kind,year,cover,backdrop:validSourceURL(backdrop)?backdrop:'',genres:cleanText(item.vod_class||type,120),area:cleanText(item.vod_area,60),category:type,providerId:source.id,providerName:source.name,rate:item.vod_score,episodes_info:remarks,release_info:cleanText(item.vod_time,50),trend_info:/更新至|连载|更至/.test(remarks)?'连载更新':'片源近期更新',updated_time:time,hits:Number(item.vod_hits_month||item.vod_hits_week||item.vod_hits)||0,ongoing:/更新至|连载|更至/.test(remarks)};
  }).filter(Boolean);
 }));
 const all=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]).sort((a,b)=>b.updated_time-a.updated_time),seen=new Set();
 const items=all.filter(item=>{const key=item.kind+':'+item.title.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');if(seen.has(key))return false;seen.add(key);return true});
 if(!items.length)return null;
 const kinds=['movie','tv','variety','anime'];
 const groups=Object.fromEntries(kinds.map(kind=>[kind,items.filter(x=>x.kind===kind).slice(0,48)]));
 const hot=Object.fromEntries(kinds.map(kind=>[kind,items.filter(x=>x.kind===kind).sort((a,b)=>Number(b.ongoing)-Number(a.ongoing)||b.hits-a.hits||b.updated_time-a.updated_time).slice(0,24)]));
 return {...groups,hot,sourceKind:'cms',rankingBasis:'source-updates-and-ongoing-episodes'};
}
