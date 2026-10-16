/* Provider adapters for Songbai. Directory entries are not playback APIs. */
import {readText} from './http.js';
import {demoCMS,isDemoAPI} from './open-demo.js';
const IA = 'https://archive.org';
export const CATALOG_URL='https://raw.githubusercontent.com/laoma528/awesome-zhuiju-free/main/resources/resources.json';
export const SOURCE_REPO='https://github.com/laoma528/awesome-zhuiju-free';
export const safeQuery = q => String(q??'').normalize('NFKC').replace(/[^\p{L}\p{N}\s.'-]/gu,' ').trim().slice(0,80);
export const cleanText = (v,max=500) => (Array.isArray(v)?v.join(' · '):String(v??'')).replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim().slice(0,max);
export const safeId = s=>/^[a-zA-Z0-9_.-]{1,110}$/.test(s);
export function validHTTP(raw){try{const u=new URL(raw);return ['https:','http:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password&&!/(^localhost$|\.localhost$|^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.|^\[|^172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)}catch{return false}}
async function jsonFetch(url,ms=8000){if(isDemoAPI(url))return demoCMS(new URL(url));const r=await fetch(url,{headers:{accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(ms)});if(!r.ok){await r.body?.cancel();throw Error(`HTTP ${r.status}`)}return JSON.parse(await readText(r))}
export function providersFromEnv(env={}){
 let a=[];try{a=JSON.parse(env.VOD_SOURCES||'[]')}catch{return []}if(!Array.isArray(a))return [];
 let seen=new Set();return a.slice(0,12).filter(x=>x&&typeof x==='object').map(x=>({id:String(x.id||''),name:cleanText(x.name||x.id,50),url:String(x.url||'')})).filter(x=>{
 const ok=/^[a-z0-9-]{2,48}$/.test(x.id)&&x.name&&x.url.startsWith('https://')&&validHTTP(x.url)&&!seen.has(x.id);seen.add(x.id);return ok;
 });
}
const yearOf=m=>{let y=String(m.year??m.date??'').match(/(?:18|19|20)\d{2}/);return y?Number(y[0]):null};
export function searchUrl(q,page=1){let u=new URL(IA+'/advancedsearch.php');const fragment=q?safeQuery(q).split(/\s+/).filter(Boolean).slice(0,7).map(t=>`title:${t}`).join(' AND '):'';u.searchParams.set('q',`mediatype:movies AND collection:prelinger${fragment?' AND '+fragment:''}`);for(const f of ['identifier','title','year','date','description','creator','downloads'])u.searchParams.append('fl[]',f);u.searchParams.set('rows','18');u.searchParams.set('page',String(page));u.searchParams.set('output','json');u.searchParams.append('sort[]','downloads desc');return u}
const archiveMeta=(m,id)=>({id,title:cleanText(m.title,140)||id,year:yearOf(m),description:cleanText(m.description,1600),creator:cleanText(m.creator,150),image:`${IA}/services/img/${encodeURIComponent(id)}`,source:'Internet Archive · Prelinger',sourceUrl:`${IA}/details/${encodeURIComponent(id)}`,type:'公开影像'});
export async function searchArchive(q,page=1){let data=await jsonFetch(searchUrl(q,page));let docs=Array.isArray(data?.response?.docs)?data.response.docs:[];return {total:Number(data?.response?.numFound||0),results:docs.filter(x=>safeId(x.identifier)).map(x=>archiveMeta(x,x.identifier))}}
const fileRank=f=>/\.mp4$/i.test(f.name)?0:/\.webm$/i.test(f.name)?1:/\.(ogv|ogg)$/i.test(f.name)?2:9;
export function selectVideoFiles(files,id){return (Array.isArray(files)?files:[]).filter(f=>typeof f.name==='string'&&/\.(mp4|webm|ogv|ogg)$/i.test(f.name)&&f.private!=='true'&&f.source!=='metadata').sort((a,b)=>fileRank(a)-fileRank(b)||Number(b.size||0)-Number(a.size||0)).slice(0,12).map((f,i)=>({name:cleanText(f.name,140),format:cleanText(f.format,60),size:Number(f.size||0),url:`${IA}/download/${encodeURIComponent(id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,line:'Internet Archive',lineId:'archive',episodeKey:'movie',index:i+1}))}
export function archiveLicenseAllowed(metadata){
 const values=Array.isArray(metadata.licenseurl)?metadata.licenseurl:[metadata.licenseurl];
 return values.some(value=>{try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)&&['creativecommons.org','www.creativecommons.org'].includes(u.hostname)&&/^\/(?:publicdomain\/(?:zero|mark)\/1\.0|licenses\/publicdomain|licenses\/(?:by|by-sa)\/(?:1\.0|2\.0|2\.5|3\.0|4\.0))\/?$/.test(u.pathname)}catch{return false}});
}
export async function archiveDetail(id){if(!safeId(id))throw Error('不合法的资源标识');const data=await jsonFetch(`${IA}/metadata/${encodeURIComponent(id)}`);if(!data?.metadata)throw Error('馆藏未找到');return {...archiveMeta(data.metadata,id),videos:archiveLicenseAllowed(data.metadata)?selectVideoFiles(data.files,id):[],playable:archiveLicenseAllowed(data.metadata)&&selectVideoFiles(data.files,id).length>0,license:cleanText(data.metadata.licenseurl||data.metadata.rights,500),rightsNote:'公开收录不等于公有领域，请核对作品的播放、传播授权。'}}
export function cmsSearchUrl(source,query,page){const u=new URL(source.url);u.searchParams.set('ac','videolist');u.searchParams.set('wd',query);u.searchParams.set('pg',String(page));return u}
export function cmsDetailUrl(source,vodId){const u=new URL(source.url);u.searchParams.set('ac','detail');u.searchParams.set('ids',vodId);return u}
const getCmsList=data=>Array.isArray(data?.list)?data.list:Array.isArray(data?.data?.list)?data.data.list:[];
const cmsId=(sourceId,vodId)=>`cms:${sourceId}:${encodeURIComponent(String(vodId))}`;
const cmsMeta=(m,s)=>({id:cmsId(s.id,m.vod_id),title:cleanText(m.vod_name,140),year:yearOf({year:m.vod_year}),description:cleanText(m.vod_content||m.vod_blurb,1600),image:validHTTP(m.vod_pic)?String(m.vod_pic):'',source:s.name,sourceUrl:'',type:cleanText(m.type_name||'影视',50) });
export async function searchCMS(source,q,page){const data=await jsonFetch(cmsSearchUrl(source,q,page),8000);let docs=getCmsList(data).filter(x=>x&&x.vod_id!=null&&String(x.vod_id).length<=120&&cleanText(x.vod_name,140));return {total:Number(data.total||docs.length),results:docs.slice(0,30).map(x=>cmsMeta(x,source))}}
export function episodeKey(str){
 const s=String(str||'').normalize('NFKC'),m=s.match(/第\s*0*(\d+)\s*[集话期]|^0*(\d+)\s*$/);
 if(m)return 'ep-'+String(Number(m[1]||m[2]));
 const label=s.toLowerCase().replace(/[\s_\-]/g,'');
 const qualityLabel=/^(?:hd|bd|sd|dvd|4k|(?:720|1080|2160)p|蓝光|高清|超清)(?:中字|国语|粤语|英语|日语|韩语|中文字幕|中英双字|双语|无字|高清|超清|修复版|完整版|版)*$/i;
 return /(正片|全集|电影|full)/i.test(s)||qualityLabel.test(label)?'movie':cleanText(label,50)||'movie';
}
export function parseCmsPlay(m,s){const lines=String(m.vod_play_from||'').split('$$$');const blocks=String(m.vod_play_url||'').split('$$$');let result=[];for(let i=0;i<blocks.length;i++){
 const line=cleanText(lines[i]||`线路${i+1}`,50);for(const raw of blocks[i].split('#')){
 const sep=raw.indexOf('$');const ep=sep<0?'正片':cleanText(raw.slice(0,sep),70)||'正片';const uri=(sep<0?raw:raw.slice(sep+1)).trim();
 if(!uri.startsWith('https://')||!validHTTP(uri)||!/\.(m3u8|mp4|webm|ogv|ogg)(\?|#|$)/i.test(uri))continue;
 result.push({name:ep,episodeKey:episodeKey(ep),format:/\.m3u8/i.test(uri)?'HLS':'视频',url:uri,line:`${s.name} · ${line}`,lineId:s.id+':'+i,sourceId:s.id});
 }}return result.slice(0,300)}
export function parseSourceId(id,env={}){if(safeId(id))throw Error('旧馆藏条目已下线，请重新搜索影视作品');const m=/^cms:([a-z0-9-]{2,48}):(.{1,200})$/.exec(String(id));if(!m)throw Error('资源标识无效');const source=providersFromEnv(env).find(s=>s.id===m[1]);if(!source)throw Error('源未启用');let vodId;try{vodId=decodeURIComponent(m[2])}catch{throw Error('资源标识无效')}if(!vodId||vodId.length>120||/[\r\n]/.test(vodId))throw Error('资源标识无效');return {kind:'cms',source,vodId}}
export async function sourceDetail(id,env){const p=parseSourceId(id,env);if(p.kind==='archive')return archiveDetail(p.identifier);const data=await jsonFetch(cmsDetailUrl(p.source,p.vodId),8000);const movie=getCmsList(data)[0];if(!movie)throw Error('该线路没有返回影片详情');return {...cmsMeta(movie,p.source),videos:parseCmsPlay(movie,p.source),license:cleanText(movie.vod_license||'',500),creator:cleanText(movie.vod_creator||'',150),rightsNote:'播放权利与可用性由数据源负责，请仅配置有使用授权的接口。'}}
function normalTitle(t){return String(t||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'').slice(0,100)}
export function groupResults(all){
 const groups=[];
 for(const item of all){
  const titleKey=normalTitle(item.title)||item.id;
  const y=Number(item.year)||0;
  // If both entries know the year, never merge different years of a same-named film.
  let g=groups.find(x=>x._titleKey===titleKey&&(!x.year||!y||x.year===y));
  if(!g){g={...item,id:item.id,sourceIds:[],providers:[],sourceCount:0,_titleKey:titleKey};groups.push(g)}
  if(!g.year&&y)g.year=y;
  if(!g.sourceIds.includes(item.id)){g.sourceIds.push(item.id);g.providers.push(item.source)}
  g.sourceCount=g.sourceIds.length;
 }
 return groups.map(({_titleKey,...g})=>g);
}
export async function aggregateSearch(q,page,env={}){const configs=providersFromEnv(env);const jobs=configs.map(s=>[s.name,()=>searchCMS(s,q,page)]);const settled=await Promise.all(jobs.map(async([name,run])=>{try{return {name,...await run(),ok:true}}catch(e){return {name,ok:false,error:String(e.message||e).slice(0,150),results:[],total:0}}}));
 const all=settled.flatMap(x=>x.results);return {q,page,total:all.length,results:groupResults(all),sourceStatus:settled.map(x=>({name:x.name,ok:x.ok,results:x.results.length,error:x.error||''})),note:'搜索使用后台已启用并确认授权的影视接口。'};}
export async function aggregateDetail(ids,env={}){const unique=[...new Set(ids)].slice(0,8);const settled=await Promise.all(unique.map(async id=>{try{return await sourceDetail(id,env)}catch(e){return {failedId:id,error:String(e.message||e).slice(0,120)}}}));const available=settled.filter(x=>!x.error);const reference=available[0];const good=available.filter(x=>normalTitle(x.title)===normalTitle(reference.title)&&(!x.year||!reference.year||x.year===reference.year));if(!good.length)throw Error(settled[0]?.error||'全部来源均不可用');const first=good[0];return {...first,videos:good.flatMap(x=>x.videos||[]).filter((x,i,all)=>all.findIndex(v=>v.url===x.url&&v.episodeKey===x.episodeKey)===i),sourceCount:good.length,sourceDetails:good.map(x=>({id:x.id,name:x.source,videoCount:x.videos.length})),failures:settled.filter(x=>x.error),rightsNote:'每条线路都应确认使用权限。不同站点网页地址不能直接用于视频播放。'};}
export function mapDirectory(doc,query='',category='online_video'){
 const list=Array.isArray(doc.resources)?doc.resources:[];const q=String(query||'').trim().toLowerCase().slice(0,80);
 return list.filter(x=>['online_video','tvbox_config'].includes(x.category)&&x.category===category&&x.verification?.status!=='removed'&&validHTTP(x.url)).filter(x=>!q||[x.name,x.summary,...(x.tags||[])].join(' ').toLowerCase().includes(q)).map(x=>({id:x.id,name:cleanText(x.name,100),url:x.url,summary:cleanText(x.summary_short||x.summary,150),category:x.category,stars:Number(x.scores?.more||0),status:x.verification?.status||'pending',checked:x.verification?.last_checked||'',risk:x.risks?.copyright||'unknown',searchable:false,playable:false,reason:'该仓库只提供入口信息，未提供此站的搜索/播放 API'})).sort((a,b)=>b.stars-a.stars);
}
export async function directorySearch(query='',category='online_video',env={}){const endpoint=(env.CATALOG_URL||CATALOG_URL);if(endpoint!==CATALOG_URL)throw Error('目录地址必须为已验证的上游');const doc=await jsonFetch(endpoint,8500);return {project:'awesome-zhuiju-free',repo:SOURCE_REPO,updatedAt:doc.updated_at,results:mapDirectory(doc,query,category),note:'目录仅表示网站入口，不代表可查询影视标题或获得可播放地址。'};}
