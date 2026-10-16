from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]/'public'
html=(root/'admin.html').read_text(encoding='utf8').replace('<link rel="stylesheet" href="./admin.css">','').replace('<script src="./admin.js" defer></script>','')
feeds=[
 dict(id='sun',name='太阳配置 sun.json',url='https://9877.kstore.space/sun.json',last_status='pending',last_checked_at=None,last_error=None,last_candidate_count=None),
 dict(id='easydc',name='EasyDC 图片扩展配置',url='https://easyzz.dpdns.org/easydc.jpg',last_status='compatible',last_checked_at='2026-10-16 09:00:00',last_error=None,last_candidate_count=2),
 dict(id='fantaiying',name='饭太硬 TVBox 入口',url='http://www.饭太硬.cc/tv',last_status='failed',last_checked_at='2026-10-16 09:00:00',last_error='返回的是 HTML 导航页',last_candidate_count=None),
 dict(id='tvbox-site',name='TVBox 配置入口',url='http://tvbox.xn--4kq62z5rby2qupq9ub.top/',last_status='pending',last_checked_at=None,last_error=None,last_candidate_count=None),
 dict(id='hajimi',name='哈基米 图片扩展配置',url='https://17264.kstore.space/哈基米.png',last_status='pending',last_checked_at=None,last_error=None,last_candidate_count=None),
 dict(id='feimao',name='肥猫 TVBox 入口',url='http://肥猫.net',last_status='pending',last_checked_at=None,last_error=None,last_candidate_count=None),
 dict(id='xc',name='XC GitHub 配置（代理）',url='https://gh-proxy.com/https://raw.githubusercontent.com/yoursmile66/TVBox/main/XC.json',last_status='unsupported',last_checked_at='2026-10-16 09:00:00',last_error='未识别 TVBox JSON',last_candidate_count=0),
 dict(id='catvod-demo',name='CatVodSpider 示例配置（代理）',url='https://gh-proxy.com/https://raw.githubusercontent.com/ggrrttyyiii/CatVodSpider/refs/heads/main/json/demo.json',last_status='pending',last_checked_at=None,last_error=None,last_candidate_count=None),
 dict(id='aowu',name='嗷呜 WebP 扩展配置',url='http://itv666.cc/aowu/config.webp',last_status='pending',last_checked_at=None,last_error=None,last_candidate_count=None),
 dict(id='easytv',name='EasyTV 图片扩展配置',url='https://easyzz.dpdns.org/easytv.jpg',last_status='pending',last_checked_at=None,last_error=None,last_candidate_count=None),
]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1420,'height':920},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'admin.css').read_text(encoding='utf8'))
 page.evaluate('''(feeds) => {
 const asJson=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
 window.fetch=async(url,opts={})=>{
   const path=String(url);
   if(path==='/api/admin/session')return asJson({configured:true,dbReady:true,authenticated:true});
   if(path==='/api/admin/sources')return asJson({sources:[{id:'s-test',name:'演示：独立影像库',url:'https://example.org/api.php/provide/vod',enabled:1,rights_confirmed:1,origin:'manual',last_status:'healthy',last_latency_ms:220}]});
   if(path==='/api/admin/feeds')return asJson({feeds});
   if(path.endsWith('/preview'))return asJson({status:'compatible',totalSites:3,skipped:{spider:1},candidates:[{name:'示例授权 API',url:'https://media.example.org/api.php/provide/vod'}]});
   if(path==='/api/admin/import/confirm')return asJson({imported:1,failed:0});
   return asJson({error:'离线预览未实现此操作'},400);
 }
}''',feeds)
 page.add_script_tag(content=(root/'admin.js').read_text(encoding='utf8'))
 page.locator('.feed-card').first.wait_for()
 assert page.locator('.feed-card').count()==10
 assert page.locator('.source-row').count()==1
 assert page.locator('#feedCount').inner_text()=='10'
 assert not errors,errors
 page.screenshot(path='/mnt/data/松柏-v0.6-十条配置后台.png',full_page=True)
 page.locator('.feed-card').first.get_by_text('检测并预览接口').click()
 page.locator('.candidate').first.wait_for()
 assert page.locator('.candidate').count()==1
 page.screenshot(path='/mnt/data/松柏-v0.6-接口解析预览.png',full_page=False)
 page.locator('#closeSheet').click()
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path='/mnt/data/松柏-v0.6-配置库手机端.png',full_page=True)
 assert not errors,errors
 print('PASS browser smoke: 10 seeded feed cards, preview flow and mobile layout, no JS errors')
 browser.close()
