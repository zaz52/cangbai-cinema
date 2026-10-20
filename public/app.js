/* 苍柏 CINEMA 0.4: 多源搜索、播放与版权投诉入口 */
'use strict';
const icons={
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 heart:'<path d="M20.5 4.7a5.5 5.5 0 0 0-7.8 0L12 5.4l-.7-.7a5.5 5.5 0 0 0-7.8 7.8l.7.7L12 21l7.8-7.8.7-.7a5.5 5.5 0 0 0 0-7.8Z"/>',
 play:'<path d="m8 5 12 7-12 7V5Z"/>',arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6h.01"/>',
 home:'<path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-8h6v8"/>',
 film:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4"/>',
 star:'<path d="m12 2.5 2.95 6.1 6.73.98-4.87 4.74 1.15 6.71L12 17.86l-5.96 3.17 1.15-6.71-4.87-4.74 6.73-.98L12 2.5Z"/>',
 filter:'<path d="M3 6h18M6 12h12M10 18h4"/>',
 spark:'<path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7Z"/>',
 tv:'<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 22h8M12 18v4M8 1l4 4 4-4"/>',
 flame:'<path d="M13 2c1 6-4 6-3 10-3-1-3-3-3-3-5 6-2 13 5 13 8 0 11-9 5-14 0 4-3 5-3 5s3-7-1-11Z"/>'
};
const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]||icons.info}</svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const x=new URL(u,location.href);return ['https:','http:'].includes(x.protocol)?x.href:''}catch{return ''}};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const storageKey='songbai-fav-v2';
function loadSaved(){try{
 const saved=JSON.parse(localStorage.getItem(storageKey)||localStorage.getItem('yingke-fav-v2')||'{}');
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return {};
 const current=Object.fromEntries(Object.entries(saved).filter(([id,item])=>item&&item.id===id&&/^(?:cms:|discover:)/.test(id)));
 if(Object.keys(current).length!==Object.keys(saved).length)localStorage.setItem(storageKey,JSON.stringify(current));
 return current;
}catch{return {}}}
let state={nav:'发现',query:'',loading:true,error:'',items:[],total:0,page:1,modal:null,detailLoading:false,saved:loadSaved(),reqSeq:0,sourceStatus:[],catalog:[],catalogUpdated:'',catalogLoading:false,catalogError:'',discoverFilter:'all',discoverFacet:'',discoverUpdated:'',discoverYear:null,hotItems:[],discoverNextRefresh:'',discoverStale:false,lastDiscoverCheck:0,discoverSource:'',discoverSourceUrl:'',heroIndex:0};
const navs=['发现','聚合搜索','我的收藏'];
const findMovie=id=>state.items.find(x=>x.id===id)||state.hotItems.find(x=>x.id===id)||state.saved[id];
const failedCovers=new Set();
const failedBackdrops=new Set();
const kindLabels={movie:'电影',tv:'电视剧',variety:'综艺',anime:'动漫'};
const categoryRows=[
 ['movie','电影','film',['动作','喜剧','爱情','科幻','恐怖']],
 ['tv','电视剧','tv',['国产剧','欧美剧','日本剧','韩国剧','港台剧']],
 ['variety','综艺','star',['大陆','港台','日韩','欧美']],
 ['anime','动漫','spark',['国漫','日漫','欧美','其他']]
];
function matchesFacet(item,facet){
 if(!facet)return true;
 const tags=(item.genres||'')+' '+(item.category||'')+' '+(item.area||'');
 if(['国产剧','大陆','国漫'].includes(facet))return /国产|大陆|内地/.test(tags)||String(item.area||'').trim()==='中国';
 const patterns={欧美剧:/欧美|美国|英国|法国|德国|加拿大/,日本剧:/日本|日剧/,韩国剧:/韩国|韩剧/,港台剧:/香港|台湾|港台/,港台:/香港|台湾|港台/,日韩:/日本|韩国|日韩/,欧美:/欧美|美国|英国|法国|德国|加拿大/,日漫:/日本|日漫/};
 if(facet==='其他')return !!tags.trim()&&!/国产|大陆|中国|日本|日韩|欧美|美国|英国|法国|德国|加拿大/.test(tags);
 return patterns[facet]?patterns[facet].test(tags):tags.includes(facet);
}
function discoveryItems(){const pool=state.discoverFilter==='hot'?state.hotItems:state.items;return pool.filter(x=>(['all','hot'].includes(state.discoverFilter)||x.kind===state.discoverFilter)&&matchesFacet(x,state.discoverFacet))}
function heroSource(item){const backdrop=safeUrl(item?.backdrop),url=backdrop&&!failedBackdrops.has(backdrop)?backdrop:safeUrl(item?.image);if(!url)return '';const parsed=new URL(url);if(/^i\d+\.hdslb\.com$/.test(parsed.hostname))parsed.pathname=parsed.pathname.split('@')[0];return parsed.href}
function fitHeroImage(img){
 const hero=img.closest('.hero');if(!hero)return;
 const wide=img.naturalWidth>=1280&&img.naturalWidth/img.naturalHeight>=1.5;
 hero.classList.toggle('hero-wide',wide);hero.dataset.imageLayout=wide?'landscape':'poster';
 img.style.setProperty('--image-width',img.naturalWidth+'px');img.style.setProperty('--image-height',img.naturalHeight+'px');
}
function heroImageFailed(img){
 const source=safeUrl(img.src),fallback=img.dataset.fallback;
 if(fallback&&source!==fallback){failedBackdrops.add(source);const next=heroItems().find(x=>safeUrl(x.backdrop)&&!failedBackdrops.has(safeUrl(x.backdrop)));if(next){state.heroIndex=0;img.closest('.hero').outerHTML=renderHero();return}img.dataset.fallback='';img.src=fallback;return}
 markPosterFailed(img);
}

