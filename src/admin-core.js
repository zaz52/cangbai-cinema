/** Signed HttpOnly admin sessions and CSRF validation for Cloudflare Workers. */
import {readText} from './http.js';
const encoder=new TextEncoder();
const fail=(error,status=400)=>new Response(JSON.stringify({error}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const toHex=bytes=>Array.from(bytes).map(n=>n.toString(16).padStart(2,'0')).join('');
async function digest(value){return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}
async function hmac(message,key){const k=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return toHex(new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(message))))}
function equalHex(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function secrets(env){return typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=12&&typeof env.ADMIN_SESSION_SECRET==='string'&&env.ADMIN_SESSION_SECRET.length>=32&&env.ADMIN_PASSWORD!==env.ADMIN_SESSION_SECRET}
export const authReady=secrets;
const cookieName='sb_admin';
const sessionTtl=8*60*60;
export async function checkPassword(given,env){if(!secrets(env)||typeof given!=='string'||given.length>512)return false;return equalHex(await digest(given),await digest(env.ADMIN_PASSWORD))}
export async function sessionCookie(env,request){
 const expiry=Math.floor(Date.now()/1000)+sessionTtl;
 if(!env.DB)throw Error('D1 数据库尚未绑定');
 const payload=String(expiry)+'.'+toHex(crypto.getRandomValues(new Uint8Array(24)));
 const signature=await hmac(payload,env.ADMIN_SESSION_SECRET+await digest(env.ADMIN_PASSWORD));
 await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(Math.floor(Date.now()/1000)).run();
 await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)').bind(await digest(payload),expiry).run();
 const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
 return `${cookieName}=${payload}.${signature}; Path=/api/admin; Max-Age=${sessionTtl}; HttpOnly; SameSite=Strict${secure}`;
}
export const logoutCookie=request=>`${cookieName}=; Path=/api/admin; Max-Age=0; HttpOnly; SameSite=Strict${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export async function isAdmin(req,env){
 if(!secrets(env))return false;
 const raw=req.headers.get('cookie')||'';const match=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
 if(!match)return false;
 const value=match.slice(cookieName.length+1);const m=/^(\d{10,11})\.([a-f0-9]{48})\.([a-f0-9]{64})$/.exec(value);if(!m)return false;
 if(Number(m[1])<Math.floor(Date.now()/1000))return false;
 if(Number(m[1])>Math.floor(Date.now()/1000)+sessionTtl)return false;
 const payload=m[1]+'.'+m[2];
 if(!equalHex(await hmac(payload,env.ADMIN_SESSION_SECRET+await digest(env.ADMIN_PASSWORD)),m[3]))return false;
 if(!env.DB)return false;
 const session=await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash=?').bind(await digest(payload)).first();
 return !!session&&session.expires_at>Math.floor(Date.now()/1000);
}
export async function revokeSession(req,env){
 const value=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
 if(value&&env.DB){const parts=value.slice(cookieName.length+1).split('.');await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await digest(parts[0]+'.'+parts[1])).run()}
}
export async function allowLogin(req,env){
 if(!env.DB)throw Error('D1 数据库尚未绑定');
 const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/900)*900;
 const key=await hmac(req.headers.get('cf-connecting-ip')||'local',env.ADMIN_SESSION_SECRET);
 const row=await env.DB.prepare('INSERT INTO login_attempts(client_hash,window_start,attempts) VALUES(?,?,1) ON CONFLICT(client_hash) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts').bind(key,windowStart).first();
 await env.DB.prepare('DELETE FROM login_attempts WHERE window_start<?').bind(windowStart-900).run();
 return row.attempts<=10;
}
export function checkOrigin(req){
 const origin=req.headers.get('origin');if(!origin)return false;
 try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}
}
export async function bodyJSON(req,maxBytes=30_000){
 const ct=req.headers.get('content-type')||'';if(!ct.includes('application/json'))throw Error('请使用 application/json');
 if(Number(req.headers.get('content-length')||0)>maxBytes)throw Error('提交内容过大');
 const value=JSON.parse(await readText(req,maxBytes));
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('请提交 JSON 对象');
 return value;
}
export {fail};
