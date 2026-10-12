(function () {
  'use strict';
  let lang=new URLSearchParams(location.search).get('lang');
  if (!['fr','en','de','es'].includes(lang)) lang='fr';
  const t = text => window.SITE_TRANSLATIONS[lang][text] ?? text;
  window.SiteI18n={get lang(){return lang;},t};
  const $=id=>document.getElementById(id);
  const mapFeedback=$('map-feedback-link');
  function feedbackUrl() {
    try {
      const configured=window.APP_CONFIG.feedbackFormUrls?.[lang] ?? window.APP_CONFIG.feedbackFormUrl;
      const url=new URL(configured);
      return url.protocol==='https:' && !url.username && !url.password && /^\/.*forms\//.test(url.pathname) ? url : null;
    } catch {return null;}
  }
  // Retain original wording so repeated language changes never translate a translation.
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const texts=[];let node;
  while((node=walker.nextNode())) if(node.textContent.trim() && !['SCRIPT','STYLE','OPTION'].includes(node.parentElement?.tagName)) {
    const original=node.textContent.trim();
    if(window.SITE_TRANSLATIONS.fr[original]) texts.push([node,original]);
  }
  const attrs=[];
  for(const element of document.querySelectorAll('[title],[aria-label],[placeholder]')) for(const attr of ['title','aria-label','placeholder']) {
    const value=element.getAttribute(attr);if(value) attrs.push([element,attr,value]);
  }
  function translate() {
    const url=feedbackUrl();
    mapFeedback.hidden=!url;
    if(url)mapFeedback.href=url.href;else mapFeedback.removeAttribute('href');
    document.documentElement.lang=lang;$('site-language').value=lang;
    for(const [node,original] of texts) node.textContent=t(original);
    for(const [node,attr,original] of attrs) node.setAttribute(attr,t(original));
    document.title=window.SITE_CONTENT[lang].title;
    for(const node of document.querySelectorAll('[data-message]')) node.textContent=t(node.dataset.message);
  }
  const slugs=['explorer','utiliser','resultats','ameliorer'];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function route() {
    const page=location.hash.slice(1)||'accueil',data=window.SITE_CONTENT[lang];
    const map=page==='carte',feedback=page==='contribuer';$('map-view').hidden=!map;$('site-content').hidden=map||feedback;$('feedback-view').hidden=!feedback;
    window.dispatchEvent(new Event('site-route-change'));
    if(map) {window.dispatchEvent(new Event('site-map-open'));window.dispatchEvent(new Event('resize'));return;}
    $('map-panel').classList.remove('map-fullscreen');document.body.classList.remove('fullscreen-open');
    if(feedback){
      $('feedback-view').querySelector('details').open=true;
      const url=feedbackUrl();
      $('feedback-grist').hidden=!url;
      $('feedback-view').querySelector('details').hidden=!!url;
      if(url)$('feedback-grist-link').href=url.href;
      return;
    }
    if(page==='donnees'){
      const d=data.dataAcknowledgements;
      $('site-content').innerHTML='<article class="site-page"><h1>'+escape(d.title)+'</h1>'+d.paragraphs.map(p=>/^\d\)/.test(p)?'<h2>'+escape(p)+'</h2>':'<p>'+escape(p)+'</p>').join('')+'<p><a href="#accueil">'+escape(t('Retour à l’accueil'))+'</a></p></article>';
      return;
    }
    if(page==='licence'){
      const l=data.license;
      $('site-content').innerHTML='<article class="site-page"><h1>'+escape(l.title)+'</h1>'+l.paragraphs.map(p=>'<p>'+escape(p)+'</p>').join('')+'<p><a rel="license" href="https://creativecommons.org/licenses/by/4.0/">'+escape(l.link)+'</a></p><p><a href="#accueil">'+escape(t('Retour à l’accueil'))+'</a></p></article>';
      return;
    }
    const i=slugs.indexOf(page);
    $('site-content').innerHTML='<article class="site-page">'+(i<0?'<img class="home-brand" src="assets/stathistic-logo.png" alt="StatHistic — 1914–1918" width="240" height="160">':'')+'<p class="site-kicker">'+escape(data.kicker)+'</p><h1>'+escape(i<0?data.title:data.titles[i])+'</h1>'+(i<0?data.intro:data.pages[i]).map(p=>'<p>'+escape(p)+'</p>').join('')+(i===3?'<p><a class="explore-link" href="#contribuer">'+escape(t('Accéder au formulaire'))+'</a></p>':'')+'<p><a class="explore-link" href="#carte">'+escape(t('Explorer la carte →'))+'</a></p>'+(i<0?'<nav class="site-links">'+slugs.map((s,j)=>'<a href="#'+s+'">'+escape(data.titles[j])+'</a>').join('')+'<a href="#donnees">'+escape(data.dataAcknowledgements.title)+'</a><a href="#licence">'+escape(t('Licence et réutilisation'))+' · CC BY 4.0</a></nav>':'<p><a href="#accueil">'+escape(t('Retour à l’accueil'))+'</a></p>')+'</article>';
  }
  $('site-language').addEventListener('change',()=>{
    lang=$('site-language').value;
    const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);
    translate();route();window.dispatchEvent(new Event('site-language-change'));
  });
  window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0);});
  translate();route();
})();
