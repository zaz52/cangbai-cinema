import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'https://weiyi.indevs.in';
const checks=[];
async function get(path){const start=Date.now();try{const u=new URL(path,base);u.searchParams.set('_check',String(Date.now()));const r=await fetch(u,{signal:AbortSignal.timeout(20000),cache:'no-store'});const type=r.headers.get('content-type');const body=type?.includes('application/json')?await r.json():null;checks.push({path,status:r.status,ms:Date.now()-start});return body}catch(error){checks.push({path,error:error.message});return null}}
await get('/');await get('/admin.html');await get('/copyright.html');
const health=await get('/api/health'),session=await get('/api/admin/session'),site=await get('/api/site-config');
const discovery=await get('/api/discover');
const query=process.argv[3]||discovery?.results?.find(x=>x.kind==='movie')?.title||'水饺皇后';
const search=await get('/api/search?q='+encodeURIComponent(query));
const candidates=[];
for(const item of (search?.results||[]).slice(0,8)){
 const detail=await get('/api/detail?id='+encodeURIComponent(item.id));
 if(detail?.videos?.length){candidates.push({id:item.id,title:detail.title,candidateCount:detail.videos.length});break}
}
const report={checkedAt:new Date().toISOString(),base,checks,health,adminConfigured:session?.configured,contactConfigured:!!site?.copyrightContactEmail,search:{query,results:search?.results?.length||0,sourceStatus:search?.sourceStatus},playbackCandidates:candidates,scope:'HTTP and metadata checks; video decoding requires a browser test'};
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/online.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
