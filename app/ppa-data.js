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
