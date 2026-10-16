/** CC BY 3.0 film excerpt; attribution and license are included in metadata. */
export const OPEN_DEMO={
 vod_id:'bunny-trailer',vod_name:'大雄兔预告片 · Big Buck Bunny',vod_year:'2008',type_name:'开放授权演示',
 vod_pic:'',vod_content:'Big Buck Bunny 预告片。© 2008 Blender Foundation / www.bigbuckbunny.org。CC BY 3.0。原作许可：https://peach.blender.org/about/ 。视频文件由 W3C 公共媒体示例提供：https://media.w3.org/2010/05/bunny/trailer.mp4 。',
 vod_license:'https://creativecommons.org/licenses/by/3.0/',vod_creator:'Blender Foundation / www.bigbuckbunny.org',
 vod_play_from:'W3C MP4$$$W3C Ogg',
 vod_play_url:'正片$https://media.w3.org/2010/05/bunny/trailer.mp4$$$正片$https://media.w3.org/2010/05/bunny/trailer.ogv'
};
export function demoCMS(url){
 const id=url.searchParams.get('ids'),q=(url.searchParams.get('wd')||'').trim().toLowerCase();
 const matches=id?id===OPEN_DEMO.vod_id:!q||q==='demo'||q==='演示'||['大雄兔','big buck bunny','bunny','开放授权'].some(word=>word.includes(q)||q.includes(word));
 return {code:1,msg:'公开许可演示内容',page:1,pagecount:1,limit:1,total:matches?1:0,list:matches?[OPEN_DEMO]:[]};
}
export function isDemoAPI(value){try{const url=new URL(value);return url.origin==='https://weiyi.indevs.in'&&url.pathname==='/api/open-demo/vod'}catch{return false}}
