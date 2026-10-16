import {normalizeSource} from './tvbox.js';
export const requireDB=env=>{if(!env?.DB?.prepare)throw Error('D1 数据库尚未绑定：请按 README 配置 DB 并运行 migrations');return env.DB};
export async function allSources(env){const db=requireDB(env);const rs=await db.prepare('SELECT id,name,url,enabled,rights_confirmed,origin,last_status,last_latency_ms,last_checked_at,last_error,created_at,updated_at FROM video_sources ORDER BY enabled DESC, name ASC').all();return rs.results||[]}
export async function activeSources(env){if(!env.DB)return [];let rows=await env.DB.prepare('SELECT id,name,url FROM video_sources WHERE enabled=1 AND rights_confirmed=1 ORDER BY CASE last_status WHEN \'healthy\' THEN 0 ELSE 1 END, name ASC LIMIT 12').all();return rows.results||[]}
export async function upsertSource(env,raw,{rights=false,origin='manual'}={}){
 const db=requireDB(env);const s=normalizeSource(raw);
 if(rights!==true)throw Error('必须确认已经获得该接口及视频内容的必要使用授权');
 // Existing source by URL keeps ID. Users must explicitly enable a new source after verification.
 const existing=await db.prepare('SELECT id,enabled FROM video_sources WHERE url=?').bind(s.url).first();
 if(existing){await db.prepare('UPDATE video_sources SET name=?,rights_confirmed=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(s.name,existing.id).run();return {id:existing.id,updated:true}}
 await db.prepare('INSERT INTO video_sources(id,name,url,enabled,rights_confirmed,origin) VALUES(?,?,?,0,1,?)').bind(s.id,s.name,s.url,origin).run();
 return {id:s.id,created:true};
}
export async function updateSource(env,id,patch){
 const db=requireDB(env);const prev=await db.prepare('SELECT * FROM video_sources WHERE id=?').bind(id).first();if(!prev)throw Error('影视源不存在');
 const name=patch.name===undefined?prev.name:String(patch.name||'').trim().slice(0,64);
 const url=patch.url===undefined?prev.url:String(patch.url||'').trim();
 normalizeSource({name,url});
 const rights=patch.rightsConfirmed===undefined?prev.rights_confirmed===1:patch.rightsConfirmed===true;
 const enabled=patch.enabled===undefined?prev.enabled===1:patch.enabled===true;
 if(enabled&&!rights)throw Error('未确认内容授权，不能启用该源');
 const changed=url!==prev.url;
 if(enabled&&!changed&&prev.last_status!=='healthy')throw Error('请先通过接口测活再启用');
 const actualEnabled=enabled&&!changed;
 await db.prepare('UPDATE video_sources SET name=?,url=?,enabled=?,rights_confirmed=?,last_status=CASE WHEN url<>? THEN \'untested\' ELSE last_status END,updated_at=CURRENT_TIMESTAMP WHERE id=?')
 .bind(name,url,actualEnabled?1:0,rights?1:0,url,id).run();
 if(changed)await db.prepare('UPDATE video_sources SET last_error=NULL,last_checked_at=NULL,last_latency_ms=NULL WHERE id=?').bind(id).run();
 return {id,updated:true,enabled:actualEnabled};
}
export async function deleteSource(env,id){return requireDB(env).prepare('DELETE FROM video_sources WHERE id=?').bind(id).run()}
export async function recordEvent(env,id,name,event,ok,message){
 const db=requireDB(env);
 await db.prepare('INSERT INTO source_events(source_id,source_name,event,ok,message) VALUES(?,?,?,?,?)').bind(id,name,event,ok?1:0,String(message||'').slice(0,240)).run();
 await db.prepare('DELETE FROM source_events WHERE id NOT IN (SELECT id FROM source_events ORDER BY id DESC LIMIT 200)').run();
}
export async function saveHealth(env,id,result){
 const db=requireDB(env);
 await db.prepare('UPDATE video_sources SET last_status=?,last_latency_ms=?,last_checked_at=CURRENT_TIMESTAMP,last_error=? WHERE id=?').bind(result.ok?'healthy':'failed',result.ms,result.error||null,id).run();
 await recordEvent(env,id,'','probe',result.ok,result.error||`API 格式正常，${result.ms} ms`);
}
