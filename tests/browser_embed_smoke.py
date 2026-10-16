from pathlib import Path
from playwright.sync_api import sync_playwright
import re, json, base64
root=Path(__file__).resolve().parents[1]/'public'
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
js=(root/'app.js').read_text()
assets=root/'assets'
# Inline local visual assets so offline browser tests do not depend on network.
for path in sorted(assets.glob('*.webp')):
 data='data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()
 css=css.replace('./assets/'+path.name,data)
 js=js.replace('./assets/'+path.name,data)
# JS dynamically constructs ./assets/poster-0N.webp; provide an embedded mapping in art function
posters={p.name:'data:image/webp;base64,'+base64.b64encode(p.read_bytes()).decode() for p in assets.glob('poster-*.webp')}
js=js.replace("const art=(n)=>`./assets/poster-${String(n).padStart(2,'0')}.webp`;",'const posters = '+json.dumps(posters)+';const art=(n)=>posters[`poster-${String(n).padStart(2,\'0\')}.webp`];')
js=js.replace("const imgHero=()=> './assets/hero.webp';","const imgHero=()=>'';")
mock="""
window.fetch=async function(req){
 let u=String(req);
 const response=(data)=>({ok:true,status:200,json:async()=>data});
 if(u.includes('/api/catalog'))return response({updatedAt:'2026-10-12',results:[{id:'site1',name:'示例资源导航站',url:'https://example.com',summary:'来自演示数据；仅为目录，不提供统一 API',category:'online_video',stars:5,status:'caution',checked:'2026-10-12',risk:'unknown',searchable:false,playable:false}]});
 if(u.includes('/api/detail')) return response({id:'demo-1',title:'开放影像演示作品',image:'',description:'这是一条用于验证 UI 的模拟视频元数据',sourceCount:2,videos:[{name:'正片',episodeKey:'movie',line:'演示线路 A',format:'MP4',url:'https://example.com/a.mp4'},{name:'正片',episodeKey:'movie',line:'演示线路 B',format:'MP4',url:'https://example.com/b.mp4'}]});
 return response({total:1,results:[{id:'demo-1',title:'开放影像演示作品',year:1950,type:'演示条目',image:'',source:'模拟接口',sourceIds:['demo-1'],sourceCount:2,description:'展示同名多源聚合的 UI。'}],sourceStatus:[{name:'Internet Archive',ok:true,results:1},{name:'模拟授权源',ok:true,results:1}]});
}
"""
html=html.replace('<link rel="stylesheet" href="./style.css" />','<style>'+css+'</style>').replace('<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js" defer></script>','').replace('<script src="./app.js" defer></script>','').replace('</body>','<script>'+mock+'</script><script>'+js+'</script></body>')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=browser.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.wait_for_timeout(300)
 print('Initial errors',errors,'visible',page.locator('main').inner_text()[:200])
 page.wait_for_selector('.poster-card',timeout=5000)
 print('Rendered cards',page.locator('.poster-card').count())
 page.screenshot(path='/mnt/data/松柏-v0.3-聚合搜索界面.png',full_page=True)
 page.locator('.poster-art').first.click(position={'x':65,'y':120})
 page.wait_for_selector('.detail-info')
 print('Details',page.locator('.detail-info h2').inner_text(),'Lines',page.locator('.episode-btn').count())
 page.locator('.detail-info [data-action="play"]').first.click()
 print('Video controls',page.locator('.real-player video').count())
 page.screenshot(path='/mnt/data/松柏-v0.3-播放换源窗口.png',full_page=False)
 page.keyboard.press('Escape')
 page.locator('[data-nav="影视源目录"]').first.click()
 page.wait_for_selector('.directory-card')
 print('Directory cards',page.locator('.directory-card').count())
 page.screenshot(path='/mnt/data/松柏-v0.3-影视源目录.png',full_page=True)
 print('Page errors',errors)
 assert not errors,errors
 browser.close()
# Offline interaction preview with explicitly labeled mock data
preview=html.replace('松柏 CINEMA · 发现下一部心动之作','松柏 CINEMA · v0.3 功能演示（模拟数据）')
Path('/mnt/data/松柏-CINEMA-v0.3-离线交互预览.html').write_text(preview)
