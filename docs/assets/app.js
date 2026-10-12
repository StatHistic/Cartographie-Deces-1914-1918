/* Leaflet 1.9.4, sans Shiny ni service côté serveur. */
(async function () {
  'use strict';
  const T = s => window.SiteI18n?.t(s) ?? s;
  const C = window.MapCore, cfg = window.APP_CONFIG, $ = id => document.getElementById(id);
  const ids = ['theme','criterion','modality','unit-type','unit-number','unit-exact','temporal'];
  let map, layer, manifest, entries, selected, series, strings, index = 0, timer = null, playing = false;
  let revision = 0, loading = true, activeId = null, cacheBytes = 0;
  const cache = new Map(), pending = new Map();
  const dataBase = cfg.dataBaseUrl ? new URL(cfg.dataBaseUrl) : new URL('data/',document.baseURI);
  if (!dataBase.pathname.endsWith('/')) dataBase.pathname += '/';
  const report = (message,error=false) => { $('status').dataset.message=message; $('status').textContent = T(message); $('status').classList.toggle('error',error); };
  function fill(id,values,prefer,labels={}) {
    const node = $(id), previous = prefer ?? node.value;
    node.replaceChildren(...values.map(value => {
      const option = document.createElement('option'); option.value=String(value); option.textContent=['theme','criterion','temporal','year'].includes(id)||value==='Ensemble'||labels[value]?T(labels[value]??String(value)):(labels[value]??String(value)); return option;
    }));
    node.value = values.map(String).includes(String(previous)) ? String(previous) : String(values[0]??'');
    node.disabled = values.length === 0;
  }
  function show(id,visible) { $(id).closest('.field').hidden = !visible; }
  function setNavigation() {
    const count = series?.dates.length??0;
    for (const id of ['previous','fs-previous']) $(id).disabled = loading || !count || index === 0;
    for (const id of ['next','fs-next']) $(id).disabled = loading || !count || index === count-1;
    for (const id of ['play','fs-play']) $(id).disabled = loading || count < 2 || playing;
    for (const id of ['pause','fs-pause']) $(id).disabled = !playing;
    $('animation-status').textContent = `${playing?T('Lecture')+' — ':''}${count?index+1:0} / ${count}`;
  }
  function pause() { clearTimeout(timer); timer=null; playing=false; setNavigation(); }
  async function fetchJson(path) {
    const url = path==='catalog.json' && cfg.catalogUrl ? new URL(cfg.catalogUrl) : new URL(path,dataBase);
    let response;
    try { response = await fetch(url); }
    catch { throw new Error(T('Lecture des données impossible. Vérifier la connexion, l’adresse du dossier et le CORS du bucket.')); }
    if (!response.ok) throw new Error(`${T('Données indisponibles')} (HTTP ${response.status}) : ${path}`);
    try { return await response.json(); } catch { throw new Error(`${T('Fichier JSON invalide')} : ${path}`); }
  }
  async function bundle(path) {
    if (cache.has(path)) { const item=cache.get(path); cache.delete(path); cache.set(path,item); return item.value; }
    if (pending.has(path)) return pending.get(path);
    const task = (async()=>{
      const value = await fetchJson(path);
      if (value.version !== 1) throw new Error(T('Version du format de données non prise en charge.'));
      // Estimation conservative de mémoire : JSON UTF-16 + objets décodés.
      const bytes = JSON.stringify(value).length*4;
      cache.set(path,{value,bytes}); cacheBytes += bytes;
      while (cacheBytes > cfg.cacheBytes && cache.size > 1) {
        const oldest = cache.keys().next().value; cacheBytes-=cache.get(oldest).bytes; cache.delete(oldest);
      }
      return value;
    })();
    pending.set(path,task);
    try { return await task; } finally { pending.delete(path); }
  }
  function cascade(changed='theme') {
    if (!manifest) return;
    if (changed==='theme') {
      const criteria=C.sort(entries.filter(e=>e.theme===$('theme').value).map(e=>e.criterion));
      const birthOrder=['Pays','Région','Region','Département','Commune'];
      if ($('theme').value.toLocaleLowerCase('fr').includes('naissance')) {
        criteria.sort((a,b)=>(birthOrder.includes(a)?birthOrder.indexOf(a):99)-(birthOrder.includes(b)?birthOrder.indexOf(b):99));
      }
      fill('criterion',criteria,'');
    }
    const base = entries.filter(e=>e.theme===$('theme').value && e.criterion===$('criterion').value);
    const regiment = $('theme').value==='Unités militaires' && $('criterion').value==='Régiment';
    show('modality',!regiment); show('unit-type',regiment); show('unit-number',false); show('unit-exact',false);
    let modality;
    if (regiment) {
      const available = C.unique(base.flatMap(e=>e.units.map(u=>u[0]??'__missing__')));
      const types = [...manifest.typeRank.filter(t=>available.includes(t)),...C.sort(available.filter(t=>!manifest.typeRank.includes(t)))];
      if (['theme','criterion'].includes(changed)) fill('unit-type',types,'',{'__missing__':'Type non renseigné'});
      const type = $('unit-type').value==='__missing__'?null:$('unit-type').value;
      const units = base.flatMap(e=>e.units).filter(u=>u[0]===type);
      const numbers = C.unique(units.map(u=>u[1])).sort((a,b)=>(a??Infinity)-(b??Infinity));
      const withNumbers = numbers.some(n=>n!==null);
      show('unit-number',withNumbers);
      if (['theme','criterion','unit-type'].includes(changed)) fill('unit-number',withNumbers?numbers.map(n=>n===null?'__missing__':String(n)):[],'',{'__missing__':'Numéro non renseigné'});
      const no = $('unit-number').value==='__missing__'?null:Number($('unit-number').value);
      const candidates = C.sort(base.filter(e=>e.units.some(u=>u[0]===type && (!withNumbers || u[1]===no))).map(e=>e.modality));
      show('unit-exact',candidates.length>1);
      if (changed!=='temporal') fill('unit-exact',candidates,changed==='unit-exact'?$('unit-exact').value:'');
      modality = $('unit-exact').value;
    } else {
      const modalities = ($('theme').value==='Unités militaires'?C.smartSort:C.sort)(base.map(e=>e.modality));
      if (['theme','criterion'].includes(changed)) { fill('modality',modalities,''); }
      modality = $('modality').value;
    }
    const matching = base.filter(e=>e.modality===modality);
    fill('temporal',['Année','Mois','Jour'].filter(t=>matching.some(e=>e.temporal===t)),$('temporal').value);
    selected = matching.find(e=>e.temporal===$('temporal').value);
    loadSelection();
  }
  async function loadSelection() {
    if (selected?.id===activeId && series) return;
    const token = ++revision, entry=selected;
    pause(); loading=true; series=null; activeId=null; layer?.setData([],1,'Année'); map?.closePopup();
    $('date-selectors').hidden=true; $('current-date').textContent=''; $('fs-date').textContent='';
    $('legends').replaceChildren(); $('fs-legend').replaceChildren(); setNavigation();
    if (!entry) { loading=false; report('Aucune sélection disponible.'); return; }
    report('Chargement de la sélection…');
    try {
      const b = await bundle(entry.file);
      if (token!==revision) return; // Une réponse tardive ne remplace jamais la sélection courante.
      if (!b.series[entry.id]) throw new Error(T('Catalogue et lots incohérents : republier le dossier de données complet.'));
      series=b.series[entry.id]; strings=b.strings; activeId=entry.id; index=0; loading=false;
      map.fitBounds(cfg.initialBounds,{animate:false});
      legends(); render();
    } catch (e) {
      if (token!==revision) return;
      loading=false; report(e.message,true); setNavigation(); $('retry').hidden=false;
    }
  }
  function datesMenus() {
    const d=series.dates[index], parts=d?.split('-')??[];
    $('date-selectors').hidden=!d;
    if (!d) return;
    fill('year',C.unique(series.dates.map(x=>x.split('-')[0])),parts[0],{'9999':'Toutes les années'});
    const month=parts[1],day=parts[2];
    show('month',!!month); show('day',!!day);
    const monthLabels=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1).padStart(2,'0'),new Intl.DateTimeFormat(window.SiteI18n?.lang??'fr',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2000,i,1)))]));
    if (month) fill('month',C.unique(series.dates.filter(x=>x.startsWith(parts[0]+'-')).map(x=>x.split('-')[1])),month,monthLabels);
    if (day) fill('day',C.unique(series.dates.filter(x=>x.startsWith(parts[0]+'-'+month+'-')).map(x=>x.split('-')[2])),day);
  }
  function render() {
    if (!series) return;
    map.closePopup(); $('retry').hidden=true;
    const date=series.dates[index];
    const points=(series.frames[index]??[]).map(i=>series.points[i]);
    layer.setData(points,series.max,selected.temporal);
    datesMenus();
    $('current-date').textContent=date?C.label(date):T('Aucune date');
    $('fs-date').textContent=$('current-date').textContent;
    const total=points.reduce((sum,p)=>sum+p[2],0);
    const modality=selected.modality==='Ensemble'?T('Ensemble'):selected.modality;
    $('map-summary').textContent=[...C.unique([T(selected.theme),T(selected.criterion),modality]),$('current-date').textContent,`${C.format(total)} ${T('décès')}`].filter(Boolean).join(' · ');
    report(points.length?`${C.format(points.length)} ${T(points.length>1?'points':'point')} — ${C.format(points.reduce((s,p)=>s+p[2],0))} ${T('décès')}`:'Aucun point avec coordonnées et date valides pour cette sélection.');
    setNavigation();
    // Surface de diagnostic en lecture seule pour les vérifications locales.
    window.APP_DIAGNOSTICS = Object.freeze({selection:selected.id,temporal:selected.temporal,date,points:points.length,max:series.max});
  }
  function navigate(delta) { pause(); if (!series) return; index=Math.max(0,Math.min(series.dates.length-1,index+delta)); render(); }
  function play() {
    if (loading || !series || series.dates.length<2) return;
    pause(); if (index>=series.dates.length-1) { index=0; render(); }
    playing=true; setNavigation(); tick();
  }
  function tick() {
    timer=setTimeout(()=>{
      if (!playing) return;
      if (index<series.dates.length-1) { index++; render(); }
      if (index>=series.dates.length-1) pause(); else tick();
    },Number($('speed').value));
  }
  function legends() {
    $('legends').replaceChildren();
    if (selected.temporal==='Année') { $('fs-legend').replaceChildren(); return; }
    const names=C.unique(series.points.map(p=>manifest.armies[p[3]]));
    const sorted=[...C.smartSort(names.filter(x=>!manifest.armies.slice(14).includes(x))),...manifest.armies.slice(14).filter(x=>names.includes(x))];
    const armyHtml='<b>'+T('Armée')+'</b><div class="army-legend">'+sorted.map(name=>`<span><img src="${C.svg(manifest.armies.indexOf(name))}" alt="">${C.escape(T(name))}</span>`).join('')+'</div>';
    $('legends').insertAdjacentHTML('beforeend','<div class="army-section">'+armyHtml+'</div>');
    $('fs-legend').innerHTML=armyHtml;
  }
  function fullscreen(enabled) {
    $('map-panel').classList.toggle('map-fullscreen',enabled);
    document.body.classList.toggle('fullscreen-open',enabled);
    $('fullscreen').title=T(enabled?'Quitter le plein écran':'Afficher la carte en plein écran');
    $('fullscreen').setAttribute('aria-pressed',String(enabled));
    requestAnimationFrame(()=>map.invalidateSize());
  }
  // Même SVG que Shiny, dessiné sur UN canvas : aucun marqueur DOM par point.
  function createLayer(images) {
    return L.Layer.extend({
      onAdd(m) {
        this._map=m; this.points=[]; this.hits=[];
        this.canvas=L.DomUtil.create('canvas','point-canvas leaflet-zoom-hide',m.getPanes().overlayPane);
        this.canvas.style.pointerEvents='none';
        m.on('moveend zoomend resize',this.draw,this); m.on('click',this.click,this); this.draw();
      },
      onRemove(m) { m.off('moveend zoomend resize',this.draw,this);m.off('click',this.click,this);this.canvas.remove(); },
      setData(points,max,temporal) {
        this.points=points;this.max=max;this.temporal=temporal;
        this.examples=this.showValues?C.labelExamples(points):[];
        this.draw();
      },
      draw() {
        if (!this._map) return;
        const m=this._map,dim=m.getSize(),ratio=window.devicePixelRatio||1;
        L.DomUtil.setPosition(this.canvas,m.containerPointToLayerPoint([0,0]));
        this.canvas.style.width=dim.x+'px';this.canvas.style.height=dim.y+'px';
        this.canvas.width=Math.round(dim.x*ratio);this.canvas.height=Math.round(dim.y*ratio);
        const ctx=this.canvas.getContext('2d');ctx.scale(ratio,ratio);this.hits=[];
        // Ordre par groupes d’armée comme dans addMarkers de l’application R.
        const groups = this.temporal==='Année'?[this.points]:C.unique(this.points.map(p=>p[3])).map(a=>this.points.filter(p=>p[3]===a));
        for (const group of groups) for (const p of group) {
          const xy=m.latLngToContainerPoint([p[1],p[0]]),r=C.radius(p[2],this.max),s=C.size(p[2],this.max);
          const extent=this.temporal==='Année'?r:s/2;
          if (xy.x < -extent || xy.y < -extent || xy.x > dim.x+extent || xy.y > dim.y+extent) continue;
          if (this.temporal==='Année') {
            ctx.beginPath();ctx.arc(xy.x,xy.y,r,0,Math.PI*2);ctx.fillStyle='rgba(215,48,39,0.55)';ctx.fill();ctx.strokeStyle='#D73027';ctx.lineWidth=1;ctx.stroke();
          } else ctx.drawImage(images[p[3]],xy.x-s/2,xy.y-s/2,s,s);
          this.hits.push({xy,point:p,r:this.temporal==='Année'?r:Math.max(10,s/2)});
        }
        // Étiquettes non interactives, dessinées après les symboles comme dans Shiny.
        if (this.showValues) for (const p of this.examples??[]) {
          const xy=m.latLngToContainerPoint([p[1],p[0]]),{text,width}=C.countLabel(p[2]);
          const x=xy.x-width/2+1,y=xy.y-25+1,w=width-2,h=17,r=4;
          if (x+w<0 || x>dim.x || y+h<0 || y>dim.y) continue;
          ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
          ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
          ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
          ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
          ctx.fillStyle='white';ctx.fill();ctx.strokeStyle='#9B2720';ctx.lineWidth=1;ctx.stroke();
          ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#333';
          ctx.fillText(text,xy.x,xy.y-12);
        }
      },
      click(event) {
        // Minimum 44 px touch target; keep symbol sizes proportional to counts.
        const touch=event.originalEvent?.pointerType==='touch' ||
          !!event.originalEvent?.sourceCapabilities?.firesTouchEvents ||
          !!window.matchMedia?.('(pointer: coarse)').matches;
        const hits=this.hits.map((h,index)=>({...h,index,distance:h.xy.distanceTo(event.containerPoint)}))
          .filter(h=>h.distance<=Math.max(h.r,touch?22:h.r))
          .sort((a,b)=>a.distance-b.distance || b.index-a.index);
        if (!hits.length || !strings) return;
        const node=document.createElement('div');
        node.innerHTML=C.popup(hits[0].point,strings);
        L.popup({pane:'topPopupPane',maxWidth:1100,minWidth:220,autoPan:true}).setLatLng([hits[0].point[1],hits[0].point[0]]).setContent(node).openOn(this._map);
      }
    });
  }
  if (cfg.feedbackEndpoint) {
    try {
      const endpoint = new URL(cfg.feedbackEndpoint);
      if (endpoint.protocol !== 'https:') throw new Error('HTTPS requis');
      $('feedback-form').action = endpoint.href;
      $('feedback-fields').disabled = false;
      $('feedback-status').dataset.message='L’envoi ouvrira la confirmation du service de réception.'; $('feedback-status').textContent = T('L’envoi ouvrira la confirmation du service de réception.');
    } catch {
      $('feedback-status').dataset.message='La réception des messages n’est pas configurée correctement.'; $('feedback-status').textContent = T('La réception des messages n’est pas configurée correctement.');
    }
  }
  try {
    if (!window.L) throw new Error(T('Leaflet n’a pas pu être chargé.'));
    map=L.map('map',{preferCanvas:true,wheelPxPerZoomLevel:300}).fitBounds(cfg.initialBounds);
    // Keep popups outside the transformed map pane's stacking context.
    const popupPane=map.createPane('topPopupPane',map.getContainer());
    popupPane.classList.add('top-popup-pane');
    const alignPopupPane=()=>L.DomUtil.setPosition(popupPane,L.DomUtil.getPosition(map.getPane('mapPane')) || L.point(0,0));
    map.on('move zoomend resize',alignPopupPane);
    alignPopupPane();
    let opened=!$('map-view').hidden;
    window.addEventListener('site-map-open',()=>{map.invalidateSize();if(!opened){map.fitBounds(cfg.initialBounds,{animate:false});opened=true;}});
    window.addEventListener('site-route-change',()=>{if($('map-view').hidden){pause();fullscreen(false);}});
    L.tileLayer(cfg.tileUrl,{attribution:cfg.tileAttribution,maxZoom:20}).addTo(map);
    const images=await Promise.all(C.styles.map((_,i)=>new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(T('Symbole cartographique non chargé')));image.src=C.svg(i);
    })));
    layer=new (createLayer(images))().addTo(map);
    const toggleValues=()=>{
      layer.showValues=!layer.showValues;
      layer.examples=layer.showValues?C.labelExamples(layer.points):[];
      for (const id of ['toggle-values','fs-toggle-values']) {
        $(id).textContent=T(layer.showValues?'Masquer les effectifs':'Afficher des effectifs');
        $(id).setAttribute('aria-pressed',String(layer.showValues));
      }
      layer.draw();
    };
    $('toggle-values').onclick=toggleValues;
    $('fs-toggle-values').onclick=toggleValues;
    manifest=await fetchJson('catalog.json');
    if (manifest.version!==1 || !Array.isArray(manifest.series)) throw new Error(T('Catalogue non compatible.'));
    entries=manifest.series;
    $('source').textContent=manifest.source;
    $('dataset-note').textContent=`${T('Jeu chargé')} : ${C.format(manifest.stats.validRows)} ${T('lignes')} · ${C.format(manifest.stats.series)} ${T('séries')}. ${T('Les dates et lieux disponibles dépendent du fichier fourni.')}`;
    fill('theme',C.sort(entries.map(e=>e.theme)),'Ensemble');
    for (const id of ids) $(id).addEventListener('change',()=>cascade(id));
    for (const id of ['previous','fs-previous']) $(id).onclick=()=>navigate(-1);
    for (const id of ['next','fs-next']) $(id).onclick=()=>navigate(1);
    for (const id of ['play','fs-play']) $(id).onclick=play;
    for (const id of ['pause','fs-pause']) $(id).onclick=pause;
    for (const id of ['year','month','day']) $(id).onchange=()=>{
      pause();if (!series) return;
      const matches=series.dates.filter(d=>d.startsWith($('year').value+(id!=='year'&&selected.temporal!=='Année'?'-'+$('month').value:'')));
      const desired=matches.find(d=>id==='day'?d.endsWith('-'+$('day').value):true);
      if (desired) { index=series.dates.indexOf(desired);render(); }
    };
    for (const id of ['speed','fs-speed']) $(id).oninput=()=>{
      const value=$(id).value; for (const other of ['speed','fs-speed']) $(other).value=value;
      for (const other of ['speed-value','fs-speed-value']) $(other).textContent=value+' ms';
      if (playing) {clearTimeout(timer);tick();}
    };
    window.addEventListener('site-language-change',()=>{
      for(const id of ['theme','criterion','temporal','year']) for(const option of $(id).options) option.textContent=T(option.value==='9999'?'Toutes les années':option.value);
      for(const id of ['modality','unit-type','unit-number','unit-exact']) for(const option of $(id).options) if(option.value==='Ensemble') option.textContent=T('Ensemble');
      if (series) {legends();render();}
      $('dataset-note').textContent=`${T('Jeu chargé')} : ${C.format(manifest.stats.validRows)} ${T('lignes')} · ${C.format(manifest.stats.series)} ${T('séries')}. ${T('Les dates et lieux disponibles dépendent du fichier fourni.')}`;
      for(const id of ['toggle-values','fs-toggle-values']) $(id).textContent=T(layer.showValues?'Masquer les effectifs':'Afficher des effectifs');
    });
    $('fullscreen').onclick=()=>fullscreen(!$('map-panel').classList.contains('map-fullscreen'));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')fullscreen(false);});
    $('retry').onclick=()=>{activeId=null;loadSelection();};
    cascade();
  } catch (e) { report(e.message,true); $('animation-status').textContent=T('Chargement interrompu'); }
})();
