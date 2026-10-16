from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os, threading
root=Path(__file__).resolve().parents[1]/'public'
os.chdir(root)
server=ThreadingHTTPServer(('127.0.0.1',8891),SimpleHTTPRequestHandler)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':940},device_scale_factor=1)
  errors=[];page.on('pageerror', lambda e:errors.append(str(e)))
  examples=[
   {'id':'s-one','name':'演示·正版电影库','url':'https://media.example.org/api.php/provide/vod','enabled':1,'rights_confirmed':1,'origin':'manual','last_status':'healthy','last_latency_ms':124,'last_error':None},
   {'id':'s-two','name':'演示·独立纪录片','url':'https://docs.example.org/api.php/provide/vod','enabled':1,'rights_confirmed':1,'origin':'tvbox','last_status':'healthy','last_latency_ms':322,'last_error':None},
   {'id':'s-three','name':'演示·待校验资源','url':'https://test.example.org/api.php/provide/vod','enabled':0,'rights_confirmed':1,'origin':'tvbox','last_status':'failed','last_latency_ms':7000,'last_error':'HTTP 503'},
  ]
  page.route('**/api/admin/session',lambda route:route.fulfill(json={'configured':True,'dbReady':True,'authenticated':True}))
  page.route('**/api/admin/sources',lambda route:route.fulfill(json={'sources':examples}))
  html=(root/'admin.html').read_text(encoding='utf8')
  html=html.replace('<link rel="stylesheet" href="./admin.css">','').replace('<script src="./admin.js" defer></script>','')
  page.set_content(html,wait_until='domcontentloaded')
  page.add_style_tag(content=(root/'admin.css').read_text(encoding='utf8'))
  page.evaluate("""() => {
    const originalFetch = window.fetch;
    window.fetch = async (url, opts={}) => {
       const path = String(url);
       if(path.includes('/api/admin/session')) return new Response(JSON.stringify({configured:true,dbReady:true,authenticated:true}),{status:200,headers:{'Content-Type':'application/json'}});
       if(path.includes('/api/admin/sources')) return new Response(JSON.stringify({sources:[
          {id:'s-one',name:'演示·正版电影库',url:'https://media.example.org/api.php/provide/vod',enabled:1,rights_confirmed:1,origin:'manual',last_status:'healthy',last_latency_ms:124},
          {id:'s-two',name:'演示·独立纪录片',url:'https://docs.example.org/api.php/provide/vod',enabled:1,rights_confirmed:1,origin:'tvbox',last_status:'healthy',last_latency_ms:322},
          {id:'s-three',name:'演示·待校验资源',url:'https://test.example.org/api.php/provide/vod',enabled:0,rights_confirmed:1,origin:'tvbox',last_status:'failed',last_latency_ms:7000,last_error:'HTTP 503'}
        ]}),{status:200,headers:{'Content-Type':'application/json'}});
       return new Response(JSON.stringify({error:'mock request'}),{status:400,headers:{'Content-Type':'application/json'}});
    };
  }""")
  page.add_script_tag(content=(root/'admin.js').read_text(encoding='utf8'))
  page.locator('.source-row').first.wait_for()
  assert page.locator('.source-row').count()==3
  print('source count:',page.locator('.source-row').count())
  page.screenshot(path='/mnt/data/松柏-v0.5-影视源管理后台.png',full_page=True)
  page.locator('#openImport').click()
  page.locator('#importRaw').count();assert page.locator('#sheetBackdrop').is_visible()
  page.locator('#modeJson').click()
  assert page.locator('#importRaw').is_visible()
  page.locator('#closeSheet').click()
  page.locator('#openAdd').click()
  assert page.locator('#sourceForm').is_visible()
  page.locator('#closeSheet').click()
  page.set_viewport_size({'width':390,'height':844})
  page.screenshot(path='/mnt/data/松柏-v0.5-管理后台移动端.png',full_page=True)
  assert not errors, errors
  print('browser page errors:',errors)
  browser.close()
finally:server.shutdown()
