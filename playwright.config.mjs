import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',workers:1,timeout:60000,expect:{timeout:15000},
 use:{baseURL:'http://127.0.0.1:8791',headless:true,channel:'chromium'},
 reporter:[['list'],['json',{outputFile:'reports/browser.json'}]],
 webServer:{command:'node scripts/run-local-test.mjs',url:'http://127.0.0.1:8791/api/health',reuseExistingServer:false,timeout:180000}
});
