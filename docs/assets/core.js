(function (root) {
  'use strict';
  const collator = new Intl.Collator('fr');
  const unique = a => [...new Set(a)];
  const sort = a => unique(a).sort(collator.compare);
  function smartSort(a) {
    return unique(a).sort((x,y) => {
      const nx = /^\d+/.exec(x), ny = /^\d+/.exec(y);
      if (nx && ny) return Number(nx[0])-Number(ny[0]) || collator.compare(x,y);
      if (nx) return -1;
      if (ny) return 1;
      return collator.compare(x,y);
    });
  }
  function radius(value, max) { return max > 0 ? Math.max(1.5,35*Math.sqrt(Math.max(0,value)/max)) : 1; }
  function size(value,max) { return max > 0 ? Math.max(7,70*Math.sqrt(Math.max(0,value)/max)) : 7; }
  // Traduction de label_examples() : rangs R à partir de 1 -> indices JS à partir de 0.
  function labelExamples(points) {
    const n=points.length;
    if (!n) return [];
    const head=Math.min(n,Math.max(5,Math.min(10,Math.ceil(n/40))));
    const ranks=Array.from({length:head},(_,i)=>i);
    for(let i=head;i<n;i+=40) ranks.push(i);
    ranks.push(n-1);
    const sorted=points.map((point,i)=>({point,i})).sort((a,b)=>b.point[2]-a.point[2] || a.i-b.i);
    return unique(ranks).map(i=>sorted[i].point);
  }
  function countLabel(value) {
    const text=format(value).replace(/[\u00a0\u202f]/g,' ');
    return {text,width:Math.max(28,9+7*text.length)};
  }
  function label(date) {
    if (date === '9999') return tr('Toutes les années');
    return date.split('-').reverse().join('/');
  }
  const escape = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr = s => root.SiteI18n?.t(s) ?? s;
  const format = n => new Intl.NumberFormat(root.SiteI18n?.lang ?? 'fr').format(n);
  function displayValue(prefix,value) {
    value=String(value);
    if (prefix==='bureau') return value.replace(/^(.+?)\s*\((\d{2,3}|2[AB])\)$/i,(_,name,code)=>code+' '+name.toLocaleLowerCase('fr').replace(/(^|[ \-'])\p{L}/gu,c=>c.toLocaleUpperCase('fr')));
    if (['unite','Division','Brigade','corps','armee'].includes(prefix)) {
      return value.replace(/^(.+?)\s+(\d{1,4})(?=\s*(?:\(|$))/,(_,type,num)=> {
        const n=Number(num); if (!n) return type+' '+num;
        const feminine=/^(SECTION|DIVISION|BRIGADE|COMPAGNIE|BATTERIE|ARM[ÉE]E)\b/i.test(type);
        return n+(n===1?(feminine?'re':'er'):'e')+' '+type;
      });
    }
    return value;
  }
  const styles = [
    ['circle','#D73027'],['circle','#7B3294'],['circle','#E08214'],
    ['square','#D73027'],['square','#7B3294'],['square','#E08214'],
    ['diamond','#D73027'],['diamond','#7B3294'],['diamond','#E08214'],
    ['circle','#D73027',true],['circle','#7B3294',true],['circle','#E08214',true],
    ['square','#D73027',true],['square','#7B3294',true],
    ['diamond','#777777'],['circle','#BBBBBB']
  ];
  function svg(index) {
    const [shape,color,hatched] = styles[index];
    const defs = hatched ? `<defs><pattern id="h" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="white"/><line x1="0" y1="0" x2="0" y2="4" stroke="${color}" stroke-width="2"/></pattern></defs>` : '';
    const attr = `fill="${hatched?'url(#h)':color}" stroke="${color}" stroke-width="2"`;
    const object = shape === 'circle' ? `<circle cx="16" cy="16" r="12" ${attr}/>` : shape === 'square' ? `<rect x="5" y="5" width="22" height="22" ${attr}/>` : `<polygon points="16,3 29,16 16,29 3,16" ${attr}/>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${defs}${object}</svg>`)}`;
  }
  const sections = [
    ['Lieu de naissance',[['Pays','Pays'],['Region','Région'],['departement','Département']]],
    ['Lieu de recrutement',[['bureau','Bureau']]],
    ['Unités militaires',[['armee','Armée'],['corps',"Corps d’armée"],['Division','Division'],['Brigade','Brigade'],['unite','Unité / régiment']]],
    ['Date de décès',[['jourdeces','Jour']]],['Lieu de décès 1',[['lieudeces1','Lieu']]],['Lieu de décès 2',[['lieudeces2','Détail']]]
  ];
  function popup(point,strings) {
    return `<div class="deces-popup"><b>${tr('Nombre de décès')} : ${format(point[2])}</b><div class="popup-themes">` + sections.map(([title,fields]) => `<section class="popup-theme"><h3>${escape(tr(title))}</h3>` + fields.map(([prefix,name]) => {
      const pairs = point[5][prefix];
      if (!pairs?.length) return '';
      return `<div class="popup-section"><b>${escape(tr(name))}</b><br>` + pairs.map(([v,n])=>escape(displayValue(prefix,strings[v]))+(n===null?'':` (${escape(strings[n])})`)).join('<br>')+'</div>';
    }).join('')+'</section>').join('')+'</div></div>';
  }
  const api = {displayValue,unique,sort,smartSort,radius,size,labelExamples,countLabel,label,escape,format,styles,svg,popup};
  if (typeof module !== 'undefined') module.exports = api;
  else root.MapCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
