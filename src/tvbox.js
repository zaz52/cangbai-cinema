/** TVBox configuration import. Only Apple CMS JSON sites, never execute spiders/scripts. */
import {validHTTP, cleanText, cmsSearchUrl} from './providers.js';
import {readText} from './http.js';
import {isDemoAPI,demoCMS} from './open-demo.js';
export function validSourceURL(value){
 try {
  const u=new URL(String(value||''));
  if(u.protocol!=='https:'||!validHTTP(u.href)||u.port||u.username||u.password) return false;
  const host=u.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.example')||host.endsWith('.invalid')||host.endsWith('.localhost')) return false;
  // Admin-managed sources only; disallow IPs, IDN confusables and single-label/private addresses.
  if(!/^[a-z0-9.-]+$/.test(host)||!host.includes('.')||/^\d+(?:\.\d+){3}$/.test(host))return false;
  return true;
 }catch{return false}
}
export function newSourceId(name,url){
 const text=String(name||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,12)||'vod';
 // Stable short non-cryptographic hash for unique identifiers; DB dedupes URL.
 let h=2166136261;for(let c of url){h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;}
 return `s-${text}-${h.toString(36)}`.slice(0,48);
}
export function normalizeSource(input){
 const name=cleanText(input?.name,64),url=String(input?.url||'').trim();
 if(!name||name.length>64)throw Error('请输入有效的影视源名称');
 if(url.length>700||!validSourceURL(url))throw Error('接口 URL 必须是有效的公网 HTTPS 域名，不能使用 IP、本地网络、端口或嵌入账号信息');
 return {id:newSourceId(name,url),name,url};
}
/** Only use these URLs as administrator-reviewed configuration entrypoints. HTTP is
 * accepted for the supplied legacy lists, never for active Apple CMS sources. */
export function validFeedURL(value){
 try{
  const u=new URL(String(value||''));
  if(!['http:','https:'].includes(u.protocol)||!validHTTP(u.href)||u.port||u.username||u.password)return false;
  const h=u.hostname.toLowerCase();
  if(!/^[a-z0-9.-]+$/.test(h)||!h.includes('.')||/^\d+(?:\.\d+){3}$/.test(h))return false;
  if(h==='localhost'||['.local','.internal','.test','.example','.invalid','.localhost'].some(s=>h.endsWith(s)))return false;
  return true;
 }catch{return false}
}
/** Strip JSON line/block comments and trailing commas without ever executing code.
 * Ignore comment markers and commas inside quoted strings. */
export function sanitizeTVBoxJSON(text){
 let result='',inString=false,escaped=false,comment='';
 for(let i=0;i<text.length;i++){
  let c=text[i],n=text[i+1];
  if(comment==='line'){if(c==='\n'||c==='\r'){result+=c;comment=''}continue}
  if(comment==='block'){if(c==='*'&&n==='/'){i++;comment=''}else if(c==='\n')result+='\n';continue}
  if(inString){result+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue}
  if(c==='"'){inString=true;result+=c;continue}
  if(c==='/'&&n==='/'){comment='line';i++;continue}
  if(c==='/'&&n==='*'){comment='block';i++;continue}
  result+=c;
 }
 let cleaned='',inside=false,backslash=false;
 for(let i=0;i<result.length;i++){
  const c=result[i];
  if(inside){cleaned+=c;if(backslash)backslash=false;else if(c==='\\')backslash=true;else if(c==='"')inside=false;continue}
  if(c==='"'){inside=true;cleaned+=c;continue}
  if(c===','){
   let j=i+1;while(j<result.length&&/\s/.test(result[j]))j++;
   if(result[j]===']'||result[j]==='}')continue;
  }
  cleaned+=c;
 }
 return cleaned;
}
export function parseTVBox(data){
 if(typeof data==='string'){
  if(data.length>1_000_000)throw Error('配置文件过大');
  let text=data.replace(/^\uFEFF/,'').trim();
  if(/^(?:<\!doctype|<html|<head|<body)/i.test(text))throw Error('该地址返回的是网页，不是可直接导入的 TVBox JSON 配置');
  try{data=JSON.parse(text)}catch{
   try{data=JSON.parse(sanitizeTVBoxJSON(text))}
   catch{throw Error('没有解析出 TVBox JSON（可能是加密配置、非 JSON 或其他格式，暂不自动解密执行）')}
  }
 }
 if(data&&typeof data==='object'&&!Array.isArray(data.sites)&&Array.isArray(data.urls))throw Error('这是 TVBox 多仓入口，仅含子配置 URL；请打开具体子仓地址后单独导入');
 if(!data||typeof data!=='object'||!Array.isArray(data.sites))throw Error('未识别 TVBox sites 数组，暂不支持多仓/加密配置');
 let skipped={spider:0,notSearchable:0,invalid:0,duplicate:0,limit:0,http:0,incompatible:0};let out=[],pendingHTTPS=[],seen=new Set();
 for(const site of data.sites.slice(0,1000)){
  if(!site||typeof site!=='object'){skipped.invalid++;continue;}
  const api=String(site.api||'').trim();
  const direct=Number(site.type)===1||(site.type==null&&/api\.php\/provide\/vod/i.test(api));
  if(!direct||/\.(?:js|jar)(?:[?#]|$)/i.test(api)||/^(?:csp_|clan:)/i.test(api)){skipped.spider++;continue;}
  if(site.searchable===0||site.searchable==='0'){skipped.notSearchable++;continue;}
  try{
   const isHTTP=api.startsWith('http:');
   const secureURL=isHTTP?api.replace(/^http:/,'https:'):api;
   if(isHTTP&&!validFeedURL(api))throw Error('无效 HTTP 地址');
   const item=normalizeSource({name:site.name||site.key||'TVBox影视源',url:secureURL});
   if(seen.has(item.url)){skipped.duplicate++;continue;}
   seen.add(item.url);
   if(isHTTP){
    if(pendingHTTPS.length>=16){skipped.limit++;continue;}
    pendingHTTPS.push({...item,originalUrl:api});skipped.http++;continue;
   }
   if(out.length>=60){skipped.limit++;continue;}
   out.push({...item,origin:'tvbox'});
  }catch{skipped.invalid++}
 }
 return {candidates:out,pendingHTTPS,skipped,totalSites:data.sites.length,note:'提取 type:1 的公网 HTTPS Apple CMS JSON 候选接口。HTTP 地址需要通过对应 HTTPS 搜索检测；Spider 和脚本不执行。接口检测与影片播放验证分别记录。'};
}
/** Check the search response only; this does not verify playback or content rights. */
export async function probeSource(source){
 const start=Date.now();
 try{
  if(!validSourceURL(source.url))throw Error('拒绝请求非公网 HTTPS 地址');
  const u=cmsSearchUrl(source,'测试',1);
  if(isDemoAPI(u))return {ok:true,ms:Date.now()-start,count:demoCMS(u).list.length,scope:'internal-adapter'};
  const response=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{accept:'application/json'}});
  if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status)}
  const text=await readText(response,350000);
  if(/^\s*(?:<\?xml|<rss\b)/i.test(text))throw Error('返回 XML；当前接入要求 Apple CMS JSON');
  if(text.trim()==='暂不支持搜索')throw Error('上游接口返回：暂不支持搜索');
  let data;try{data=JSON.parse(text)}catch{throw Error('返回内容不是有效的 Apple CMS JSON')}
  const list=Array.isArray(data?.list)?data.list:data?.data?.list;
  if(!Array.isArray(list))throw Error(cleanText(data?.msg,150)||'未返回 Apple CMS list 数组');
  if(list.some(x=>!x||typeof x!=='object'||x.vod_id==null||!cleanText(x.vod_name,140)))throw Error('搜索结果缺少 vod_id 或 vod_name');
  return {ok:true,ms:Date.now()-start,count:list.length,scope:'search-json'};
 }catch(e){return {ok:false,ms:Date.now()-start,error:String(e.message||e).slice(0,150)}}
}
/** Upgrade public HTTP candidates only after testing the exact HTTPS endpoint.
 * A maximum of 16 bounded probes stays within the Workers Free subrequest limit. */
