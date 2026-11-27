/* Marchéo · génération des supports imprimés et visuels à partir de la charte.
   Usage : node marcheo/marque/generer_supports.js <dossier_polices>
   Polices : CG-500i.ttf, CG-600.ttf, Inter-400.ttf, Inter-600.ttf (Google Fonts, licence OFL).
   Coordonnées : marque/coordonnees.json. Sortie : marque/supports/ */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ICI = __dirname;
const POL = path.resolve(process.argv[2] || '.');
const OUT = path.join(ICI, 'supports');
const C = JSON.parse(fs.readFileSync(path.join(ICI, 'coordonnees.json'), 'utf8'));
const logo = n => 'file://' + path.join(ICI, 'logos', `marcheo-${n}.svg`);
const capture = n => 'file://' + path.join(ICI, 'captures', `${n}.png`);
fs.mkdirSync(OUT, { recursive: true });

const BASE = `
@font-face { font-family: CG; src: url(file://${POL}/CG-600.ttf); font-weight: 600; }
@font-face { font-family: CG; src: url(file://${POL}/CG-500i.ttf); font-weight: 500; font-style: italic; }
@font-face { font-family: In; src: url(file://${POL}/Inter-400.ttf); font-weight: 400; }
@font-face { font-family: In; src: url(file://${POL}/Inter-600.ttf); font-weight: 600; }
:root { --nuit:#0e2a1d; --vert:#0f4a30; --ivoire:#f6f0e2; --fond:#f1ece1; --laiton:#c9ab74; --laiton-f:#a8864f; --encre:#15211b; --gris:#5a675f;
  --metal: linear-gradient(100deg, transparent 28%, rgba(190,235,205,.10) 42%, rgba(255,255,255,.16) 46%, rgba(190,235,205,.08) 50%, transparent 64%), linear-gradient(118deg, #07190f 0%, #0d2f1f 20%, #17503a 36%, #2f7553 43%, #164a31 50%, #0c2c1c 66%, #103826 84%, #081c12 100%); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: In, sans-serif; color: var(--encre); }
.serif { font-family: CG, Georgia, serif; }
.caps { text-transform: uppercase; letter-spacing: .22em; font-weight: 600; }
`;

/* Carte de visite : 85 × 55 mm + 3 mm de fond perdu = 91 × 61 mm. Zone de sécurité : 4 mm à l'intérieur de la coupe. */
const carte = `<style>${BASE}
@page { size: 91mm 61mm; margin: 0; }
.p { width: 91mm; height: 61mm; position: relative; overflow: hidden; page-break-after: always; }
.recto { background: var(--metal); color: var(--ivoire); display: grid; place-items: center; }
.recto .cadre { position: absolute; inset: 6.5mm; border: .25mm solid var(--laiton); border-radius: 1.2mm; opacity: .75; }
.recto .bloc { text-align: center; display: grid; gap: 2.6mm; justify-items: center; }
.recto img { height: 27mm; }
.recto .accroche { font-family: CG; font-style: italic; font-weight: 500; font-size: 10.5pt; color: var(--laiton); }
.verso { background: var(--ivoire); }
.verso .in { position: absolute; inset: 7mm 7mm 7mm 7mm; display: grid; grid-template-rows: auto 1fr auto; }
.verso .mono { position: absolute; top: 7mm; right: 7mm; height: 9mm; }
.verso .nom { font-family: CG; font-weight: 600; font-size: 17pt; line-height: 1; color: var(--nuit); }
.verso .ei { font-family: In; font-weight: 600; font-size: 5.5pt; letter-spacing: .1em; color: var(--laiton-f); margin-left: 1.6mm; vertical-align: .5em; }
.verso .fn { font-size: 6.4pt; color: var(--laiton-f); margin-top: 1.4mm; }
.verso .filet { width: 12mm; height: .25mm; background: var(--laiton); margin: 3.2mm 0 0; }
.verso .contact { align-self: end; display: grid; gap: .9mm; font-size: 7.6pt; }
.verso .contact b { font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.verso .zone { font-size: 4.9pt; color: var(--gris); margin-top: 2.6mm; letter-spacing: .14em; }
</style>
<div class="p recto"><div class="cadre"></div><div class="bloc"><img src="${logo('vertical-transparent')}" style="height:27mm;background:transparent"><div class="accroche">${C.accroche}</div></div></div>
<div class="p verso"><img class="mono" src="${logo('monogramme-clair')}"><div class="in">
  <div><div class="nom">${C.nom}<span class="ei">EI</span></div><div class="fn caps">${C.fonction}</div><div class="filet"></div></div><div></div>
  <div><div class="contact"><b>${C.telephone}</b><span>${C.email}</span><span>${C.site}</span></div><div class="zone caps">${C.zone}</div></div>
</div></div>`;

