import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const base='https://weiyi.indevs.in';
const credential=await readFile(new URL('../../管理员登录信息.txt',import.meta.url),'utf8');
const password=/管理员密码：([^\r\n]+)/.exec(credential)?.[1];
if(!password)throw Error('找不到独立的管理员凭据文件');
const proxy=process.env.HTTPS_PROXY||process.env.https_proxy;
const browser=await chromium.launch({headless:true,channel:'chromium',...(proxy?{proxy:{server:proxy}}:{})});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
const report={base,checkedAt:new Date().toISOString(),checks:[],errors:[]};
page.on('pageerror',error=>report.errors.push(error.message));
try{
 await page.goto(base+'/admin.html',{waitUntil:'domcontentloaded'});
 await page.locator('#password').fill(password);await page.locator('#loginForm button').click();
 await page.waitForSelector('#dashboard',{state:'visible'});report.checks.push({name:'production-admin-login',ok:true});
 await page.waitForSelector('.feed-card');report.checks.push({name:'ten-feeds',count:await page.locator('.feed-card').count()});
 // Read and persist real edge feed inspection results without importing candidates.
 if(process.argv.includes('--inspect-feeds'))await page.locator('#testAllFeeds').click();
 await page.waitForFunction(()=>!document.querySelector('#testAllFeeds').disabled,undefined,{timeout:120000});
 const feeds=await page.evaluate(async()=>await (await fetch('/api/admin/feeds')).json());
 report.feeds=feeds.feeds.map(x=>({id:x.id,status:x.last_status,candidates:x.last_candidate_count,error:x.last_error}));
 await page.screenshot({path:'reports/online-admin.png',fullPage:true});
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.locator('#globalSearch').fill('大雄兔');
 await page.waitForFunction(()=>[...document.querySelectorAll('.poster-art')].some(x=>x.dataset.id.startsWith('cms:')),undefined,{timeout:30000});
 report.checks.push({name:'production-search',ok:true,cards:await page.locator('.poster-card').count()});
 await page.locator('.poster-art[data-id^="cms:"]').click();
 await page.waitForSelector('.detail-info');
 await page.locator('.detail-info [data-action="play"]').first().click();
 try{await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0.5,undefined,{timeout:45000});report.checks.push({name:'production-media-playback',ok:true,...await page.locator('video').evaluate(el=>({currentTime:el.currentTime,currentSrc:el.currentSrc,readyState:el.readyState}))})}
 catch(error){report.checks.push({name:'production-media-playback',ok:false,error:error.message,video:await page.locator('video').evaluate(el=>({currentTime:el.currentTime,currentSrc:el.currentSrc,error:el.error?.message}))})}
 await page.screenshot({path:'reports/online-player.png'});
 if(process.argv.includes('--check-continuous')){
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>18,undefined,{timeout:25000});
  report.checks.push({name:'production-continuous-play-past-startup-timeout',ok:true,currentTime:await page.locator('video').evaluate(el=>el.currentTime)});
 }
 await page.keyboard.press('Escape');
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});report.checks.push({name:'production-layout',width,ok:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)});await page.screenshot({path:`reports/online-home-${width}.png`,fullPage:true})}
 await page.goto(base+'/copyright.html');report.checks.push({name:'production-contact',ok:(await page.locator('a[href^="mailto:"]').getAttribute('href')).startsWith('mailto:1845779520@qq.com')});
 await page.goto(base+'/admin.html');await page.locator('#logout').click();await page.waitForSelector('#login',{state:'visible'});report.checks.push({name:'production-admin-logout',ok:true});
}catch(error){report.errors.push(error.message);process.exitCode=1}
finally{await writeFile(new URL('../reports/browser-online.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report,null,2))}
