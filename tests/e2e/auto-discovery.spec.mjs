import {test,expect} from '@playwright/test';
test('an open homepage refreshes new releases after its refresh deadline without a manual reload',async({page,request})=>{
 const initial=Date.now(),response=await request.get('/api/discover'),catalog=await response.json();let generation=1,requests=0;
 await page.clock.install({time:new Date(initial)});
 await page.route('https://i0.hdslb.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"/>'}));
 await page.route('**/api/discover',route=>{
  requests++;const updated=initial+(generation===1?0:61*60000);
  const result={...catalog,updatedAt:new Date(updated).toISOString(),nextRefreshAt:new Date(updated+3600000).toISOString(),results:catalog.results.map((x,i)=>i===0?{...x,title:'自动上新第'+generation+'批'}:x)};
  return route.fulfill({json:result});
 });
 await page.goto('/');await expect(page.locator('.story-strip')).toContainText('自动上新第1批');
 await expect(page.locator('.hero-title')).toContainText(String(catalog.year));
 generation=2;await page.clock.fastForward(61*60000);
 await expect(page.locator('.story-strip')).toContainText('自动上新第2批');expect(requests).toBe(2);
 await page.locator('[data-discover-filter="hot"]').click();await expect(page.locator('#popularFilms')).toContainText('热播推荐');await expect(page.locator('.discovery-card').first()).toContainText('人气电影0');
});
