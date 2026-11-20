"""Génère la démo publique de présentation à partir de app/ppa-pilot.html :
 - page de code d'accès + filigrane de confidentialité + noindex ;
 - couche « explications » : à chaque rubrique / sous-onglet / fiche, une
   fenêtre présente les bénéfices (argumentaire de vente, démo-only).
Sortie HTML non obfusquée (à passer ensuite à obfuscate.js en base).
Usage: python3 -I build/make_demo.py <sortie.html>"""
import sys
src = 'app/ppa-pilot.html'
out = sys.argv[1]
s = open(src, encoding='utf-8').read()

# ---- <head> : noindex + styles du code d'accès et des fenêtres d'explication ----
head_add = '''<meta name="robots" content="noindex,nofollow">
<style>
html:not(.pu) .app,html:not(.pu) #ppaDemoBar,html:not(.pu) .navpick,html:not(.pu) #ppaXFab{display:none!important}
#ppaGate{position:fixed;inset:0;z-index:100000;background:#0F141E;color:#E8ECF4;display:flex;align-items:center;justify-content:center;padding:24px;font:15px/1.5 system-ui,-apple-system,sans-serif}
html.pu #ppaGate{display:none}
#ppaGate .card{max-width:360px;width:100%;text-align:center}
#ppaGate .logo{width:56px;height:56px;border-radius:15px;background:#2456C7;color:#fff;display:inline-flex;align-items:center;justify-content:center;font:800 20px system-ui;margin-bottom:14px}
#ppaGate h1{font-size:20px;margin:0 0 4px}#ppaGate p{color:#B5BDCD;margin:0 0 18px;font-size:13.5px}
#ppaGate input{width:100%;padding:13px;border-radius:10px;border:1px solid #2A3243;background:#171D2A;color:#fff;font:16px system-ui;text-align:center;letter-spacing:2px;box-sizing:border-box}
#ppaGate button{width:100%;margin-top:10px;padding:13px;border:0;border-radius:10px;background:#2456C7;color:#fff;font:700 15px system-ui;cursor:pointer}
#ppaGate .err{color:#FF8A8A;font-size:13px;min-height:18px;margin-top:8px}#ppaGate small{display:block;color:#6B7688;margin-top:16px;font-size:12px}
/* ---- fenêtres d'explication ---- */
#ppaX{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px}
#ppaX .xov{position:absolute;inset:0;background:rgba(10,15,25,.55);backdrop-filter:blur(2px)}
#ppaX .xcard{position:relative;max-width:460px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(10,15,25,.4);animation:xpop .22s ease;max-height:90vh;display:flex;flex-direction:column}
@keyframes xpop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
#ppaX .xhead{background:linear-gradient(135deg,var(--xc),color-mix(in srgb,var(--xc) 72%,#000));color:#fff;padding:22px 24px;display:flex;align-items:center;gap:16px}
#ppaX .xic{width:56px;height:56px;min-width:56px;border-radius:16px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:30px}
#ppaX .xt{font:800 19px/1.25 system-ui,sans-serif}
#ppaX .xbody{padding:20px 24px 6px;overflow:auto}
#ppaX .xac{font:600 16px/1.45 system-ui;color:#16213A;margin:0 0 14px}
#ppaX .xpts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
#ppaX .xpts li{position:relative;padding-left:30px;font-size:14.5px;line-height:1.5;color:#2A3650}
#ppaX .xpts li::before{content:'';position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:50%;background:var(--xc) url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E") center/13px no-repeat}
#ppaX .xpts li b{color:#16213A}
#ppaX .xhl{margin:16px 0 4px;padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--xc) 9%,#fff);border:1px solid color-mix(in srgb,var(--xc) 22%,#fff);font-size:13.5px;line-height:1.5;color:#2A3650}
#ppaX .xhl b{color:var(--xc)}
#ppaX .xfoot{padding:14px 24px 20px;display:flex;flex-direction:column;gap:8px}
#ppaX .xbtn{border:0;border-radius:11px;background:var(--xc);color:#fff;font:700 15px system-ui;padding:13px;cursor:pointer}
#ppaX .xoff{border:0;background:none;color:#8A93A6;font:500 12.5px system-ui;cursor:pointer;padding:2px}
#ppaXFab{position:fixed;right:14px;bottom:46px;z-index:99997;display:inline-flex;align-items:center;gap:7px;background:#2456C7;color:#fff;border:0;border-radius:999px;padding:10px 15px;font:700 13px system-ui;box-shadow:0 8px 24px rgba(36,86,199,.4);cursor:pointer}
#ppaXFab svg{width:16px;height:16px}
@media (max-width:560px){#ppaX{padding:0;align-items:flex-end}#ppaX .xcard{max-width:none;border-radius:20px 20px 0 0;max-height:92vh}#ppaXFab{bottom:40px;right:10px;padding:9px 13px;font-size:12px}}
</style>
<title>'''
s = s.replace('<title>', head_add, 1)

