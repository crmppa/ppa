# Écrans nouveaux (ajouts v2). Appliqué APRÈS skin.py (le menu a déjà été renommé).
import sys,os
def apply(s):
    n=0
    def R(a,b):
        nonlocal s,n
        assert s.count(a)==1,('écran: ancre introuvable: '+a[:80]); s=s.replace(a,b); n+=1
    # 1. onglet dans TABS
    R("qualiopi:['Qualiopi','Qualité et conformité']",
      "perfTreso:['Performance & trésorerie','CA, encaissements, délais, trésorerie'],qualiopi:['Qualiopi','Qualité et conformité']")
    # 2. dans le groupe Pilotage (déjà renommé par skin)
    R("['reports','Pilotage','tdb',['qualiopi']]","['reports','Pilotage','tdb',['perfTreso','qualiopi']]")
    # 3. accès admin
    R("...(t==='formateur'||t==='admin'?['agendaF','audits']:[])","...(t==='formateur'||t==='admin'?['agendaF','audits']:[]),...(t==='admin'?['perfTreso']:[])")
    # 4. enregistrer la vue
    R("const VIEWS={carte2:V_carte2,","const VIEWS={perfTreso:V_perfTreso,carte2:V_carte2,")
    # 5. injecter le code de l'écran avant VIEWS
    code=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'perf_treso.js'),encoding='utf-8').read()
    R("const VIEWS={perfTreso:V_perfTreso,","\n"+code+"\nconst VIEWS={perfTreso:V_perfTreso,")
    # 6. gestionnaire du solde + styles, avant la balise app
    extra=r"""<script>
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-a="ptSolde"]');if(!t)return;
 var cur=(window.db&&db.conf&&db.conf.solde)||'';var v=prompt('Solde actuel du compte bancaire (€) :',cur);if(v===null)return;
 v=parseFloat(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'));if(isNaN(v))return;
 db.conf=db.conf||{};db.conf.solde=v;try{save()}catch(_){}try{refresh()}catch(_){}});
</script>"""
    R('<div class="app" id="app">',extra+'<div class="app" id="app">')
    return s,n
if __name__=='__main__':
    s,n=apply(open(sys.argv[1],encoding='utf-8').read());open(sys.argv[2],'w',encoding='utf-8').write(s);print('écrans',n)
