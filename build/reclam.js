/* ===== Réclamations (registre Qualiopi, indicateurs 31 et 32) — ajout v2 =====
   Saisie, suivi par étapes, réponse pré-rédigée, clôture avec cause et action d'amélioration, registre. */
const RCL_SRC=[['tel','Téléphone'],['mail','E-mail'],['oral','Oral / sur place'],['quest','Questionnaire de satisfaction'],['autre','Autre']];
const RCL_ET=[['recue','Reçue','warn'],['traitement','En traitement','info'],['repondue','Réponse envoyée','info']];
function rclOpen(r){return r&&r.statut!=='Traitée'}
function rclEtLbl(r){if(!rclOpen(r))return ['Clôturée','ok'];const e=RCL_ET.find(x=>x[0]===(r.etape||'recue'))||RCL_ET[0];return [e[1],e[2]]}
function V_reclam(){
 const u=curUser();if(u.kind!=='direction'&&u.kind!=='admin')return '<div class="empty">Réservé à la direction et à l’administration.</div>';
 db.reclam=db.reclam||[];
 const L=db.reclam.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const ouvertes=L.filter(rclOpen),enRetard=ouvertes.filter(r=>r.date&&diff(r.date)<=-15);
 const opt=(a,cur)=>a.map(([v,l])=>`<option value="${v}" ${cur===v?'selected':''}>${esc(l)}</option>`).join('');
 const cliOpt=cur=>`<option value="">— aucune entreprise —</option>`+(db.clients||[]).map(c=>`<option value="${esc(c.id)}" ${cur===c.id?'selected':''}>${esc(c.nom)}</option>`).join('');
 const form=ui.reclNew?`<section class="panel" style="padding:14px;margin-bottom:14px"><b style="font:800 15px var(--f-disp)">Nouvelle réclamation</b>
  <div class="frow" style="margin-top:10px"><div class="fl"><label>Objet *</label><input id="rcObjet" placeholder="Résumé en une ligne"></div><div class="fl"><label>Date *</label><input id="rcDate" type="date" value="${TODAY}"></div></div>
  <div class="frow"><div class="fl"><label>Entreprise ou stagiaire</label><select id="rcCli">${cliOpt('')}</select></div><div class="fl"><label>Reçue par</label><select id="rcSrc">${opt(RCL_SRC,'tel')}</select></div></div>
  <div class="fl"><label>Description</label><textarea id="rcDesc" rows="3" placeholder="Ce qui s’est passé, tel que décrit par le réclamant"></textarea></div>
  <div class="mfoot" style="margin-top:10px"><button class="btn primary" data-recl="create">Enregistrer la réclamation</button><button class="btn" data-recl="cancel">Annuler</button></div></section>`:'';
 const card=r=>{const [el,ec]=rclEtLbl(r),open=rclOpen(r),late=open&&r.date&&diff(r.date)<=-15,soon=open&&r.date&&diff(r.date)<=-10;
  return `<section class="panel" style="padding:14px;margin-bottom:10px">
   <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><div class="grow" style="min-width:200px"><b style="font:700 15px var(--f-disp)">${esc(r.objet||'(sans objet)')}</b><div style="color:var(--muted);font-size:13px">${esc(r.client?CL(r.client).nom:'Sans entreprise')} · reçue le ${fmt(r.date)} · ${esc((RCL_SRC.find(s=>s[0]===r.src)||['','—'])[1])}</div></div>
    <span class="pill ${ec}">${el}</span>${late?'<span class="pill bad">Réponse en retard (+15 j)</span>':soon?'<span class="pill warn">À répondre (indicateur 31)</span>':''}</div>
   ${r.desc?`<p style="margin:8px 0 0;color:var(--fg)">${esc(r.desc)}</p>`:''}
   ${open?`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
     <span style="font-size:12px;color:var(--muted)">Étape :</span>${RCL_ET.map(([v,l])=>`<button class="btn sm ${((r.etape||'recue')===v)?'primary':''}" data-recl="etape" data-id="${r.id}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="fl" style="margin-top:8px"><label>Réponse au réclamant <button class="btn sm" data-recl="tpl" data-id="${r.id}">Texte pré-rédigé</button> <button class="btn sm" data-recl="copy" data-id="${r.id}">Copier</button></label><textarea data-recl="repf" data-id="${r.id}" rows="2" placeholder="Réponse envoyée au réclamant">${esc(r.reponse||'')}</textarea></div>
    <div class="frow" style="margin-top:8px"><div class="fl"><label>Cause (analyse)</label><input data-recl="causef" data-id="${r.id}" value="${esc(r.cause||'')}"></div><div class="fl"><label>Action d’amélioration (indicateur 32)</label><input data-recl="actionf" data-id="${r.id}" value="${esc(r.action||'')}"></div></div>
    <div class="mfoot" style="margin-top:8px"><button class="btn primary" data-recl="close" data-id="${r.id}">Clôturer la réclamation</button></div>`
   :`<div style="margin-top:8px;font-size:13px;color:var(--muted)">${r.reponse?'<b>Réponse :</b> '+esc(r.reponse)+'<br>':''}${r.cause?'<b>Cause :</b> '+esc(r.cause)+' · ':''}${r.action?'<b>Action :</b> '+esc(r.action):''}${r.clotureAt?' · clôturée le '+fmt(r.clotureAt):''}</div>`}
  </section>`};
 return `<div class="ph"><div><span class="eyebrow">Pilotage · Qualiopi</span><h1>Réclamations</h1><p>Registre des réclamations (indicateur 31) et des actions d’amélioration (indicateur 32). Chaque réclamation doit recevoir une réponse sous 15 jours. À présenter tel quel le jour de l’audit.</p></div><span class="sp" style="flex:1"></span><button class="btn primary" data-recl="new">Nouvelle réclamation</button><button class="btn" data-recl="print">Registre (imprimer)</button></div>
  <div class="kpi-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:0 0 14px">
   <div class="kpi"><small>Ouvertes</small><b style="display:block;font:800 23px var(--f-disp)">${ouvertes.length}</b></div>
   <div class="kpi"><small>En retard (+15 j)</small><b style="display:block;font:800 23px var(--f-disp);color:${enRetard.length?'var(--bad)':'inherit'}">${enRetard.length}</b></div>
   <div class="kpi"><small>Traitées (registre)</small><b style="display:block;font:800 23px var(--f-disp)">${L.length-ouvertes.length}</b></div></div>
  ${form}
  ${L.length?L.map(card).join(''):'<div class="empty">Aucune réclamation enregistrée. C’est aussi une preuve pour l’audit : le registre existe et il est à jour.</div>'}`;
}
/* gestionnaire des actions de l'écran réclamations */
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-recl]');if(!t)return;var a=t.getAttribute('data-recl'),id=t.getAttribute('data-id');
 db.reclam=db.reclam||[];var r=id&&db.reclam.find(function(x){return x.id===id});
 if(a==='new'){ui.reclNew=true;refresh();return}
 if(a==='cancel'){ui.reclNew=false;refresh();return}
 if(a==='create'){var g=function(i){var el=document.getElementById(i);return el?el.value.trim():''};var o=g('rcObjet');if(!o){toast({title:'Objet obligatoire',kind:'warn'});return}
  db.reclam.push({id:'RC'+Date.now().toString(36),objet:o,date:g('rcDate')||TODAY,client:g('rcCli'),src:g('rcSrc'),desc:g('rcDesc'),etape:'recue',statut:'Ouverte'});ui.reclNew=false;try{save()}catch(_){}refresh();toast({title:'Réclamation enregistrée',sub:'À traiter et répondre sous 15 jours',kind:'ok'});return}
 if(!r)return;
 if(a==='etape'){r.etape=t.getAttribute('data-v');try{save()}catch(_){}refresh();return}
 if(a==='tpl'){r.reponse='Bonjour,\n\nNous avons bien pris en compte votre réclamation du '+fmt(r.date)+' concernant : '+(r.objet||'')+'.\nNous en sommes sincèrement désolés. Voici les mesures prises : \n\nNous restons à votre disposition.\n\nPPA Formation — Organisme certifié Qualiopi';try{save()}catch(_){}refresh();return}
 if(a==='copy'){var v=r.reponse||'';if(navigator.clipboard)navigator.clipboard.writeText(v).then(function(){toast({title:'Réponse copiée',sub:'Collez-la dans votre messagerie',kind:'ok'})},function(){});return}
 if(a==='close'){if(!r.reponse){toast({title:'Réponse manquante',sub:'Indiquez la réponse envoyée avant de clôturer',kind:'warn'});return}r.statut='Traitée';r.clotureAt=TODAY;try{save()}catch(_){}refresh();toast({title:'Réclamation clôturée',sub:'Ajoutée au registre',kind:'ok'});return}
 if(a==='print'){try{var w=window.open('','_blank');var rows=db.reclam.slice().sort(function(a,b){return String(a.date).localeCompare(String(b.date))}).map(function(x){return '<tr><td>'+fmt(x.date)+'</td><td>'+esc(x.objet||'')+'</td><td>'+esc(x.client?CL(x.client).nom:'')+'</td><td>'+(rclOpen(x)?'Ouverte':'Traitée')+'</td><td>'+esc(x.reponse||'')+'</td><td>'+esc(x.cause||'')+'</td><td>'+esc(x.action||'')+'</td></tr>'}).join('');
  w.document.write('<title>Registre des réclamations — PPA</title><style>body{font:13px system-ui;padding:20px}h1{font-size:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}</style><h1>Registre des réclamations — PPA Formation</h1><p>Édité le '+fmt(TODAY)+' · indicateurs 31 et 32</p><table><tr><th>Date</th><th>Objet</th><th>Entreprise</th><th>État</th><th>Réponse</th><th>Cause</th><th>Action</th></tr>'+rows+'</table>');w.document.close();w.print&&setTimeout(function(){w.print()},300)}catch(_){toast({title:'Impression impossible',kind:'warn'})}return}
},true);
/* champs de saisie (réponse, cause, action) */
document.addEventListener('input',function(e){var t=e.target,a=t.getAttribute&&t.getAttribute('data-recl');if(!a||['repf','causef','actionf'].indexOf(a)<0)return;var r=(db.reclam||[]).find(function(x){return x.id===t.getAttribute('data-id')});if(!r)return;r[a==='repf'?'reponse':a==='causef'?'cause':'action']=t.value;try{save()}catch(_){}},true);
