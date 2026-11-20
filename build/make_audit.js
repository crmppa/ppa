/* Construit la démo autonome de l'outil d'audit hygiène.
 - données (9 zones, 71 points) encodées base64 -> non récupérables au copier-coller
 - script applicatif obfusqué en base (pas de rc4 : zéro corruption du français)
 - pdf-lib inliné -> fonctionne hors-ligne (iPhone / Fichiers)
 Usage: node build/make_audit.js [audit_data.js] [sortie.html]
*/
const fs=require('fs');
const O=require('javascript-obfuscator');
const SRC='app/ppa-audit.html';
const DATA=process.argv[2]||'app/ppa-audit-data.js';
const OUT=process.argv[3]||'audit.html';

let html=fs.readFileSync(SRC,'utf8');

// 1) données -> base64
const code=fs.readFileSync(DATA,'utf8');
const {AU_Z,AU_LV,AU_P}=new Function(code+';return{AU_Z,AU_LV,AU_P}')();
const json=JSON.stringify({z:AU_Z,lv:AU_LV,p:AU_P});
const b64=Buffer.from(json,'utf8').toString('base64');
const dataScript='<script>(function(){try{var b="'+b64+'";var j=JSON.parse(decodeURIComponent(escape(atob(b))));window.AU_Z=j.z;window.AU_LV=j.lv;window.AU_P=j.p;}catch(e){}})();<\/script>';
html=html.replace('<!-- __AUDIT_DATA__ -->',dataScript);

// 2) obfuscation base du script applicatif (marqueur PPA-OBF-BASE)
const base={compact:true,controlFlowFlattening:false,deadCodeInjection:false,identifierNamesGenerator:'mangled',
 renameGlobals:false,simplify:true,stringArray:false,numbersToExpressions:false,unicodeEscapeSequence:false};
let done=0;
html=html.replace(/<script>([\s\S]*?)<\/script>/g,(m,c)=>{
 if(!/PPA-OBF-BASE/.test(c))return m;
 try{done++;return '<script>'+O.obfuscate(c,base).getObfuscatedCode()+'<\/script>';}
 catch(e){console.error('obf',e.message);return m;}
});

// 3) pdf-lib n'est PAS inliné : chargé à la demande (clic « Générer le PDF »)
//    depuis lib/pdf-lib-1.17.1.min.js (même origine) -> page légère, gate instantané

fs.writeFileSync(OUT,html);
console.log('OK',OUT,'| scripts obfusqués:',done,'| données b64:',b64.length,'| taille:',html.length);
