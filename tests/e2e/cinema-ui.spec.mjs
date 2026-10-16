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
