/* ===== Écran Performance & trésorerie (ajout, non présent en v112) =====
   Calculé à partir des données réelles du CRM : factures émises, imports OPCO, financements, deals.
   Graphiques SVG statiques (pas de dépendance). Réservé direction/administration. */
function ptMonthKey(s){s=String(s||'');return /^\d{4}-\d{2}/.test(s)?s.slice(0,7):''}
function ptLast12(){const o=[],d=new Date(T0.getFullYear(),T0.getMonth(),1);for(let i=11;i>=0;i--){const x=new Date(d);x.setMonth(x.getMonth()-i);o.push({k:x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0'),l:['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'][x.getMonth()]})}return o}
function ptPaid(o){return /pay|régl|vire|sold/i.test(String(o&&o.etat||''))||!!(o&&o.paye)}
const ptK=n=>n>=1000?(Math.round(n/100)/10).toLocaleString('fr-FR')+' k€':Math.round(n)+' €';
function ptNiceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const n=[1,1.5,2,2.5,3,4,5,6,8,10].find(m=>m*p>=v)||10;return n*p}
/* barres groupées statiques */
function ptBars(labels,series,fmt){const W=680,H=250,L=52,R=8,T=12,B=28,pw=W-L-R,ph=H-T-B;
 const max=ptNiceMax(Math.max(1,...series.flatMap(s=>s.v)));const step=pw/labels.length,gw=step*.72,bw=Math.max(3,(gw-2*(series.length-1))/series.length);
 const y=v=>T+ph-v/max*ph;let g='';
 for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);g+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v,true)}</text>`}
 labels.forEach((lb,i)=>{const x0=L+i*step+(step-gw)/2;series.forEach((s,j)=>{const v=s.v[i]||0,x=x0+j*(bw+2),yy=y(v),h=T+ph-yy;if(v>0)g+=`<path d="M${x},${T+ph}V${yy+Math.min(4,h)}q0,-4 4,-4h${bw-8}q4,0 4,4V${T+ph}Z" fill="${s.c}"/>`});g+=`<text x="${L+i*step+step/2}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--muted)">${lb}</text>`});
 g+=`<line x1="${L}" x2="${W-R}" y1="${T+ph}" y2="${T+ph}" stroke="var(--line2)"/>`;
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Chiffre d’affaires par mois">${g}</svg>`}
/* courbe statique avec seuil */
function ptLine(labels,vals,color,fmt,opts){opts=opts||{};const W=680,H=230,L=58,R=12,T=14,B=28,pw=W-L-R,ph=H-T-B;
 const hi=ptNiceMax(Math.max(1,...vals)),lo=0;const y=v=>T+ph-(v-lo)/(hi-lo)*ph,x=i=>L+i*pw/Math.max(1,labels.length-1);let g='';
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,yy=y(v);g+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v,true)}</text>`}
 if(opts.seuil!=null){const yy=y(opts.seuil);g+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--bad)" stroke-dasharray="4 4"/><text x="${L+6}" y="${yy-5}" font-size="11" fill="var(--bad)">${opts.seuilTxt||''}</text>`}
 const pts=vals.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
 g+=`<polygon points="${x(0)},${y(0)} ${pts} ${x(vals.length-1)},${y(0)}" fill="${color}" opacity=".12"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
 labels.forEach((lb,i)=>{if(i%(opts.every||1)===0||i===labels.length-1)g+=`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${lb}</text>`});
 const li=vals.length-1;if(li>=0)g+=`<circle cx="${x(li)}" cy="${y(vals[li])}" r="4" fill="${color}"/><text x="${x(li)}" y="${y(vals[li])-9}" text-anchor="end" font-size="12" font-weight="700" fill="var(--fg)">${fmt(vals[li])}</text>`;
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img">${g}</svg>`}
/* barres horizontales */
function ptHBars(rows,color,fmt){const W=680,rowH=34,L=Math.min(180,W*.34),R=90,H=Math.max(40,rows.length*rowH+8),pw=W-L-R;const max=ptNiceMax(Math.max(1,...rows.map(r=>r[1])));let g='';
 rows.forEach(([lb,v,sub],i)=>{const yy=6+i*rowH,w=Math.max(2,v/max*pw),c=Array.isArray(color)?color[i%color.length]:color;
  g+=`<text x="${L-10}" y="${yy+18}" text-anchor="end" font-size="12" fill="var(--fg)">${lb}</text><path d="M${L},${yy+6}h${Math.max(0,w-4)}q4,0 4,4v${rowH-22}q0,4 -4,4h-${Math.max(0,w-4)}Z" fill="${c}"/><text x="${L+w+8}" y="${yy+18}" font-size="12" font-weight="700" fill="var(--fg)">${fmt(v)}</text>${sub?`<text x="${L+w+8}" y="${yy+30}" font-size="10" fill="var(--muted)">${sub}</text>`:''}`});
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img">${g}</svg>`}

function V_perfTreso(){
 const u=curUser();if(u.kind!=='direction'&&u.kind!=='admin')return '<div class="empty">Réservé à la direction et à l’administration.</div>';
 const M=ptLast12(),fac=db.factures||[],inv=db.opcoInv||[],afac=db.aktoFac||[],fin=db.financements||[],deals=db.deals||[];
 const z=()=>M.map(()=>0),idx=k=>M.findIndex(m=>m.k===k);
 const sig=z(),factd=z(),enc=z();
 // Signé : financements accordés (par date d'accord) ; à défaut sessions (par début)
 fin.forEach(f=>{if(/accord|factur|pay/i.test(String(f.statut||''))){const i=idx(ptMonthKey(f.accord||f.depot));if(i>=0)sig[i]+=+f.montant||0}});
 (db.sessions||[]).forEach(s=>{if(s.signe||s.debut){const i=idx(ptMonthKey(s.signe||s.debut));if(i>=0&&!fin.some(f=>f.session===s.id))sig[i]+=+s.prix||0}});
 // Facturé : OPCO importés (date de dépôt) + factures client émises
 inv.forEach(o=>{const i=idx(ptMonthKey(o.recu||o.date));if(i>=0)factd[i]+=+o.ht||0});
 fac.forEach(f=>{if(!/opco|akto|subrog/i.test(String(f.payeur||''))){const i=idx(ptMonthKey(f.emise));if(i>=0)factd[i]+=+f.montant||0}});
 // Encaissé : OPCO payés (par date de paiement) + factures client payées
 inv.forEach(o=>{if(ptPaid(o)){const i=idx(ptMonthKey(o.paye));if(i>=0)enc[i]+=+o.ht||0}});
 fac.forEach(f=>{if(f.paye){const i=idx(ptMonthKey(f.paye));if(i>=0)enc[i]+=+f.montant||0}});
 const sum=a=>a.reduce((x,y)=>x+y,0);
 // Reste à encaisser par financeur
 const reste={};const addR=(k,v)=>{if(v>0)reste[k]=(reste[k]||0)+v};
 inv.forEach(o=>{if(!ptPaid(o)&&!/rejet|refus|annul/i.test(String(o.etat||'')))addR(o.opco||'AKTO',+o.ht||0)});
 fac.forEach(f=>{if(!f.paye)addR(/opco|akto|subrog/i.test(String(f.payeur||''))?'OPCO (facture interne)':'Clients directs',+f.montant||0)});
 afac.forEach(f=>{if(!f.paye&&f.cli)addR('Clients directs',+f.ht||0)});
 const resteR=Object.entries(reste).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,v,'']);
 const totReste=sum(Object.values(reste));
 const retard=inv.filter(o=>!ptPaid(o)&&o.recu&&diff(o.recu)<-45).reduce((a,o)=>a+(+o.ht||0),0);
 // Délai moyen de paiement AKTO
 const dl=inv.filter(o=>ptPaid(o)&&o.recu&&o.paye).map(o=>Math.max(0,Math.round((parse(o.paye)-parse(o.recu))/864e5)));
 const delaiMoy=dl.length?Math.round(sum(dl)/dl.length):null;
 const delaiMens=M.map(m=>{const d=inv.filter(o=>ptPaid(o)&&ptMonthKey(o.paye)===m.k&&o.recu).map(o=>Math.max(0,Math.round((parse(o.paye)-parse(o.recu))/864e5)));return d.length?Math.round(sum(d)/d.length):0});
 // Encaissements attendus sur 13 semaines (échéances des factures non payées)
 const sem=[];for(let i=0;i<13;i++){const a=new Date(T0);a.setDate(a.getDate()+i*7);sem.push({a:iso(a),l:a.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}),v:0})}
 const dueDate=(d)=>{const n=diff(d);const w=Math.floor(n/7);return w>=0&&w<13?w:-1};
 fac.forEach(f=>{if(!f.paye&&f.echeance){const w=dueDate(f.echeance);if(w>=0)sem[w].v+=+f.montant||0}});
 afac.forEach(f=>{if(!f.paye&&f.ech){const w=dueDate(f.ech);if(w>=0)sem[w].v+=+f.ttc||f.ht||0}});
 const solde=(db.conf&&+db.conf.solde)||0;let cum=solde;const tres=sem.map(s=>{cum+=s.v;return cum});
 // Taux de transformation
 const signe=deals.filter(d=>d.conv||d.etape==='Gagné').length,refus=deals.filter(d=>d.perdu).length;
 const taux=(signe+refus)?Math.round(signe/(signe+refus)*100):0;
 const rdv=deals.filter(d=>d.envoye).length,appels=deals.filter(d=>d.lead).length;
 // CA par formation
 const parForm={};fac.forEach(f=>{if(f.paye){const s=(db.sessions||[]).find(x=>x.id===f.session);const t=s?(s.titre||s.prog||'Autre'):'Autre';parForm[t]=(parForm[t]||0)+(+f.montant||0)}});
 inv.forEach(o=>{if(ptPaid(o)){const t=(o.intitule||'Formations OPCO');parForm[t]=(parForm[t]||0)+(+o.ht||0)}});
 const formR=Object.entries(parForm).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>[k.length>26?k.slice(0,26)+'…':k,v,'']);
 const BL='var(--acc)',OR='#eb6834',GR='#1baf7a';
 const kpi=(t,v,d,dc)=>`<div class="kpi"><small>${t}</small><b style="display:block;font:800 23px var(--f-disp);margin-top:3px">${v}</b>${d?`<div style="font-size:12px;font-weight:700;margin-top:2px;color:${dc||'var(--muted)'}">${d}</div>`:''}</div>`;
 const pan=(t,sub,body,note)=>`<section class="panel" style="padding:0;margin:0"><div style="display:flex;align-items:baseline;gap:8px;padding:14px 16px 8px"><b style="font:800 15px var(--f-disp)">${t}</b><span style="flex:1"></span>${sub?`<small style="color:var(--muted)">${sub}</small>`:''}</div><div style="padding:0 12px 12px">${body}</div>${note?`<p style="margin:0;padding:0 16px 14px;font-size:12px;color:var(--muted)">${note}</p>`:''}</section>`;
 const empty=sum(sig)+sum(factd)+sum(enc)+totReste===0;
 return `<div class="ph"><div><span class="eyebrow">Pilotage</span><h1>Performance &amp; trésorerie</h1><p>Chiffre d’affaires, encaissements, délais de paiement et trésorerie prévisionnelle. Calculé sur les 12 derniers mois à partir des factures, des imports OPCO et des financements.</p></div></div>
 ${empty?'<div class="note" style="margin:0 0 14px">Peu de données pour l’instant : les chiffres se rempliront avec les imports OPCO et les factures. L’écran est prêt.</div>':''}
 <div class="kpi-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px">
  ${kpi('Encaissé sur 12 mois',eur(sum(enc)),sum(enc)>0?'d’après les imports OPCO + factures':'',' var(--muted)')}
  ${kpi('Reste à encaisser',eur(totReste),retard>0?eur(retard)+' en retard (+45 j)':'',retard>0?'var(--bad)':'var(--muted)')}
  ${kpi('Délai moyen AKTO',delaiMoy!=null?delaiMoy+' j':'—','entre réception et paiement')}
  ${kpi('Trésorerie prévue à 13 sem.',eur(tres[tres.length-1]||0),solde?'solde de départ '+eur(solde):'ajoutez le solde du compte ci-dessous')}
  ${kpi('RDV transformés',taux+' %',signe+' signés / '+(signe+refus)+' décidés')}
 </div>
 <div style="display:grid;grid-template-columns:1fr;gap:14px">
  ${pan('Chiffre d’affaires par mois','Signé · Facturé · Encaissé',`<div style="display:flex;gap:16px;flex-wrap:wrap;padding:0 4px 8px;font-size:12.5px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${BL};margin-right:5px"></i>Signé</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${OR};margin-right:5px"></i>Facturé</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${GR};margin-right:5px"></i>Encaissé</span></div>`+ptBars(M.map(m=>m.l),[{v:sig,c:BL},{v:factd,c:OR},{v:enc,c:GR}],(v,ax)=>ax?ptK(v):eur(v)))}
  ${pan('Trésorerie prévue sur 13 semaines','Solde + encaissements attendus',ptLine(sem.map(s=>s.l),tres,BL,(v,ax)=>ax?ptK(v):eur(v),{seuil:solde?15000:null,seuilTxt:'seuil d’alerte 15 000 €',every:2}),'Calcul : solde de départ + échéances des factures non payées, semaine par semaine. '+(solde?'':'Renseignez le solde du compte pour une vraie prévision : ')+'<button class="btn sm" data-a="ptSolde">'+(solde?'Modifier le solde ('+eur(solde)+')':'Saisir le solde du compte')+'</button>')}
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
   ${pan('Reste à encaisser par financeur','',resteR.length?ptHBars(resteR,BL,eur):'<div class="empty" style="padding:20px">Rien à encaisser.</div>')}
   ${pan('Délai de paiement AKTO','jours entre facture et paiement',ptLine(M.map(m=>m.l),delaiMens,BL,(v)=>Math.round(v)+' j',{every:2}))}
   ${pan('Des appels à la signature','12 derniers mois',ptHBars([['Appels / fiches',appels,''],['RDV pris',rdv,''],['Signés',signe,'']],['#86b6ef','#2a78d6','#1c5cab'],v=>v.toLocaleString('fr-FR')))}
   ${pan('Chiffre d’affaires par formation','encaissé',formR.length?ptHBars(formR,BL,eur):'<div class="empty" style="padding:20px">Pas encore d’encaissement.</div>')}
  </div>
 </div>`;
}