function markPosterFailed(img){
 const url=safeUrl(img.currentSrc||img.src),fresh=!failedCovers.has(url);failedCovers.add(url);img.style.display='none';img.closest('.poster-art,.hero-image,.editorial-card,.detail-visual')?.classList.add('no-cover');
 const hero=document.querySelector('.hero');if(fresh&&hero){const index=heroItems().findIndex(x=>x.id===hero.dataset.featured);state.heroIndex=index>=0?index:0;hero.outerHTML=renderHero()}
}
function renderNav(){
 const activeKind=isDiscovery()?state.discoverFilter:null;
 const entries=[{label:'首页',icon:'home',nav:'发现',active:state.nav==='发现'&&activeKind==='all'},{label:'电影',icon:'film',kind:'movie',active:activeKind==='movie'},{label:'电视剧',icon:'tv',kind:'tv',active:activeKind==='tv'},{label:'动漫',icon:'spark',kind:'anime',active:activeKind==='anime'},{label:'综艺',icon:'star',kind:'variety',active:activeKind==='variety'},{label:'热播榜',icon:'flame',kind:'hot',active:activeKind==='hot'},{label:'搜片',icon:'search',nav:'聚合搜索',active:state.nav==='聚合搜索'&&(!!state.query||activeKind==='all')},{label:'收藏',icon:'heart',nav:'我的收藏',active:state.nav==='我的收藏'}];
 const attrs=x=>x.kind?`data-browse-kind="${x.kind}"`:`data-nav="${x.nav}"`;
 document.getElementById('topNav').innerHTML=entries.map(x=>`<button type="button" class="nav-link ${x.active?'active':''}" ${attrs(x)} ${x.active?'aria-current="page"':''}>${icon(x.icon)}<span>${x.label}</span></button>`).join('');
 document.getElementById('mobileNav').innerHTML=entries.filter(x=>['首页','电影','电视剧','热播榜','收藏'].includes(x.label)).map(x=>`<button class="${x.active?'active':''}" ${attrs(x)} ${x.active?'aria-current="page"':''}>${icon(x.icon)}<span>${x.label}</span></button>`).join('');
}
const currentYear=()=>new Date(Date.now()+8*60*60*1000).getUTCFullYear();
function heroItems(){const seen=new Set(),pool=[...state.hotItems,...state.items].filter(x=>{const wide=safeUrl(x.backdrop)&&!failedBackdrops.has(safeUrl(x.backdrop));if(!x.discovery||!safeUrl(x.image)||(!wide&&failedCovers.has(safeUrl(x.image)))||seen.has(x.title))return false;seen.add(x.title);return true}),wide=pool.filter(x=>safeUrl(x.backdrop)&&!failedBackdrops.has(safeUrl(x.backdrop)));return (wide.length?wide:pool).slice(0,6)}
function renderHero(){
 const year=state.discoverYear||currentYear(),items=heroItems(),index=items.length?state.heroIndex%items.length:0,featured=items[index];
 return `<section class="hero ${featured?.backdrop&&!failedBackdrops.has(safeUrl(featured.backdrop))?'hero-wide':''}" data-featured="${esc(featured?.id||'')}" data-image-layout="poster" aria-label="热门作品推荐"><div class="hero-image">${featured?`<img class="hero-featured" src="${esc(heroSource(featured))}" data-fallback="${esc(safeUrl(featured.image))}" alt="${esc(featured.title)}海报" fetchpriority="high" referrerpolicy="no-referrer" onload="fitHeroImage(this)" onerror="heroImageFailed(this)"/>`:''}</div><div class="hero-inner"><div class="hero-content"><div class="eyebrow">${icon('flame')} 正在热播 <span class="hero-kicker">CANGBAI CINEMA</span></div><h1 class="hero-title">${esc(featured?.title||'好戏，即刻发现')}<span class="hero-title-year">${year} 年度影视推荐</span></h1><div class="hero-meta">${featured?.rating?`<span class="tag-score">${icon('star')} ${Number(featured.rating).toFixed(1)}</span><i class="meta-divider"></i>`:''}<span>${esc(kindLabels[featured?.kind]||'影视')}</span><i class="meta-divider"></i><span>${esc(featured?.episodesInfo||'片单持续更新')}</span></div><p class="hero-desc">${esc([featured?.area,featured?.genres].filter(Boolean).join(' · ')||'新片、新剧，接着看。发现喜欢的作品。')}</p><div class="hero-buttons"><button class="btn btn-primary" ${featured?`data-query="${esc(featured.title)}"`:'data-browse-kind="hot"'}>${icon('play')} ${featured?'搜索这部影片':'浏览热播推荐'}</button><button class="btn btn-glass" data-browse-kind="hot">更多热播 ${icon('arrow')}</button></div></div>${featured?.backdropSourceUrl?`<a class="banner-credit" href="${esc(safeUrl(featured.backdropSourceUrl))}" target="_blank" rel="noopener noreferrer">宣传图来源 ↗</a>`:''}<div class="hero-choices" aria-label="选择推荐作品">${items.map((item,i)=>`<button class="hero-choice ${i===index?'active':''}" type="button" data-hero-index="${i}" aria-pressed="${i===index}"><span>${esc(item.title)}</span><small>${esc(item.episodesInfo||item.type||'年度推荐')}</small></button>`).join('')}</div><div class="hero-pagination" aria-label="推荐轮播">${items.map((item,i)=>`<button type="button" class="${i===index?'active':''}" data-hero-index="${i}" aria-label="切换到${esc(item.title)}" aria-pressed="${i===index}"></button>`).join('')}</div></div></section>`;
}
function renderQuickCategories(){return `<section class="category-directory" aria-label="影视分类导航">${categoryRows.map(([kind,title,symbol,facets])=>`<div class="category-row" data-category-row="${kind}"><button class="category-heading" data-browse-kind="${kind}">${icon(symbol)}${title}</button><div class="category-links">${facets.map(facet=>`<button data-browse-kind="${kind}" data-facet="${esc(facet)}">${facet}</button>`).join('')}<button class="category-all" data-browse-kind="${kind}" aria-label="全部${title}">全部 ${icon('arrow')}</button></div></div>`).join('')}</section>`}
function selectHero(index,focus=false){const items=heroItems();if(!items.length||!document.querySelector('.hero'))return;state.heroIndex=(Number(index)+items.length)%items.length;document.querySelector('.hero').outerHTML=renderHero();if(focus)document.querySelector(`.hero-choice[data-hero-index="${state.heroIndex}"]`)?.focus({preventScroll:true})}
const isDiscovery=()=>!state.query&&['发现','聚合搜索'].includes(state.nav);
const card=(m,i)=>{
 const favor=!!state.saved[m.id],title=esc(m.title),action=m.discovery?`data-query="${esc(m.title)}"`:`data-action="detail" data-id="${esc(m.id)}"`;
 const score=m.discovery?(m.rating?`<span>★</span> ${Number(m.rating).toFixed(1)}`:esc(kindLabels[m.kind]||'影视')):`<span>◎</span> ${m.sourceCount>1?esc(m.sourceCount+'源'):esc((m.source||'影视源').slice(0,8))}`;
 const subtitle=m.discovery?`${esc(m.year||'')} · ${esc(m.episodesInfo||m.releaseInfo||m.type)}`:`${esc(m.year||'年份未注明')} · ${esc(m.type||'影像')}`;
 return `<article class="poster-card ${m.discovery?'discovery-card':''}" data-kind="${esc(m.kind||'source')}"><div class="poster-art" ${action} role="button" tabindex="0" aria-label="${m.discovery?'搜索':'查看'}${title}${m.discovery?'片源':'详情'}"><img alt="${title} 海报" src="${esc(safeUrl(m.image))}" referrerpolicy="no-referrer" loading="lazy" onerror="markPosterFailed(this)"/><span class="poster-placeholder" aria-hidden="true">${icon('film')}<strong>${title}</strong><small>海报暂缺</small></span><span class="quality">${m.discovery?esc(m.episodesInfo||m.type):m.sourceCount>1?m.sourceCount+' 条候选来源':esc(m.type||'影像')}</span><button class="fav ${favor?'active':''}" aria-label="${favor?'取消收藏':'收藏'}${title}" data-action="fav" data-id="${esc(m.id)}">${icon('heart')}</button><div class="poster-hover"><button class="mini-play" ${action}>${icon(m.discovery?'search':'play')} ${m.discovery?'搜索片源':'查看线路'}</button></div></div><div class="poster-foot"><div class="poster-info"><h3 title="${title}">${title}</h3><p>${subtitle}</p></div><span class="poster-score">${score}</span></div></article>`;
};
function stateCards(){
 if(state.loading)return `<div class="skeleton-grid">${Array.from({length:8},()=>'<div class="skeleton-card"><i></i><b></b><small></small></div>').join('')}</div>`;
 if(state.error)return `<div class="empty-state" style="grid-column:1/-1">${icon('info')}<h3>暂时无法加载影视列表</h3><p>${esc(state.error)}<br/>请检查网络，或稍后重试。</p><button class="reset-btn" data-action="retry">重新加载</button></div>`;
 const list=state.nav==='我的收藏'?Object.values(state.saved):isDiscovery()?discoveryItems():state.items;
 if(!list.length)return `<div class="empty-state" style="grid-column:1/-1">${icon('search')}<h3>${state.nav==='我的收藏'?'还没有收藏作品':state.discoverFacet?'当前分类暂无作品':'暂时没有匹配的影片'}</h3><p>${state.nav==='我的收藏'?'点开作品详情后，可以加入收藏。':isDiscovery()?'当前年度片单中暂无该分类，其他分类和片名搜索仍可使用。':'当前未找到影片。请尝试其他片名，或在后台检查已启用的影视源。'}</p><button class="reset-btn" data-action="reset">浏览热门影视</button></div>`;
 return `<div class="poster-grid">${list.map(card).join('')}</div>`;
}
function sectionHead(title,sub,eyebrow='POPULAR CINEMA'){return `<div class="section-toolbar"><div><div class="section-topline">${eyebrow}</div><h2 class="section-title">${title}<span style="color:var(--accent)">.</span></h2><p class="section-subtitle">${sub}</p></div></div>`}
function catalogCards(){
 if(state.catalogLoading)return `<div class="empty-state"><h3>正在同步 awesome-zhuiju-free …</h3></div>`;
 if(state.catalogError)return `<div class="empty-state"><h3>目录更新暂时不可用</h3><p>${esc(state.catalogError)}</p><button class="reset-btn" data-action="catalog-retry">重试</button></div>`;
 if(!state.catalog.length)return `<div class="empty-state"><h3>未找到符合条件的资源站点</h3><p>目录只支持搜索站点名称、简介和标签。</p></div>`;
 return `<div class="directory-grid">${state.catalog.map(x=>`<article class="directory-card"><div class="directory-card-head"><span class="directory-icon">${icon('film')}</span><span class="directory-rating">${esc(x.stars)} / 5</span></div><h3>${esc(x.name)}</h3><p>${esc(x.summary||'影视资源导航收录站点')}</p><div class="directory-meta"><span>${esc(x.status)}</span><span>${esc(x.checked||'暂无检测日期')}</span></div><div class="directory-disclaimer">站点入口 · 尚未验证搜索/播放接口 · 版权风险：${esc(x.risk)}</div><a class="directory-open" href="${esc(safeUrl(x.url))}" rel="noopener noreferrer" target="_blank">访问站点（新窗口） ${icon('arrow')}</a></article>`).join('')}</div>`;
}
function renderDirectory(){return `<section class="result-page cinema-feed">${sectionHead('影视源发现目录','同步 laoma528/awesome-zhuiju-free 的公开站点列表。此处展示可访问入口，不代表已接入自动搜索或获得播放权限。','SOURCE DIRECTORY')}<div class="source-intro"><strong>实际参与搜索的源 ≠ 资源站点目录。</strong> 目录只包含网址和描述。要实现全站搜片、自动换源，需要各站开放可用且有授权的搜索和播放 API。</div><div class="archive-status"><span class="online-dot"></span>${state.catalogLoading?'正在同步':`${state.catalog.length} 个目录站点`}<span class="archive-caption"> · 数据更新 ${esc(state.catalogUpdated||'未知')}</span></div>${catalogCards()}<div class="source-credit">数据来源：<a href="https://github.com/laoma528/awesome-zhuiju-free" target="_blank" rel="noopener noreferrer">awesome-zhuiju-free (CC BY 4.0)</a>。网站可访问状态不等于影片有对应播放线路。</div></section>`}
function renderFacetFilters(){
 const row=categoryRows.find(x=>x[0]===state.discoverFilter);if(!row)return '';
 return `<div class="facet-filters" aria-label="${row[1]}细分类"><span>筛选本年片单</span>${['',...row[3]].map(facet=>`<button class="${state.discoverFacet===facet?'active':''}" data-discover-facet="${facet}" aria-pressed="${state.discoverFacet===facet}">${facet||'全部'}</button>`).join('')}<small>${discoveryItems().length} 部</small></div>`;
}
function renderArchive(isHome){
 if(isDiscovery()){
  const year=state.discoverYear||currentYear(),hot=state.discoverFilter==='hot';
  const filters=[['all','本年上新'],['movie','最新电影'],['tv','最新剧集'],['variety','综艺'],['anime','动漫'],['hot','热播推荐']];
  const updated=state.discoverUpdated?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(state.discoverUpdated)):'';
  const shelves=isHome&&state.discoverFilter==='all'&&!state.loading&&!state.error;
  const featured=state.hotItems.length?state.hotItems:state.items;
  const shelf=(kind,title)=>{const items=state.items.filter(x=>x.kind===kind).slice(0,12);return items.length?`<section class="home-shelf" data-home-kind="${kind}"><div class="shelf-heading"><h2>${icon(({tv:'tv',movie:'film',variety:'star',anime:'spark'})[kind]||'film')}${title}</h2><button class="link-more" data-browse-kind="${kind}">更多 ${icon('arrow')}</button></div><div class="poster-grid">${items.map(card).join('')}</div></section>`:''};
  return `<section id="popularFilms" class="${isHome?'top-picks':'result-page'} cinema-feed discovery-feed"><div class="shelf-heading discovery-heading">${sectionHead(shelves?'正在热播':year+(hot?' 热播推荐':kindLabels[state.discoverFilter]?' '+kindLabels[state.discoverFilter]:' 新片新剧'),hot?'跟踪今年正在更新的剧集与片源人气作品。':'新片新剧，跟上每一份精彩。',year+' / 新片新剧')}<button class="link-more" data-browse-kind="hot">更多热播 ${icon('arrow')}</button></div><div class="discovery-toolbar"><div class="discovery-filters" aria-label="年度影视分类">${filters.map(([key,label])=>`<button class="discovery-filter ${state.discoverFilter===key?'active':''}" data-discover-filter="${key}" aria-pressed="${state.discoverFilter===key}">${label}</button>`).join('')}</div><span class="discovery-hint">点击海报，搜索片源 ${icon('arrow')}</span></div>${renderFacetFilters()}${shelves?`<div class="poster-grid home-hot">${featured.slice(0,12).map(card).join('')}</div>${shelf('movie','电影')}${shelf('tv','电视剧')}${shelf('variety','综艺')}${shelf('anime','动漫')}`:stateCards()}<div class="discovery-credit"><span class="discovery-sync">每小时自动更新 · ${updated?'最近同步 '+esc(updated):'正在同步本年片单'}${state.discoverStale?' · 部分片单暂用缓存':''}</span>${state.discoverSourceUrl?`<a href="${esc(safeUrl(state.discoverSourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(state.discoverSource)} ↗</a>`:`<span>${esc(state.discoverSource||'影视片单正在同步')}</span>`}</div></section>`;

 }
 const heading=state.nav==='我的收藏'?'我的收藏':state.query?`关于「${esc(state.query)}」的结果`:'多源聚合影视搜索';
 const subtitle=state.nav==='我的收藏'?'收藏保存在当前浏览器中。':'搜索已连接的视频数据接口，合并同名影片。源失效时可尝试同集其他可用线路。';
 const count=state.loading?'正在并行查询…':state.error?'搜索异常':state.nav==='我的收藏'?`收藏 ${Object.keys(state.saved).length} 部`:`本页找到 ${state.items.length} 部影片`;
 const suggest=state.nav==='我的收藏'?'':`<div class="search-suggestions"><span>继续发现：</span><button data-browse-kind="movie">热门电影</button><button data-browse-kind="tv">热播剧集</button></div>`;
 return `<section class="${isHome?'top-picks':'result-page'} cinema-feed">${sectionHead(heading,subtitle,'MULTI-SOURCE SEARCH')}<div class="archive-status"><span class="online-dot"></span>${esc(count)}<span class="archive-caption"> · 已接入片源聚合检索</span></div>${suggest}${stateCards()}${state.nav!=='我的收藏'&&!state.loading&&state.items.length>=18?`<div class="page-ctrl"><button class="btn btn-glass" data-action="prev" ${state.page===1?'disabled':''}>上一页</button><span>第 ${state.page} 页</span><button class="btn btn-glass" data-action="next">下一页 ${icon('arrow')}</button></div>`:''}</section>`;
}
function renderSpotlights(){
 return `<section class="story-strip" aria-label="热门影视推荐">${[['movie','新片速递','随今年上映片单自动更新'],['tv','热剧推荐','跟上今年的人气故事']].map(([kind,label,description])=>{
  const item=(kind==='tv'?state.hotItems:state.items).find(x=>x.discovery&&x.kind===kind);
  return `<button type="button" class="editorial-card" ${item?`data-query="${esc(item.title)}"`:`data-browse-kind="${kind}"`}>${item?`<img src="${esc(safeUrl(item.image))}" alt="${esc(item.title)}海报" referrerpolicy="no-referrer" loading="lazy" onerror="markPosterFailed(this)"/>`:''}<div class="editorial-content"><span class="overline">${state.discoverYear||currentYear()} / ${label}</span><h3>${esc(item?.title||label)}</h3><p>${description}</p></div><div class="editorial-arrow">${icon('arrow')}</div></button>`;
 }).join('')}<div class="editorial-card narrative"><div class="narrative-copy"><div class="eyebrow">SOURCE INTEGRATION</div><h3>一个搜索框<br/><strong>多个播放源</strong>。</h3><p>仅对已接入合法播放接口的来源自动换源。</p></div></div></section>`;
}
function renderMain(){
 document.getElementById('mainContent').innerHTML=state.nav==='发现'?`${renderHero()}<div class="content-wrap">${renderQuickCategories()}${renderArchive(true)}${renderSpotlights()}</div>`:state.nav==='影视源目录'?`<div class="content-wrap">${renderDirectory()}</div>`:`<div class="content-wrap">${renderArchive(false)}</div>`;
 renderNav();
}
async function loadArchive(page=1){
 state.loading=true;state.error='';state.page=page;const seq=++state.reqSeq;renderMain();
 try{const qs=new URLSearchParams({q:state.query,page:String(page)});const res=await fetch(isDiscovery()?'/api/discover':`/api/search?${qs}`,{headers:{accept:'application/json'}});if(!res.ok)throw Error(`HTTP ${res.status}`);const data=await res.json();if(seq!==state.reqSeq)return;state.items=Array.isArray(data.results)?data.results:[];if(isDiscovery()){state.hotItems=Array.isArray(data.hotResults)?data.hotResults:[];state.discoverYear=data.year||currentYear();state.discoverUpdated=data.updatedAt||'';state.discoverNextRefresh=data.nextRefreshAt||'';state.discoverStale=!!data.stale;state.discoverSource=data.source||'';state.discoverSourceUrl=data.sourceUrl||'';state.lastDiscoverCheck=Date.now();}state.total=Number(data.total||0);state.sourceStatus=Array.isArray(data.sourceStatus)?data.sourceStatus:[];
 }catch(e){if(seq!==state.reqSeq)return;state.error=e.message||'未知错误';state.items=[];state.total=0;state.sourceStatus=[]}
 finally{if(seq===state.reqSeq){state.loading=false;renderMain()}}
}
async function loadCatalog(){const seq=++state.reqSeq;state.catalogLoading=true;state.catalogError='';renderMain();try{const qs=new URLSearchParams({q:state.query,category:'online_video'});const r=await fetch(`/api/catalog?${qs}`);if(!r.ok)throw Error('目录 API 返回 '+r.status);const data=await r.json();if(seq!==state.reqSeq)return;state.catalog=Array.isArray(data.results)?data.results:[];state.catalogUpdated=data.updatedAt||'';}catch(e){if(seq!==state.reqSeq)return;state.catalogError=e.message||'请求失败';state.catalog=[]}finally{if(seq===state.reqSeq){state.catalogLoading=false;renderMain()}}}
function toast(msg){const area=document.getElementById('toastContainer');const el=document.createElement('div');el.className='toast';el.textContent=msg;area.append(el);setTimeout(()=>el.remove(),2900)}
function closeModal(){freeHls();const o=document.getElementById('modalOverlay');o.querySelector('video')?.pause();o.classList.remove('open');o.setAttribute('aria-hidden','true');o.innerHTML='';state.modal=null;document.body.style.overflow=''}
function showModal(markup){const o=document.getElementById('modalOverlay');o.innerHTML=markup;o.classList.add('open');o.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';o.querySelector('.dialog-close')?.focus();}
function detailMarkup(m){
 const videos=m.videos||[];const isFav=!!state.saved[m.id];const license=m.license?`<div class="license-note">权利信息：${esc(m.license)}${m.creator?` · 作者：${esc(m.creator)}`:''}</div>`:'';
 const allLines=[...new Set(videos.map(x=>x.line||'原始文件'))];
 const files=videos.length?`<div class="episodes"><h4>播放线路 · ${allLines.length} 条线路，${videos.length} 个候选地址</h4><p class="source-hint">当前视频出现解码或网络错误时，将依次尝试同一集的其他候选地址。</p><div class="episode-list">${videos.map((f,i)=>`<button class="episode-btn" data-action="play" data-id="${esc(m.id)}" data-index="${i}">${icon('play')} ${esc(f.name)} <small>${esc(f.line||f.format||'视频')}</small></button>`).join('')}</div></div>`:`<div class="license-note">各候选来源尚未返回浏览器可直接播放的 MP4、WebM 或 HLS 地址。外部网页 URL 不能直接作为视频源。</div>`;
 return `<div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(m.title)}详情"><button class="dialog-close" data-action="close" aria-label="关闭">${icon('x')}</button><div class="detail-visual"><img src="${esc(safeUrl(m.image))}" onerror="markPosterFailed(this)" alt="${esc(m.title)}封面"/><span class="detail-placeholder">${icon('film')}<small>海报暂缺</small></span></div><div class="detail-info"><span class="eyebrow">CANGBAI / AGGREGATED MEDIA</span><h2>${esc(m.title)}</h2><div class="detail-tags"><span>${esc(m.year||'年份未知')}</span><span>${esc(m.sourceCount||1)} 个返回详情的来源</span><span>${videos.length} 条候选视频</span></div><p>${esc(m.description||'暂无简介')}</p><div class="detail-actions">${videos.length?`<button class="btn btn-primary" data-action="play" data-id="${esc(m.id)}" data-index="0">${icon('play')} 开始播放</button>`:''}<button class="btn btn-glass" data-action="fav" data-id="${esc(m.id)}">${icon(isFav?'check':'plus')} ${isFav?'已收藏':'加入收藏'}</button>${m.sourceUrl&&safeUrl(m.sourceUrl)?`<a class="btn btn-glass" href="${esc(safeUrl(m.sourceUrl))}" target="_blank" rel="noopener noreferrer">来源网站 ${icon('arrow')}</a>`:''}</div>${files}${license}<p class="rights-warning">${esc(m.rightsNote||'播放前请确认内容使用和访问权限。')}</p></div></div>`;
}
async function openDetail(id){const movie=findMovie(id);if(!movie)return toast('影片信息尚未加载');state.modal={id,type:'detail'};showModal(`<div class="dialog"><button class="dialog-close" data-action="close" aria-label="关闭">${icon('x')}</button><div class="detail-loading">正在并行获取「${esc(movie.title)}」的候选线路…</div></div>`);try{
 const qs=new URLSearchParams();qs.set('ids',JSON.stringify((movie.sourceIds?.length?movie.sourceIds:[id]).slice(0,8)));const r=await fetch(`/api/detail?${qs}`);if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();if(data.error)throw Error(data.detail||data.error);if(state.modal?.id!==id)return;data.id=id;data.sourceIds=movie.sourceIds;state.modal.detail=data;showModal(detailMarkup(data));
 }catch(e){if(state.modal?.id!==id)return;showModal(`<div class="dialog"><button class="dialog-close" data-action="close" aria-label="关闭">${icon('x')}</button><div class="detail-loading">详情和线路获取失败：${esc(e.message)}<div style="margin-top:24px"><button class="btn btn-glass" data-action="detail" data-id="${esc(id)}">重试</button></div></div></div>`)}
}
let currentHls=null;let playerWatchdog=null;
function freeHls(){if(playerWatchdog){clearTimeout(playerWatchdog);playerWatchdog=null}if(currentHls){currentHls.destroy();currentHls=null}}
function playCandidate(idx,auto=false){
 const m=state.modal;if(!m||m.type!=='play')return;const v=m.candidates[idx];if(!v)return toast('没有更多可尝试的线路');
 freeHls();document.querySelector('.real-player video')?.pause();m.index=idx;m.tried.add(idx);let failed=false;
 showModal(`<div class="dialog player-dialog" role="dialog" aria-modal="true" aria-label="${esc(m.detail.title)}播放"><button class="dialog-close" data-action="close" aria-label="关闭">${icon('x')}</button><div class="player-body real-player"><video controls playsinline preload="metadata" poster="${esc(safeUrl(m.detail.image))}" aria-label="${esc(m.detail.title)}视频播放器"></video></div><div class="player-actions"><div><strong>${esc(m.detail.title)}</strong><small>${esc(v.name)} · ${esc(v.line||'媒体原站')} · 第 ${idx+1}/${m.candidates.length} 个候选${auto?' · 自动换源':''}</small></div><button class="btn btn-glass" data-action="next-line">${icon('arrow')} 换下一条线路</button><button class="btn btn-glass" data-action="back-detail" data-id="${esc(m.id)}">返回详情</button></div><div class="video-disclaimer">视频由第三方媒体服务直连提供。仅在相同剧集的候选视频间尝试换源；无法播放请核对权限、地区与格式。<a href="./copyright.html">版权与侵权投诉</a></div></div>`);
 const el=document.querySelector('.real-player video');if(!el)return;
 const fail=()=>{if(failed||state.modal!==m||m.type!=='play'||m.index!==idx)return;failed=true;freeHls();el.pause();const next=m.candidates.findIndex((_,i)=>!m.tried.has(i));if(next>=0){toast(`当前线路播放失败，自动尝试第 ${next+1} 条`);playCandidate(next,true)}else toast('全部候选线路均无法播放；请检查视频权限或稍后重试')};
 el.addEventListener('error',fail,{once:true});
 const clearWatch=()=>{if(playerWatchdog){clearTimeout(playerWatchdog);playerWatchdog=null}};
 const armWatch=()=>{clearWatch();if(!el.paused)playerWatchdog=setTimeout(fail,17000)};
 const startPlayback=()=>el.play().catch(error=>{if(error.name==='NotAllowedError'){clearWatch();toast('请点击播放器中的播放按钮')}else if(error.name!=='AbortError')fail()});
 el.addEventListener('playing',clearWatch);
 el.addEventListener('pause',clearWatch);
 el.addEventListener('play',armWatch);
 el.addEventListener('waiting',armWatch);
 el.addEventListener('stalled',armWatch);
 playerWatchdog=setTimeout(fail,17000);
 const uri=safeUrl(v.url);if(!uri){fail();return}
 if(/\.m3u8(\?|#|$)/i.test(uri)){
  if(el.canPlayType('application/vnd.apple.mpegurl')){el.src=uri;startPlayback()}
  else if(window.Hls?.isSupported()){currentHls=new window.Hls({maxBufferLength:30,manifestLoadPolicy:{default:{maxTimeToFirstByteMs:8000,maxLoadTimeMs:10000,timeoutRetry:{maxNumRetry:0},errorRetry:{maxNumRetry:0}}}});currentHls.loadSource(uri);currentHls.attachMedia(el);currentHls.on(window.Hls.Events.MANIFEST_PARSED,startPlayback);currentHls.on(window.Hls.Events.ERROR,(_,data)=>{if(data.fatal)fail()});}
  else fail();
 }else{el.src=uri;startPlayback()}
}
function openPlayer(id,index=0){const m=state.modal?.detail;if(!m||m.id!==id)return openDetail(id);const chosen=m.videos?.[index];if(!chosen)return toast('此作品暂无直接播放地址');const same=(m.videos||[]).filter(x=>(x.episodeKey||'movie')===(chosen.episodeKey||'movie'));const seen=new Set();const candidates=[chosen,...same.filter(x=>x!==chosen)].filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true}).slice(0,16);state.modal={id,type:'play',detail:m,candidates,index:0,tried:new Set()};playCandidate(0)}
function toggleFav(id){const m=state.modal?.detail?.id===id?state.modal.detail:findMovie(id);if(!m)return;
 if(state.saved[id])delete state.saved[id];else state.saved[id]={id:m.id,title:m.title,year:m.year,image:m.image,type:m.type,sourceUrl:m.sourceUrl,description:m.description,sourceIds:m.sourceIds,discovery:m.discovery,kind:m.kind,rating:m.rating,episodesInfo:m.episodesInfo};
 try{localStorage.setItem(storageKey,JSON.stringify(state.saved))}catch{}
 toast(state.saved[id]?'已加入我的收藏':'已取消收藏');if(state.modal?.type==='detail')showModal(detailMarkup(state.modal.detail));renderMain();
}
function navigate(nav){if(nav==='发现')state.discoverFacet='';closeModal();state.nav=nav;state.query='';document.getElementById('globalSearch').value='';history.replaceState(null,'',`#/${encodeURIComponent(nav)}`);if(nav==='影视源目录')loadCatalog();else if(nav!=='我的收藏')loadArchive(1);else{state.reqSeq++;state.loading=false;renderMain();}window.scrollTo({top:0,behavior:'smooth'});}
function queryTo(q){state.nav=state.nav==='影视源目录'?'影视源目录':'聚合搜索';state.query=q;document.getElementById('globalSearch').value=q;history.replaceState(null,'',`#/${encodeURIComponent(state.nav)}`);closeModal();if(state.nav==='影视源目录')loadCatalog();else loadArchive(1);window.scrollTo({top:0,behavior:'smooth'});}
function showAbout(){state.modal={type:'about'};showModal(`<div class="dialog about-dialog" role="dialog" aria-modal="true"><button class="dialog-close" data-action="close" aria-label="关闭">${icon('x')}</button><div class="detail-loading about-copy"><span class="eyebrow">ABOUT CANGBAI</span><h2>开放的多源影视搜索架构</h2><p>苍柏影院支持搜索电影、电视剧与热播作品，聚合搜索使用后台已启用并确认授权的影视源。</p><p>播放器支持浏览器直连 MP4/WebM/HLS，当前线路播放失败会依次尝试同集其他候选视频。不利用 Cloudflare 免费 Workers 中转视频内容。</p><p>各来源的版权、跨域访问和可用性必须单独验证。本站不盈利，但非营利不代表免除著作权责任。若权利人发现涉及侵权的内容或链接，请联系站长申请核查与删除。</p><p><a class="about-legal-link" href="./copyright.html">版权声明与侵权投诉 →</a></p><button class="btn btn-primary" data-action="close">了解</button></div></div>`)}
let timer=null;
document.getElementById('searchIcon').innerHTML=icon('search');document.getElementById('heartIcon').innerHTML=icon('heart');
document.getElementById('globalSearch').placeholder='搜索电影、剧集…';
document.getElementById('globalSearch').addEventListener('input',e=>{const q=e.target.value;clearTimeout(timer);timer=setTimeout(()=>queryTo(q.trim()),420)});
document.getElementById('favoritesButton').addEventListener('click',()=>navigate('我的收藏'));
document.getElementById('brandHome').addEventListener('click',e=>{e.preventDefault();state.discoverFilter='all';navigate('发现')});
document.body.addEventListener('click',e=>{
 const b=e.target.closest('[data-action],[data-nav],[data-query],[data-discover-filter],[data-browse-kind],[data-hero-index],[data-discover-facet]');if(!b){if(e.target.id==='modalOverlay')closeModal();return}
 if(b.dataset.heroIndex!==undefined){selectHero(b.dataset.heroIndex,b.classList.contains('hero-choice'));return}
 if(b.matches('a[data-nav]'))e.preventDefault();
 if(b.dataset.nav){if(b.dataset.nav==='发现')state.discoverFilter='all';navigate(b.dataset.nav);return}
 if(b.dataset.browseKind){state.discoverFilter=b.dataset.browseKind;state.discoverFacet=b.dataset.facet||'';navigate('聚合搜索');return}
 if(b.dataset.discoverFacet!==undefined){state.discoverFacet=b.dataset.discoverFacet;renderMain();return}
 if(b.dataset.discoverFilter){state.discoverFilter=b.dataset.discoverFilter;state.discoverFacet='';renderMain();return}
 if(b.dataset.query){queryTo(b.dataset.query);return}
 const act=b.dataset.action,id=b.dataset.id;
 if(act==='close')closeModal();
 if(act==='about')showAbout();
 if(act==='top')window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 if(act==='detail')openDetail(id);
 if(act==='play')openPlayer(id,Number(b.dataset.index||0));
 if(act==='back-detail'&&state.modal?.detail){freeHls();state.modal.type='detail';showModal(detailMarkup(state.modal.detail));}
 if(act==='next-line'&&state.modal?.type==='play'){const m=state.modal;const next=m.candidates.findIndex((_,i)=>!m.tried.has(i));if(next>=0)playCandidate(next);else toast('没有更多未尝试的线路');}
 if(act==='catalog-retry')loadCatalog();
 if(act==='fav')toggleFav(id);
 if(act==='reset')queryTo('');
 if(act==='retry')loadArchive(state.page);
 if(act==='prev'&&state.page>1){loadArchive(state.page-1);window.scrollTo(0,0)}
 if(act==='next'){loadArchive(state.page+1);window.scrollTo(0,0)}
});
document.body.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.poster-art')){e.preventDefault();if(e.target.dataset.query)queryTo(e.target.dataset.query);else openDetail(e.target.dataset.id)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal)closeModal();if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&!state.modal){e.preventDefault();document.getElementById('globalSearch').focus()}});
const hash=decodeURIComponent(location.hash.replace(/^#\//,''));if(hash==='影视源目录')history.replaceState(null,'','#/');else if(navs.includes(hash))state.nav=hash;
renderMain();if(state.nav==='影视源目录')loadCatalog();else loadArchive(1);

function refreshDiscoveryWhenDue(){
 if(document.hidden||!isDiscovery()||state.loading||state.modal||Date.now()-state.lastDiscoverCheck<300000)return;
 const due=Date.parse(state.discoverNextRefresh)||0;
 if(state.discoverYear!==currentYear()||Date.now()>=due)loadArchive(1);
}
setInterval(refreshDiscoveryWhenDue,60000);
document.addEventListener('visibilitychange',refreshDiscoveryWhenDue);
setInterval(()=>{const hero=document.querySelector('.hero');if(document.hidden||state.loading||state.modal||state.nav!=='发现'||!hero||hero.matches(':hover,:focus-within')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;selectHero(state.heroIndex+1)},7000);
