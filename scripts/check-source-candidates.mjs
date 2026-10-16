import {readFile,writeFile} from 'node:fs/promises';
import {probeSource} from '../src/admin-api.js';
const report=JSON.parse(await readFile(new URL('../reports/feeds-live.json',import.meta.url),'utf8'));
const candidates=[...new Map(report.rows.flatMap(x=>x.candidates||[]).map(x=>[x.url,x])).values()];
let index=0;const results=[];
await Promise.all(Array.from({length:2},async()=>{while(index<candidates.length){const source=candidates[index++];const result=await probeSource(source);results.push({id:source.id,name:source.name,url:source.url,...result,rights:'pending',playbackVerified:false});console.log(`${source.id}: API ${result.ok?'compatible':'failed'} (${result.ms} ms)`)}}));
await writeFile(new URL('../reports/candidate-api-live.json',import.meta.url),JSON.stringify({environment:'local Node.js network',checkedAt:new Date().toISOString(),results},null,2)+'\n');
