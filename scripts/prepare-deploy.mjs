import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../wrangler.jsonc',import.meta.url);
const config=JSON.parse(readFileSync(path,'utf8'));
const id=process.env.D1_DATABASE_ID||config.d1_databases[0].database_id;
if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw Error('请设置真实的 D1_DATABASE_ID 或先运行 npm run db:set');
config.d1_databases[0].database_id=id;
const domain=process.env.CUSTOM_DOMAIN||config.routes?.[0]?.pattern?.replace(/\/\*$/,'');
if(domain){if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain))throw Error('CUSTOM_DOMAIN 格式无效');config.routes=[{pattern:domain+'/*',zone_name:process.env.CLOUDFLARE_ZONE_NAME||config.routes?.[0]?.zone_name||domain}]}
if(process.env.CLOUDFLARE_ACCOUNT_ID)config.account_id=process.env.CLOUDFLARE_ACCOUNT_ID;
writeFileSync(path,JSON.stringify(config,null,2)+'\n');
console.log('D1 与域名配置已验证。');
