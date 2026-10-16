// Local test entrypoint. Production uses src/index.js.
import worker from '../src/index.js';
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(url.hostname==='archive.org')return Response.json({response:{docs:[],numFound:0}});
 if(url.hostname==='owned-inspect.example.org')return Response.json({list:[{vod_id:10,vod_name:'授权接口样片',vod_play_from:'fixture',vod_play_url:'正片$https://media-fixture.example.org/valid.mp4'}]});
 if(url.hostname==='tvbox-fixture.example.org'){
  if(url.pathname==='/config')return Response.json({sites:[
   {name:'授权 JSON 源',type:1,api:'http://tvbox-fixture.example.org/vod?source=json'},
   {name:'XML 源',type:1,api:'http://tvbox-fixture.example.org/vod?source=xml'},
   {name:'不支持搜索源',type:1,api:'http://tvbox-fixture.example.org/vod?source=none'}
  ]});
  if(url.protocol!=='https:')throw Error('Fixture requires secure transport');
  if(url.searchParams.get('source')==='xml')return new Response('<?xml version="1.0"?><rss/>');
  if(url.searchParams.get('source')==='none')return new Response('暂不支持搜索');
  return Response.json({list:[{vod_id:1,vod_name:'测试影片'}]});
 }
 if(url.hostname==='api.bilibili.com'){
  const kind=(url.searchParams.get('season_type')==='2'?'movie':'tv');
  const hot=['2','3'].includes(url.searchParams.get('order'));
  return Response.json({code:0,data:{list:Array.from({length:6},(_,i)=>({season_id:(kind==='movie'?100:200)+(hot?1000:0)+i,title:(hot?(kind==='movie'?'人气电影':'人气剧集'):(kind==='movie'?'热门电影':'热播剧集'))+i,score:'8.5',cover:'https://i0.hdslb.com/bfs/bangumi/example.jpg',index_show:kind==='tv'?'更新至第06集':'',order:hot?'100万追剧':'今天更新',playable:true}))}});
 }
 if(url.hostname==='owned-one.example.org'||url.hostname==='owned-two.example.org'){
  const second=url.hostname==='owned-two.example.org';
  if(url.searchParams.get('wd')==='测试')return Response.json({list:[]});
  if(url.searchParams.get('wd')==='电影换源测试'||url.searchParams.get('ids')==='2')return Response.json({list:[{vod_id:2,vod_name:'电影换源测试',vod_year:'2026',vod_play_from:'fixture',vod_play_url:`${second?'正片':'HD中字'}$https://media-fixture.example.org/${second?'valid':'broken'}.mp4#第02集$https://media-fixture.example.org/other.mp4`}]});
  return Response.json({list:[{vod_id:1,vod_name:'授权测试短片',vod_year:'2026',vod_play_from:'fixture',vod_play_url:`第01集$https://media-fixture.example.org/${second?'valid':'broken'}.mp4#第02集$https://media-fixture.example.org/other.mp4`}]});
 }
 throw Error('Unexpected fixture network request: '+url.hostname);
};
export default {async fetch(req,env,ctx){
 if(new URL(req.url).pathname==='/__fixture/reset'&&req.method==='POST'){
  for(const table of ['video_sources','admin_sessions','login_attempts','source_events'])await env.DB.prepare('DELETE FROM '+table).run();
  return Response.json({ok:true});
 }
 return worker.fetch(req,env,ctx);
},scheduled:worker.scheduled};
