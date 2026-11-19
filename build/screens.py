# Écrans nouveaux (v2) : Performance & trésorerie, Réclamations, BPF, Émargement. Appliqué APRÈS skin.py.
import sys,os
def apply(s):
    n=0
    def R(a,b):
        nonlocal s,n
        assert s.count(a)==1,('écran: ancre introuvable: '+a[:80]); s=s.replace(a,b); n+=1
    HERE=os.path.dirname(os.path.abspath(__file__)); rd=lambda f:open(os.path.join(HERE,f),encoding='utf-8').read()
    # onglets (libellés)
    R("qualiopi:['Qualiopi','Qualité et conformité']",
      "perfTreso:['Performance & trésorerie','CA, encaissements, délais, trésorerie'],reclam:['Réclamations','Registre Qualiopi · réponses et actions'],bpf:['Bilan BPF','Bilan pédagogique et financier annuel'],emarg:['Émargement','QR code, signatures en direct, feuille'],qualiopi:['Qualiopi','Qualité et conformité']")
    # groupe Pilotage
    R("['reports','Pilotage','tdb',['qualiopi']]","['reports','Pilotage','tdb',['perfTreso','reclam','bpf','qualiopi']]")
    # groupe Formations : + émargement
    R("['formation','Formations','sessions',['sessions','agendaF','audits','perfF']]","['formation','Formations','sessions',['sessions','emarg','agendaF','audits','perfF']]")
    # accès : formateur a l'émargement ; admin a les quatre
    R("...(t==='formateur'?['perfF']:[])","...(t==='formateur'?['perfF','emarg']:[])")
    R("...(t==='formateur'||t==='admin'?['agendaF','audits']:[])","...(t==='formateur'||t==='admin'?['agendaF','audits']:[]),...(t==='admin'?['perfTreso','reclam','bpf','emarg']:[])")
    # enregistrer les vues + injecter le code avant VIEWS
    R("const VIEWS={carte2:V_carte2,","const VIEWS={perfTreso:V_perfTreso,reclam:V_reclam,bpf:V_bpf,emarg:V_emarg,carte2:V_carte2,")
    R("const VIEWS={perfTreso:V_perfTreso,reclam:V_reclam,bpf:V_bpf,emarg:V_emarg,",
      "\n"+rd('perf_treso.js')+"\n"+rd('reclam.js')+"\n"+rd('bpf.js')+"\n"+rd('emarg.js')+"\nconst VIEWS={perfTreso:V_perfTreso,reclam:V_reclam,bpf:V_bpf,emarg:V_emarg,")
    # solde de trésorerie
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