# ---- avant </body> : filigrane + fenêtres d'explication + code d'accès ----
body_end = r'''
<style>
#ppaDemoBar{position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#14213D;color:#fff;font:600 12.5px/1.4 system-ui,sans-serif;padding:7px 14px;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;box-shadow:0 -2px 10px rgba(0,0,0,.25)}
#ppaDemoBar b{color:#FFD166}#ppaDemoBar span{opacity:.85}body{padding-bottom:40px}
@media print{#ppaDemoBar{position:static}}
@media (max-width:560px){#ppaDemoBar{font-size:10.5px;padding:5px 10px;gap:6px;flex-wrap:nowrap;white-space:nowrap;overflow:hidden}#ppaDemoBar .long{display:none}body{padding-bottom:30px}.navpick{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}}
</style>
<div id="ppaDemoBar"><b>DEMONSTRATION</b><span>&middot; Donnees fictives</span><span class="long">&middot; Apercu non fonctionnel &middot;</span><span>&copy; PPA Formation<span class="long"> &mdash; confidentiel</span>. Ne pas diffuser<span class="long">, copier ni reutiliser</span>.</span></div>

<div id="ppaX" role="dialog" aria-modal="true"></div>
<button id="ppaXFab" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none"/></svg>Pourquoi c&rsquo;est mieux&nbsp;?</button>
<script>
/* ===== Fenetres d'explication (demo uniquement) ===== */
(function(){
 var EXPL={
  aujourdhui:{ic:'👋',c:'#2456C7',t:'Bienvenue sur PPA Pilot',ac:'Votre CRM pensé pour la formation hygiène — pas un outil générique adapté à la va-vite.',p:['Chaque rubrique vous explique, en un clic, ce qu’elle vous fait gagner.','Votre journée est déjà priorisée : l’urgent, ce qui rapporte, ce qui bloque — calculé tout seul.','Plus de post-it, plus d’oubli de relance ou de dépôt AKTO.'],hl:'Démonstration avec données fictives. Cliquez les icônes du menu : chaque page se présente toute seule.',cta:'Commencer la visite'},
  agenda:{ic:'📅',c:'#0B7A8C',t:'Un seul agenda pour toute l’equipe',ac:'Commerciaux, formateurs, audits : tout au même endroit, sans double saisie.',p:['Fini les doublons : chacun voit les créneaux des autres avant de caler un RDV.','Les audits à 3 mois se placent <b>automatiquement</b> après chaque formation.','Vue semaine ou mois, filtrable par personne.'],hl:'Souvent l’agenda est séparé du reste : ici il est relié aux dossiers et aux audits.'},
  appels:{ic:'📞',c:'#7A2E8E',t:'La téléprospection qui fait gagner des heures',ac:'Importez la liste de veille : toutes les fiches sont créées automatiquement. Zéro saisie.',p:['La phoneuse n’ouvre plus une seule fiche à la main → <b>beaucoup plus d’appels par jour</b>.','Chaque fiche arrive avec son accroche, ses 3 questions et son angle : elle décroche et convainc.','Zéro erreur de saisie → zéro aller-retour avec le commercial, l’administratif ou le formateur.','Plus d’appels + moins d’erreurs = <b>plus de RDV, plus de clients gagnés</b>.'],hl:'<b>Avant :</b> créer chaque fiche à la main, risque d’erreur, temps perdu. <b>Maintenant :</b> un import, et on appelle.'},
  affaires:{ic:'🤝',c:'#B45309',t:'Du premier RDV à la signature, rien ne se perd',ac:'Chaque affaire suit son étape toute seule — vous ne pilotez plus de mémoire.',p:['Dès qu’un client signe, son dossier de formation <b>démarre automatiquement</b> côté formateur.','Les renouvellements à 11 mois remontent seuls : 15 % de commission à ne jamais rater.','Vous voyez d’un coup ce qui est chaud, à relancer, ou à conclure.'],hl:'Un prospect oublié, c’est un client perdu. Ici, aucune affaire ne tombe dans l’oubli.'},
  formations:{ic:'🎓',c:'#0B7A0B',t:'Le dossier se monte presque tout seul',ac:'De la signature à la facture AKTO, chaque pièce et chaque étape sont guidées.',p:['Les 9 documents Qualiopi se génèrent <b>pré-remplis</b> (établissement, stagiaires, dates, formateur) — zéro ressaisie.','Chaque étape sait qui doit agir : commercial, formateur ou administration.','Un dossier incomplet ne peut pas passer à l’étape suivante → plus d’oubli, plus de non-conformité.'],hl:'Le gros du travail administratif de la formation, fait pour vous.'},
  finances:{ic:'💶',c:'#2456C7',t:'Votre argent AKTO suivi au centime',ac:'Les 3 exports AKTO s’importent d’un coup et se rattachent à vos entreprises par SIRET.',p:['En temps réel : encaissé, à encaisser, en retard, bloqué pour pièces.','Les commissions se calculent toutes seules (5 / 10 / 15 %, décompte 30 jours) — fini le tableur.','Les relances des impayés sont proposées automatiquement.'],hl:'Combien l’AKTO vous doit, et à quelle date ? La réponse est ici, à jour, sans Excel.'},
  entreprises:{ic:'🏢',c:'#1F6B75',t:'Prospects et clients au même endroit, toujours à jour',ac:'Une fiche par établissement, enrichie automatiquement.',p:['SIRET, dirigeant, Alim’confiance, OPCO : renseignés tout seuls à l’import.','Vous savez d’un coup d’œil où en est chaque dossier.','La recherche trouve n’importe quel établissement en une frappe.'],hl:'Plus de double fichier Excel/CRM : une seule source, partagée par toute l’équipe.'},
  rapports:{ic:'📈',c:'#3D4A8A',t:'Pilotez au chiffre, pas au ressenti',ac:'CA, trésorerie, délais de paiement, taux de transformation — sur vos vraies données.',p:['CA signé / facturé / encaissé par mois, calculé sur vos factures réelles.','Trésorerie prévisionnelle et délai moyen de paiement AKTO.','Repérez les retards et les points bas avant qu’ils ne fassent mal.'],hl:'Le tableau de bord qu’un dirigeant veut voir, sans monter un seul Excel.'},
  fiche:{ic:'📇',c:'#2456C7',t:'Tout le client sur une seule page',ac:'Identité, dossier, contacts, affaires, financements, factures — d’un coup d’œil.',p:['Le dossier se remplit ici et <b>génère directement les documents Word</b>.','Vous voyez immédiatement ce qu’il reste à faire et qui doit agir.','L’historique et les documents sont rattachés automatiquement.'],hl:'Plus besoin de fouiller trois outils et un dossier Drive : tout est réuni.'},
  'formations|Émargement':{ic:'✍️',c:'#0B7A0B',t:'L’émargement digital — ou papier, au choix',ac:'Un seul QR code en salle : le stagiaire signe sur son téléphone.',p:['La signature <b>remonte automatiquement dans le dossier</b> et dans la feuille Word n°4 → conformité Qualiopi garantie.','Vous gardez la feuille papier en secours : rien n’est imposé.','Fini les feuilles perdues, ressaisies, scannées à la main.','En direct, vous voyez qui a signé, matin et après-midi.'],hl:'La preuve d’émargement exigée par l’audit se constitue toute seule.'},
  'formations|Sessions':{ic:'🗓️',c:'#1F6B75',t:'Vos sessions, prêtes à démarrer',ac:'Chaque session affiche ce qui manque pour avancer.',p:['Programmation bloquée tant que le dossier n’est pas complet → zéro session non conforme.','Contre-appel, documents, dates : tout est suivi au même endroit.'],hl:''},
  'formations|Audits':{ic:'🔍',c:'#B45309',t:'Les audits à 3 mois ne s’oublient plus',ac:'Planifiés automatiquement après chaque formation.',p:['Audit guidé (71 points en 9 zones), photos, rapport PDF.','La prochaine visite se calcule toute seule.'],hl:'Un suivi client qui, en plus, nourrit vos preuves Qualiopi.'},
  'finances|Financements':{ic:'📨',c:'#8C2F4B',t:'Le pipeline AKTO, dossier par dossier',ac:'Chaque dossier à son état : à déposer, en attente, à facturer, payé.',p:['Les imports du lundi mettent tout à jour automatiquement.','Les dossiers non rattachés sont signalés pour ne rien perdre.'],hl:''},
  'finances|Factures émises':{ic:'📤',c:'#2F5D9E',t:'Vos factures suivies jusqu’au paiement',ac:'À émettre, en cours, en retard, réglées — en un seul écran.',p:['Les relances sont proposées automatiquement selon le retard.','Montants HT côté AKTO, TVA côté clients directs : géré correctement.'],hl:''},
  'finances|Factures reçues':{ic:'🧾',c:'#7A6420',t:'Les commissions de l’équipe, sans prise de tête',ac:'Vous validez, la personne édite sa facture, vous payez — tout est tracé.',p:['Un bordereau de versement édité à chaque paiement.','Vous savez à tout moment ce qui est dû et à qui.'],hl:''},
  'finances|Commissions':{ic:'🧮',c:'#7A6420',t:'Chaque euro de commission calculé tout seul',ac:'Plus de calcul à la main, plus de litige en fin de mois.',p:['5 % pour qui a pris le RDV, 10 % pour le commercial, 15 % s’il a fait les deux ou en renouvellement.','Le décompte de 30 jours démarre au paiement AKTO, automatiquement.','Validation, facture, versement, bordereau : tout est tracé.'],hl:'Fini le tableur de commissions et les désaccords en fin de mois.'},
  'rapports|Qualiopi':{ic:'✅',c:'#0B7A0B',t:'L’audit Qualiopi préparé toute l’année',ac:'Les 7 critères, les preuves, les échéances — à présenter tel quel le jour J.',p:['Registre des réclamations toujours à jour (indicateurs 31 et 32).','Échéances BPF et audits rappelées automatiquement.'],hl:'Arrivez à l’audit serein : les preuves sont déjà réunies.'}
 };
 var SEEN,OFF;
 try{SEEN=new Set(JSON.parse(sessionStorage.getItem('ppaXSeen')||'[]'));}catch(e){SEEN=new Set();}
 try{OFF=sessionStorage.getItem('ppaXOff')==='1';}catch(e){OFF=false;}
 function save(){try{sessionStorage.setItem('ppaXSeen',JSON.stringify([].slice.call(SEEN)));}catch(e){}}
 var host=document.getElementById('ppaX'),fab=document.getElementById('ppaXFab'),curKey='aujourdhui';
 function esc(x){return x;}
 function render(e){
  host.innerHTML='<div class="xov"></div><div class="xcard" style="--xc:'+e.c+'">'
   +'<div class="xhead"><div class="xic">'+e.ic+'</div><div class="xt">'+e.t+'</div></div>'
   +'<div class="xbody"><p class="xac">'+e.ac+'</p><ul class="xpts">'+e.p.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul>'
   +(e.hl?'<div class="xhl">'+e.hl+'</div>':'')+'</div>'
   +'<div class="xfoot"><button class="xbtn" type="button" id="xgo">'+(e.cta||'Compris, découvrir')+' →</button><button class="xoff" type="button" id="xoff">Ne plus afficher ces fenêtres</button></div></div>';
  host.style.display='flex';
  host.querySelector('.xov').onclick=hide;
  document.getElementById('xgo').onclick=hide;
  document.getElementById('xoff').onclick=function(){OFF=true;try{sessionStorage.setItem('ppaXOff','1');}catch(e){}hide();};
 }
 function hide(){host.style.display='none';}
 function pick(k){return EXPL[k]||EXPL[String(k).split('|')[0]]||null;}
 function showKey(k,force){var e=force?pick(k):EXPL[k];if(!e)return;if(!force){if(OFF||SEEN.has(k))return;SEEN.add(k);save();}curKey=k;render(e);}
 function routeKey(){var r=(location.hash.slice(1)||'aujourdhui');return r.indexOf('fiche')===0?'fiche':r;}
 function onRoute(){var r=routeKey();curKey=r;showKey(r);}
 if(fab)fab.onclick=function(){showKey(curKey,true);};
 window.addEventListener('hashchange',function(){setTimeout(onRoute,70);});
 document.addEventListener('click',function(ev){var t=ev.target.closest&&ev.target.closest('.tabs .tab,[data-fot],[data-ft],[data-rp]');if(!t)return;
  setTimeout(function(){var tab=document.querySelector('#view .tabs .tab[aria-selected="true"]');if(!tab)return;var sub=tab.textContent.replace(/\s*\d+\s*$/,'').trim();var k=routeKey()+'|'+sub;if(EXPL[k])showKey(k);},80);
 },true);
 window.ppaStart=function(){setTimeout(onRoute,200);};
})();
</script>

<div id="ppaGate"><div class="card"><div class="logo">PPA</div><h1>PPA Pilot &mdash; Démonstration</h1><p>Aperçu confidentiel. Saisissez le code d’accès qui vous a été communiqué.</p><input id="ppaCode" type="password" inputmode="text" placeholder="Code d&rsquo;acc&egrave;s" autocomplete="off" autofocus><button id="ppaGo" type="button">Entrer</button><div class="err" id="ppaErr"></div><small>Donn&eacute;es fictives &middot; &copy; PPA Formation &middot; Ne pas diffuser</small></div></div>
<script>
(function(){var T='1gkdhps';
 function hh(v){var x=5381;v=String(v).toLowerCase().trim();for(var i=0;i<v.length;i++)x=((x<<5)+x+v.charCodeAt(i))|0;return (x>>>0).toString(36);}
 function unlock(){try{sessionStorage.setItem('ppaDemoOk','1');}catch(e){}document.documentElement.classList.add('pu');var g=document.getElementById('ppaGate');if(g)g.remove();if(window.ppaStart)window.ppaStart();}
 var ok=false;try{ok=sessionStorage.getItem('ppaDemoOk')==='1';}catch(e){}
 if(ok){unlock();return;}
 function go(){var el=document.getElementById('ppaCode');if(hh(el.value)===T){unlock();}else{document.getElementById('ppaErr').textContent='Code incorrect, réessayez.';el.value='';el.focus();}}
 var b=document.getElementById('ppaGo');if(b)b.onclick=go;
 var c=document.getElementById('ppaCode');if(c)c.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go();}});
})();
</script>
</body></html>'''
i = s.rfind('</script>'); j = i + len('</script>')
open(out, 'w', encoding='utf-8').write(s[:j] + '\n' + body_end + s[j:])
print('demo source ecrite', len(s) + len(body_end), 'octets ; explications:', body_end.count('ic:'))
