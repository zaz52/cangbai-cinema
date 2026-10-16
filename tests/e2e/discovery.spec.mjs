import {test,expect} from '@playwright/test';
test('home and blank search show popular titles; categories, favorite and actual source search work',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://i0.hdslb.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#2f464c"/></svg>'}));
 await page.goto('/');await expect(page.locator('.discovery-card')).toHaveCount(24);
 await expect(page.locator('#popularFilms')).toContainText('新片新剧');
 await expect(page.locator('.story-strip button.editorial-card')).toHaveCount(2);
 await expect(page.locator('.story-strip')).toContainText('热门电影0');await expect(page.locator('.story-strip')).toContainText('人气剧集0');
 await page.locator('[data-discover-filter="hot"]').click();await expect(page.locator('.discovery-card')).toHaveCount(12);await expect(page.locator('.discovery-card').first()).toContainText('人气电影0');
 await expect(page.locator('body')).not.toContainText('回到自然');await expect(page.locator('body')).not.toContainText('城市的旧时光');
 expect(await page.evaluate(()=>state.items.every(x=>x.discovery&&!x.playable))).toBe(true);
 await page.locator('[data-discover-filter="movie"]').click();await expect(page.locator('.discovery-card')).toHaveCount(6);
 await expect(page.locator('.discovery-card[data-kind="tv"]')).toHaveCount(0);
 await page.locator('[data-discover-filter="tv"]').click();await expect(page.locator('.discovery-card[data-kind="tv"]')).toHaveCount(6);
 await page.locator('.discovery-card .fav').first().click();
 await page.locator('[data-nav="我的收藏"]').first().click();await expect(page.locator('.discovery-card')).toHaveCount(1);
 await page.locator('[data-nav="聚合搜索"]').first().click();await expect(page.locator('#popularFilms')).toBeVisible();
 await page.locator('.discovery-card .poster-art').first().click();
 await expect(page.locator('#globalSearch')).toHaveValue('热播剧集0');await expect(page.locator('#popularFilms')).toHaveCount(0);
 await expect(page.locator('.section-title')).toContainText('热播剧集0');
 await page.locator('#globalSearch').fill('');await expect(page.locator('#popularFilms')).toBeVisible();
 await page.locator('[data-nav="发现"]').first().click();await expect(page.locator('.story-strip button[data-query="热门电影0"]')).toBeVisible();
 await page.locator('.story-strip button[data-query="热门电影0"]').click();await expect(page.locator('#globalSearch')).toHaveValue('热门电影0');await expect(page.locator('#popularFilms')).toHaveCount(0);
 await page.locator('#topNav [data-browse-kind="tv"]').click();await expect(page.locator('.discovery-card')).toHaveCount(6);await expect(page.locator('.discovery-card[data-kind="movie"]')).toHaveCount(0);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 expect(errors).toEqual([]);
});
test('old archive favorites are removed while current movie favorites remain',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('songbai-fav-v2',JSON.stringify({
  'old-film':{id:'old-film',title:'Old Archive Film',image:'https://archive.org/old.jpg'},
  'cms:owned-one:1':{id:'cms:owned-one:1',title:'保留的影视收藏',sourceIds:['cms:owned-one:1']}
 })));
 await page.goto('/');await page.locator('[data-nav="我的收藏"]').first().click();
 await expect(page.locator('.poster-card')).toHaveCount(1);await expect(page.locator('.poster-card')).toContainText('保留的影视收藏');
 expect(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('songbai-fav-v2'))))).toEqual(['cms:owned-one:1']);
});
