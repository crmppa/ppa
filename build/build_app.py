"""Construit l'application PPA Pilot (nouvelle version) à partir du code v112 + correctifs v113.
Usage : python3 -I build_app.py <v112_source.html> <patch_v113.py> <sortie app.html>
Le moteur métier de la v112 est conservé tel quel ; seuls changent le stockage (Supabase),
la connexion (comptes), les bibliothèques (hébergées), et la carte 3D (retirée)."""
import sys, re, subprocess, os, tempfile

src, patch, out = sys.argv[1:4]
tmp = tempfile.mktemp(suffix='.html')
subprocess.run([sys.executable, '-I', patch, src, tmp], check=True)
s = open(tmp, encoding='utf-8').read()
n = 0
def R(a, b, cnt=1):
    global s, n
    c = s.count(a)
    if c != cnt:
        sys.exit(f'ancre introuvable ({c}) : {a[:90]!r}')
    s = s.replace(a, b); n += 1

# 1. Carte 3D retirée (décision du 19/11) : importmap + module three.js
a = s.index('<script type="importmap">'); b = s.index('</script>', a) + len('</script>')
s = s[:a] + s[b:]
a = s.index('<script type="module">\n/* =========================================================\n   Plan façon GPS')
b = s.index('</script>', a) + len('</script>')
s = s[:a] + s[b:]

# 2. Données d'exemple réelles retirées du code (les données viennent de Supabase)
s = re.sub(r'const OPCO_SEED=\[.*?\];\n', 'const OPCO_SEED=[];\n', s, count=1, flags=re.S)
s = re.sub(r'const SUIVI=\[\n.*?\n\];\n', 'const SUIVI=[];\n', s, count=1, flags=re.S)

# 3. Bibliothèques hébergées avec le CRM (plus de CDN)
R("const LIBS={zip:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',xlsx:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',pdfjs:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'};const PDFJS_W='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';",
  "const LIBS={zip:PPA_LIB+'jszip-3.10.1.min.js',xlsx:PPA_LIB+'xlsx-0.18.5.full.min.js',pdfjs:PPA_LIB+'pdf-3.11.174.min.js'};const PDFJS_W=PPA_LIB+'pdf.worker-3.11.174.min.js';")
R("const PDFLIB_URL='https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';", "const PDFLIB_URL=PPA_LIB+'pdf-lib-1.17.1.min.js';")

# 4. Connexion par compte : l'écran de code PIN laisse la place à la connexion Supabase
R("function gate(){\n", "function gate(){if(window.PPA&&PPA.logout){PPA.logout();return}\n")

# 5. Ancienne synchro Google désactivée (Supabase prend le relais) ; Google reste utilisé pour les documents Drive
R("async function sync(){\n", "async function sync(){if(window.PPA&&PPA.sync)return;\n")
R("function badge(){", "function badge(){if(window.PPA&&PPA.sync)return PPA.badge&&PPA.badge();")

# 6. Chaque enregistrement part aussi vers Supabase (fiches modifiées uniquement)
R("function save(){try{localStorage.setItem(DB_KEY,JSON.stringify(db))}catch(e){}}",
  "function save(){try{localStorage.setItem(DB_KEY,JSON.stringify(db))}catch(e){}if(window.PPA&&PPA.sync&&PPA.sync.db===db)PPA.sync.save()}")

# 7. Point d'entrée : constantes injectées avant le code métier, branchement après
pre = "<script>const PPA_LIB=(window.PPA&&PPA.lib)||'../lib/';</script>\n"
a = s.index('<script>\n/* =========================================================\n   PPA Pilot')
s = s[:a] + pre + s[a:]
post = r"""<script>
/* Branchement Supabase après le démarrage du moteur v112 */
(function(){
 const l=document.getElementById('loader');if(l)l.hidden=true;
 if(!window.PPA||!PPA.sync)return;
 const S=PPA.sync;S.db=db;                       /* même objet que le moteur : les fenêtres ouvertes restent valides */
 S.save();                                         /* envoie les éventuelles mises à niveau faites au démarrage */
 let pend=false;const quiet=()=>{const m=document.getElementById('modal');const a=document.activeElement;return !(m&&!m.hidden)&&!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))};
 S.onChange=()=>{try{localStorage.setItem(DB_KEY,JSON.stringify(db))}catch(e){}if(quiet())refresh();else pend=true};
 setInterval(()=>{if(pend&&quiet()){pend=false;refresh()}},1500);
 S.live();
})();
</script>
"""
a = s.rindex('</body>') if '</body>' in s else len(s)
s = s[:a] + post + s[a:]

import importlib.util as _i;_dp=_i.spec_from_file_location('decisions',os.path.join(os.path.dirname(os.path.abspath(__file__)),'decisions.py'));_dm=_i.module_from_spec(_dp);_dp.loader.exec_module(_dm);s,_=_dm.apply(s);_sp=_i.spec_from_file_location('skin',os.path.join(os.path.dirname(os.path.abspath(__file__)),'skin.py'));_sk=_i.module_from_spec(_sp);_sp.loader.exec_module(_sk);s=_sk.apply(s)
import importlib.util as _i2;_cp=_i2.spec_from_file_location('screens',os.path.join(os.path.dirname(os.path.abspath(__file__)),'screens.py'));_cm=_i2.module_from_spec(_cp);_cp.loader.exec_module(_cm);s,_=_cm.apply(s)
open(out, 'w', encoding='utf-8').write(s)
os.remove(tmp)
print('OK', n, 'remplacements', len(s), 'caractères')
