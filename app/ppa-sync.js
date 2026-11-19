/* PPA Pilot · synchronisation Supabase, fiche par fiche
   - charge uniquement les fiches que la personne connectée a le droit de voir (droits vérifiés par le serveur) ;
   - reconstruit l'objet `db` au format de la v112, pour réutiliser son moteur tel quel ;
   - n'envoie que les fiches modifiées ;
   - reçoit en direct les modifications des autres et les applique dans l'objet existant (les fenêtres ouvertes restent valides) ;
   - hors connexion : les modifications attendent et partent au retour du réseau. */
(function (global) {
  'use strict';

  // Collections dont les éléments sont des listes d'objets (une ligne par élément).
  const LISTS = ['equipe','clients','sessions','deals','rdv','opcoInv','comInv','factures','conf','audits','aktoFac',
    'financements','prep','imports','comLog','aud','reclam','log','suiviItems'];
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  const J = x => JSON.stringify(x);

  function itemId(coll, it, i) {
    if (it && it.id != null) return String(it.id);
    if (it && it.k != null) return String(it.k);
    if (coll === 'log' || coll === 'comLog') return 'h' + hash(J(it));
    return 'i' + i;
  }
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  /* ---------- Qui peut voir quoi (en plus de la direction et de l'administration) ---------- */
  function clientOwners(db, cid) {
    const c = (db.clients || []).find(x => x.id === cid) || (db.deals || []).find(x => x.id === cid);
    return c ? [c.phoneuse, c.commercial, c.formateur].filter(Boolean) : [];
  }
  function sessionClient(db, sid) { const s = (db.sessions || []).find(x => x.id === sid); return s && s.client; }
  function ownersFor(db, coll, id, v) {
    const uniq = a => [...new Set(a.filter(Boolean).map(String))];
    switch (coll) {
      case 'clients': return uniq([v.phoneuse, v.commercial, v.formateur]);
      case 'deals': return uniq([v.phoneuse, v.envoye ? v.commercial : null, v.conv ? v.commercial : null]);
      case 'dos': case 'stAt': return uniq(clientOwners(db, id));
      case 'factures': case 'financements': return uniq(clientOwners(db, sessionClient(db, v.session)));
      case 'aktoFac': return uniq(clientOwners(db, v.cid));
      case 'opcoInv': return uniq(clientOwners(db, (db.links || {})[v.dossier]));
      case 'opcoDos': return uniq(clientOwners(db, (db.links || {})[id]));
      case 'links': return uniq(clientOwners(db, v));
      case 'comInv': return uniq([v.who]);
      case 'comVal': case 'comPaid': {               // clé = dossier|num|tel ou dossier|num|com
        const [dossier, , role] = String(id).split('|');
        const c = (db.clients || []).find(x => x.id === (db.links || {})[dossier]);
        return c ? uniq([role === 'tel' ? c.phoneuse : c.commercial]) : [];
      }
      case 'audits': case 'aud': return uniq([v.auditeur, v.owner, ...clientOwners(db, v.cid || v.client)]);
      default: return [];
    }
  }
  function clientIdFor(coll, id, v) {
    if (coll === 'clients' || coll === 'dos' || coll === 'stAt') return id;
    return (v && (v.client || v.cid || v.ent)) || null;
  }

  /* ---------- db ⇄ lignes ---------- */
  function toRows(db) {
    const rows = new Map();
    Object.keys(db).forEach(coll => {
      const val = db[coll];
      if (coll === 'pins' || coll === 'pinsH') return;                 // les codes PIN disparaissent : connexion par compte
      if (Array.isArray(val) || LISTS.includes(coll)) {
        (val || []).forEach((it, i) => { const id = itemId(coll, it, i); rows.set(coll + '\u0001' + id, { coll, id, data: it }); });
      } else if (isObj(val)) {
        Object.keys(val).forEach(k => rows.set(coll + '\u0001' + k, { coll, id: k, data: { v: val[k] } }));
      } else {
        rows.set('meta\u0001' + coll, { coll: 'meta', id: coll, data: { v: val } });
      }
    });
    return rows;
  }
  function fromRows(rows) {
    const db = {};
    rows.forEach(r => {
      if (r.deleted) return;
      if (r.coll === 'meta') { db[r.id] = r.data.v; return; }
      if (LISTS.includes(r.coll) || (r.data && !('v' in r.data && Object.keys(r.data).length === 1))) {
        (db[r.coll] = db[r.coll] || []).push(r.data);
      } else {
        (db[r.coll] = db[r.coll] || {})[r.id] = r.data.v;
      }
    });
    LISTS.forEach(c => { if (!db[c]) db[c] = []; });
    return db;
  }

  /* ---------- application en place (les objets déjà ouverts restent les mêmes) ---------- */
  function patchObj(t, s) { Object.keys(t).forEach(k => { if (!(k in s)) delete t[k]; }); Object.assign(t, s); return t; }
  function applyRow(db, r) {
    if (r.coll === 'meta') { if (r.deleted) delete db[r.id]; else db[r.id] = r.data.v; return; }
    const isList = LISTS.includes(r.coll) || Array.isArray(db[r.coll]) || (r.data && !('v' in r.data && Object.keys(r.data).length === 1));
    if (isList) {
      const L = db[r.coll] = db[r.coll] || [];
      const i = L.findIndex((x, n) => itemId(r.coll, x, n) === r.id);
      if (r.deleted) { if (i >= 0) L.splice(i, 1); }
      else if (i >= 0) patchObj(L[i], r.data); else L.push(r.data);
    } else {
      const M = db[r.coll] = db[r.coll] || {};
      if (r.deleted) delete M[r.id]; else M[r.id] = r.data.v;
    }
  }

  /* ---------- moteur de synchro ---------- */
  function PpaSync(opts) {
    const sb = global.supabase.createClient(opts.url, opts.key, { auth: { persistSession: true, autoRefreshToken: true } });
    const S = { sb, db: null, snap: new Map(), queue: [], busy: false, online: navigator.onLine, me: null, onChange: opts.onChange || (() => {}), onState: opts.onState || (() => {}) };
    const QKEY = 'ppa-sync-queue';
    try { S.queue = JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { S.queue = []; }
    const saveQueue = () => { try { localStorage.setItem(QKEY, J(S.queue)); } catch (e) {} };
    const state = (st, msg) => S.onState(st, msg || '');

    S.signIn = (email, password) => sb.auth.signInWithPassword({ email, password });
    S.signOut = () => sb.auth.signOut();
    S.resetPassword = email => sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });

    S.whoAmI = async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u || !u.user) return null;
      const { data, error } = await sb.from('members').select('id,role,email,active').eq('user_id', u.user.id).maybeSingle();
      if (error) throw error;
      S.me = data; return data;
    };

    S.load = async () => {
      state('sync', 'Chargement…');
      const all = []; let from = 0; const step = 1000;
      for (;;) {
        const { data, error } = await sb.from('records').select('coll,id,data,deleted').eq('deleted', false).range(from, from + step - 1);
        if (error) throw error;
        all.push(...data); if (data.length < step) break; from += step;
      }
      S.db = fromRows(all);
      S.snap = new Map(); toRows(S.db).forEach((r, k) => S.snap.set(k, J(r.data)));
      await S.flush();
      state('ok', 'Synchronisé');
      return S.db;
    };

    // Compare db à la dernière version connue et met en file les seules fiches modifiées
    S.save = () => {
      if (!S.db) return 0;
      const now = toRows(S.db); let n = 0;
      now.forEach((r, k) => {
        const j = J(r.data);
        if (S.snap.get(k) !== j) {
          S.queue.push({ coll: r.coll, id: r.id, data: r.data, owners: ownersFor(S.db, r.coll, r.id, r.coll === 'meta' ? {} : (r.data && 'v' in r.data && Object.keys(r.data).length === 1 ? r.data.v : r.data)), client_id: clientIdFor(r.coll, r.id, r.data), deleted: false });
          S.snap.set(k, j); n++;
        }
      });
      S.snap.forEach((_, k) => {
        if (!now.has(k)) { const [coll, id] = k.split('\u0001'); S.queue.push({ coll, id, data: {}, owners: [], deleted: true, del: 1 }); S.snap.delete(k); n++; }
      });
      if (n) { saveQueue(); S.flush(); }
      return n;
    };

    S.flush = async () => {
      if (S.busy || !S.queue.length || !navigator.onLine) { if (!navigator.onLine && S.queue.length) state('err', S.queue.length + ' modification(s) en attente de réseau'); return; }
      S.busy = true; state('sync', 'Enregistrement…');
      try {
        while (S.queue.length) {
          const batch = S.queue.slice(0, 200);
          // dernière version de chaque fiche seulement
          const last = new Map(); batch.forEach(r => last.set(r.coll + '\u0001' + r.id, r));
          const ups = [...last.values()].filter(r => !r.del).map(({ coll, id, data, owners, client_id }) => ({ coll, id, data, owners, client_id, deleted: false }));
          const dels = [...last.values()].filter(r => r.del);
          if (ups.length) { const { error } = await sb.from('records').upsert(ups, { onConflict: 'coll,id' }); if (error) throw error; }
          for (const d of dels) { const { error } = await sb.from('records').update({ deleted: true }).eq('coll', d.coll).eq('id', d.id); if (error) throw error; }
          S.queue.splice(0, batch.length); saveQueue();
        }
        state('ok', 'Synchronisé');
      } catch (e) {
        const denied = /row-level security|permission/i.test(String(e.message || e));
        if (denied) { S.queue = []; saveQueue(); state('err', 'Modification refusée : vous n’avez pas les droits sur cette fiche'); await S.load(); S.onChange('reload'); }
        else state('err', 'Hors ligne · ' + S.queue.length + ' modification(s) en attente');
      }
      S.busy = false;
    };

    // Modifications des autres, en direct
    S.live = () => sb.channel('records').on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, p => {
      const r = p.new && p.new.coll ? p.new : p.old; if (!r || !S.db) return;
      const k = r.coll + '\u0001' + r.id;
      if (!r.deleted && S.snap.get(k) === J(r.data)) return;                 // c'est notre propre modification
      applyRow(S.db, r);
      if (r.deleted) S.snap.delete(k); else S.snap.set(k, J(r.data));
      S.onChange(r);
    }).subscribe();

    global.addEventListener('online', () => S.flush());
    return S;
  }

  global.PpaSync = PpaSync;
  global.PpaSyncInternals = { toRows, fromRows, applyRow, ownersFor, itemId };
})(window);