/* Papier à en-tête A4 */
const entete = `<style>${BASE}
@page { size: A4; margin: 0; }
.a4 { width: 210mm; height: 297mm; position: relative; background: #fff; }
.haut { position: absolute; top: 16mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; align-items: center; padding-bottom: 6mm; border-bottom: .3mm solid var(--laiton); }
.haut img { height: 15mm; }
.haut .c { text-align: right; font-size: 8pt; line-height: 1.6; color: var(--gris); }
.haut .c b { color: var(--encre); font-weight: 600; }
.corps { position: absolute; top: 52mm; left: 20mm; right: 20mm; font-size: 10pt; line-height: 1.55; color: #c8c2b4; }
.bas { position: absolute; bottom: 12mm; left: 20mm; right: 20mm; padding-top: 3mm; border-top: .2mm solid #e6dece; display: flex; justify-content: space-between; font-size: 6.6pt; color: var(--gris); }
.bas .caps { letter-spacing: .14em; color: var(--laiton-f); }
</style>
<div class="a4">
  <div class="haut"><img src="${logo('signature-clair').replace('clair', 'clair')}" style="background:transparent"><div class="c"><b>${C.nom}</b><br>${C.telephone}<br>${C.email}<br>${C.site}</div></div>
  <div class="corps"></div>
  <div class="bas"><span>${C.societe}</span><span class="caps">${C.zone}</span></div>
</div>`;

/* Avatar 1080 × 1080 (WhatsApp, Google, LinkedIn) */
const avatar = `<style>${BASE} body{width:1080px;height:1080px;background:var(--metal);display:grid;place-items:center}</style>
<img src="${logo('monogramme-transparent')}" style="width:760px">`;

/* Bannière 1584 × 396 (LinkedIn, en-tête de profil) */
const banniere = `<style>${BASE}
body { width:1584px; height:396px; background:var(--metal); color:var(--ivoire); display:flex; align-items:center; justify-content:space-between; padding:0 110px 0 440px; position:relative; overflow:hidden; }
.l { position:absolute; left:110px; top:50%; transform:translateY(-50%); height:120px; opacity:0; }
h1 { font-family:CG; font-weight:600; font-size:64px; line-height:1.05; letter-spacing:-.005em; }
h1 em { font-style:italic; font-weight:500; color:var(--laiton); }
p { margin-top:18px; font-size:17px; color:#a9b8a8; letter-spacing:.2em; text-transform:uppercase; font-weight:600; }
.f { position:absolute; inset:22px; border:1.5px solid rgba(201,171,116,.35); border-radius:10px; }
img.s { height:150px; }
</style><div class="f"></div>
<div><h1>J'achète en l'état.<br><em>Je signe vite.</em></h1><p>${C.zone.split(' · ').slice(0, 3).join(' · ')} · ${C.zone.split(' · ').length > 3 ? 'et alentours' : ''}</p></div>
<img class="s" src="${logo('vertical-transparent')}">`.replace('padding:0 110px 0 440px', 'padding:0 110px');

