/* ===== Bilan pédagogique et financier (BPF) — ajout v2 =====
   Obligation annuelle (dépôt avant le 31 mai). Consultable à tout moment, arrêté à une date, prérempli depuis le CRM. */
function bpfYears(){const y=T0.getFullYear(),o=[];for(let i=0;i<4;i++)o.push(y-1-i+1);/* année en cours puis précédentes */return [y,y-1,y-2,y-3];}
function V_bpf(){
 const u=curUser();if(u.kind!=='direction'&&u.kind!=='admin')return '<div class="empty">Réservé à la direction et à l’administration.</div>';
 const Y=ui.bpfYear||(T0.getMonth()>4?T0.getFullYear():T0.getFullYear()-1);
 const asof=ui.bpfAsof||TODAY;
 const inYear=d=>{const s=String(d||'');return s.slice(0,4)==String(Y)&&s<=asof};
 const sess=(db.sessions||[]).filter(s=>inYear(s.fin||s.debut));
 const nbStag=sess.reduce((a,s)=>a+((s.stagList&&s.stagList.length)||+s.stag||0),0);
 const heuresStag=sess.reduce((a,s)=>a+((+s.h||14)*((s.stagList&&s.stagList.length)||+s.stag||0)),0);
 const nbSess=sess.length,nbEnt=new Set(sess.map(s=>s.client)).size;
 const nbForm=(db.equipe||[]).filter(e=>hasRole(e,'formateur')).length;
 // Produits encaissés par financeur dans l'année (HT)
 let caOpco=0,caEnt=0;
 (db.opcoInv||[]).forEach(o=>{if((/pay|régl|vire|sold/i.test(String(o.etat||''))||o.paye)&&inYear(o.paye||o.recu))caOpco+=+o.ht||0});
 (db.factures||[]).forEach(f=>{if(f.paye&&inYear(f.paye)){if(/opco|akto|subrog/i.test(String(f.payeur||'')))caOpco+=+f.montant||0;else caEnt+=+f.montant||0}});
 const caTot=caOpco+caEnt;
 db.conf=db.conf||{};db.conf.bpf=db.conf.bpf||{};const man=db.conf.bpf[Y]=db.conf.bpf[Y]||{};
 const mf=(k,lbl,ph)=>`<div class="fl"><label>${lbl}</label><input data-bpf="${k}" inputmode="numeric" value="${esc(man[k]||'')}" placeholder="${ph||'€'}"></div>`;
 const tile=(t,v,s)=>`<div class="kpi"><small>${t}</small><b style="display:block;font:800 22px var(--f-disp);margin-top:2px">${v}</b>${s?`<div style="font-size:12px;color:var(--muted)">${s}</div>`:''}</div>`;
 const yOpt=[T0.getFullYear(),T0.getFullYear()-1,T0.getFullYear()-2,T0.getFullYear()-3].map(y=>`<option value="${y}" ${y===Y?'selected':''}>${y}</option>`).join('');
 return `<div class="ph"><div><span class="eyebrow">Pilotage · obligation annuelle</span><h1>Bilan pédagogique et financier</h1><p>À déposer chaque année avant le 31 mai sur le portail BPF. Prérempli à partir du CRM, arrêté à la date de votre choix. Les montants comptables non connus du CRM se saisissent à la main.</p></div><span class="sp" style="flex:1"></span><button class="btn" data-bpf="print">Imprimer / PDF</button></div>
 <div class="frow" style="margin-bottom:14px"><div class="fl"><label>Année du bilan</label><select data-bpf="year">${yOpt}</select></div><div class="fl"><label>Arrêté à la date</label><input type="date" data-bpf="asof" value="${asof}"></div><div class="fl"><label>&nbsp;</label><div class="note" style="margin:0">Dépôt attendu avant le <b>31/05/${Y+1}</b></div></div></div>
 <section class="panel" style="padding:16px;margin-bottom:14px"><b style="font:800 15px var(--f-disp)">A — Activité de formation ${Y}</b>
  <div class="kpi-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:10px">
   ${tile('Stagiaires formés',nbStag,'')}${tile('Heures-stagiaires',heuresStag.toLocaleString('fr-FR'),'heures × stagiaires')}${tile('Sessions',nbSess,'')}${tile('Entreprises',nbEnt,'')}${tile('Formateurs',nbForm,'')}</div></section>
 <section class="panel" style="padding:16px;margin-bottom:14px"><b style="font:800 15px var(--f-disp)">B — Produits ${Y} (encaissés)</b>
  <div class="kpi-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:10px">
   ${tile('OPCO (AKTO…)',eur(caOpco),'')}${tile('Entreprises / clients',eur(caEnt),'')}${tile('Total produits',eur(caTot),'calculé')}</div>
  <p class="note" style="margin-top:10px">Complétez les lignes comptables que le CRM ne connaît pas (fonds propres, subventions, autres) :</p>
  <div class="frow">${mf('autresProd','Autres produits (subventions, fonds propres…)')}${mf('charges','Charges totales')}${mf('resultat','Résultat de l’exercice')}</div></section>
 <p class="note">Ces chiffres sont une base de travail : vérifiez-les avec votre comptable avant le dépôt officiel.</p>`;
}
document.addEventListener('change',function(e){var t=e.target,a=t.getAttribute&&t.getAttribute('data-bpf');if(!a)return;
 if(a==='year'){ui.bpfYear=+t.value;refresh();return}
 if(a==='asof'){ui.bpfAsof=t.value;refresh();return}},true);
document.addEventListener('input',function(e){var t=e.target,a=t.getAttribute&&t.getAttribute('data-bpf');if(!a||['autresProd','charges','resultat'].indexOf(a)<0)return;
 var Y=ui.bpfYear||(T0.getMonth()>4?T0.getFullYear():T0.getFullYear()-1);db.conf=db.conf||{};db.conf.bpf=db.conf.bpf||{};db.conf.bpf[Y]=db.conf.bpf[Y]||{};db.conf.bpf[Y][a]=t.value;try{save()}catch(_){}},true);
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-bpf="print"]');if(!t)return;try{window.print()}catch(_){}},true);
/* Décision 5 : recréer le rappel BPF chaque année */
(function(){try{var q=(db.conf||[]).find&&(db.conf||[]).find(function(x){return x.id==='Q8'});}catch(_){}
 try{if(Array.isArray(db.conf)){var bpf=db.conf.find(function(x){return x.id==='Q8'});if(bpf&&bpf.done&&bpf.date&&bpf.date<TODAY){var y=+String(bpf.date).slice(0,4)+1;bpf.date=y+'-05-31';bpf.done=false;try{save()}catch(_){}}}}catch(_){}})();
