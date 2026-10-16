'use strict';
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sources=[],feeds=[],preview=[],importMode='url',toastTimer;
async function call(path,{method='GET',data}={}){
 const resp=await fetch(path,{method,headers:data===undefined?{}:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin',cache:'no-store'});
 let body;try{body=await resp.json()}catch{throw Error('服务器未返回 JSON')}
 if(!resp.ok)throw Error(body.error||'请求失败：'+resp.status);return body;
}
function notify(text,bad=false){let x=$('#toast');x.textContent=text;x.style.borderColor=bad?'#a74b4b':'#465646';x.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>x.hidden=true,4500)}
function overlay(markup){$('#sheetBody').innerHTML=markup;$('#sheetBackdrop').hidden=false;$('#closeSheet').focus()}
function closeSheet(){$('#sheetBackdrop').hidden=true;$('#sheetBody').innerHTML=''}
function statusMarkup(src){let names={healthy:'正常',failed:'检测失败',untested:'未检测'};let st=src.last_status||'untested';return `<span class="health ${esc(st)}" title="${esc(src.last_error||'')}">${names[st]||'未检测'}${Number.isFinite(src.last_latency_ms)?` · <span class="latency">${src.last_latency_ms}ms</span>`:''}</span>`}
function listMarkup(src){return `<div class="source-row" data-id="${esc(src.id)}"><div class="source-info"><div class="source-title">${esc(src.name)}</div><div class="source-url" title="${esc(src.url)}">${esc(src.url)}</div><div class="source-origin">${src.origin==='tvbox'?'TVBOX IMPORT':'MANUAL SOURCE'}${src.rights_confirmed?' · 权限已确认':''}</div></div><div>${statusMarkup(src)}</div><button class="toggle ${src.enabled?'on':''}" data-action="toggle" role="switch" aria-checked="${!!src.enabled}" aria-label="启用或停用 ${esc(src.name)}"><span></span></button><div class="row-actions"><button class="smallbtn" data-action="test">检测</button><button class="smallbtn" data-action="edit">编辑</button><button class="smallbtn danger" data-action="delete">删除</button></div></div>`}
function renderSources(){let active=sources.filter(x=>x.enabled).length,healthy=sources.filter(x=>x.last_status==='healthy').length;
 $('#sTotal').textContent=sources.length;$('#sActive').textContent=active;$('#sHealthy').textContent=healthy;$('#sOther').textContent=sources.length-healthy;
 $('#sourceList').innerHTML=sources.map(listMarkup).join('');$('#empty').hidden=!!sources.length;
}
async function refresh(){let data=await call('/api/admin/sources');sources=data.sources||[];renderSources()}
function feedStatus(f){let kind=f.last_status||'pending';const labels={pending:'待检测',compatible:'可识别 JSON',unsupported:'未找到 CMS 接口',failed:'解析失败'};return `<span class="feed-status ${esc(kind)}">${labels[kind]||'待检测'}</span>`}
function renderFeeds(){
 $('#feedCount').textContent=feeds.length;
 $('#feedList').innerHTML=feeds.map(f=>`<article class="feed-card" data-feed-id="${esc(f.id)}"><div class="feed-card-top"><div class="feed-card-name">${esc(f.name)}</div>${feedStatus(f)}</div><div class="feed-url" title="${esc(f.url)}">${esc(f.url)}</div><div class="feed-meta">${f.last_checked_at?'最近检测：'+esc(f.last_checked_at):'尚未检测'}${f.last_candidate_count!==null&&f.last_candidate_count!==undefined?' · 候选接口 '+Number(f.last_candidate_count):''}</div>${f.last_error?`<div class="feed-error" title="${esc(f.last_error)}">${esc(f.last_error)}</div>`:''}<div class="feed-card-actions"><button class="smallbtn" data-feed-action="preview">检测并预览接口</button><a class="smallbtn feed-open" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">查看原地址 ↗</a></div></article>`).join('')||'<p>暂无预置配置，请检查 D1 是否已运行 0002 迁移。</p>';
}
async function refreshFeeds(){const data=await call('/api/admin/feeds');feeds=data.feeds||[];renderFeeds()}
async function previewKnownFeed(feed){
 importSheet();$('#importUrl').value=feed.url;
 $('#sheetBody .subtitle').textContent='正在解析「'+feed.name+'」。仅预览其中兼容的公网 HTTPS Apple CMS 接口，不会自动启用。';
 $('#doPreview').disabled=true;
 $('#doPreview').textContent='正在识别…';
 try{
  const result=await call('/api/admin/feeds/'+feed.id+'/preview',{method:'POST',data:{}});
  renderCandidatePreview(result);
  if(result.error)notify('已记录检测结果：'+result.error,true);
  await refreshFeeds();
 }catch(e){notify(e.message,true)}finally{$('#doPreview').disabled=false;$('#doPreview').textContent='重新解析地址 →'}
}
async function checkAllFeeds(){
 const b=$('#testAllFeeds');b.disabled=true;
 const jobs=[...feeds];let index=0,done=0,compatible=0;
 async function work(){while(index<jobs.length){const feed=jobs[index++];try{const result=await call('/api/admin/feeds/'+feed.id+'/preview',{method:'POST',data:{}});if(result.status==='compatible')compatible++}catch{}done++;b.textContent=`正在检测 ${done}/${jobs.length}`}}
 try{await Promise.all(Array.from({length:Math.min(2,jobs.length)},work));await refreshFeeds();notify(`已检查 ${done} 个地址，其中 ${compatible} 个发现可识别的 CMS 接口；未自动导入或启用`)}
 catch(e){notify(e.message,true)}finally{b.disabled=false;b.textContent='逐个检测 10 个地址'}
}

async function start(){try{const s=await call('/api/admin/session');$('#login').hidden=true;$('#setup').hidden=true;$('#dashboard').hidden=true;
 if(!s.configured||!s.dbReady){$('#setupText').textContent=(!s.configured?'缺少管理员密钥。':'')+(!s.dbReady?'缺少数据库绑定。':'');$('#setup').hidden=false;return}
 if(!s.authenticated){$('#login').hidden=false;return}
 $('#dashboard').hidden=false;await Promise.all([refresh(),refreshFeeds()]);}catch(e){$('#setupText').textContent=e.message;$('#setup').hidden=false}}
function addSheet(src,defaults={}){const isEdit=!!src?.id;
 overlay(`<div class="eyebrow">${isEdit?'EDIT SOURCE':'NEW CONTENT API'}</div><h2>${isEdit?'修改影视源':'添加 Apple CMS 源'}</h2><p class="subtitle">仅支持拥有使用权限的公网 HTTPS JSON 接口。新源默认关闭，建议先检测。</p><form id="sourceForm"><div class="form-field"><label>源名称</label><input id="addName" maxlength="64" required placeholder="例如：我的授权点播源" value="${esc(src?.name||defaults.name||'')}"></div><div class="form-field"><label>Apple CMS API 地址</label><input id="addUrl" type="url" maxlength="700" required placeholder="https://media.example.org/api.php/provide/vod" value="${esc(src?.url||defaults.url||'')}"><div class="form-hint">只接受公开 HTTPS 域名，不接受本地地址、脚本或普通网页链接。</div></div><label class="field-check"><input id="addRights" type="checkbox" ${src?.rights_confirmed?'checked':''} required>我确认已获得该接口和相关视频内容的必要使用许可，了解非盈利不代表自动获得播放权。</label><div class="sheet-footer"><button class="button ghost" type="button" id="addCancel">取消</button><button class="button primary" type="submit">${isEdit?'保存修改':'保存源'} →</button></div></form>`);
 $('#addCancel').onclick=closeSheet;$('#sourceForm').onsubmit=async e=>{e.preventDefault();const payload={name:$('#addName').value,url:$('#addUrl').value,rightsConfirmed:$('#addRights').checked};let btn=e.target.querySelector('[type=submit]');btn.disabled=true;
 try{await call(isEdit?`/api/admin/sources/${src.id}`:'/api/admin/sources',{method:isEdit?'PATCH':'POST',data:payload});notify(isEdit?'影视源已更新':'影视源已保存并完成首次检测（默认未启用）');closeSheet();await refresh()}catch(e){notify(e.message,true)}finally{btn.disabled=false}};
}
function importSheet(){preview=[];importMode='url';overlay(`<div class="eyebrow">TVBOX CONFIG IMPORTER</div><h2>导入 TVBox 配置</h2><p class="subtitle">只预览符合条件的 Apple CMS JSON 源，不执行 Spider、JAR、JS 或任意第三方脚本。</p><div class="import-tabs"><button id="modeUrl" class="tab active">远程 HTTP / HTTPS 地址</button><button id="modeJson" class="tab">粘贴 JSON 配置</button></div><div class="form-field"><label id="importLabel">配置订阅地址（HTTP / HTTPS）</label><input id="importUrl" type="url" placeholder="https://example.org/tvbox.json"><textarea id="importRaw" placeholder="在这里粘贴包含 sites 数组的 TVBox JSON" hidden></textarea></div><div class="sheet-footer"><button id="doPreview" class="button primary">解析并预览 →</button></div><div id="importPreview"></div>`);
 $('#modeUrl').onclick=()=>mode('url');$('#modeJson').onclick=()=>mode('json');$('#doPreview').onclick=runPreview;
}
function mode(v){importMode=v;$('#modeUrl').classList.toggle('active',v==='url');$('#modeJson').classList.toggle('active',v==='json');$('#importUrl').hidden=v==='json';$('#importRaw').hidden=v!=='json';$('#importLabel').textContent=v==='json'?'TVBox JSON 文本':'配置订阅地址';preview=[];$('#importPreview').innerHTML=''}
function renderCandidatePreview(result){
 preview=result.candidates||[];
 const skipLabels={spider:'Spider / 脚本',notSearchable:'禁止搜索',invalid:'无效地址',duplicate:'重复',limit:'超出检测上限',http:'待验证 HTTPS',incompatible:'接口不兼容'};
 const skipped=Object.entries(result.skipped||{}).filter(([,v])=>v).map(([k,v])=>`${skipLabels[k]||k}: ${v}`).join(' / ');
 let message=result.error?`<div class="preview-summary problem">${esc(result.error)}</div>`:'';
 if(result.warning)message+=`<div class="preview-summary problem">${esc(result.warning)}</div>`;
 const total=result.totalSites??0;
 const checks=(result.checks||[]).length?`<details class="preview-summary" open><summary>HTTP 接口的 HTTPS 检测明细（${result.checks.length} 项）</summary>${result.checks.map(x=>`<p><strong>${esc(x.name)}</strong> · ${x.ok?'HTTPS 搜索 JSON 通过':esc(x.error)}<br><small>${esc(x.url)}</small></p>`).join('')}</details>`:'';
 $('#importPreview').innerHTML=message+`<div class="preview-summary">配置中发现 ${Number(total)} 项；识别到 ${preview.length} 个候选 Apple CMS 源。跳过：${esc(skipped||'无')}。<br>搜索接口检测通过后，影片播放能力与内容授权仍需分别确认。</div>`+checks+`<div class="candidate-list">${preview.map((x,i)=>`<label class="candidate"><input type="checkbox" data-candidate="${i}"><span>${esc(x.name)}<small>${esc(x.url)}</small>${x.transportUpgraded?'<small>已转换 HTTPS，并通过搜索 JSON 检测</small>':''}</span></label>`).join('')||'<p>该配置暂时没有兼容的标准 HTTPS CMS 源。</p>'}</div>${preview.length?`<label class="field-check"><input id="importRights" type="checkbox">我已逐个确认所选影视 API 及内容的使用许可。源导入后默认停用。</label><div class="sheet-footer"><button id="confirmImport" class="button primary">导入选中源 →</button></div>`:''}`;
 if(preview.length)$('#confirmImport').onclick=confirmImport;
}
async function runPreview(){let b=$('#doPreview');b.disabled=true;b.textContent='正在解析…';try{
 const result=await call('/api/admin/import/tvbox',{method:'POST',data:importMode==='url'?{url:$('#importUrl').value}:{raw:$('#importRaw').value}});
 renderCandidatePreview(result);
 }catch(e){notify(e.message,true)}finally{b.disabled=false;b.textContent='解析并预览 →'}}
async function confirmImport(){const indexes=[...document.querySelectorAll('[data-candidate]:checked')].map(el=>Number(el.dataset.candidate));if(!indexes.length)return notify('请至少勾选一个源',true);if(indexes.length>30)return notify('一次最多导入30个源',true);if(!$('#importRights').checked)return notify('请确认使用授权后再导入',true);
 let b=$('#confirmImport');b.disabled=true;try{const selected=indexes.map(i=>preview[i]);let imported=0,failed=0;for(let start=0;start<selected.length;start+=15){const result=await call('/api/admin/import/confirm',{method:'POST',data:{rightsConfirmed:true,sources:selected.slice(start,start+15)}});imported+=result.imported;failed+=result.failed}notify(`已导入 ${imported} 个，失败 ${failed} 个（均默认不自动启用）`);closeSheet();await refresh()}catch(e){notify(e.message,true)}finally{b.disabled=false}}
$('#loginForm').onsubmit=async e=>{e.preventDefault();let b=e.target.querySelector('button');b.disabled=true;$('#loginMsg').textContent='';try{await call('/api/admin/login',{method:'POST',data:{password:$('#password').value}});$('#password').value='';await start()}catch(err){$('#loginMsg').textContent=err.message}finally{b.disabled=false}};
$('#logout').onclick=async()=>{try{await call('/api/admin/logout',{method:'POST'});await start()}catch(e){notify(e.message,true)}};
$('#viewLogs').onclick=async()=>{try{const data=await call('/api/admin/logs');overlay('<h2>错误与测活日志</h2><p class="subtitle">最近 100 条记录，最多保留 200 条。</p>'+data.logs.map(x=>'<div class="preview-summary"><strong>'+esc(x.created_at)+' · '+esc(x.source_name||x.source_id)+' · '+esc(x.event)+'</strong><p>'+esc(x.message)+'</p></div>').join(''))}catch(e){notify(e.message,true)}};
$('#refresh').onclick=async()=>{try{await refresh();notify('数据已刷新')}catch(e){notify(e.message,true)}};
$('#openAdd').onclick=()=>addSheet();$('#openImport').onclick=importSheet;$('#closeSheet').onclick=closeSheet;
$('#refreshFeeds').onclick=async()=>{try{await refreshFeeds();notify('配置列表已刷新')}catch(e){notify(e.message,true)}};
$('#testAllFeeds').onclick=checkAllFeeds;
$('#feedList').addEventListener('click',async e=>{const b=e.target.closest('[data-feed-action]');if(!b)return;const feed=feeds.find(x=>x.id===b.closest('[data-feed-id]')?.dataset.feedId);if(feed&&b.dataset.feedAction==='preview')await previewKnownFeed(feed)});
$('#sheetBackdrop').addEventListener('click',e=>{if(e.target===$('#sheetBackdrop'))closeSheet()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
$('#sourceList').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;const row=btn.closest('[data-id]');const id=row.dataset.id,src=sources.find(s=>s.id===id);if(!src)return;
 const act=btn.dataset.action;
 if(act==='edit')return addSheet(src);
 if(act==='delete'&&!confirm(`确定删除「${src.name}」？删除后无法恢复。`))return;
 if(act==='toggle'&&src.enabled!==1&&src.last_status!=='healthy')return notify('请先通过接口测活再启用',true);
 btn.disabled=true;
 try{
  if(act==='test'){const x=await call(`/api/admin/sources/${id}/test`,{method:'POST'});notify(x.ok?`接口正常，返回 ${x.count} 条测试结果，${x.ms} ms`:`检测失败：${x.error}`,!x.ok)}
  if(act==='toggle'){await call(`/api/admin/sources/${id}`,{method:'PATCH',data:{enabled:!src.enabled}});notify(src.enabled?'影视源已停用':'影视源已启用')}
  if(act==='delete'){await call(`/api/admin/sources/${id}`,{method:'DELETE'});notify('影视源已删除')}
  await refresh();
 }catch(err){notify(err.message,true)}finally{btn.disabled=false}
});
start();

function inspectSheet(){
 overlay(`<div class="eyebrow">CONTENT API CHECK</div><h2>识别采集接口</h2><p class="subtitle">粘贴采集地址，自动尝试 HTTPS / JSON 格式，并检测搜索与详情中的线路。播放效果需要单独验证。</p><div class="inspector-presets"><button class="smallbtn" type="button" data-inspect-preset="360">填入 360 m3u8</button><button class="smallbtn" type="button" data-inspect-preset="ff">填入非凡 m3u8</button></div><form id="inspectForm"><div class="form-field"><label for="inspectName">源名称</label><input id="inspectName" type="text" maxlength="64" placeholder="例如：我的影视接口"></div><div class="form-field"><label for="inspectUrl">采集 API 地址</label><input id="inspectUrl" type="url" maxlength="700" required placeholder="粘贴 HTTP / HTTPS、XML / JSON 采集地址"></div><div class="form-field"><label for="inspectQuery">测试片名</label><input id="inspectQuery" type="text" maxlength="80" required value="水饺皇后"></div><div class="sheet-footer"><button class="button primary" id="inspectRun" type="submit">识别并检测 →</button></div></form><div id="inspectResult" aria-live="polite"></div>`);
 const presets={'360':{name:'360 m3u8',url:'https://360zyzz.com/api.php/provide/vod/from/360m3u8/at/json'},ff:{name:'非凡 m3u8',url:'http://api.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/xml/'}};
 document.querySelectorAll('[data-inspect-preset]').forEach(button=>button.onclick=()=>{const preset=presets[button.dataset.inspectPreset];$('#inspectName').value=preset.name;$('#inspectUrl').value=preset.url;$('#inspectResult').innerHTML=''});
 $('#inspectForm').onsubmit=async event=>{
  event.preventDefault();const button=$('#inspectRun');button.disabled=true;button.textContent='正在检测…';$('#inspectResult').innerHTML='';
  try{
   const data=await call('/api/admin/sources/inspect',{method:'POST',data:{name:$('#inspectName').value,url:$('#inspectUrl').value,query:$('#inspectQuery').value}});
   if(!$('#inspectResult'))return;
   const conversions=data.changes?.length?data.changes.join('；'):'地址格式保持原样';
   const search=data.search.ok?`搜索通过 · 返回 ${data.search.count} 条结果`:`搜索失败：${data.search.error}`;
   const detail=data.detail.checked?(data.detail.ok?`详情通过 · ${data.detail.title}`:`详情失败：${data.detail.error}`):data.detail.message||'详情尚未检测';
   const playback=data.playback.directCandidates?`识别到 ${data.playback.directCandidates} 个标准视频地址（${(data.playback.formats||[]).join(' / ')}）。实际播放尚未验证。`:'该样本尚未提供标准视频地址；网页解析线路需要上游另行提供 m3u8 等标准接口。';
   $('#inspectResult').innerHTML=`<div class="preview-summary"><strong>${esc(search)}</strong><p>${esc(conversions)}</p><code class="inspector-url">${esc(data.url)}</code><p>${esc(detail)}</p><p>${esc(playback)}</p>${data.playback.lines?.length?`<p>线路标识：${esc(data.playback.lines.join(' / '))}</p>`:''}${data.existing?`<p>后台已有此接口：${esc(data.existing.name)}（${data.existing.enabled?'已启用':'已停用'}）。</p>`:''}</div>${data.compatible?`<p class="form-hint">继续到表单确认名称与使用许可，保存后在源列表测活、启用。</p><div class="sheet-footer"><button class="button primary" id="applyInspected" type="button">${data.existing?'编辑已有接口':'填入添加表单'} →</button></div>`:''}`;
   if(data.compatible)$('#applyInspected').onclick=()=>addSheet(data.existing||null,{name:data.suggestedName,url:data.url});
  }catch(error){if($('#inspectResult'))$('#inspectResult').innerHTML=`<div class="preview-summary problem">${esc(error.message)}</div>`}
  finally{if($('#inspectRun')){$('#inspectRun').disabled=false;$('#inspectRun').textContent='识别并检测 →'}}
 };
}
$('#openInspect').onclick=inspectSheet;
