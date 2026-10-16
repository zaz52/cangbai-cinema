import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('HD movie failure automatically switches to a 正片 source without selecting another episode',async({page,request})=>{
 await request.post('/__fixture/reset');const media=[];
 await page.route('https://media-fixture.example.org/**',async route=>{
  const name=new URL(route.request().url()).pathname;media.push(name);
  if(name==='/valid.mp4')await route.fulfill({contentType:'video/mp4',body:readFileSync(new URL('../fixtures/sample.mp4',import.meta.url)),headers:{'access-control-allow-origin':'*'}});
  else await route.fulfill({status:404,body:'missing video'});
 });
 await page.goto('/admin.html');await page.locator('#password').fill('local-fixture-password-only');await page.locator('#loginForm button').click();await expect(page.locator('#dashboard')).toBeVisible();
 for(const [name,host] of [['高清源','owned-one'],['正片源','owned-two']]){
  await page.evaluate(async({name,host})=>{const response=await fetch('/api/admin/sources',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,url:`https://${host}.example.org/vod`,rightsConfirmed:true})});const {id}=await response.json();await fetch('/api/admin/sources/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})},{name,host});
 }
 await page.goto('/');await page.locator('#globalSearch').fill('电影换源测试');await expect(page.locator('.poster-card')).toHaveCount(1);await page.locator('.poster-art').first().click();
 await page.locator('.episode-btn').filter({hasText:'HD中字'}).first().click();
 await expect.poll(()=>page.locator('video').evaluate(v=>v.currentTime)).toBeGreaterThan(0.2);
 expect(await page.evaluate(()=>({candidates:state.modal.candidates.length,index:state.modal.index,tried:state.modal.tried.size}))).toEqual({candidates:2,index:1,tried:2});
 expect(media.filter(x=>x==='/broken.mp4')).toHaveLength(1);expect(media).not.toContain('/other.mp4');
});
