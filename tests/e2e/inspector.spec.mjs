import {test,expect} from '@playwright/test';
test('branded admin converts collector addresses, previews read-only and prefills a disabled source',async({page,request})=>{
 await request.post('/__fixture/reset');await page.goto('/admin.html');await expect(page).toHaveTitle(/苍柏 CINEMA/);await page.locator('#password').fill('local-fixture-password-only');await page.locator('#loginForm button').click();await expect(page.locator('#dashboard')).toBeVisible();
 await page.locator('#openInspect').click();await page.locator('#inspectName').fill('授权接口测试');await page.locator('#inspectUrl').fill('http://owned-inspect.example.org/api.php/provide/vod/from/fixture/at/xml/?source=7');await page.locator('#inspectRun').click();
 await expect(page.locator('#inspectResult')).toContainText('搜索通过');await expect(page.locator('#inspectResult')).toContainText('HTTP → HTTPS');await expect(page.locator('#inspectResult')).toContainText('XML → JSON');await expect(page.locator('#inspectResult')).toContainText('实际播放尚未验证');
 await expect(page.locator('.source-row')).toHaveCount(0);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.locator('#applyInspected').click();await expect(page.locator('#addUrl')).toHaveValue('https://owned-inspect.example.org/api.php/provide/vod/from/fixture/at/json/?source=7');await expect(page.locator('#addName')).toHaveValue('授权接口测试');await expect(page.locator('#addRights')).not.toBeChecked();
 await page.locator('#addRights').check();await page.locator('#sourceForm [type="submit"]').click();await expect(page.locator('.source-row')).toHaveCount(1);await expect(page.locator('.toggle.on')).toHaveCount(0);
 await page.locator('#openInspect').click();await page.locator('#inspectUrl').fill('https://owned-inspect.example.org/api.php/provide/vod/from/fixture?source=7');await page.locator('#inspectRun').click();await expect(page.locator('#inspectResult')).toContainText('后台已有此接口');await expect(page.locator('#applyInspected')).toContainText('编辑已有接口');
 await page.goto('/');await expect(page).toHaveTitle(/苍柏 CINEMA/);await expect(page.locator('.brand-text')).toContainText('苍柏');
 await page.goto('/copyright.html');await expect(page).toHaveTitle(/苍柏 CINEMA/);
});
