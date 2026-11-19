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

  /* ============================================================
     Import des listes d'appels (phoning) — porté du moteur v112
     PDF « CARTE PHONEUR » (veille PPA), Excel, CSV, texte collé.
     ============================================================ */
  var ACTS = ['Restauration rapide', 'Boucherie', 'Boulangerie', 'Coiffure', 'Commerce alimentaire', 'Création d’entreprise', 'Autre'];
  var LSV = ['PMS', 'Hygiène alimentaire', 'Étiquetage', 'Traçabilité', 'Relevés froid', 'Nettoyage', 'Températures', 'Ouverture', 'Affichages obligatoires'];
  function nzp(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  var AP_COLS = [['nom', ['enseigne', 'nom commercial', 'libelle etablissement', 'etablissement', 'denomination', 'raison sociale', 'societe', 'entreprise', 'nom']], ['rs', ['exploitant', 'raison sociale', 'denomination sociale', 'denomination', 'forme juridique']], ['tel', ['telephone', 'tel', 'portable', 'mobile', 'phone', 'numero de telephone']], ['ville', ['ville', 'commune', 'localite']], ['cp', ['code postal', 'cp', 'postal']], ['adresse', ['adresse', 'rue', 'voie']], ['siret', ['siret']], ['siren', ['siren']], ['ape', ['ape', 'naf']], ['eff', ['effectif', 'salaries', 'nb salaries']], ['contact', ['dirigeant', 'gerant', 'contact', 'responsable']], ['dirQ', ['qualite', 'fonction']], ['email', ['email', 'e mail', 'mail', 'courriel']], ['acti', ['activite', 'type d activite', 'categorie', 'type', 'secteur']], ['alim', ['alim confiance', 'alimconfiance', 'niveau d hygiene', 'niveau hygiene', 'synthese eval sanit', 'evaluation sanitaire', 'resultat du controle', 'niveau', 'evaluation']], ['alimDate', ['date d inspection', 'date inspection', 'date du controle', 'date de controle', 'date controle', 'inspection']], ['raison', ['raison d appel', 'raison appel', 'motif d appel', 'motif', 'raison']], ['angle', ['angle commercial', 'angle', 'accroche', 'argument']], ['services', ['services', 'service', 'besoins', 'besoin']], ['priorite', ['priorite', 'urgence']], ['notes', ['commentaire', 'note', 'notes', 'observation', 'observations', 'remarque']]];
  var apTel = function (v) { var d = String(v == null ? '' : v).replace(/[^0-9+]/g, ''); if (d.indexOf('+33') === 0) d = '0' + d.slice(3); if (d.indexOf('0033') === 0) d = '0' + d.slice(4); if (/^[1-9]\d{8}$/.test(d)) d = '0' + d; return /^0\d{9}$/.test(d) ? d.replace(/(\d\d)(?=\d)/g, '$1 ') : String(v == null ? '' : v).trim(); };
  var apAlim = function (v) { var n = nzp(v); return !n ? '' : /urgent/.test(n) ? 'À corriger de manière urgente' : /amelior/.test(n) ? 'À améliorer' : /tres/.test(n) ? 'Très satisfaisant' : /satisf/.test(n) ? 'Satisfaisant' : /non retrouv|introuvable|absent|aucun/.test(n) ? 'Non retrouvé' : ''; };
  var apDate = function (v) { var t = String(v || '').trim(), m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3]; m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); return m ? (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : ''; };
  var apPrio = function (v, al) { var n = nzp(v); return /haut|eleve|urgent|^1$|forte|chaud/.test(n) ? 'haute' : /moyen|^2$/.test(n) ? 'moyenne' : n ? 'qualifier' : /urgente|améliorer/.test(al) ? 'haute' : al === 'Satisfaisant' ? 'moyenne' : 'qualifier'; };
  var apAct = function (v) { var n = nzp(v); if (!n) return 'Autre'; var d = ACTS.find(function (a) { return nzp(a) === n || n.indexOf(nzp(a)) >= 0; }); if (d) return d; return /restau|pizz|kebab|snack|burger|tacos|sushi|brasserie|traiteur|friterie|cafe|bar /.test(n) ? 'Restauration rapide' : /boucher|charcut/.test(n) ? 'Boucherie' : /boulang|patiss/.test(n) ? 'Boulangerie' : /aliment|epicer|primeur|superette|supermarche|poissonn|fromag/.test(n) ? 'Commerce alimentaire' : 'Autre'; };
  function apCsv(t) {
    t = String(t).replace(/^﻿/, '').replace(/^```[a-z]*\s*$/gim, ''); var lines = t.split(/\r?\n/).filter(function (l) { return l.trim(); }); var l1 = lines[0] || '';
    if (/^\s*\|/.test(l1) && l1.split('|').length > 3) return lines.filter(function (l) { return !/^\s*\|?[\s:|-]+\|?\s*$/.test(l); }).map(function (l) { return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (x) { return x.trim().replace(/^\*\*|\*\*$/g, ''); }); });
    var sep = [';', '\t', ',', '|'].map(function (c) { return [c, l1.split(c).length]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0]; var R = [], row = [], cur = '', q = false; t = lines.join('\n');
    for (var i = 0; i < t.length; i++) { var c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); R.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; }
    if (cur || row.length) { row.push(cur); R.push(row); } return R.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }
  function apCards(t, STATE) {
    var B = String(t).replace(/\r/g, '').split(/^.*CARTE\s+PHONEUR\s+\d+\s*\/\s*\d+.*$/im).slice(1), O = [], X = {};
    var HD = [['id', /^IDENTIT[ÉE] ET CONTR[ÔO]LE/i], ['why', /^POURQUOI APPELER/i], ['ang', /^ANGLE PPA/i], ['acc', /^ACCROCHE T[ÉE]L[ÉE]PHONIQUE/i], ['q', /^\d?\s*QUESTIONS? PHONEUR/i], ['end', /^SUIVI COMMERCIAL/i]];
    B.forEach(function (b) {
      var LN = b.split('\n'), S = { head: [], id: [], why: [], ang: [], acc: [], q: [], r: [] }, cur = 'head';
      for (var ri = 0; ri < LN.length; ri++) { var raw = LN[ri], parts = raw.split('\t'), l = (parts[0] || '').trim(), r = (parts[1] || '').trim(); var hd = HD.find(function (x) { return x[1].test(l); }); if (hd) { if (hd[0] === 'end') break; cur = hd[0]; if (r) S.r.push(r); continue; } if (cur === 'q') { if (!r) { var m = l.match(/^(.*?)\s{3,}(\S.*)$/); if (m) { l = m[1]; r = m[2]; } } if (l) S.q.push(l); if (r) S.r.push(r); } else if (l || r) S[cur].push((l + ' ' + r).trim()); }
      var nom = (S.head[0] || '').trim(); if (!nom) return;
      var pl = S.head.slice(1).join(' ').match(/(P\d)\s*[—–-]\s*(.*?)\s*\|\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\|\s*(.*)$/) || [];
      var F = {}; S.id.join('\n').split(/\n|\s•\s/).forEach(function (x) { var m = x.match(/^\s*([^:]{2,40}?)\s*:\s*(.+)$/); if (m) F[nzp(m[1])] = m[2].trim(); else { var k = Object.keys(F).pop(); if (k && x.trim()) F[k] += ' ' + x.trim(); } });
      var g = function (re) { var k = Object.keys(F).find(function (k) { return re.test(k); }); return k ? F[k] : ''; };
      var adr = g(/^adresse/), ma = adr.match(/^(.*?)[,\s]+(\d{5})\s+(.+)$/) || [], ss = g(/siren|siret/).split('/').map(function (x) { return x.replace(/\D/g, ''); }), dir = g(/^dirigeant/), md = dir.match(/^(.*?)\s*\(([^)]*)\)\s*$/) || [], tel = g(/^telephone/);
      var ang = S.ang.join(' '), ks = ang.search(/Services?\s*:/i), rr = S.r.join('\n'), ke = rr.search(/À ÉVITER|A EVITER/i), join = function (a) { return a.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim(); };
      var ob = join((ke < 0 ? rr : rr.slice(0, ke)).replace(/OBJECTIF DU RENDEZ-?VOUS/i, '')), ev = ke < 0 ? '' : join(rr.slice(ke).replace(/À ÉVITER|A EVITER/i, ''));
      var qs = join(S.q.join('\n')).split(/\s*(?=\b[1-9]\.\s)/).map(function (x) { return x.replace(/^\d\.\s*/, '').replace(/\s+\?/g, ' ?').trim(); }).filter(Boolean);
      var siret = (ss.find(function (x) { return x.length === 14; }) || '');
      var o = { 'Etablissement': nom, 'Exploitant': g(/^raison sociale/), 'Dirigeant': md[1] || dir, 'Qualite': md[2] || '', 'Adresse': ma[1] || adr, 'Code postal': ma[2] || '', 'Ville': ma[3] || '', 'Telephone': /\d{2}/.test(tel) ? tel : '', 'SIRET': siret || ss[0] || '', 'APE': g(/^ape|^naf/), 'Activite': g(/^activite/), 'Alim confiance': g(/^resultat/) || pl[4] || '', 'Date inspection': pl[3] || '', 'Raison d appel': S.why.join(' '), 'Angle commercial': (ks < 0 ? ang : ang.slice(0, ks)).trim(), 'Services': ks < 0 ? '' : ang.slice(ks).replace(/Services?\s*:\s*/i, ''), 'Priorite': pl[1] === 'P1' ? 'haute' : pl[1] === 'P2' ? 'moyenne' : '', 'Notes': pl[1] ? pl[1] + ' — ' + pl[2] : '' };
      O.push(o); X[siret || nzp(nom)] = { accroche: S.acc.join(' ').replace(/^[«"\s]+|[»"\s]+$/g, ''), questions: qs.slice(0, 5), objectif: ob, eviter: ev, servTxt: o.Services, inspection: g(/^inspection/), cible: pl[2] || '' };
    });
    STATE.impX = X; return O;
  }
  function apFiches(t) { var B = String(t).replace(/\r/g, '').split(/\n\s*\n|\n\s*(?:-{3,}|={3,}|\*{3,}|#{1,4}\s.*|fiche\s*(?:n[°o]\s*)?\d+.*)\s*\n/i).map(function (b) { return b.trim(); }).filter(Boolean), O = []; B.forEach(function (b) { var o = {}; b.split('\n').forEach(function (l) { var m = l.replace(/^[\s>*•\-–\d.)]+/, '').replace(/\*\*/g, '').match(/^([^:：]{2,40})\s*[:：]\s*(.*)$/); if (m && m[2].trim()) o[m[1].trim()] = m[2].trim(); }); if (Object.keys(o).length >= 2) O.push(o); }); return O; }
  function apObjs(O) { var K = []; O.forEach(function (o) { Object.keys(o).forEach(function (k) { if (K.indexOf(k) < 0) K.push(k); }); }); return [K].concat(O.map(function (o) { return K.map(function (k) { var v = o[k]; return v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.values(v).join(' ') : String(v); }); })); }
  function apMap(H) { var N = H.map(nzp), M = {}; AP_COLS.forEach(function (pair) { var k = pair[0], W = pair[1]; for (var wi = 0; wi < W.length; wi++) { var w = W[wi]; var i = N.findIndex(function (h, j) { return Object.values(M).indexOf(j) < 0 && (h === w || h.indexOf(w + ' ') === 0 || h.slice(-(w.length + 1)) === ' ' + w || (' ' + h + ' ').indexOf(' ' + w + ' ') >= 0) && !(k === 'nom' && /prenom|dirigeant|gerant|contact|responsable|activite|exploitant/.test(h)) && !(k === 'acti' && /libelle etablissement$/.test(h) && !/activite/.test(h)) && !(k === 'alim' && /date/.test(h)); }); if (i >= 0) { M[k] = i; break; } } }); return M; }
  function apRead(t, STATE) {
    t = String(t || '').trim(); if (!t) return null; STATE.impX = null;
    if (/CARTE\s+PHONEUR\s+\d+\s*\/\s*\d+/i.test(t)) { var O = apCards(t, STATE); if (O.length) return apObjs(O); }
    if (/^[\[{]/.test(t.replace(/^```[a-z]*\s*/i, ''))) { try { var j = JSON.parse(t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '')); if (!Array.isArray(j)) j = Object.values(j).find(Array.isArray) || [j]; return apObjs(j.filter(function (x) { return x && typeof x === 'object'; })); } catch (e) {} }
    var LN = t.split('\n'), pipe = LN.filter(function (l) { return /^\s*\|.*\|\s*$/.test(l); }); if (pipe.length >= 2) return apCsv(pipe.join('\n'));
    var cnt = function (l) { return Math.max(l.split(';').length, l.split('\t').length); }, k = LN.findIndex(function (l) { return cnt(l) >= 4; }); if (k > 0) t = LN.slice(k).filter(function (l) { return cnt(l) >= 2; }).join('\n');
    var l1 = t.split('\n').find(function (l) { return l.trim(); }) || ''; var tab = Math.max.apply(null, [';', '\t', '|'].map(function (c) { return l1.split(c).length; })) >= 3 || (l1.split(',').length >= 4 && !/:/.test(l1));
    if (!tab) { var O2 = apFiches(t); if (O2.length) return apObjs(O2); } return apCsv(t);
  }
  function apParse(R, db) {
    if (!R || R.length < 2) return { err: 'Il faut une ligne de titres puis au moins un contact, ou des fiches « Champ : valeur ».' };
    var M = apMap(R[0]); if (M.nom == null) return { err: 'Nom de l’établissement introuvable. Titres lus : ' + R[0].join(', ') };
    var dig = function (v) { return String(v || '').replace(/\D/g, ''); }, seen = new Set();
    (db.deals || []).concat(db.clients || []).forEach(function (x) { if (dig(x.tel).length >= 9) seen.add('t' + dig(x.tel).slice(-9)); if (dig(x.siret).length === 14) seen.add('s' + dig(x.siret)); });
    var out = [], dup = 0, vide = 0, noTel = 0;
    R.slice(1).forEach(function (r) {
      var g = function (k) { return M[k] == null ? '' : String(r[M[k]] == null ? '' : r[M[k]]).trim(); };
      var nom = g('nom'); if (!nom || /^[-—–\s]*$/.test(nom)) { vide++; return; }
      var tel = apTel(g('tel')), k1 = dig(tel).length >= 9 ? 't' + dig(tel).slice(-9) : '', k2 = dig(g('siret')).length === 14 ? 's' + dig(g('siret')) : '';
      if ((k1 && seen.has(k1)) || (k2 && seen.has(k2))) { dup++; return; } if (k1) seen.add(k1); if (k2) seen.add(k2); if (!tel) noTel++;
      var alim = apAlim(g('alim')), sv = nzp(g('services'));
      out.push({ nom: nom, rs: g('rs'), tel: tel, ville: g('ville'), cp: dig(g('cp')).slice(0, 5), adresse: g('adresse'), siret: dig(g('siret')) || dig(g('siren')), ape: g('ape'), eff: g('eff'), contact: g('contact'), dirQ: g('dirQ'), email: g('email'), act: apAct(g('acti')) !== 'Autre' ? apAct(g('acti')) : apAct(nom + ' '), acti: g('acti'), alim: alim, alimDate: apDate(g('alimDate')), raison: g('raison'), angle: g('angle'), services: LSV.filter(function (x) { return sv && sv.indexOf(nzp(x)) >= 0; }), priorite: apPrio(g('priorite'), alim), notes: g('notes') });
    });
    return { rows: out, dup: dup, vide: vide, noTel: noTel, cols: Object.keys(M) };
  }
  async function apPdf(file) {
    var lib = glob.pdfjsLib || glob['pdfjs-dist/build/pdf'];
    if (!lib) throw new Error('pdfjs non chargé');
    var L = (glob.PPA && glob.PPA.lib) || '../lib/'; try { lib.GlobalWorkerOptions.workerSrc = L + 'pdf.worker-3.11.174.min.js'; } catch (e) {}
    var pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; var out = [];
    for (var pn = 1; pn <= pdf.numPages; pn++) {
      var pg = await pdf.getPage(pn), W = pg.getViewport({ scale: 1 }).width, tc = await pg.getTextContent(), Ls = [];
      tc.items.forEach(function (it) { if (!String(it.str).trim()) return; var x = it.transform[4], y = it.transform[5]; var l = Ls.find(function (q) { return Math.abs(q.y - y) < 3; }); if (!l) { l = { y: y, it: [] }; Ls.push(l); } l.it.push({ x: x, s: it.str }); });
      Ls.sort(function (a, b) { return b.y - a.y; }).forEach(function (l) { l.it.sort(function (a, b) { return a.x - b.x; }); var a = l.it.filter(function (i) { return i.x < W * .5; }).map(function (i) { return i.s; }).join(' '), b = l.it.filter(function (i) { return i.x >= W * .5; }).map(function (i) { return i.s; }).join(' '); out.push((a + (b ? '\t' + b : '')).replace(/ {2,}/g, ' ')); }); out.push('');
    }
    return out.join('\n');
  }
  async function ensurePdf() { var L = (glob.PPA && glob.PPA.lib) || '../lib/'; if (!glob.XLSX) await loadScript(L + 'xlsx-0.18.5.full.min.js'); if (!(glob.pdfjsLib || glob['pdfjs-dist/build/pdf'])) await loadScript(L + 'pdf-3.11.174.min.js'); }

  // lit un fichier (PDF carte phoneur, Excel, CSV) -> {rows, impX, ...}
  async function parsePhoning(file, db) {
    await ensurePdf();
    var STATE = { impX: null }, R;
    if (/\.xlsx?$/i.test(file.name)) { var wb = glob.XLSX.read(await file.arrayBuffer(), { type: 'array' }); R = glob.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).filter(function (r) { return r.some(function (x) { return String(x).trim(); }); }); }
    else if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') { var t = await apPdf(file); R = apRead(t, STATE); if (!STATE.impX) throw new Error('ce PDF ne contient pas de « CARTE PHONEUR »'); }
    else { var txt = await file.text(); R = apRead(txt, STATE); }
    var P = apParse(R, db); P.impX = STATE.impX; return P;
  }

  // pousse les fiches dans db.deals (leads), attribuées à "who"
  function savePhoning(P, db, who, listName) {
    db.deals = db.deals || [];
    var t0 = Date.now(), n = 0;
    (P.rows || []).forEach(function (r, k) {
      var enr = (P.impX || {})[r.siret] || (P.impX || {})[nzp(r.nom)] || {};
      db.deals.push(Object.assign({ id: 'D' + (t0 + k), lead: 1, froid: 1, liste: listName, offre: 'Hygiène alimentaire HACCP', montant: 1120, etape: 'Prospect', maj: new Date().toISOString().slice(0, 10), act: 'Autre', priorite: 'qualifier', phoneuse: who, origine: 'centre', suivi: { statut: '', notes: r.notes || '' } },
        { nom: r.nom, rs: r.rs, tel: r.tel, ville: r.ville, cp: r.cp, adresse: r.adresse, siret: r.siret, ape: r.ape, eff: r.eff, contact: r.contact, dirQ: r.dirQ, email: r.email, act: r.act, acti: r.acti, alim: r.alim, alimDate: r.alimDate, raison: r.raison, angle: r.angle, services: r.services, priorite: r.priorite }, enr));
      n++;
    });
    db.opRev = (db.opRev || 0) + 1;
    return n;
  }

  // orchestration : plusieurs fichiers -> leads
  async function importCalls(files, db, who, listName) {
    var out = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], P;
      try { P = await parsePhoning(f, db); } catch (e) { out.push({ name: f.name, error: 'Lecture impossible : ' + (e.message || e) }); continue; }
      if (P.err) { out.push({ name: f.name, error: P.err }); continue; }
      var n = savePhoning(P, db, who, listName || ('Liste du ' + new Date().toLocaleDateString('fr-FR')));
      out.push({ name: f.name, pdf: /\.pdf$/i.test(f.name), lus: (P.rows.length + P.dup + P.vide), nv: n, dbl: P.dup, sans: P.noTel });
    }
    return out;
  }

  var api = { parseExport: parseExport, opcoDosLink: opcoDosLink, applyImport: applyImport, importFiles: importFiles, ensureLibs: ensureLibs, parsePhoning: parsePhoning, savePhoning: savePhoning, importCalls: importCalls };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  glob.PPA_IMPORT = api;
})(typeof window !== 'undefined' ? window : globalThis);
