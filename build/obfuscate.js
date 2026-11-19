const O=require('javascript-obfuscator');const fs=require('fs');
const [,,inp,out,level]=process.argv;
let html=fs.readFileSync(inp,'utf8');
const base={compact:true,controlFlowFlattening:false,deadCodeInjection:false,identifierNamesGenerator:'mangled',
 renameGlobals:false,simplify:true,stringArray:false,numbersToExpressions:false,unicodeEscapeSequence:false};
const strong={...base,stringArray:true,stringArrayEncoding:['rc4'],stringArrayThreshold:0.8,stringArrayCallsTransform:true,
 stringArrayWrappersType:'function',rotateStringArray:true,shuffleStringArray:true};
const opts=level==='strong'?strong:base;
let done=0,i=0;
html=html.replace(/<script>([\s\S]*?)<\/script>/g,(m,code)=>{i++;
 if(/window\.__TPL=/.test(code)||code.length<200)return m;
 // le code porté du moteur v112 casse en rc4 (charAt) -> obfuscation base ciblée
 const o=/PPA-OBF-BASE/.test(code)?base:opts;
 try{const r=O.obfuscate(code,o).getObfuscatedCode();done++;return '<script>'+r+'</script>'}
 catch(e){console.error('script',i,e.message);return m}});
fs.writeFileSync(out,html);console.log(level||'base','scripts',done,'taille',html.length);