export async function resolveTVBox(data){
 const result=parseTVBox(data),pending=result.pendingHTTPS;delete result.pendingHTTPS;
 const checks=new Array(pending.length);let next=0;
 async function run(){while(next<pending.length){
  const index=next++,item=pending[index],health=await probeSource(item);
  checks[index]={name:item.name,originalUrl:item.originalUrl,url:item.url,...health};
 }}
 await Promise.all(Array.from({length:Math.min(3,pending.length)},run));
 for(let i=0;i<pending.length;i++){
  result.skipped.http--;
  if(!checks[i].ok){result.skipped.incompatible++;continue;}
  if(result.candidates.length>=60){result.skipped.limit++;continue;}
  result.candidates.push({...pending[i],origin:'tvbox',transportUpgraded:true,verification:'search-json'});
 }
 result.checks=checks;
 return result;
}
function looksBinary(bytes){
 // Standard JPEG, PNG and WebP signatures; disguised JSON with *.jpg names still works.
 return (bytes[0]===0xff&&bytes[1]===0xd8)||
 (bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)||
 (String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP');
}
/** Limit actual bytes read: server can lie about Content-Length. */
async function boundedText(response,maxBytes=1_000_000){
 if(Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel();throw Error('配置文件超过 1MB')}
 if(!response.body){const x=await response.arrayBuffer();if(x.byteLength>maxBytes)throw Error('配置文件超过 1MB');return new Uint8Array(x)}
 const reader=response.body.getReader();const chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw Error('配置文件超过 1MB');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 const buf=new Uint8Array(total);let cursor=0;for(const chunk of chunks){buf.set(chunk,cursor);cursor+=chunk.byteLength}return buf;
}
export async function fetchTVBoxJSON(url){
 if(!validFeedURL(url))throw Error('配置地址必须是公网 HTTP/HTTPS 域名，不允许本地网络、IP 或指定端口');
 let current=url;
 for(let i=0;i<4;i++){
  const r=await fetch(current,{headers:{accept:'application/json,text/plain,*/*;q=0.5'},signal:AbortSignal.timeout(8500),redirect:'manual'});
  if([301,302,303,307,308].includes(r.status)){
   const target=r.headers.get('location');if(!target)throw Error('服务端重定向没有目标地址');
   const next=new URL(target,current).href;
   if(!validFeedURL(next))throw Error('重定向指向不安全的地址');
   current=next;await r.body?.cancel();continue;
  }
  if(!r.ok){await r.body?.cancel();throw Error('配置下载失败：HTTP '+r.status)}
  const bytes=await boundedText(r);
  if(looksBinary(bytes))throw Error('该地址返回真实图片文件（JPEG/PNG/WebP），不是可解析 JSON；可能需要专用 TVBox 解析器');
  return resolveTVBox(new TextDecoder('utf-8').decode(bytes));
 }
 throw Error('配置地址重定向次数过多');
}
