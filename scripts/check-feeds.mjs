import {mkdir,writeFile} from 'node:fs/promises';
import {DEFAULT_FEEDS} from '../src/default-feeds.js';
import {fetchTVBoxJSON} from '../src/tvbox.js';
const rows=[];
// Bounded independent downloads; configuration content is parsed as data.
let cursor=0;
await Promise.all(Array.from({length:2},async()=>{
 while(cursor<DEFAULT_FEEDS.length){
  const feed=DEFAULT_FEEDS[cursor++],start=Date.now();
  let row;
  try{const data=await fetchTVBoxJSON(feed.url);row={...feed,status:data.candidates.length?'compatible':'unsupported',totalSites:data.totalSites,candidates:data.candidates,skipped:data.skipped}}
  catch(error){row={...feed,status:'failed',error:error.message,candidates:[]}}
  row.checkedAt=new Date().toISOString();row.ms=Date.now()-start;
  row.rights='pending';row.playbackVerified=false;
  rows.push(row);console.log(`${feed.id}: ${row.status}; candidates=${row.candidates.length}; ${row.error||''}`);
 }
}));
rows.sort((a,b)=>DEFAULT_FEEDS.findIndex(x=>x.id===a.id)-DEFAULT_FEEDS.findIndex(x=>x.id===b.id));
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/feeds-live.json',import.meta.url),JSON.stringify({environment:'local Node.js network, not Cloudflare edge',checkedAt:new Date().toISOString(),rows},null,2)+'\n');
