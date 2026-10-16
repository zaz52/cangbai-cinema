import {requireDB} from './source-db.js';
export async function allFeeds(env){
 const rs=await requireDB(env).prepare('SELECT id,name,url,last_status,last_error,last_candidate_count,last_total_sites,last_checked_at FROM tvbox_feeds ORDER BY rowid ASC').all();
 return rs.results||[];
}
export async function feedById(env,id){
 return requireDB(env).prepare('SELECT id,name,url,last_status,last_error,last_candidate_count,last_total_sites,last_checked_at FROM tvbox_feeds WHERE id=?').bind(id).first();
}
export async function saveFeedResult(env,id,{status='error',error='',candidates=0,total=null}={}){
 return requireDB(env).prepare('UPDATE tvbox_feeds SET last_status=?,last_error=?,last_candidate_count=?,last_total_sites=?,last_checked_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,String(error||'').slice(0,250),candidates,total,id).run();
}
