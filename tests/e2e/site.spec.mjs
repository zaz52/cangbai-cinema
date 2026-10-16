import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('real local Worker/D1 admin CRUD, search merge, media decode and finite fallback',async({page,context,request})=>{
 await request.post('/__fixture/reset');
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const requests=[];
 await page.route('https://media-fixture.example.org/**',async route=>{
  requests.push(route.request().url());
  if(route.request().url().endsWith('/valid.mp4'))await route.fulfill({contentType:'video/mp4',body:readFileSync(new URL('../fixtures/sample.mp4',import.meta.url)),headers:{'access-control-allow-origin':'*'}});
  else await route.fulfill({status:404,body:'fixture missing'});
 });
 await page.goto('/admin.html');await page.locator('#password').fill('local-fixture-password-only');await page.locator('#loginForm button').click();
 await expect(page.locator('#dashboard')).toBeVisible();await expect(page.locator('.feed-card')).toHaveCount(10);
 // API calls share the browser session and exercise real D1 writes.
 const api=async(path,method,data)=>page.evaluate(async({path,method,data})=>{const response=await fetch(path,{method,headers:{'content-type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:response.status,data:await response.json()}},{path,method,data});
 const ids=[];
 for(const [name,host] of [['测试甲','owned-one'],['测试乙','owned-two']]){
  const created=await api('/api/admin/sources','POST',{name,url:`https://${host}.example.org/api.php/provide/vod`,rightsConfirmed:true});
  expect(created.status).toBe(201);expect(created.data.health.ok).toBe(true);ids.push(created.data.id);
  expect((await api('/api/admin/sources/'+created.data.id,'PATCH',{enabled:true})).status).toBe(200);
 }
 await page.reload();await expect(page.locator('.source-row')).toHaveCount(2);
 await page.locator('#viewLogs').click();await expect(page.locator('#sheetBody')).toContainText('API 格式正常');await page.locator('#closeSheet').click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.goto('/');await page.locator('#globalSearch').fill('授权测试短片');
 await expect(page.locator('.section-title').first()).toContainText('授权测试短片');
 await expect(page.locator('.poster-card')).toHaveCount(1);
 await page.locator('.poster-art').first().click();await expect(page.locator('.detail-info')).toBeVisible();
 await page.locator('.episode-btn').filter({hasText:'测试甲'}).first().click();
 await expect.poll(()=>page.locator('video').evaluate(el=>el.currentSrc)).toContain('/valid.mp4');
 await page.locator('video').scrollIntoViewIfNeeded();
 try{await expect.poll(()=>page.locator('video').evaluate(el=>el.currentTime),{timeout:15000}).toBeGreaterThan(0.2)}catch(error){console.log(await page.locator('video').evaluate(el=>({currentTime:el.currentTime,duration:el.duration,paused:el.paused,readyState:el.readyState,error:el.error?.message,currentSrc:el.currentSrc})));throw error}
 expect(requests.some(x=>x.endsWith('/broken.mp4'))).toBe(true);expect(requests.some(x=>x.endsWith('/valid.mp4'))).toBe(true);
 expect(requests.some(x=>x.endsWith('/other.mp4'))).toBe(false);
 await page.screenshot({path:'reports/mobile-player.png'});
 await page.clock.install();await page.clock.fastForward(18000);
 expect(await page.locator('video').evaluate(el=>el.error)).toBeNull();
 await page.locator('[data-action="next-line"]').click();
 expect(requests.filter(x=>x.endsWith('/broken.mp4')).length).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('.overlay.open')).toHaveCount(0);
 await page.goto('/copyright.html');await expect(page.locator('a[href^="mailto:"]')).toBeVisible();
 await page.goto('/admin.html');
 await page.locator('.source-row').first().locator('[data-action="toggle"]').click();
 await expect(page.locator('.toggle.on')).toHaveCount(1);
 await page.locator('.source-row').first().locator('[data-action="edit"]').click();await page.locator('#addName').fill('已编辑');await page.locator('#sourceForm [type="submit"]').click();await expect(page.locator('#sourceList')).toContainText('已编辑');
 page.once('dialog',dialog=>dialog.accept());await page.locator('.source-row').first().locator('[data-action="delete"]').click();await expect(page.locator('.source-row')).toHaveCount(1);
 const savedCookies=await context.cookies();await page.locator('#logout').click();await expect(page.locator('#login')).toBeVisible();
 await context.addCookies(savedCookies);expect((await api('/api/admin/sources','GET')).status).toBe(401);
 expect(errors).toEqual([]);
});
test('30-source TVBox import is split into two D1-safe batches and stays disabled',async({page,request})=>{
 await request.post('/__fixture/reset');
 await page.goto('/admin.html');await page.locator('#password').fill('local-fixture-password-only');await page.locator('#loginForm button').click();
 await expect(page.locator('#dashboard')).toBeVisible();await page.locator('#openImport').click();await page.locator('#modeJson').click();
 const config={sites:Array.from({length:30},(_,index)=>({name:'授权批量 '+index,type:1,api:'https://owned-one.example.org/api.php/provide/vod?entry='+index}))};
 await page.locator('#importRaw').fill(JSON.stringify(config));await page.locator('#doPreview').click();
 await expect(page.locator('[data-candidate]')).toHaveCount(30);
 for(const checkbox of await page.locator('[data-candidate]').all())await checkbox.check();
 await page.locator('#importRights').check();const batches=[];
 page.on('request',req=>{if(req.url().endsWith('/api/admin/import/confirm'))batches.push(req.postDataJSON().sources.length)});
 await page.locator('#confirmImport').click();await expect(page.locator('.source-row')).toHaveCount(30);
 expect(batches).toEqual([15,15]);await expect(page.locator('.toggle.on')).toHaveCount(0);
});
