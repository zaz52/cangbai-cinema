import {test,expect} from '@playwright/test';
test('mixed HTTP TVBox feed shows verified HTTPS candidates and per-source reasons without importing',async({page,request})=>{
 await request.post('/__fixture/reset');
 await page.goto('/admin.html');await page.locator('#password').fill('local-fixture-password-only');await page.locator('#loginForm button').click();
 await expect(page.locator('#dashboard')).toBeVisible();await page.locator('#openImport').click();
 await page.locator('#importUrl').fill('https://tvbox-fixture.example.org/config');await page.locator('#doPreview').click();
 await expect(page.locator('[data-candidate]')).toHaveCount(1);
 await expect(page.locator('#importPreview')).toContainText('配置中发现 3 项');
 await expect(page.locator('#importPreview')).toContainText('接口不兼容: 2');
 await expect(page.locator('#importPreview')).toContainText('已转换 HTTPS，并通过搜索 JSON 检测');
 await expect(page.locator('#importPreview details')).toContainText('返回 XML');
 await expect(page.locator('#importPreview details')).toContainText('暂不支持搜索');
 expect(await page.locator('[data-candidate]').isChecked()).toBe(false);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.locator('#closeSheet').click();await expect(page.locator('.source-row')).toHaveCount(0);
});
