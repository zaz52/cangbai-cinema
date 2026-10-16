import {spawn} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const env={...process.env,USERPROFILE:process.platform==='win32'?'D:\\Codex':process.env.USERPROFILE,WRANGLER_SEND_METRICS:'false'};
if(process.platform==='win32'){env.APPDATA='E:\\AppDataRoaming';env.LOCALAPPDATA='E:\\AppData';env.XDG_CONFIG_HOME='D:\\Codex\\.config'}
const cli='node_modules/wrangler/bin/wrangler.js';
// Reuse the local test database after checking every migration's persisted record.
// This also keeps repeated runs independent of a completed CLI's open handles.
function migrated(){
 const directory='.wrangler/test-state/v3/d1/miniflare-D1DatabaseObject';
 if(!existsSync(directory))return false;
 const expected=readdirSync('migrations').filter(name=>name.endsWith('.sql'));
 return readdirSync(directory).filter(name=>name.endsWith('.sqlite')&&name!=='metadata.sqlite').some(name=>{
  let db;try{db=new DatabaseSync(directory+'/'+name,{readOnly:true});const names=new Set(db.prepare('SELECT name FROM d1_migrations').all().map(row=>row.name));return expected.every(value=>names.has(value))}catch{return false}finally{db?.close()}
 });
}
if(!migrated()){
 const migration=spawn(process.execPath,[cli,'d1','migrations','apply','songbai-test-db','--local','--config','wrangler.test.jsonc','--persist-to','.wrangler/test-state'],{stdio:'inherit',env});
 const code=await new Promise(resolve=>migration.on('exit',resolve));if(code!==0)process.exit(code||1);
}
const server=spawn(process.execPath,[cli,'dev','--config','wrangler.test.jsonc','--persist-to','.wrangler/test-state','--ip','127.0.0.1','--port','8791'],{stdio:'inherit',env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.kill());
server.on('exit',code=>process.exit(code||0));
