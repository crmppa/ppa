"""Transforme la maquette (app/ppa-pilot.html) en application réelle :
 - inline la couche de données app/ppa-data.js (avant le script principal),
 - rend TEAM/ENTS/ROLES/DEALS/EVS/AGP réassignables et les remplace par les
   vraies données quand PPA_ADAPT est présent (sinon la démo reste),
 - remplace la liste de formateurs codée en dur,
 - masque le sélecteur de rôle pour les comptes non-direction.
Ré-exécutable à chaque mise à jour de la maquette.
Usage : python3 -I build/maquette_build.py app/ppa-pilot.html app/ppa-data.js <sortie.html>
"""
import sys

src, datajs, out = sys.argv[1:4]
s = open(src, encoding='utf-8').read()
adapter = open(datajs, encoding='utf-8').read()
n = 0

def R(a, b, cnt=1):
    global s, n
    c = s.count(a)
    if c != cnt:
        sys.exit('ancre introuvable (%d attendu %d) : %r' % (c, cnt, a[:80]))
    s = s.replace(a, b, cnt); n += 1

# 1. inline de la couche données avant le script applicatif
anchor = '<script>\n/* ===== Icônes ===== */'
R(anchor, '<script>\n/* ---- couche de données réelle (inline) ---- */\n' + adapter + '\n</script>\n' + anchor)

# 2. déclarations réassignables (const -> let)
for name, head in [('TEAM', "const TEAM={RA:"), ('ENTS', "const ENTS=["),
                   ('ROLES', "const ROLES={"), ('DEALS', "const DEALS=["),
                   ('EVS', "const EVS=["), ('AGP', "const AGP={RA:")]:
    R(head, head.replace('const ', 'let ', 1))

# 3. liste des formateurs : réelle si dispo
R("${['RA','JO'].map(k=>", "${(window.PPA_ADAPT?PPA_ADAPT.formateurs:['RA','JO']).map(k=>")

# 3b. bandeau démo identifiable (masqué en mode réel)
R('<span class="demo">Maquette · données fictives</span>',
  '<span class="demo" id="demoBadge">Maquette · données fictives</span>')

# 4. branchement des vraies données + garde du sélecteur de rôle,
#    juste avant l'IIFE du sélecteur de rôle de démonstration
R("/* menu selon le rôle (démonstration) */",
  "/* ===== branchement des données réelles ===== */\n"
  "if(window.PPA_ADAPT&&PPA_ADAPT.real){const A=PPA_ADAPT;"
  "TEAM=A.TEAM;ROLES=A.ROLES;ENTS=A.ENTS;DEALS=A.DEALS;EVS=A.EVS;role=A.myRole;"
  "AGP=(function(){const o={},cols=['--s1','--s2','--s3','--s4','--s5'];let i=0;"
  "Object.keys(A.TEAM).forEach(c=>{o[c]={n:A.TEAM[c],c:cols[i++%cols.length]}});return o})();"
  "try{localStorage.setItem('ppa-role',A.myRole)}catch(e){}"
  "var dbg=document.getElementById('demoBadge');if(dbg)dbg.style.display='none';"
  "if(A.myRole!=='direction'){const np=document.querySelector('.navpick');if(np)np.style.display='none';}}\n"
  "/* menu selon le rôle (démonstration) */")

open(out, 'w', encoding='utf-8').write(s)
print('OK', n, 'transformations ->', out, len(s), 'caractères')
