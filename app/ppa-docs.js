/* ============================================================
   PPA Pilot — Usine à documents (génération des 9 Word Qualiopi)
   Porté du moteur v112 : remplit tes modèles __TPL avec
   l'établissement, les stagiaires, les dates, le lieu, le
   formateur, et sort un ZIP de .docx prêts à imprimer/signer.
   Dépend de JSZip (hébergé) et de window.__TPL (lib/ppa-tpl.js).
   ============================================================ */
(function (glob) {
  'use strict';

  var LIEU_DEF = '40 rue de Valenciennes 59500 Douai';
  var GRP = 3;
  var TPLS = [
    { n: '01', f: '01-dossier-inscription.docx', t: 'Dossier d’inscription', per: 'stag' },
    { n: '02', f: '02-convention.docx', t: 'Convention de formation', per: 'ent' },
    { n: '03', f: '03-convocation.docx', t: 'Convocation + règlement intérieur', per: 'stag' },
    { n: '04', f: '04-emargement.docx', t: 'Feuille d’émargement', per: 'group' },
    { n: '05', f: '05-qcm-initial.docx', t: 'QCM initial', per: 'stag' },
    { n: '06', f: '06-qcm-final.docx', t: 'QCM final + enquête de satisfaction', per: 'stag' },
    { n: '07', f: '07-attestation.docx', t: 'Attestation de fin de formation', per: 'stag' },
    { n: '08', f: '08-satisfaction-formateur.docx', t: 'Questionnaire de satisfaction formateur', per: 'session' },
    { n: '09', f: '09-satisfaction-entreprise-3-mois.docx', t: 'Questionnaire entreprise à 3 mois', per: 'ent' }
  ];

  /* ---- dates / helpers (autonomes) ---- */
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function parse(s) { if (!s || typeof s !== 'string') return new Date(NaN); var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function fmt(s) { return s ? parse(s).toLocaleDateString('fr-FR') : '—'; }
  function eur(n) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0); }
  function workdays(a, b) { var out = [], d = parse(a), e = parse(b); while (d <= e) { if (d.getDay() % 6 !== 0) out.push(iso(d)); d.setDate(d.getDate() + 1); } return out.length ? out : [a]; }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function slug(s) { return norm(s).slice(0, 1) ? norm(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) : 'doc'; }
  function xesc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // remplissage des {placeholder} éventuellement coupés par des balises XML Word
  function wFill(x, vals, empty) {
    return x.replace(/\{(?:<[^>]+>)*\{((?:\w|<[^>]+>)+?)\}(?:<[^>]+>)*\}/g, function (m, inner) {
      var k = inner.replace(/<[^>]+>/g, ''), v = vals[k];
      if ((v == null || v === '') && empty) empty.add(k);
      return xesc(v == null ? '' : v) + (m.match(/<[^>]+>/g) || []).join('');
    });
  }

  function docCount(stagN) {
    return TPLS.reduce(function (a, t) { return a + (t.per === 'stag' ? stagN : t.per === 'group' ? Math.max(1, Math.ceil(stagN / GRP)) : 1); }, 0);
  }

  /* ---- cœur : génère le ZIP des .docx pour une "session" ----
     session = {prog,titre,code,debut,fin,heures,prix,stag,lieu,
       client:{rs,nom,adresse,cp,ville,siret,siren,secteur,act,dirigeant,contact},
       formateur:{civ,nom}, stagList:[{n,email,tel,poste,naiss,adresse}]}  */
  async function genDocs(session, JSZipRef, onStep) {
    var JSZip = JSZipRef || glob.JSZip;
    if (!JSZip) throw new Error('JSZip non chargé');
    if (!glob.__TPL) throw new Error('Modèles Word absents (lib/ppa-tpl.js non chargé)');
    var s = session, c = s.client || {}, tr = s.formateur || {}, L = s.stagList || [];
    var days = workdays(s.debut, s.fin), nd = days.length, J = nd > 1 ? 'S' : '';
    var prix = +s.prix || 0, nb = +s.stag || L.length || 1;
    var base = {
      FORMATEUR: (tr.civ || 'Mr') + ' ' + (tr.nom || ''),
      E_NOM: c.rs || c.nom || '', E_ADRESSE: [c.adresse, c.cp, c.ville].filter(Boolean).join(' '),
      E_SIRET: c.siret || c.siren || '', E_SECTEUR: c.secteur || c.act || '',
      E_REPRESENTANT: c.dirigeant || c.contact || '',
      S_NOMS: L.map(function (x) { return x.n; }).join(', '),
      TOTAL_TTC: eur(Math.round(prix * 120) / 100), VILLE_DOC: 'Douai',
      MOTIF: 'Mise en conformité réglementaire en hygiène alimentaire (PMS / HACCP) et montée en compétences de l’équipe.',
      H_OUI: '', H_NON: 'X', H_DETAIL: '', COMMENT_ENT: '', NOTE_Q: '', CK_ADMIS: '☐', CK_RECALE: '☐',
      O1A: '☐', O1B: '☐', O1C: '☐', O2A: '☐', O2B: '☐', O2C: '☐', O3A: '☐', O3B: '☐', O3C: '☐', O4A: '☐', O4B: '☐', O4C: '☐', O5A: '☐', O5B: '☐', O5C: '☐',
      DUREE: s.heures + ' heures (' + nd + ' jour' + (nd > 1 ? 's' : '') + ')',
      DUREE_JOURS: nd + ' JOUR' + J + ' (' + s.heures + ' heures)',
      DUREE_ATT: s.heures + 'H00 ( ' + nd + ' JOUR' + J + ' )', HORAIRES: '8H30 – 17h30',
      DATES: nd > 1 ? (fmt(s.debut) + ' au ' + fmt(s.fin)) : fmt(s.debut),
      LIEU: s.lieu || LIEU_DEF, EFFECTIF: String(nb), NB: String(nb),
      PU: eur(prix / Math.max(1, nb)), TOTAL_HT: eur(prix),
      DATE_DOC: fmt(iso(new Date())), DATE_FIN: fmt(s.fin), J1: fmt(days[0]), J2: fmt(days[1] || days[0]),
      NOTE_QCM: '', NOTE_OBJ: '', NOTE_FIN: '', COMMENT: ''
    };
    var sv = function (x) { return { S_NOM: x.n, S_EMAIL: x.email, S_TEL: x.tel, S_POSTE: x.poste, S_NAISS: x.naiss, S_ADRESSE: x.adresse }; };
    var b64 = function (n) { var bin = atob(glob.__TPL[n]); var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
    var out = new JSZip(), folder = 'PPA_' + s.prog + '_' + slug(c.nom || c.rs) + '_' + s.debut, count = 0;
    for (var ti = 0; ti < TPLS.length; ti++) {
      var t = TPLS[ti];
      if (!glob.__TPL[t.f]) throw new Error('Modèle introuvable : ' + t.f);
      var buf = b64(t.f), inst = [];
      if (t.per === 'stag') L.forEach(function (x) { inst.push([t.n + '_' + slug(t.t) + '_' + slug(x.n) + '.docx', Object.assign({}, sv(x), { DATE_QCM: t.n === '05' ? fmt(days[0]) : fmt(s.fin) })]); });
      else if (t.per === 'group') { var g = Math.max(1, Math.ceil(L.length / GRP)); for (var k = 0; k < g; k++) { var v = {}; for (var ii = 0; ii < GRP; ii++) v['S' + (ii + 1)] = L[k * GRP + ii] ? L[k * GRP + ii].n : ''; inst.push([t.n + '_' + slug(t.t) + (g > 1 ? '_groupe' + (k + 1) : '') + '.docx', v]); } }
      else inst.push([t.n + '_' + slug(t.t) + '.docx', {}]);
      for (var ri = 0; ri < inst.length; ri++) {
        var name = inst[ri][0], vv = inst[ri][1];
        var z = await JSZip.loadAsync(buf);
        var xml = await z.file('word/document.xml').async('string');
        xml = wFill(xml, Object.assign({}, base, vv));
        z.file('word/document.xml', xml);
        out.file(folder + '/' + name, await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
        count++;
      }
      if (onStep) onStep(t);
    }
    return { blob: await out.generateAsync({ type: 'blob' }), name: folder + '.zip', count: count };
  }

  /* ---- charge JSZip + modèles à la demande (navigateur) ---- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[data-ppa="' + src + '"]')) return res();
      var sc = document.createElement('script'); sc.src = src; sc.dataset.ppa = src;
      sc.onload = res; sc.onerror = function () { rej(new Error('Chargement impossible : ' + src)); };
      document.head.appendChild(sc);
    });
  }
  async function ensureLibs() {
    var L = (glob.PPA && glob.PPA.lib) || '../lib/';
    if (!glob.JSZip) await loadScript(L + 'jszip-3.10.1.min.js');
    if (!glob.__TPL) await loadScript(L + 'ppa-tpl.js');
  }

  /* ---- construit une "session" depuis une entreprise + un dossier maquette,
         génère, et déclenche le téléchargement. formation = {prog,titre,dateIdx} ---- */
  async function generate(ent, dossier, formation, teamNames) {
    await ensureLibs();
    var d = dossier || {}, f = formation || {};
    var dates = d.dates || ['', ''];
    // deux formations qui s'enchaînent : chacune 2 jours ouvrés
    var di = f.dateIdx || 0;
    var debut = dates[di] || dates[0] || iso(new Date());
    var wd = workdays(debut, debut); // 1er jour ; le modèle calcule les suivants
    // fin = 2e jour ouvré
    var dd = parse(debut); var cnt = 0; while (cnt < 1) { dd.setDate(dd.getDate() + 1); if (dd.getDay() % 6 !== 0) cnt++; }
    var fin = iso(dd);
    var pu = +d.tarif || 350;
    var session = {
      prog: f.prog || 'PMS', titre: f.titre || 'Plan de maîtrise sanitaire',
      code: ent.id + '-' + (f.prog || 'PMS'),
      debut: debut, fin: fin, heures: 14, prix: pu * (d.sal || []).length, stag: (d.sal || []).length,
      lieu: ent.adr || '',
      client: {
        rs: ent.nom, nom: ent.nom, adresse: ent.adr, cp: '', ville: ent.ville,
        siret: ent.siret, secteur: ent.act, dirigeant: ent.gerant, contact: ent.gerant
      },
      formateur: { civ: 'Mr', nom: (teamNames && teamNames[d.formateur]) || d.formateur || '' },
      stagList: (d.sal || []).map(function (x) { return { n: [x.prenom, x.nom].filter(Boolean).join(' '), email: x.email || '', tel: x.tel || '', poste: x.poste || '', naiss: x.naiss || '', adresse: x.adresse || '' }; })
    };
    var r = await genDocs(session);
    // téléchargement
    var a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return r;
  }

  var api = { genDocs: genDocs, generate: generate, ensureLibs: ensureLibs, TPLS: TPLS, docCount: docCount, _helpers: { wFill: wFill, workdays: workdays, slug: slug } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  glob.PPA_DOCS = api;
})(typeof window !== 'undefined' ? window : globalThis);