/* Visuel du CRM 2400 × 1350 (présentation, réseaux, dossier banque) */
const visuel = `<style>${BASE}
body { width:2400px; height:1350px; background: var(--metal); position:relative; overflow:hidden; color:var(--ivoire); }
.txt { position:absolute; left:130px; top:150px; width:640px; }
.txt img { height:120px; margin-bottom:90px; }
h1 { font-family:CG; font-weight:600; font-size:104px; line-height:1; letter-spacing:-.01em; }
h1 em { font-style:italic; font-weight:500; color:var(--laiton); }
ul { list-style:none; margin-top:60px; display:grid; gap:22px; font-size:28px; color:#cfd8cc; }
li::before { content:''; display:inline-block; width:28px; height:2px; background:var(--laiton); vertical-align:middle; margin-right:22px; }
.ecran { position:absolute; left:860px; top:170px; width:1440px; border-radius:22px; padding:18px; background:#07100b; box-shadow:0 50px 120px rgba(0,0,0,.55), 0 0 0 2px rgba(201,171,116,.25); }
.ecran img { width:100%; display:block; border-radius:8px; }
.tel { position:absolute; left:760px; top:560px; width:380px; border-radius:58px; padding:14px; background:#050a07; box-shadow:0 40px 90px rgba(0,0,0,.6), 0 0 0 2px rgba(201,171,116,.35); }
.tel img { width:100%; display:block; border-radius:46px; height:740px; object-fit:cover; object-position:top; }
</style>
<div class="txt"><img src="${logo('signature-transparent')}"><h1>Du repérage<br>à la <em>revente.</em></h1>
<ul><li>Annonces triées à la marge</li><li>Visite guidée sur téléphone</li><li>Prix réels du secteur (DVF)</li><li>Simulation, chantier, bilan</li></ul></div>
<div class="ecran"><img src="${capture('bureau-tableau')}"></div>
<div class="tel"><img src="${capture('mobile-visite')}"></div>`;

(async () => {
  const b = await chromium.launch();
  const page = async (html, w, h) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html, { waitUntil: 'load' }); await p.goto('about:blank'); return p; };
  const rendre = async (html, w, h, sortie, opts = {}) => {
    const f = path.join(OUT, '_tmp.html'); fs.writeFileSync(f, '<!doctype html><meta charset="utf-8">' + html);
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: opts.dsf || 1 });
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    if (opts.pdf) await p.pdf({ path: path.join(OUT, sortie), preferCSSPageSize: true, printBackground: true });
    else await p.screenshot({ path: path.join(OUT, sortie) });
    await p.close(); fs.unlinkSync(f);
  };
  await rendre(carte, 344, 230, 'carte-visite-91x61-fond-perdu.pdf', { pdf: true });
  await rendre(carte.replace('page-break-after: always;', 'page-break-after: always; margin-bottom: 4mm;'), 344, 470, 'carte-visite-apercu.png', { dsf: 3 });
  await rendre(entete, 794, 1123, 'papier-en-tete-A4.pdf', { pdf: true });
  await rendre(entete, 794, 1123, 'papier-en-tete-apercu.png', { dsf: 1 });
  await rendre(avatar, 1080, 1080, 'avatar-1080.png');
  await rendre(banniere, 1584, 396, 'banniere-1584x396.png');
  await rendre(visuel, 2400, 1350, 'visuel-crm-2400x1350.png');
  // Logos en PNG (signature e-mail, documents bureautiques)
  for (const n of ['signature-clair', 'signature-sombre', 'vertical-clair', 'vertical-sombre', 'monogramme-clair']) {
    const svg = fs.readFileSync(path.join(ICI, 'logos', `marcheo-${n}.svg`), 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
    await rendre(`<style>body{margin:0;background:transparent}</style>${svg}`, w, h, `logo-${n}@2x.png`.replace('@2x', ''), { dsf: 2 });
  }
  await b.close();
  console.log('Supports écrits dans', OUT);
})();
