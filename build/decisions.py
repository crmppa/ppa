# Décisions métier de Mehdi (priment sur la v112). Appliquées au HTML v112.
import sys
def apply(s):
    n=0
    def R(a,b):
        nonlocal s,n
        assert s.count(a)==1,('décision: ancre introuvable: '+a[:70]); s=s.replace(a,b); n+=1
    # Décision 2 : renouvellement = remise à zéro complète du dossier
    R("delete x.ctl1;delete x.ctl2;delete x.ref1;delete x.ref2;c.formateur='';c.signe=TODAY;c.statut=null;c.origine='renouvellement';",
      "delete x.ctl1;delete x.ctl2;delete x.ref1;delete x.ref2;delete x.valCom;delete x.ctrF;delete x.valForm;delete x.depot;delete x.accord;x.doc={};c.formateur='';c.signe=TODAY;c.statut=null;c.origine='renouvellement';")
    R("Un nouveau cycle démarre : les pièces de formation seront à redéposer.",
      "Un nouveau cycle démarre : tout le dossier repart de zéro (pièces, validations, contrôle, dépôt). La CNI et les fiches de paie restent acquises.")
    # Décision 6 : la programmation d'une session est réservée à l'administration et à la direction
    R("case 'newSession':closeDrawer();openNewSession(d.f,d.cli);break;",
      "case 'newSession':{const _k=curUser().kind;if(_k!=='direction'&&_k!=='admin'){toast({title:'Réservé à l’administration',sub:'La programmation des sessions est faite par l’administration ou la direction.',kind:'warn'});break}closeDrawer();openNewSession(d.f,d.cli);break;}")
    # Décision 6 : blocage si le dossier n'est pas encore validé par le commercial
    R("function cliGate(cid){const c=db.clients.find(x=>x.id===cid);if(!c)return [];return []}",
      "function cliGate(cid){const c=db.clients.find(x=>x.id===cid);if(!c)return [];try{const k=cliChain(c);return k.idx===0?k.miss:[]}catch(e){return []}}")
    # le blocage s'applique à tous (plus d'exception silencieuse) ; la direction garde une confirmation explicite
    R("if(curUser().kind==='direction'&&confirm('Dossier incomplet pour '+ENTNAME(sel.value)+'.\\nManque : '+txt+'.\\n\\nPlanifier quand même ?'))return;",
      "if((curUser().kind==='direction'||curUser().kind==='admin')&&confirm('Dossier incomplet pour '+ENTNAME(sel.value)+'.\\nManque : '+txt+'.\\n\\nForcer la planification quand même ?'))return;")
    return s,n
if __name__=='__main__':
    s,n=apply(open(sys.argv[1],encoding='utf-8').read());open(sys.argv[2],'w',encoding='utf-8').write(s);print('décisions',n)
