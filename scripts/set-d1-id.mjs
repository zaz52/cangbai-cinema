import fs from 'node:fs';
const id=process.argv[2];
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){
 console.error('请提供 wrangler d1 create 命令输出的有效 database_id UUID。');
 process.exit(1);
}
const url=new URL('../wrangler.jsonc',import.meta.url);
const config=JSON.parse(fs.readFileSync(url,'utf8'));
if(!Array.isArray(config.d1_databases)||!config.d1_databases.length)throw Error('wrangler 缺少 D1 配置');
config.d1_databases[0].database_id=id;
fs.writeFileSync(url,JSON.stringify(config,null,2)+'\n');
console.log('已将 D1 ID 写入 wrangler.jsonc。');
