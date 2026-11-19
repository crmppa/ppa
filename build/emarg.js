/* ===== Émargement (écran CRM) — ajout v2 =====
   QR en salle + mode « appareil du formateur », suivi en direct, feuille signée imprimable, feuille papier de secours. */
function emJours(s){const o=[];if(!s)return o;let d=parse(s.debut);const fin=s.fin?parse(s.fin):d;let guard=0;
 while(d<=fin&&guard<10){if(d.getDay()%6!==0)o.push(iso(d));d=new Date(d);d.setDate(d.getDate()+1);guard++}return o.length?o:[s.debut]}
function emStags(s){if(s&&s.stagList&&s.stagList.length)return s.stagList.map(x=>x.n||x.nom||'').filter(Boolean);
 const d=s&&(db.dos||{})[s.client];if(d&&d.sal)return d.sal.filter(x=>x.nom).map(x=>[x.nom,x.prenom].filter(Boolean).join(' '));return []}
function emSessions(){const u=curUser();let L=(db.sessions||[]).filter(s=>s.debut);
 if(u.kind==='formateur')L=L.filter(s=>s.formateur===u.id||s.formateur===u.mid);
 return L.sort((a,b)=>String(b.debut).localeCompare(String(a.debut)))}
function V_emarg(){
 const u=curUser();if(!['formateur','admin','direction'].includes(u.kind))return '<div class="empty">Réservé aux formateurs, à l’administration et à la direction.</div>';
 const L=emSessions();const sel=ui.emargSel||(L[0]&&L[0].id);const s=L.find(x=>x.id===sel);
 const opt=L.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(CL(x.client).nom)} · ${esc(x.titre||x.prog||'')} · ${fmt(x.debut)}</option>`).join('');
 if(!s)return `<div class="ph"><div><span class="eyebrow">Formation</span><h1>Émargement</h1><p>Aucune session. Planifiez une session pour générer sa feuille d’émargement.</p></div></div>`;
 const stg=emStags(s),jrs=emJours(s);
 return `<div class="ph"><div><span class="eyebrow">Formation</span><h1>Émargement</h1><p>Un QR code par session. Chaque stagiaire le scanne et signe sur son téléphone ; ou le formateur fait signer sur son appareil. La feuille se remplit en direct.</p></div><span class="sp" style="flex:1"></span><select data-emarg="sel" style="min-width:260px">${opt}</select></div>
 ${stg.length?'':'<div class="note" style="margin:0 0 14px">Cette session n’a pas encore de stagiaires. Ajoutez-les dans le dossier client pour qu’ils apparaissent ici.</div>'}
 <div style="display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px;align-items:start" class="emgrid">
  <section class="panel" style="padding:16px;text-align:center"><b style="font:800 15px var(--f-disp)">QR code de la salle</b>
   <div id="emargQR" style="width:220px;height:220px;margin:12px auto;display:grid;place-items:center;color:var(--muted)">Préparation…</div>
   <div style="font-size:12px;color:var(--muted)">Affichez-le en salle ou imprimez-le.</div>
   <div class="mfoot" style="justify-content:center;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-emarg="print">Imprimer le QR</button><button class="btn sm primary" data-emarg="device">Faire signer sur cet appareil</button></div>
  </section>
  <section class="panel" style="padding:0">
   <div style="display:flex;align-items:center;gap:8px;padding:14px 16px 8px"><b style="font:800 15px var(--f-disp)">Feuille d’émargement · en direct</b><span id="emargDot" style="width:8px;height:8px;border-radius:50%;background:var(--ok)"></span><span class="sp" style="flex:1"></span><button class="btn sm primary" data-emarg="pdf">Feuille signée (à imprimer / PDF)</button><button class="btn sm" data-emarg="paper">Feuille papier vierge</button></div>
   <div class="tw" style="padding:0 12px 14px"><table class="t emtab"><thead><tr><th>Stagiaire</th>${jrs.map((j,i)=>`<th colspan="2">Jour ${i+1} · ${fmt(j)}</th>`).join('')}</tr><tr><th></th>${jrs.map(()=>'<th style="font-size:10px">matin</th><th style="font-size:10px">ap-m</th>').join('')}</tr></thead><tbody id="emargLive"><tr><td colspan="${1+jrs.length*2}" style="color:var(--muted);padding:14px">Chargement…</td></tr></tbody></table></div>
  </section>
 </div>`;
}
let EMARG={tok:null,sel:null,poll:null,sheet:null};
function emLoadQR(){return new Promise(function(res){if(window.qrcode)return res();var sc=document.createElement('script');sc.src=((window.PPA&&PPA.lib)||'../lib/')+'qrcode-generator-1.4.4.min.js';sc.onload=function(){res()};sc.onerror=function(){res()};document.head.appendChild(sc)})}
async function emargEnsure(s){
 const sb=window.PPA&&PPA.sync&&PPA.sync.sb;if(!sb)return null;
 const r=await sb.rpc('emarg_create_sheet',{p_session_ref:s.id,p_titre:(CL(s.client).nom+' · '+(s.titre||s.prog||'')),p_jours:emJours(s).map(d=>({d})),p_stagiaires:emStags(s)});
 if(r.error||!r.data||!r.data.ok)return null;return r.data.token;
}
async function emargRefreshLive(){const sb=window.PPA&&PPA.sync&&PPA.sync.sb;if(!sb||!EMARG.tok)return;
 const r=await sb.rpc('emarg_get_sheet',{p_token:EMARG.tok});if(r.error||!r.data)return;EMARG.sheet=r.data;
 const tb=document.getElementById('emargLive');if(!tb)return;const s=emSessions().find(x=>x.id===EMARG.sel);if(!s)return;
 const jrs=emJours(s),stg=emStags(s),sig=r.data.signatures||[];
 const has=(st,j,d)=>sig.find(x=>x.stagiaire===st&&x.jour===j&&x.demi===d);
 tb.innerHTML=stg.map(st=>`<tr><td class="name">${esc(st)}</td>${jrs.map(j=>['m','a'].map(d=>{const v=has(st,j,d);return `<td style="text-align:center">${v?'<span style="color:var(--ok);font-weight:800" title="signé '+new Date(v.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'">✓</span>':'<span style="color:var(--line2)">—</span>'}</td>`}).join('')).join('')}</tr>`).join('')||`<tr><td colspan="${1+jrs.length*2}" style="color:var(--muted);padding:14px">Aucun stagiaire.</td></tr>`;
}
function emargBind(){
 const s=emSessions().find(x=>x.id===(ui.emargSel||(emSessions()[0]&&emSessions()[0].id)));if(!s)return;
 if(EMARG.poll){clearInterval(EMARG.poll);EMARG.poll=null}
 if(EMARG.sel!==s.id){EMARG.sel=s.id;EMARG.tok=null}
 const qrDiv=document.getElementById('emargQR');
 (async()=>{
  if(!EMARG.tok)EMARG.tok=await emargEnsure(s);
  if(!EMARG.tok){if(qrDiv)qrDiv.textContent='Connexion au serveur requise.';return}
  const url=location.origin+location.pathname.replace(/[^/]*$/,'')+'emargement.html#'+EMARG.tok;
  EMARG.url=url;
  await emLoadQR();
  if(qrDiv&&window.qrcode){try{const qr=qrcode(0,'M');qr.addData(url);qr.make();qrDiv.innerHTML=qr.createSvgTag({cellSize:5,margin:1});const svg=qrDiv.querySelector('svg');if(svg){svg.style.width='200px';svg.style.height='200px'}}catch(e){qrDiv.textContent='QR indisponible'}}
  emargRefreshLive();EMARG.poll=setInterval(emargRefreshLive,4000);
 })();
}
/* actions de l'écran */
document.addEventListener('change',function(e){var t=e.target;if(t.getAttribute&&t.getAttribute('data-emarg')==='sel'){ui.emargSel=t.value;EMARG.tok=null;refresh()}},true);
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-emarg]');if(!t)return;var a=t.getAttribute('data-emarg');
 if(a==='device'){if(EMARG.url)window.open(EMARG.url,'_blank');else toast({title:'Préparation du lien…',sub:'Réessayez dans un instant',kind:'warn'});return}
 if(a==='print'){if(!EMARG.url)return;try{var w=window.open('','_blank');var qr='';if(window.qrcode){var q=qrcode(0,'M');q.addData(EMARG.url);q.make();qr=q.createSvgTag({cellSize:8,margin:2})}
  w.document.write('<title>QR émargement</title><style>body{font:16px system-ui;text-align:center;padding:30px}svg{width:320px;height:320px}</style><h2>Émargement — scannez pour signer</h2>'+qr+'<p>'+location.host+'</p>');w.document.close();setTimeout(function(){w.print&&w.print()},300)}catch(_){}return}
 if(a==='pdf'){emargPdf();return}
 if(a==='paper'){emargPaper();return}
},true);
function emargPaper(){var s=emSessions().find(x=>x.id===EMARG.sel);if(!s)return;var jrs=emJours(s),stg=emStags(s);
 var w=window.open('','_blank');var head='<tr><th>Nom / Prénom</th>'+jrs.map(function(j,i){return '<th colspan=2>Jour '+(i+1)+' · '+fmt(j)+'</th>'}).join('')+'</tr><tr><th></th>'+jrs.map(function(){return '<th>matin</th><th>après-midi</th>'}).join('')+'</tr>';
 var body=stg.map(function(st){return '<tr><td>'+st+'</td>'+jrs.map(function(){return '<td></td><td></td>'}).join('')+'</tr>'}).join('')+'<tr><td>Formateur : '+esc(EM(s.formateur).nom)+'</td>'+jrs.map(function(){return '<td></td><td></td>'}).join('')+'</tr>';
 w.document.write('<title>Feuille d’émargement</title><style>body{font:13px system-ui;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:14px 8px}h2{font-size:17px}</style><h2>Feuille d’émargement — '+esc(CL(s.client).nom)+'</h2><p>'+esc(s.titre||'')+'</p><table>'+head+body+'</table>');w.document.close();setTimeout(function(){w.print&&w.print()},300)}
function emargPdf(){var s=emSessions().find(x=>x.id===EMARG.sel);if(!s||!EMARG.sheet)return;var jrs=emJours(s),stg=emStags(s),sig=(EMARG.sheet.signatures)||[];
 var cell=function(st,j,d){var v=sig.find(function(x){return x.stagiaire===st&&x.jour===j&&x.demi===d});return v?'<img src="'+v.png+'" style="height:34px">':'<span style="color:#bbb">—</span>'};
 var head='<tr><th>Nom / Prénom</th>'+jrs.map(function(j,i){return '<th colspan=2>Jour '+(i+1)+' · '+fmt(j)+'</th>'}).join('')+'</tr><tr><th></th>'+jrs.map(function(){return '<th>matin</th><th>après-midi</th>'}).join('')+'</tr>';
 var body=stg.map(function(st){return '<tr><td>'+esc(st)+'</td>'+jrs.map(function(j){return '<td>'+cell(st,j,'m')+'</td><td>'+cell(st,j,'a')+'</td>'}).join('')+'</tr>'}).join('');
 var w=window.open('','_blank');w.document.write('<title>Émargement signé</title><style>body{font:13px system-ui;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:6px;text-align:center}td:first-child,th:first-child{text-align:left}h2{font-size:17px}img{display:block;margin:auto}</style><h2>Feuille d’émargement signée — '+esc(CL(s.client).nom)+'</h2><p>'+esc(s.titre||'')+' · éditée le '+fmt(TODAY)+'</p><table>'+head+body+'</table>');w.document.close();setTimeout(function(){w.print&&w.print()},400)}
/* lancer le branchement après chaque rendu de l'écran émargement */
(function(){var _r=window.refresh;window.refresh=function(f){var x=_r.apply(this,arguments);try{if(ui.view==='emarg')setTimeout(emargBind,0);else if(EMARG.poll){clearInterval(EMARG.poll);EMARG.poll=null}}catch(e){}return x}})();
