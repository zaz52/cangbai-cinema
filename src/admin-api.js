import {authReady,checkPassword,sessionCookie,logoutCookie,isAdmin,checkOrigin,bodyJSON,fail,revokeSession,allowLogin} from './admin-core.js';
import {allSources,requireDB,upsertSource,updateSource,deleteSource,saveHealth} from './source-db.js';
import {resolveTVBox,fetchTVBoxJSON,probeSource} from './tvbox.js';
export {probeSource} from './tvbox.js';
import {allFeeds,feedById,saveFeedResult} from './feed-db.js';
import {inspectCMS,cmsIdentity} from './cms-inspector.js';
const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const error=e=>json({error:(e instanceof Error?e.message:String(e)).slice(0,180)},/D1 数据库尚未绑定/.test(String(e))?503:400);
/** A feed URL is only a candidate configuration entry, never an active search source. */
export async function previewFeed(env,id){
 const feed=await feedById(env,id);
 if(!feed)throw Error('配置入口不存在');
 try{
  const result=await fetchTVBoxJSON(feed.url);
  const status=result.candidates.length?'compatible':'unsupported';
  const info={status,candidates:result.candidates.length,total:result.totalSites,
   error:result.candidates.length?'':'找到配置，但没有可直接导入的公网 HTTPS Apple CMS JSON 源（可能主要是 Spider 或 HTTP 接口）'};
  await saveFeedResult(env,id,info);
  return {feed:{...feed,last_status:status},...result,status,warning:info.error};
 }catch(e){
  const msg=(e instanceof Error?e.message:String(e)).slice(0,240);
  await saveFeedResult(env,id,{status:'failed',error:msg});
  return {feed:{...feed,last_status:'failed'},status:'failed',error:msg,candidates:[],totalSites:0,skipped:{}};
 }
}
export async function adminAPI(req,env,path){
 const method=req.method;
 if(path==='/api/admin/session'&&method==='GET')return json({configured:authReady(env),dbReady:!!env.DB,authenticated:await isAdmin(req,env)});
 if(path==='/api/admin/login'&&method==='POST'){
  if(!checkOrigin(req))return fail('请求来源不匹配',403);
  if(!authReady(env))return fail('请先配置 ADMIN_PASSWORD（至少12位）和 ADMIN_SESSION_SECRET（至少32位）',503);
  try{
   const {password}=await bodyJSON(req,2000);
   if(!await allowLogin(req,env))return json({error:'登录尝试过多，请在 15 分钟后重试'},429,{'retry-after':'900'});
   if(!await checkPassword(password,env))return fail('密码不正确',401);
   return json({ok:true},200,{'set-cookie':await sessionCookie(env,req)});
  }catch(e){return error(e)}
 }
 if(!await isAdmin(req,env))return fail('未授权，请先登录后台',401);
 if(method!=='GET'&&!checkOrigin(req))return fail('请求来源不匹配',403);
 if(path==='/api/admin/logout'&&method==='POST'){await revokeSession(req,env);return json({ok:true},200,{'set-cookie':logoutCookie(req)})}
 try{
  requireDB(env);
  if(path==='/api/admin/logs'&&method==='GET')return json({logs:(await env.DB.prepare('SELECT * FROM source_events ORDER BY id DESC LIMIT 100').all()).results||[]});
  if(path==='/api/admin/feeds'&&method==='GET')return json({feeds:await allFeeds(env)});
  const feedMatch=path.match(/^\/api\/admin\/feeds\/([a-z0-9-]{2,48})\/preview$/);
  if(feedMatch&&method==='POST'){
   const result=await previewFeed(env,feedMatch[1]);
   return json(result);
  }
  if(path==='/api/admin/sources'&&method==='GET')return json({sources:await allSources(env)});
  if(path==='/api/admin/sources/inspect'&&method==='POST'){
   const result=await inspectCMS(await bodyJSON(req,2000));
   const existing=(await allSources(env)).find(x=>{try{return cmsIdentity(x.url)===cmsIdentity(result.url)}catch{return false}});
   if(existing)result.existing=existing;
   return json(result);
  }
  if(path==='/api/admin/sources'&&method==='POST'){
   const payload=await bodyJSON(req,4000);
   const value=await upsertSource(env,payload,{rights:payload.rightsConfirmed===true});
   const row=await env.DB.prepare('SELECT id,name,url FROM video_sources WHERE id=?').bind(value.id).first();
   const health=await probeSource(row);await saveHealth(env,row.id,health);return json({ok:true,...value,health},201)
  }
  if(path==='/api/admin/import/tvbox'&&method==='POST'){
   const payload=await bodyJSON(req,1_010_000);
   const result=payload.url?await fetchTVBoxJSON(payload.url):await resolveTVBox(payload.raw||'');
   return json(result);
  }
  if(path==='/api/admin/import/confirm'&&method==='POST'){
   const payload=await bodyJSON(req,32_000);
   if(payload.rightsConfirmed!==true)return fail('必须确认已获得所选接口及视频内容的必要使用授权');
   if(!Array.isArray(payload.sources)||payload.sources.length<1||payload.sources.length>20)return fail('单次请求支持 1 到 20 个有效接口；后台会自动分批导入');
   const results=[];for(const source of payload.sources){try{const r=await upsertSource(env,source,{rights:true,origin:'tvbox'});results.push({name:source.name,...r})}catch(e){results.push({name:source?.name,error:String(e.message||e)})}}
   return json({results,imported:results.filter(x=>!x.error).length,failed:results.filter(x=>x.error).length});
  }
  const m=path.match(/^\/api\/admin\/sources\/([a-z0-9-]{2,48})(?:\/(test))?$/);
  if(m){const id=m[1],action=m[2];
   if(action==='test'&&method==='POST'){
    const row=await env.DB.prepare('SELECT id,name,url FROM video_sources WHERE id=?').bind(id).first();if(!row)return fail('该源不存在',404);
    const outcome=await probeSource(row);await saveHealth(env,id,outcome);return json(outcome)
   }
   if(!action&&method==='PATCH')return json(await updateSource(env,id,await bodyJSON(req,4000)));
   if(!action&&method==='DELETE'){await deleteSource(env,id);return json({ok:true})}
  }
  return fail('后台接口不存在',404);
 }catch(e){return error(e)}
}
