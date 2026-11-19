/* ============================================================
   PPA Pilot — couche de données réelle (adaptateur)
   Transforme la base Supabase (v112/v113) dans les structures
   attendues par la maquette : TEAM, ROLES, ENTS, DEALS, EVS…
   Mode réel si window.PPA.sync.db existe, sinon laisse la démo.
   Module pur et testable : buildAdapter(db, meId) -> objet.
   ============================================================ */
(function (glob) {
  'use strict';

  /* ---------- utilitaires ---------- */
  function initials(nom) {
    var p = String(nom || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '??';
    if (p.length === 1) return (p[0].slice(0, 2)).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }
  // "Rachid AIT LASRI" -> "Rachid A."  (prénom + initiale du 1er mot de nom)
  function shortName(nom) {
    var p = String(nom || '').trim().split(/\s+/).filter(Boolean);
    if (p.length < 2) return p[0] || '—';
    return p[0] + ' ' + p[1][0].toUpperCase() + '.';
  }
  var T0 = new Date(); T0.setHours(0, 0, 0, 0);
  function dayDiff(d) {
    if (!d) return null;
    var t = new Date(String(d) + 'T12:00'); if (isNaN(t)) return null;
    return Math.round((t - T0) / 86400000);
  }
  function roleKind(m) {
    var t = String(m && m.type || '').toLowerCase();
    if (t === 'direction') return 'direction';
    if (t === 'admin') return 'admin';
    if (t === 'phoneuse') return 'phoneuse';
    if (t === 'formateur') return 'formateur';
    return 'terrain';
  }
  var ROLE_LAB = {
    direction: 'Direction', admin: 'Gestion administrative',
    terrain: 'Commercial', phoneuse: 'Téléprospection', formateur: 'Formateur'
  };
  // menu visible par rôle (reprend les décisions : admin voit la téléprospection,
  // commercial et téléprospection voient agenda ; formateur voit les formations)
  var ROLE_VIEWS = {
    direction: ['aujourdhui', 'agenda', 'appels', 'affaires', 'formations', 'finances', 'entreprises', 'rapports'],
    admin: ['aujourdhui', 'agenda', 'appels', 'affaires', 'formations', 'finances', 'entreprises', 'rapports'],
    terrain: ['aujourdhui', 'agenda', 'appels', 'affaires', 'entreprises', 'finances'],
    phoneuse: ['aujourdhui', 'agenda', 'appels', 'finances'],
    formateur: ['aujourdhui', 'agenda', 'formations', 'entreprises']
  };

  /* ---------- équipe : codes stables + maps ---------- */
  function buildTeam(equipe) {
    var TEAM = {}, EMAP = {}, used = {};
    (equipe || []).forEach(function (e) {
      var c = initials(e.nom); // code 2 lettres
      if (used[c]) { // collision -> prénom[0]+nom[1]…
        var alt = (String(e.nom).replace(/\s+/g, '').slice(0, 2)).toUpperCase(), i = 2;
        while (used[alt]) { alt = (initials(e.nom)[0] + String(i)); i++; }
        c = alt;
      }
      used[c] = 1;
      TEAM[c] = shortName(e.nom);
      EMAP[e.id] = c;
    });
    return { TEAM: TEAM, EMAP: EMAP };
  }

  /* ---------- rôles : un représentant par rôle (pour le sélecteur) ---------- */
  function buildRoles(equipe, EMAP, TEAM, meId) {
    var byRole = {};
    (equipe || []).forEach(function (e) {
      var k = roleKind(e);
      if (!byRole[k]) byRole[k] = e; // premier trouvé = représentant
    });
    var out = {};
    Object.keys(ROLE_VIEWS).forEach(function (k) {
      var e = byRole[k];
      // si le user connecté a ce rôle, c'est lui le représentant
      var meMember = (equipe || []).filter(function (x) { return x.id === meId; })[0];
      if (meMember && roleKind(meMember) === k) e = meMember;
      out[k] = {
        nom: e ? shortName(e.nom) : ROLE_LAB[k],
        lab: ROLE_LAB[k],
        ini: e ? initials(e.nom) : '??',
        eid: e ? e.id : null,
        code: e ? EMAP[e.id] : null,
        v: ROLE_VIEWS[k]
      };
    });
    return out;
  }

  /* ---------- entreprises ---------- */
  function entStage(c, dealByEnt, opcoPaidByDossier) {
    if (String(c.statut || '') === 'Soldé') return 'paye';
    // facture AKTO payée rattachée à son dossier
    if (c.dossier && opcoPaidByDossier[c.dossier]) return 'paye';
    if (c.signe) {
      if (c.dossier) return 'opco';
      return 'signe';
    }
    var dl = dealByEnt[c.id] || dealByEnt[normKey(c.nom)];
    if (dl) {
      if (/gagn|sign/i.test(dl.etape)) return 'signe';
      if (/rdv/i.test(dl.etape)) return 'rdv';
    }
    return 'prospect';
  }
  function normKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function buildEnts(db, EMAP) {
    var clients = db.clients || [];
    var deals = db.deals || [];
    // index deals par entreprise (par nom normalisé, faute d'un lien direct)
    var dealByEnt = {};
    deals.forEach(function (d) {
      var k = normKey(d.nom || d.rs);
      if (k && !dealByEnt[k]) dealByEnt[k] = d;
    });
    // factures AKTO payées par dossier
    var opcoPaid = {};
    (db.opcoInv || []).forEach(function (o) {
      if ((o.paye || /pay|régl|sold/i.test(String(o.etat || ''))) && o.dossier) opcoPaid[o.dossier] = true;
    });
    // CA encaissé par dossier (pour la colonne CA)
    var caByDossier = {};
    (db.opcoInv || []).forEach(function (o) {
      if (o.dossier) caByDossier[o.dossier] = (caByDossier[o.dossier] || 0) + (+o.ht || 0);
    });

    return clients.map(function (c) {
      var stage = entStage(c, { /* id */ }, opcoPaid);
      // re-tente via nom normalisé
      var dl = dealByEnt[normKey(c.nom)];
      if (stage === 'prospect' && dl) {
        if (/gagn|sign/i.test(dl.etape)) stage = 'signe';
        else if (/rdv/i.test(dl.etape)) stage = 'rdv';
      }
      var ld = dayDiff(c.last);
      var dir = String(c.dirigeant || '').split(/[;,]/)[0].trim();
      return {
        id: c.id,
        nom: c.nom || c.rs || c.id,
        ville: c.ville || '',
        act: c.secteur || c.acti || '—',
        stage: stage,
        com: EMAP[c.commercial] || '',
        tel: EMAP[c.phoneuse] || '',
        last: ld == null ? -99 : ld,
        next: nextAction(c, stage),
        nextD: 0,
        ca: c.dossier ? (caByDossier[c.dossier] || 0) : 0,
        siret: c.siret || '',
        gerant: dir || '',
        phone: c.tel || '',
        opco: c.opco || '',
        eff: c.eff || '',
        alim: c.alim || '—',
        adr: c.adresse || ''
      };
    });
  }
  function nextAction(c, stage) {
    if (stage === 'prospect') return c.commercial ? 'Reprendre contact' : 'Premier appel';
    if (stage === 'rdv') return 'Rendez-vous à mener';
    if (stage === 'signe') return 'Monter le dossier';
    if (stage === 'opco') return 'Relancer / suivre l’AKTO';
    if (stage === 'paye') return 'Suivi à 3 mois';
    return '';
  }

  /* ---------- affaires (kanban) ---------- */
  function mapEtape(e) {
    e = String(e || '');
    if (/gagn|sign/i.test(e)) return 'signe';
    if (/rdv/i.test(e)) return 'rdv';
    if (/perdu|refus/i.test(e)) return 'perdu';
    return 'prospect';
  }
  function buildDeals(db, EMAP) {
    return (db.deals || []).map(function (d) {
      return {
        id: d.id,
        nom: d.nom || d.rs || d.id,
        ville: d.ville || '',
        offre: d.offre || 'Formation',
        montant: +d.montant || 0,
        etape: d.etape || 'Prospect',
        stage: mapEtape(d.etape),
        c: EMAP[d.commercial] || EMAP[d.phoneuse] || '',
        tel: EMAP[d.phoneuse] || '',
        contact: d.contact || '',
        maj: d.maj || ''
      };
    });
  }

  /* ---------- agenda (RDV + audits) ---------- */
  function buildEvents(db, EMAP) {
    var out = [];
    (db.rdv || []).forEach(function (r) {
      out.push({
        id: r.id, date: r.date, heure: r.heure || '', duree: +r.duree || 60,
        titre: r.titre || 'Rendez-vous', type: r.type || 'rdv',
        who: EMAP[r.owner] || '', ent: r.ent || '', lieu: r.lieu || ''
      });
    });
    (db.audits || []).forEach(function (a) {
      // un audit a déjà un rdv associé (a.rdv) -> éviter le doublon
      if (a.rdv && (db.rdv || []).some(function (r) { return r.id === a.rdv; })) return;
      out.push({
        id: a.id, date: a.date, heure: a.heure || '10:00', duree: 60,
        titre: 'Audit ' + (a.type || '') + (a.ent ? ' · ' + a.ent : ''),
        type: 'audit', who: EMAP[a.owner] || '', ent: a.ent || ''
      });
    });
    return out.sort(function (x, y) { return String(x.date).localeCompare(String(y.date)); });
  }

  /* ---------- assemblage ---------- */
  function buildAdapter(db, meId) {
    db = db || {};
    var t = buildTeam(db.equipe);
    var roles = buildRoles(db.equipe, t.EMAP, t.TEAM, meId);
    var meMember = (db.equipe || []).filter(function (x) { return x.id === meId; })[0];
    var myRole = meMember ? roleKind(meMember) : 'direction';
    return {
      real: true,
      meId: meId || null,
      myRole: myRole,
      me: meMember ? { id: meMember.id, nom: shortName(meMember.nom), ini: initials(meMember.nom), role: myRole } : null,
      TEAM: t.TEAM,
      EMAP: t.EMAP,
      ROLES: roles,
      formateurs: (db.equipe || []).filter(function (e) { return /formateur/i.test(e.role || '') || roleKind(e) === 'formateur' || roleKind(e) === 'direction'; }).map(function (e) { return t.EMAP[e.id]; }),
      commerciaux: (db.equipe || []).filter(function (e) { return roleKind(e) === 'terrain' || roleKind(e) === 'phoneuse' || roleKind(e) === 'direction'; }).map(function (e) { return t.EMAP[e.id]; }),
      ENTS: buildEnts(db, t.EMAP),
      DEALS: buildDeals(db, t.EMAP),
      EVS: buildEvents(db, t.EMAP),
      // données financières brutes (pour Facturation / trésorerie)
      opcoInv: db.opcoInv || [],
      comVal: db.comVal || {},
      audits: db.audits || [],
      raw: db
    };
  }

  /* ---------- exposition navigateur ---------- */
  function wire() {
    var S = glob.PPA && glob.PPA.sync;
    if (!S || !S.db) return false; // pas de session -> mode démo
    var meId = null;
    try { meId = JSON.parse(localStorage.getItem('ppa-ui-who') || 'null'); } catch (e) {}
    var A = buildAdapter(S.db, meId);
    // persistance : un enregistrement de dossier par entreprise, via la synchro
    A.save = function () { try { S.save && S.save(); } catch (e) {} };
    function freshDossier() {
      return { mode: 'akto', has: {}, sal: [], ak: {}, dates: ['', ''], audit: '', valCom: false, ctrF: false, doc: {}, valForm: false, ctl: false, depot: false, accord: false, fact: 0, paye: false, rem: {} };
    }
    // ---- Pilotage : performance & trésorerie à partir des données réelles ----
    A.perf = function () {
      var inv = S.db.opcoInv || [], dos = S.db.opcoDos || {}, links = S.db.links || {}, clients = S.db.clients || [], rdv = S.db.rdv || [], deals = S.db.deals || [];
      var MNAMES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
      var now = new Date(); now.setHours(0, 0, 0, 0);
      var M = []; for (var i = 11; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth() - i, 1); M.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: MNAMES[d.getMonth()] }); }
      var mk = function (s) { s = String(s || ''); return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : ''; };
      var idx = function (k) { return M.map(function (m) { return m.k; }).indexOf(k); };
      var paid = function (o) { return /pay|régl|vire|sold/i.test(String(o.etat || '')) || !!o.paye; };
      var z = function () { return M.map(function () { return 0; }); };
      var SIG = z(), FAC = z(), ENC = z();
      // signé : dossiers AKTO par mois de début (montant demandé/engagé)
      Object.keys(dos).forEach(function (kk) { var x = dos[kk]; var j = idx(mk(x.debut)); if (j >= 0) SIG[j] += (+x.dem || +x.eng || 0); });
      // facturé : factures AKTO par date de réception/facture
      inv.forEach(function (o) { var j = idx(mk(o.recu || o.date)); if (j >= 0) FAC[j] += (+o.ht || 0); });
      // encaissé : factures payées par date de paiement
      inv.forEach(function (o) { if (paid(o)) { var j = idx(mk(o.paye)); if (j >= 0) ENC[j] += (+o.ht || 0); } });
      var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
      // reste à encaisser par financeur
      var reste = {}; inv.forEach(function (o) { if (!paid(o) && !/rejet|refus|annul/i.test(String(o.etat || ''))) { var k = o.opco || 'AKTO'; reste[k] = (reste[k] || 0) + (+o.ht || 0); } });
      var resteR = Object.keys(reste).map(function (k) { return [k, reste[k], '']; }).sort(function (a, b) { return b[1] - a[1]; });
      // délai moyen de paiement AKTO + par mois
      var pd = function (s) { var p = String(s).split('-'); return new Date(p[0], p[1] - 1, p[2]); };
      var dl = inv.filter(function (o) { return paid(o) && o.recu && o.paye; }).map(function (o) { return Math.max(0, Math.round((pd(o.paye) - pd(o.recu)) / 864e5)); });
      var delaiMoy = dl.length ? Math.round(sum(dl) / dl.length) : 0;
      var DELAI = M.map(function (m) { var a = inv.filter(function (o) { return paid(o) && mk(o.paye) === m.k && o.recu; }).map(function (o) { return Math.max(0, Math.round((pd(o.paye) - pd(o.recu)) / 864e5)); }); return a.length ? Math.round(sum(a) / a.length) : 0; });
      // trésorerie : encaissements OPCO attendus cumulés sur 13 semaines
      var med = dl.length ? dl.slice().sort(function (a, b) { return a - b; })[Math.floor(dl.length / 2)] : 45;
      var monday = new Date(now); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      var SEM = [], weeks = []; for (var w = 0; w < 13; w++) { var ws = new Date(monday); ws.setDate(ws.getDate() + w * 7); SEM.push(String(ws.getDate()).padStart(2, '0') + '/' + String(ws.getMonth() + 1).padStart(2, '0')); weeks.push(ws.getTime()); }
      var perWeek = weeks.map(function () { return 0; });
      inv.forEach(function (o) { if (paid(o) || /rejet|refus|annul/i.test(String(o.etat || ''))) return; var base = o.recu || o.date; if (!base) return; var exp = pd(base).getTime() + med * 864e5; var wi = 0; while (wi < 12 && exp >= weeks[wi + 1]) wi++; if (exp < weeks[0]) wi = 0; perWeek[wi] += (+o.ht || 0); });
      var TRESO = []; var acc = 0; perWeek.forEach(function (v) { acc += v; TRESO.push(acc); });
      // CA par formation (factures payées rattachées à un dossier)
      var caForm = {}; inv.forEach(function (o) { if (!paid(o)) return; var x = dos[o.dossier] || {}; var t = /etiq|trac/i.test(x.titre || '') ? 'Étiquetage' : /sanitaire|pms|hygi/i.test(x.titre || '') ? 'PMS / HACCP' : (x.titre ? x.titre.slice(0, 22) : 'Autre'); caForm[t] = (caForm[t] || 0) + (+o.ht || 0); });
      var caFormR = Object.keys(caForm).map(function (k) { return [k, caForm[k], '']; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
      // entonnoir : RDV pris -> signatures
      var nbRdv = rdv.length;
      var nbSign = clients.filter(function (c) { return c.signe || String(c.statut || '') === 'Soldé'; }).length + deals.filter(function (d) { return /gagn|sign/i.test(d.etape || ''); }).length;
      var retard = inv.filter(function (o) { return !paid(o) && o.recu && (now - pd(o.recu)) / 864e5 > 45; }).reduce(function (a, o) { return a + (+o.ht || 0); }, 0);
      return {
        M: M.map(function (m) { return m.l; }), SIG: SIG, FAC: FAC, ENC: ENC, SEM: SEM, TRESO: TRESO, DELAI: DELAI,
        resteFin: resteR, caForm: caFormR, delaiMoy: delaiMoy, totReste: sum(Object.keys(reste).map(function (k) { return reste[k]; })),
        retard: retard, nbRdv: nbRdv, nbSign: nbSign, encTotal: sum(ENC)
      };
    };

    // ---- pipeline facturation AKTO à partir des factures/dossiers réels ----
    A.fin = function () {
      var inv = S.db.opcoInv || [], links = S.db.links || {}, clients = S.db.clients || [];
      var cliName = function (dossier) { var id = links[dossier]; var c = clients.filter(function (x) { return x.id === id; })[0]; return c ? c.nom : null; };
      var paid = function (o) { return !!o.paye || /pay|régl|sold/i.test(String(o.etat || '')); };
      var sum = function (a) { return a.reduce(function (s, o) { return s + (+o.ht || 0); }, 0); };
      var enc = inv.filter(paid), rejete = inv.filter(function (o) { return /rejet|refus/i.test(o.etat) && !inv.some(function (q) { return q.dossier === o.dossier && paid(q); }); });
      var transmis = inv.filter(function (o) { return !paid(o) && /transmis|analyse/i.test(o.etat); });
      var pieces = inv.filter(function (o) { return /pièces|pieces/i.test(o.etat) && !paid(o); });
      var kpis = { encaisse: sum(enc), aEncaisser: sum(transmis), bloque: sum(pieces), rejete: sum(rejete), nbPaye: enc.length };
      // dossiers accordés sans facture émise -> à facturer
      var dos = S.db.opcoDos || {};
      var aFacturer = Object.keys(dos).map(function (k) { return dos[k]; }).filter(function (x) { return /accord/i.test(x.etat) && !inv.some(function (o) { return o.dossier === x.num; }); });
      kpis.aFacturer = aFacturer.reduce(function (s, x) { return s + (+x.fac || +x.eng || +x.dem || 0); }, 0);
      var invRow = function (o) { return [(cliName(o.dossier) || o.rs || '—') + ' · ' + (o.dossier || o.num), o.opco + (o.recu ? ' · reçue le ' + o.recu.split('-').reverse().join('/') : ''), Math.round(o.ht) + ' €', o]; };
      var groups = [
        { key: 'afac', label: 'À facturer à l’OPCO', color: '#56702A', rows: aFacturer.map(function (x) { return [(cliName(x.num) || x.rs || '—') + ' · ' + x.num, 'Dossier accordé · ' + (x.titre || 'formation'), Math.round(+x.fac || +x.eng || +x.dem || 0) + ' €', x]; }) },
        { key: 'att', label: 'À encaisser · transmis à l’OPCO', color: '#8C2F4B', rows: transmis.map(invRow) },
        { key: 'blo', label: 'Pièces réclamées par l’OPCO', color: '#B42828', rows: pieces.map(invRow) },
        { key: 'ref', label: 'Rejetés · à corriger', color: '#6B5B5B', rows: rejete.map(invRow) },
        { key: 'pay', label: 'Payés', color: '#2F6B3F', rows: enc.slice().sort(function (a, b) { return String(b.paye || '').localeCompare(String(a.paye || '')); }).slice(0, 40).map(invRow) }
      ].filter(function (g) { return g.rows.length; });
      return { kpis: kpis, groups: groups };
    };
    A.getDossier = function (id) {
      S.db.dossiers = S.db.dossiers || {};
      if (!S.db.dossiers[id]) S.db.dossiers[id] = freshDossier();
      return S.db.dossiers[id];
    };
    A.setDossier = function (id, obj) {
      S.db.dossiers = S.db.dossiers || {};
      S.db.dossiers[id] = obj; A.save();
    };
    glob.PPA_ADAPT = A;
    return true;
  }

  // export module (Node / test) + navigateur
  var api = { buildAdapter: buildAdapter, buildTeam: buildTeam, buildEnts: buildEnts, buildDeals: buildDeals, buildEvents: buildEvents, buildRoles: buildRoles, wire: wire };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  glob.PPA_DATA = api;
  // auto-branchement si on tourne dans l'app connectée
  try { if (glob.PPA && glob.PPA.sync && glob.PPA.sync.db) wire(); } catch (e) {}
})(typeof window !== 'undefined' ? window : globalThis);
