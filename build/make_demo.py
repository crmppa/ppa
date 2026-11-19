"""Génère la démo publique protégée : page de code + filigrane + noindex,
à partir de app/ppa-pilot.html. Sortie HTML non obfusquée (à passer ensuite
à obfuscate.js en base). Usage: python3 -I build/make_demo.py <sortie.html>"""
import sys
src = 'app/ppa-pilot.html'
out = sys.argv[1]
s = open(src, encoding='utf-8').read()

head_add = '''<meta name="robots" content="noindex,nofollow">
<style>
html:not(.pu) .app,html:not(.pu) #ppaDemoBar,html:not(.pu) .navpick{display:none!important}
#ppaGate{position:fixed;inset:0;z-index:100000;background:#0F141E;color:#E8ECF4;display:flex;align-items:center;justify-content:center;padding:24px;font:15px/1.5 system-ui,-apple-system,sans-serif}
html.pu #ppaGate{display:none}
#ppaGate .card{max-width:360px;width:100%;text-align:center}
#ppaGate .logo{width:56px;height:56px;border-radius:15px;background:#2456C7;color:#fff;display:inline-flex;align-items:center;justify-content:center;font:800 20px system-ui;margin-bottom:14px}
#ppaGate h1{font-size:20px;margin:0 0 4px}#ppaGate p{color:#B5BDCD;margin:0 0 18px;font-size:13.5px}
#ppaGate input{width:100%;padding:13px;border-radius:10px;border:1px solid #2A3243;background:#171D2A;color:#fff;font:16px system-ui;text-align:center;letter-spacing:2px;box-sizing:border-box}
#ppaGate button{width:100%;margin-top:10px;padding:13px;border:0;border-radius:10px;background:#2456C7;color:#fff;font:700 15px system-ui;cursor:pointer}
#ppaGate .err{color:#FF8A8A;font-size:13px;min-height:18px;margin-top:8px}#ppaGate small{display:block;color:#6B7688;margin-top:16px;font-size:12px}
</style>
<title>'''
s = s.replace('<title>', head_add, 1)

body_end = '''
<style>
#ppaDemoBar{position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#14213D;color:#fff;font:600 12.5px/1.4 system-ui,sans-serif;padding:7px 14px;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;box-shadow:0 -2px 10px rgba(0,0,0,.25)}
#ppaDemoBar b{color:#FFD166}#ppaDemoBar span{opacity:.85}body{padding-bottom:40px}
@media print{#ppaDemoBar{position:static}}
@media (max-width:560px){#ppaDemoBar{font-size:10.5px;padding:5px 10px;gap:6px;flex-wrap:nowrap;white-space:nowrap;overflow:hidden}#ppaDemoBar .long{display:none}body{padding-bottom:30px}.navpick{bottom:calc(38px + env(safe-area-inset-bottom,0px))!important}}
</style>
<div id="ppaDemoBar"><b>DÉMONSTRATION</b><span>· Données fictives</span><span class="long">· Aperçu non fonctionnel ·</span><span>© PPA Formation<span class="long"> — confidentiel</span>. Ne pas diffuser<span class="long">, copier ni réutiliser</span>.</span></div>
<div id="ppaGate"><div class="card"><div class="logo">PPA</div><h1>PPA Pilot — Démonstration</h1><p>Aperçu confidentiel. Saisissez le code d'accès qui vous a été communiqué.</p><input id="ppaCode" type="password" inputmode="text" placeholder="Code d'accès" autocomplete="off" autofocus><button id="ppaGo" type="button">Entrer</button><div class="err" id="ppaErr"></div><small>Données fictives · © PPA Formation · Ne pas diffuser</small></div></div>
<script>
(function(){var T='1gkdhps';
 function hh(v){var x=5381;v=String(v).toLowerCase().trim();for(var i=0;i<v.length;i++)x=((x<<5)+x+v.charCodeAt(i))|0;return (x>>>0).toString(36);}
 function unlock(){try{sessionStorage.setItem('ppaDemoOk','1');}catch(e){}document.documentElement.classList.add('pu');var g=document.getElementById('ppaGate');if(g)g.remove();}
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
print('demo source écrite', len(s) + len(body_end), 'octets')
