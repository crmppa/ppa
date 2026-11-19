# Habillage : bleu, menu renommé, barre latérale rétractable au survol. À appliquer sur le HTML v112.
import sys
def apply(s):
    # 1. Menu : renommage + groupe Pilotage (Qualiopi) séparé
    old="const GROUPS=[['pilotage','Pilotage','cockpit',['cockpit']],['prospection','Prospection','leads',['appels','leads','tdb']],['commercial','Commercial','clients',['clients','agenda','portefeuille']],['formation','Formation','sessions',['sessions','agendaF','audits','perfF']],['gestion','Gestion','euro',['opco','factures','facturesR','commissions','qualiopi']],['admin','Paramètres','gear',['profils','auto','reinit']]];"
    new="const GROUPS=[['pilotage','Accueil','cockpit',['cockpit']],['prospection','Prospection','leads',['appels','leads','tdb']],['commercial','Ventes','clients',['clients','agenda','portefeuille']],['formation','Formations','sessions',['sessions','agendaF','audits','perfF']],['gestion','Facturation','euro',['opco','factures','facturesR','commissions']],['reports','Pilotage','tdb',['qualiopi']],['admin','Paramètres','gear',['profils','auto','reinit']]];"
    assert s.count(old)==1,'GROUPS'; s=s.replace(old,new)
    # COMV par clé de groupe (le libellé a changé)
    s=s.replace("GROUPS.find(g=>g[1]==='Commercial')","GROUPS.find(g=>g[0]==='commercial')",1)
    # 2. Thème bleu + barre rétractable (feuille ajoutée, l'emporte sur l'existant)
    css=r"""<style id="ppa-skin">
:root{--acc:#2456C7;--acc-fg:#FFFFFF;--acc-soft:#E7EEFB;--info:#2456C7;--info-soft:#E7EEFB}
:root:not([data-theme="light"]){}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--acc:#6E9BFF;--acc-soft:#1D2A47;--acc-fg:#0F141E;--info:#6E9BFF;--info-soft:#1D2A47}}
:root[data-theme="dark"]{--acc:#6E9BFF;--acc-soft:#1D2A47;--acc-fg:#0F141E;--info:#6E9BFF;--info-soft:#1D2A47}
/* barre : actif en bleu, logo bleu, recherche focus bleu */
.btn.primary{background:var(--acc)!important;border-color:var(--acc)!important;color:#fff!important;box-shadow:0 2px 8px rgba(36,86,199,.25)!important}\n#rail .sdt.on{background:var(--acc)!important;color:#fff!important}
#rail .sdb .logo{background:var(--acc)!important;color:#fff!important}
#rail .sdq.cmd:focus-within{border-color:var(--acc)!important}
#rail .nvt.on,#rail .nvg.on{background:var(--acc)!important;color:#fff!important}
/* sous-onglet actif (submenu) */
#rail .sdto.on,#rail .sdtot .on{color:#fff!important}
/* ancienne pastille de synchro Google masquée (remplacée par celle de Supabase) */
#srvBadge{display:none!important}
/* 3. Barre rétractable au survol (bureau seulement) */
@media(min-width:901px){
 .app{grid-template-columns:76px minmax(0,1fr)!important}
 #rail{position:fixed;left:0;top:0;bottom:0;width:76px;z-index:80;overflow:hidden;transition:width .16s ease,box-shadow .16s ease;padding:18px 12px 14px}
 #rail:hover,#rail:focus-within{width:272px;box-shadow:8px 0 30px rgba(15,27,45,.18);overflow-y:auto}
 #rail .sdb>b,#rail .sdt>span,#rail .sdt .sdc,#rail .sdq.cmd input,#rail .sdas,#rail .me small,#rail .me b,#rail .sdto small,#rail .sdto b,#rail .sdbl{opacity:0;transition:opacity .1s;white-space:nowrap}
 #rail:hover .sdb>b,#rail:hover .sdt>span,#rail:hover .sdt .sdc,#rail:hover .sdq.cmd input,#rail:hover .sdas,#rail:hover .me small,#rail:hover .me b,#rail:hover .sdto small,#rail:hover .sdto b,#rail:hover .sdbl,
 #rail:focus-within .sdt>span,#rail:focus-within .sdq.cmd input{opacity:1}
 #rail .sdt{justify-content:flex-start}
 #rail .sdt>svg,#rail .sdt .nvi{flex:none}
 #rail .sdt sup{position:absolute;top:7px;left:30px}
 #rail:hover .sdt sup{position:static;left:auto;top:auto;margin-left:auto}
 #rail .sdq.cmd{padding:0 0 0 14px}
}
</style>"""
    anchor='<div class="app" id="app">'
    assert s.count(anchor)==1,'app anchor'; s=s.replace(anchor,css+anchor)
    return s
if __name__=='__main__':
    s=open(sys.argv[1],encoding='utf-8').read();open(sys.argv[2],'w',encoding='utf-8').write(apply(s));print('skin ok',len(s))
