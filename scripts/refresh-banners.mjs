import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {BANNER_PAGE,parseBannerPage} from '../src/banner-art.js';

// Read source dimensions without decoding, resampling or altering image bytes.
export function imageDimensions(buffer){
 if(buffer.length<30)throw Error('Image header truncated');
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),extension:'png'};
 if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'){
  const format=buffer.toString('ascii',12,16);
  if(format==='VP8X')return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3),extension:'webp'};
  if(format==='VP8 ')return {width:buffer.readUInt16LE(26)&0x3fff,height:buffer.readUInt16LE(28)&0x3fff,extension:'webp'};
  if(format==='VP8L'){const bits=buffer.readUInt32LE(21);return {width:1+(bits&0x3fff),height:1+((bits>>>14)&0x3fff),extension:'webp'}}
 }
 if(buffer[0]===0xff&&buffer[1]===0xd8){
  let offset=2;while(offset+9<buffer.length){if(buffer[offset]!==0xff)break;const marker=buffer[offset+1],length=buffer.readUInt16BE(offset+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {width:buffer.readUInt16BE(offset+7),height:buffer.readUInt16BE(offset+5),extension:'jpg'};if(length<2)break;offset+=2+length}
 }
 throw Error('Unsupported image format');
}
async function download(url){const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5000000)throw Error('Image exceeds 5 MB');return bytes}
export async function refreshBanners(){
 const root=new URL('../public/',import.meta.url),html=(await download(BANNER_PAGE)).toString('utf8'),rows=parseBannerPage(html),items=[],errors=[];
 await mkdir(new URL('assets/banners/',root),{recursive:true});
 for(const row of rows){
  try{const bytes=await download(row.image),size=imageDimensions(bytes);if(size.width<1280||size.width/size.height<1.5)throw Error('Landscape resolution too small');const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16),image='/assets/banners/'+hash+'.'+size.extension;await writeFile(new URL(image.slice(1),root),bytes);items.push({...row,image,...size,bytes:bytes.length})}catch(error){errors.push({title:row.title,error:error.message})}
 }
 if(!items.length)throw Error('No valid landscape banners: '+JSON.stringify(errors));
 let prior;try{prior=JSON.parse(await readFile(new URL('data/banners.json',root),'utf8'))}catch{}
 const changed=JSON.stringify(prior?.items)!==JSON.stringify(items),manifest={source:BANNER_PAGE,updatedAt:changed?new Date().toISOString():prior.updatedAt,items};
 await writeFile(new URL('data/banners.json',root),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({changed,items:items.map(x=>({title:x.title,width:x.width,height:x.height,bytes:x.bytes})),errors},null,2));
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await refreshBanners();
