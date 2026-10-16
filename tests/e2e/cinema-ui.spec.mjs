import {test,expect} from '@playwright/test';

test('cinema portal supports hero selection, category navigation and responsive layouts',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://i0.hdslb.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#263d60"/></svg>'}));
 await page.goto('/');await expect(page.locator('.home-hot .discovery-card')).toHaveCount(12);
 await expect(page.locator('[data-home-kind="movie"] .discovery-card')).toHaveCount(6);
 await expect(page.locator('[data-home-kind="tv"] .discovery-card')).toHaveCount(6);
 await expect(page.locator('.hero-choice')).toHaveCount(6);
 await page.locator('.hero-choice').nth(1).click();await expect(page.locator('.hero-title')).toContainText('人气剧集0');await expect(page.locator('.hero-choice').nth(1)).toHaveAttribute('aria-pressed','true');
 await page.locator('.hero-buttons [data-query]').click();await expect(page.locator('#globalSearch')).toHaveValue('人气剧集0');await expect(page.locator('.hero')).toHaveCount(0);
 await page.locator('#topNav [data-browse-kind="movie"]').click();await expect(page.locator('.discovery-card')).toHaveCount(6);await expect(page.locator('#topNav [data-browse-kind="movie"]')).toHaveAttribute('aria-current','page');
 await page.locator('#brandHome').click();await expect(page.locator('.home-hot')).toBeVisible();await expect(page.locator('.hero-title')).toContainText(String(new Date().getFullYear()));
 for(const width of [1440,1024,768,750,390,320]){
  await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.poster-grid').first().evaluate(x=>getComputedStyle(x).gridTemplateColumns.split(' ').length)).toBe(width>1030?6:width>750?4:2);
  if(width===390){await page.locator('#mobileNav [data-browse-kind="tv"]').click();await expect(page.locator('.discovery-card')).toHaveCount(6);await page.locator('#mobileNav [data-nav="发现"]').click();await expect(page.locator('.home-hot')).toBeVisible();await page.screenshot({path:'reports/cinema-ui-local-mobile.png'})}
 }
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'reports/cinema-ui-local-desktop.png'});
 await page.mouse.move(2,2);await page.emulateMedia({reducedMotion:'no-preference'});const selected=await page.evaluate(()=>state.heroIndex);await page.clock.fastForward(7500);expect(await page.evaluate(()=>state.heroIndex)).toBe((selected+1)%6);
 await page.emulateMedia({reducedMotion:'reduce'});const frozen=await page.evaluate(()=>state.heroIndex);await page.clock.fastForward(7500);expect(await page.evaluate(()=>state.heroIndex)).toBe(frozen);
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#4388ff');
 expect(errors).toEqual([]);
});

test('missing posters retain titles and working search, with unavailable covers excluded from hero choices',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://i0.hdslb.com/**',route=>route.fulfill({status:404,body:'missing cover'}));
 await page.goto('/');await expect(page.locator('.home-hot .poster-art.no-cover').first()).toBeVisible();await expect(page.locator('.hero-choice')).toHaveCount(0);
 await expect(page.locator('.home-hot .poster-placeholder').first()).toContainText('人气电影0');await expect(page.locator('.home-hot .poster-placeholder').first()).toContainText('海报暂缺');
 await page.locator('.home-hot .poster-art').first().click();await expect(page.locator('#globalSearch')).toHaveValue('人气电影0');
 expect(errors).toEqual([]);
});

test('hero preserves small covers, accepts large landscapes and falls back when a banner fails',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://i0.hdslb.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"/>'}));
 await page.route('https://posters.example.org/banner.jpg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="700"/>'}));
 await page.route('https://posters.example.org/missing.jpg',route=>route.fulfill({status:404,body:'missing'}));
 await page.goto('/');await expect(page.locator('.hero-featured')).toHaveJSProperty('naturalWidth',200);
 expect(await page.locator('.hero-featured').evaluate(img=>img.width<=img.naturalWidth&&img.height<=img.naturalHeight)).toBe(true);
 await expect(page.locator('.hero')).toHaveAttribute('data-image-layout','poster');
 await page.evaluate(()=>{state.hotItems[0].backdrop='https://posters.example.org/banner.jpg';selectHero(0)});
 await expect(page.locator('.hero')).toHaveClass(/hero-wide/);await expect(page.locator('.hero-featured')).toHaveJSProperty('naturalWidth',1920);
 await page.evaluate(()=>{state.hotItems[0].backdrop='https://posters.example.org/missing.jpg';selectHero(0)});
 await expect(page.locator('.hero-featured')).toHaveJSProperty('naturalWidth',200);await expect(page.locator('.hero')).toHaveAttribute('data-image-layout','poster');
});

test('homepage genre and region links filter actual movie, TV, variety and anime metadata',async({page})=>{
 await page.route('**/api/discover',async route=>{const response=await route.fetch(),data=await response.json();const first=data.results[0];data.results=[
  {...first,id:'discover:movie:1',title:'动作电影',kind:'movie',genres:'动作,冒险',area:'中国大陆'},
  {...first,id:'discover:movie:2',title:'喜剧电影',kind:'movie',genres:'喜剧',area:'美国'},
  {...first,id:'discover:tv:1',title:'国产剧集',kind:'tv',category:'国产剧',area:'中国大陆'},
  {...first,id:'discover:tv:2',title:'港台剧集',kind:'tv',category:'香港剧',area:'中国香港'},
  {...first,id:'discover:variety:1',title:'日韩综艺',kind:'variety',category:'日韩综艺',area:'韩国'},
  {...first,id:'discover:anime:1',title:'国产动漫',kind:'anime',category:'国产动漫',area:'中国大陆'}
 ];await route.fulfill({json:data})});
 await page.goto('/');await expect(page.locator('.category-row')).toHaveCount(4);await expect(page.locator('[data-home-kind="anime"] .poster-card')).toHaveCount(1);await expect(page.locator('[data-home-kind="variety"] .poster-card')).toHaveCount(1);
 for(const [kind,facet,title] of [['movie','动作','动作电影'],['tv','国产剧','国产剧集'],['variety','日韩','日韩综艺'],['anime','国漫','国产动漫']]){
  await page.locator('.category-links [data-browse-kind="'+kind+'"][data-facet="'+facet+'"]').click();await expect(page.locator('.discovery-card')).toHaveCount(1);await expect(page.locator('.discovery-card')).toContainText(title);await expect(page.locator('.facet-filters .active')).toHaveText(facet);await page.locator('#brandHome').click();
 }
 await page.locator('.category-links [data-facet="恐怖"]').click();await expect(page.locator('.empty-state')).toContainText('当前分类暂无作品');
 await page.locator('[data-discover-facet=""]').click();await expect(page.locator('.discovery-card')).toHaveCount(2);
});
