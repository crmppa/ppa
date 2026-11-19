/* ============================================================
   PPA Pilot — Import des exports AKTO/OPCO
   Porté du moteur v112 : lit les 3 formats Excel (suivi des
   dossiers, paiements, facturation), stocke les factures et
   dossiers AKTO et les rattache aux entreprises par SIRET.
   Dépend de XLSX (hébergé).  Module pur et testable.
   ============================================================ */
(function (glob) {
  'use strict';

  function norm(s) { return String(s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function toIso(v) {
    if (!v) return null;
    if (v instanceof Date) return iso(v);
    if (typeof v === 'number') { var d = new Date(Math.round((v - 25569) * 864e5)); return iso(d); }
    var m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/); if (m) return m[3] + '-' + m[2] + '-' + m[1];
    var m2 = String(v).match(/(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : null;
  }
  var COLMAP = {
    num: ['numéro facture', 'numero facture', 'n° facture'], ref: ['référence facture', 'reference facture'],
    date: ['date facture'], recu: ['date réception', 'date reception'],
    etat: ['etat de la facture', 'état de la facture', 'statut', 'etat'], paye: ['date de paiement'],
    ht: ['facture - montant ht', 'montant ht'],
    dossier: ['numéro dossier / dr', 'numero dossier / dr', 'numéro dossier', 'n° dossier'],
    refint: ['référence interne dossier / dr', 'référence interne']
  };

  /* ---- lecture d'un export, retourne un diff à valider ---- */
  async function parseExport(file, opco, db, XLSXRef) {
    var XLSX = XLSXRef || glob.XLSX;
    if (!XLSX) throw new Error('XLSX non chargé');
    db = db || {}; db.opcoInv = db.opcoInv || []; db.clients = db.clients || []; db.links = db.links || {};
    var wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
    if (!rows.length) throw new Error('Le fichier est vide.');
    var heads = Object.keys(rows[0]);
    var hn = function (s) { return String(s).trim().toLowerCase(); };
    var col = function () { var a = [].slice.call(arguments); return heads.find(function (h) { return a.indexOf(hn(h)) >= 0; }); };
    var dg = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };

    // format « suivi des dossiers avant facturation »
    if (col('etat dossier') && col('etablissements - siret', 'etablissement - siret')) {
      var C = { num: col('numéro dossier'), etat: col('etat dossier'), ref: col('référence interne dossier'), stag: col('stagiaires'), rs: col('etablissements - raison sociale'), siret: col('etablissements - siret'), tit: col('intitulé formation'), deb: col('date début formation'), fin: col('date fin formation'), h: col('durée en heures'), dem: col('montants demandé - coûts pédagogiques'), eng: col('montants engagés - coûts pédagogiques'), fac: col('montants facturés - coûts pédagogiques'), reg: col('montants reglés - coûts pédagogiques') };
      var list = rows.filter(function (r) { return r[C.num]; }).map(function (r) { return { opco: opco, num: String(r[C.num]).trim(), etat: String(r[C.etat] || '').trim(), refint: String(r[C.ref] || ''), stag: +r[C.stag] || 0, rs: String(r[C.rs] || '').trim(), siret: dg(r[C.siret]), titre: String(r[C.tit] || '').trim(), debut: toIso(r[C.deb]), fin: toIso(r[C.fin]), heures: +r[C.h] || 0, dem: +r[C.dem] || 0, eng: +r[C.eng] || 0, fac: +r[C.fac] || 0, reg: +r[C.reg] || 0 }; });
      var old = db.opcoDos || {};
      var nouv = list.filter(function (x) { return !old[x.num]; });
      var chg = list.filter(function (x) { return old[x.num] && old[x.num].etat !== x.etat; }).map(function (x) { return { o: old[x.num], x: x }; });
      var bySiret = new Map(db.clients.filter(function (c) { return dg(c.siret).length >= 9; }).map(function (c) { return [dg(c.siret), c]; }));
      return { kind: 'dos', list: list, nouv: nouv, chg: chg, same: list.filter(function (x) { return old[x.num] && old[x.num].etat === x.etat; }), file: file.name, opco: opco, lies: list.filter(function (x) { return bySiret.has(x.siret); }).length, orph: Array.from(new Set(list.filter(function (x) { return !bySiret.has(x.siret) && !db.links[x.num]; }).map(function (x) { return x.rs; }))) };
    }
    // format « paiements »
    if (col('virement - référence') && col('facture - référence')) {
      var P = { vir: col('virement - référence'), paye: col('facture - date de paiement'), ref: col('facture - référence'), etat: col('facture - etat'), date: col('facture - date de la facture'), recu: col('facture - date de reception'), ht: col('facture - montant ht'), dos: col('dossier - numero'), acc: col("dossier - date d'accord"), refint: col('dossier - référence interne') };
      var listp = rows.filter(function (r) { return r[P.dos] && r[P.ref] != null; }).map(function (r) { return { opco: opco, ref: String(r[P.ref]).trim(), vir: String(r[P.vir] || ''), paye: toIso(r[P.paye]), etat: String(r[P.etat] || 'Payé').trim(), date: toIso(r[P.date]), recu: toIso(r[P.recu]) || toIso(r[P.date]), ht: +r[P.ht] || 0, dossier: String(r[P.dos]).trim(), accord: toIso(r[P.acc]), refint: String(r[P.refint] || '') }; });
      var cur = function (x) { return db.opcoInv.find(function (o) { return o.opco === opco && o.dossier === x.dossier && String(o.ref) === x.ref; }); };
      var nouvp = listp.filter(function (x) { return !cur(x); });
      var chgp = listp.filter(function (x) { var o = cur(x); return o && !(o.etat === 'Payé' && o.paye); }).map(function (x) { return { o: cur(x), x: x }; });
      return { kind: 'pay', list: listp, nouv: nouvp, chg: chgp, same: listp.filter(function (x) { var o = cur(x); return o && o.etat === 'Payé' && o.paye; }), file: file.name, opco: opco };
    }
    // format « facturation générale »
    var find = function (k) { return heads.find(function (h) { return COLMAP[k].indexOf(String(h).trim().toLowerCase()) >= 0; }); };
    var H = {}; Object.keys(COLMAP).forEach(function (k) { H[k] = find(k); });
    var missing = ['num', 'etat', 'ht', 'dossier'].filter(function (k) { return !H[k]; });
    if (missing.length) return { error: 'Colonnes non reconnues (' + missing.join(', ') + '). Colonnes trouvées : ' + heads.slice(0, 12).join(' · ') };
    var listf = rows.filter(function (r) { return r[H.num] != null; }).map(function (r) { return { opco: opco, num: String(r[H.num]), ref: String(r[H.ref] == null ? r[H.num] : r[H.ref]), date: toIso(r[H.date]), recu: toIso(r[H.recu]) || toIso(r[H.date]), etat: String(r[H.etat] || '').trim(), paye: toIso(r[H.paye]), ht: +r[H.ht] || 0, dossier: String(r[H.dossier] || ''), refint: String(r[H.refint] || '') }; });
    var oldf = db.opcoInv.filter(function (x) { return x.opco === opco; });
    var om = new Map(oldf.map(function (x) { return [x.num + '|' + x.date, x]; }));
    var nf = [], cf = [], sf = [];
    listf.forEach(function (x) { var o = om.get(x.num + '|' + x.date); if (!o) nf.push(x); else if (o.etat !== x.etat) cf.push({ o: o, x: x }); else sf.push(x); });
    return { kind: 'fac', list: listf, nouv: nf, chg: cf, same: sf, file: file.name, opco: opco };
  }

  /* ---- rattachement des dossiers AKTO aux entreprises (SIRET/SIREN + n°) ---- */
  function opcoDosLink(db) {
    var n = 0, dg = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };
    var STOP = new Set(['sarl', 'sas', 'sasu', 'eurl', 'snc', 'sci', 'les', 'des', 'the', 'chez', 'restaurant', 'snack', 'pizzeria', 'boulangerie', 'boucherie', 'france']);
    var tok = function (s) { return norm(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3 && !STOP.has(w); }); };
    var nameOk = function (a, b) { var A = tok(a), B = new Set(tok(b)); return A.length && B.size && (A.filter(function (w) { return B.has(w); }).length >= Math.min(2, Math.min(A.length, B.size))); };
    var bySir = new Map(), bySrn = new Map(), byNum = new Map();
    // n° AKTO éventuellement saisis sur la fiche (modèle maquette : d.ak.num ; modèle v112 : d.opcoNum)
    var numsOf = function (c) { var d = (db.dossiers || {})[c.id] || (db.dos || {})[c.id] || {}; return String(d.opcoNum || (d.ak && d.ak.num) || '').toUpperCase().split(/[\s,;]+/).filter(Boolean); };
    (db.clients || []).forEach(function (c) { var s = dg(c.siret); if (s.length >= 14) { if (!bySir.has(s)) bySir.set(s, []); bySir.get(s).push(c); } if (s.length >= 9) { var r = s.slice(0, 9); if (!bySrn.has(r)) bySrn.set(r, []); bySrn.get(r).push(c); } numsOf(c).forEach(function (k) { if (!byNum.has(k)) byNum.set(k, []); byNum.get(k).push(c); }); });
    db.opcoOk = db.opcoOk || {}; db.links = db.links || {};
    var noNums = byNum.size === 0; // aucun numéro AKTO saisi sur les fiches -> SIRET seul suffit
    Object.values(db.opcoDos || {}).forEach(function (x) {
      var xs = dg(x.siret), num = String(x.num || '').toUpperCase();
      var exact = xs.length >= 14 ? (bySir.get(xs) || []) : [];
      var C = exact.length ? exact : (xs.length >= 9 ? (bySrn.get(xs.slice(0, 9)) || []) : []);
      var crit = exact.length ? 'SIRET' : 'SIREN';
      var N = byNum.get(num) || [], both = C.filter(function (c) { return N.indexOf(c) >= 0; });
      var man = db.opcoOk[x.num] && (db.clients || []).find(function (c) { return c.id === db.opcoOk[x.num]; });
      var st = 'absent', cid = null, why = [];
      if (man) { st = 'ok'; cid = man.id; why = ['confirmé à la main']; }
      else if (both.length === 1) { st = 'ok'; cid = both[0].id; why = [crit, 'numéro de dossier AKTO']; }
      else if (both.length > 1) { st = 'doublon'; }
      else if (C.length > 1) { st = 'doublon'; }
      else if (C.length === 1) { cid = C[0].id; if (noNums) { st = 'ok'; why = [crit + ' (numéro AKTO non saisi sur les fiches)']; } else { st = 'doute'; why = [crit + ' identique à ' + C[0].nom]; } }
      else if (N.length === 1) { st = 'doute'; cid = N[0].id; why = ['numéro de dossier identique à ' + N[0].nom]; }
      else { var c = (db.clients || []).find(function (c) { return nameOk(x.rs, c.nom) && tok(x.rs).length === tok(c.nom).length; }); if (c) { st = 'doute'; cid = c.id; why = ['même nom que ' + c.nom]; } }
      x.m = { st: st, cid: cid, why: why };
      if (st === 'ok') { if (db.links[x.num] !== cid) { db.links[x.num] = cid; n++; } }
      else if (db.links[x.num] && !man) { delete db.links[x.num]; }
    });
    return n;
  }

  /* ---- applique un résultat d'import dans la base ---- */
  function applyImport(r, db, by) {
    db.opcoInv = db.opcoInv || []; db.imports = db.imports || []; db.opcoDos = db.opcoDos || {}; db.links = db.links || {};
    var n = 0;
    if (r.kind === 'dos') {
      r.list.forEach(function (x) { db.opcoDos[x.num] = x; });
      n = opcoDosLink(db);
    } else if (r.kind === 'pay') {
      r.list.forEach(function (x) {
        var o = db.opcoInv.find(function (q) { return q.opco === r.opco && q.dossier === x.dossier && String(q.ref) === x.ref; });
        if (!o) { o = { opco: r.opco, num: 'V' + x.dossier + '-' + x.ref, ref: x.ref, date: x.date, recu: x.recu, ht: x.ht, dossier: x.dossier, refint: x.refint }; db.opcoInv.push(o); }
        o.etat = 'Payé'; o.paye = x.paye; o.vir = x.vir; if (x.accord) o.accord = x.accord; n++;
      });
    } else if (r.kind === 'fac') {
      r.list.forEach(function (x) {
        var o = db.opcoInv.find(function (q) { return q.opco === r.opco && q.num === x.num && q.date === x.date; });
        if (!o) { db.opcoInv.push(x); n++; } else { o.etat = x.etat; o.paye = x.paye || o.paye; }
      });
    }
    db.imports.push({ id: 'I' + Date.now(), opco: r.opco, date: iso(new Date()), par: by || '', valide: true, lignes: r.list.length, fichier: r.file, type: r.kind });
    db.opRev = (db.opRev || 0) + 1;
    return n;
  }

  /* ---- charge XLSX à la demande ---- */
  function loadScript(src) { return new Promise(function (res, rej) { if (document.querySelector('script[data-ppa="' + src + '"]')) return res(); var sc = document.createElement('script'); sc.src = src; sc.dataset.ppa = src; sc.onload = res; sc.onerror = function () { rej(new Error('Chargement impossible : ' + src)); }; document.head.appendChild(sc); }); }
  async function ensureLibs() { var L = (glob.PPA && glob.PPA.lib) || '../lib/'; if (!glob.XLSX) await loadScript(L + 'xlsx-0.18.5.full.min.js'); }

  // reconnaît l'OPCO/format au nom de fichier (pour l'instant tout AKTO)
  function guessOpco() { return 'AKTO'; }

  /* ---- orchestration : lit plusieurs fichiers, applique, résume ---- */
  async function importFiles(files, db, by, onParsed) {
    await ensureLibs();
    var out = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], r;
      try { r = await parseExport(f, guessOpco(f.name), db, glob.XLSX); }
      catch (e) { out.push({ name: f.name, error: 'Lecture impossible : ' + (e.message || e) }); continue; }
      if (r.error) { out.push({ name: f.name, error: r.error }); continue; }
      if (onParsed) { var go = onParsed(r); if (go === false) { out.push({ name: f.name, r: r, skipped: true }); continue; } }
      var n = applyImport(r, db, by);
      out.push({ name: f.name, kind: r.kind, lignes: r.list.length, nouv: r.nouv.length, chg: r.chg.length, applied: n, lies: r.lies, orph: r.orph });
    }
    return out;
  }

  var api = { parseExport: parseExport, opcoDosLink: opcoDosLink, applyImport: applyImport, importFiles: importFiles, ensureLibs: ensureLibs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  glob.PPA_IMPORT = api;
})(typeof window !== 'undefined' ? window : globalThis);
