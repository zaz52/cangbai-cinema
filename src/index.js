/** 苍柏 CINEMA v0.6: persisted source admin, safe TVBox import, multi-search, switch lines. */
import {aggregateSearch, aggregateDetail, directorySearch, providersFromEnv, safeQuery, searchUrl, searchArchive, archiveDetail, selectVideoFiles} from './providers.js';
import {activeSources} from './source-db.js';
import {adminAPI,probeSource} from './admin-api.js';
import {saveHealth} from './source-db.js';
import {demoCMS} from './open-demo.js';
import {discover} from './discovery.js';
const json=(v,status=200,cache='no-store')=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':cache,'x-content-type-options':'nosniff'}});
async function searchEnvironment(env){
 // Only sources explicitly enabled and rights-confirmed in D1 participate.
 // D1 is the single source of truth once installed, so 'disable' always takes effect.
 // Old v0.4 VOD_SOURCES is only used when no D1 database is bound.
 const combined=env.DB ? (await activeSources(env)) : providersFromEnv(env);
 return {...env,VOD_SOURCES:JSON.stringify(combined)};
}
async function api(req,env={}){
 const url=new URL(req.url),path=url.pathname;
 if(path.startsWith('/api/admin/'))return adminAPI(req,env,path);
 if(req.method!=='GET')return json({error:'公共接口仅支持 GET'},405);
 if(path==='/api/open-demo/vod')return json(demoCMS(url));
 if(path==='/api/discover'){
  try{return json(await discover(env,url.origin),200,'public,max-age=300')}
  catch{return json({error:'热门影视暂时无法加载',results:[]},503)}
 }
 if(path==='/api/site-config'){
  const value=String(env.COPYRIGHT_CONTACT_EMAIL||'').trim();const email=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)&&value.length<=254?value:null;
  return json({copyrightContactEmail:email,nonCommercial:true});
 }
 if(path==='/api/health'){
  let databaseReady=false;
  try{if(env.DB){await env.DB.prepare('SELECT id FROM video_sources LIMIT 1').all();await env.DB.prepare('SELECT id FROM tvbox_feeds LIMIT 1').all();await env.DB.prepare('SELECT token_hash FROM admin_sessions LIMIT 1').all();await env.DB.prepare('SELECT client_hash FROM login_attempts LIMIT 1').all();await env.DB.prepare('SELECT id FROM source_events LIMIT 1').all();databaseReady=true}}catch{}
  return json({ok:databaseReady,product:'苍柏 CINEMA',version:'0.6.1',databaseConfigured:!!env.DB,databaseReady},databaseReady?200:503);
 }
 if(path==='/api/providers'){
  try{const connected=providersFromEnv(await searchEnvironment(env));return json({directory:'awesome-zhuiju-free',connected:connected.map(s=>({id:s.id,name:s.name,kind:'cms'}))})}
  catch{return json({error:'数据源加载失败'},503)}
 }
 if(path==='/api/catalog'){
  const cat=url.searchParams.get('category')==='tvbox_config'?'tvbox_config':'online_video';
  try{return json(await directorySearch(safeQuery(url.searchParams.get('q')),cat,env),200,'public,max-age=300,s-maxage=1800')}
  catch(e){return json({error:'暂时无法拉取追剧导航目录',detail:String(e.message||e).slice(0,130),results:[]},502)}
 }
 if(path==='/api/search'){
  const q=safeQuery(url.searchParams.get('q'));const page=Math.max(1,Math.min(10,parseInt(url.searchParams.get('page')||'1',10)||1));
  try{return json(await aggregateSearch(q,page,await searchEnvironment(env)),200,'no-store')}
  catch(e){return json({error:'影视检索失败',detail:String(e.message||e).slice(0,130),results:[]},502)}
 }
 if(path==='/api/detail'){
  let ids=[];const raw=url.searchParams.get('ids');
  if(raw){if(raw.length>2000)return json({error:'请求线路过多'},400);try{ids=JSON.parse(raw)}catch{return json({error:'来源列表格式错误'},400)}}
  else if(url.searchParams.get('id'))ids=[url.searchParams.get('id')];
  if(!Array.isArray(ids)||ids.length>12||!ids.length||ids.some(x=>typeof x!=='string'||x.length>250))return json({error:'资源标识无效'},400);
  try{return json(await aggregateDetail(ids,await searchEnvironment(env)),200,'no-store')}
  catch(e){return json({error:'所有线路均未返回可用详情',detail:String(e.message||e).slice(0,130)},502)}
 }
 return json({error:'不存在的 API'},404);
}
export {safeQuery,searchUrl,selectVideoFiles,searchArchive as searchIA,archiveDetail as detailIA};
export default {
 async fetch(request,env){try{const path=new URL(request.url).pathname;if(path.startsWith('/api/'))return await api(request,env);return env.ASSETS.fetch(request)}catch{return json({error:'服务暂不可用，请检查数据库迁移与配置'},503)}},
 async scheduled(controller,env){
  if(!env.DB)return;
  if(controller.cron==='15 * * * *'){await discover(env,'https://weiyi.indevs.in',{force:true});return}
  if(controller.cron&&controller.cron!=='30 */6 * * *')return;
  const rows=await env.DB.prepare("SELECT id,name,url FROM video_sources WHERE rights_confirmed=1 ORDER BY CASE WHEN last_checked_at IS NULL THEN 0 ELSE 1 END, last_checked_at ASC LIMIT 12").all();
  await Promise.all((rows.results||[]).map(async row=>{
   const result=await probeSource(row);
   await saveHealth(env,row.id,result);
  }));
 }
};
