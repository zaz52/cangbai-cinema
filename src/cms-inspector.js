import {validFeedURL,validSourceURL} from './tvbox.js';
import {cmsSearchUrl,cmsDetailUrl,parseCmsPlay,cleanText,safeQuery} from './providers.js';
import {readText} from './http.js';

export function normalizeCMSAddress(value){
 const original=String(value||'').trim();
 if(original.length>700||!validFeedURL(original))throw Error('请输入有效的公网 HTTP/HTTPS 采集接口地址');
 const url=new URL(original),changes=[];
 if(url.protocol==='http:'){url.protocol='https:';changes.push('HTTP → HTTPS')}
 if(/\/at\/xml(?:\/|$)/i.test(url.pathname)){url.pathname=url.pathname.replace(/\/at\/xml(?=\/|$)/ig,'/at/json');changes.push('XML → JSON')}
 if(url.searchParams.get('at')?.toLowerCase()==='xml'){url.searchParams.set('at','json');changes.push('XML → JSON')}
 for(const key of ['ac','wd','pg','ids'])url.searchParams.delete(key);
 url.hash='';
 if(!validSourceURL(url.href))throw Error('转换后的接口需要使用公网 HTTPS 域名');
 if(url.searchParams.has('url')||/\/(?:player|jiexi)(?:\/|$)/i.test(url.pathname))throw Error('这是网页解析器地址，请填写影视采集 API');
 return {originalUrl:original,url:url.href,changes:[...new Set(changes)]};
}
export function cmsIdentity(value){
 const url=new URL(value);url.pathname=url.pathname.replace(/\/at\/(?:json|xml)\/?$/i,'').replace(/\/+$/,'');
 if(['json','xml'].includes(url.searchParams.get('at')?.toLowerCase()))url.searchParams.delete('at');
 for(const key of ['ac','wd','pg','ids'])url.searchParams.delete(key);
 url.searchParams.sort();url.hash='';return url.href;
}
async function cmsJSON(url){
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{accept:'application/json'}});
 if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status)}
 const text=await readText(response,700000);if(/^\s*(?:<\?xml|<rss\b)/i.test(text))throw Error('接口仍返回 XML，请使用上游提供的 JSON 地址');
 let data;try{data=JSON.parse(text)}catch{throw Error('接口返回的内容无法解析为 JSON')}
 const list=Array.isArray(data?.list)?data.list:data?.data?.list;if(!Array.isArray(list))throw Error(cleanText(data?.msg,140)||'未识别 Apple CMS list 数组');
 return list;
}
export async function inspectCMS(input){
 const normalized=normalizeCMSAddress(input.url),name=cleanText(input.name,64)||new URL(normalized.url).hostname;
 const source={id:'inspection',name,url:normalized.url},query=safeQuery(input.query||'水饺皇后');
 if(!query)throw Error('请输入有效的测试片名');
 const result={...normalized,suggestedName:name,query,compatible:false,search:{ok:false},detail:{checked:false},playback:{verified:false,directCandidates:0,scope:'url-structure-only'}};
 const start=Date.now();
 try{
  const list=await cmsJSON(cmsSearchUrl(source,query,1));
  if(list.some(x=>!x||x.vod_id==null||String(x.vod_id).length>120||!cleanText(x.vod_name,140)))throw Error('搜索结果缺少有效的 vod_id 或 vod_name');
  result.compatible=true;result.search={ok:true,count:list.length,ms:Date.now()-start};
  if(!list.length){result.detail.message='该片名没有搜索结果，可换一个片名重新检测';return result}
  const sample=list[0];
  try{
   const details=await cmsJSON(cmsDetailUrl(source,sample.vod_id)),movie=details.find(x=>String(x.vod_id)===String(sample.vod_id));
   if(!movie)throw Error('详情没有返回对应影片');
   const videos=parseCmsPlay(movie,source),raw=String(movie.vod_play_url||'').split('$$$').flatMap(x=>x.split('#')).filter(Boolean);
   result.detail={checked:true,ok:true,title:cleanText(movie.vod_name,140)};
   result.playback={verified:false,scope:'url-structure-only',directCandidates:videos.length,formats:[...new Set(videos.map(x=>x.format))],lines:cleanText(movie.vod_play_from,500).split('$$$').filter(Boolean).slice(0,20),otherCandidates:Math.max(0,raw.length-videos.length)};
  }catch(error){result.detail={checked:true,ok:false,error:String(error.message||error).slice(0,180)}}
 }catch(error){result.search={ok:false,error:String(error.message||error).slice(0,180),ms:Date.now()-start}}
 return result;
}
