# Démarrer un nouveau CRM sur le socle PPA Pilot

> **Comment utiliser ce document :** crée le nouveau repo GitHub, connecte Claude dessus,
> puis ouvre une **nouvelle conversation Claude Code sur ce repo** et colle ce fichier en
> entier comme premier message. Il contient tout le contexte technique nécessaire : la
> nouvelle session n'a pas accès à cette conversation-ci.
>
> Le code de référence est dans le repo **`crmppa/ppa`** (branche `main` pour le déployé,
> `claude/adoring-noether-t9dws9` pour les sources). La nouvelle session doit l'ajouter en
> lecture (outil `add_repo` → `crmppa/ppa`) pour copier les fichiers du socle.

---

## 1. Ce qu'est le socle (et ce qu'il vaut)

PPA Pilot est un **CRM mono-fichier** (une seule page HTML qui contient toute l'UI + la
logique), branché sur **Supabase** (auth, base de données, stockage du code), déployé en
**gratuit** sur GitHub Pages + stockage Supabase. Pas de framework, pas de serveur à
maintenir, pas d'abonnement. C'est le point fort à réutiliser tel quel.

Le socle fournit, **indépendamment du métier** :
- authentification par compte (Supabase Auth) avec rôles et droits par rôle ;
- une app chargée **après connexion** depuis un bucket privé (le code n'est pas public) ;
- une **couche d'adaptation données** : la maquette tourne avec des données de démo, et
  bascule sur les vraies données Supabase quand elles sont présentes (même code, deux modes) ;
- une **synchro ligne par ligne** (n'échange que ce qui change) ;
- un **build + obfuscation** reproductible ;
- un générateur de **démo publique** (code d'accès + filigrane + noindex) pour prospects ;
- **émargement / signature mobile par QR code** (sans compte pour le signataire) ;
- génération de **documents Word** et de **rapports PDF** côté navigateur ;
- un design **responsive sans concession** (identique PC / iPhone), déjà débuggé.

Ce qui est **spécifique PPA** (à remplacer par le métier du nouveau CRM) : formation
hygiène/HACCP, financements AKTO/OPCO, Qualiopi, commissions, les 9 documents Word, l'outil
d'audit 71 points. Tout le reste est générique.

---

## 2. Stack & arborescence

**Stack :** HTML/CSS/JS natif (aucun framework) · Supabase (Postgres + Auth + Storage) ·
bibliothèques auto-hébergées dans `/lib` (jamais de CDN en prod) · build Python + Node
(`javascript-obfuscator`) · hébergement GitHub Pages (pages publiques) + Supabase Storage
(code privé de l'app).

Fichiers de `crmppa/ppa` (⭐ = à copier quasi tel quel, 🔧 = à adapter au métier, 🗑 = PPA-spécifique) :

```
app/
  ppa-pilot.html     🔧  LA maquette : toute l'UI + logique du CRM (169 Ko). Point de départ à refondre par écran.
  ppa-data.js        🔧  Adaptateur window.PPA_ADAPT : dérive les shapes de la maquette depuis la vraie DB. Squelette réutilisable, mapping métier à refaire.
  ppa-sync.js        ⭐  Synchro ligne par ligne (PpaSync). Générique.
  ppa-docs.js        🗑  Génération Word (dépend des gabarits PPA).
  ppa-tpl.js         🗑  Gabarits Word PPA en base64 (1,2 Mo).
  ppa-import.js      🗑  Imports Excel/PDF AKTO + phoning.
  ppa-audit*.{html,js} 🗑 Outil d'audit hygiène (réutilisable seulement si besoin de checklists).
beta/
  index.html         ⭐  Page de connexion : login Supabase, télécharge app.html du bucket, cache par version. ~Générique (changer URL projet + nom).
  emargement.html    ⭐  Signature mobile par QR (si besoin de recueil de signatures).
  test.html          ⭐  Même chose que index.html mais charge la build de test (app-test.html).
build/
  maquette_build.py  ⭐  Inline les adaptateurs dans la maquette + bascule données réelles + garde des rôles → app.html.
  obfuscate.js       ⭐  Obfuscation. ATTENTION : niveau "base" uniquement (voir §4).
  make_demo.py       ⭐  Génère la démo publique (gate + filigrane + noindex + fenêtres d'explication).
  make_audit.js      ⭐  Modèle de build d'une page autonome (données base64 + obfuscation + lazy lib).
  *.js/*.py autres   🗑  Écrans/correctifs spécifiques PPA.
supabase/migrations/
  001_base.sql       🔧  Schéma : members (compte↔personne), droits par rôle, tables métier. Garder members + le pattern RLS, refaire les tables métier.
  002/003_app_*.sql  ⭐  Stockage privé du code de l'app (bucket + policies « membre actif »).
  004_emargement.sql ⭐  Émargement (si besoin).
lib/                 ⭐  Toutes les libs auto-hébergées (supabase-js, pdf-lib, jszip, xlsx, qrcode, pdfjs). Copier tel quel.
index.html / robots.txt / .nojekyll / manifest.json ⭐ Racine GitHub Pages.
```

---

## 3. Architecture : comment ça marche

**Deux modes, un seul code.** `app/ppa-pilot.html` définit des variables globales
(`TEAM`, `ENTS`, `DEALS`, `EVS`, `ROLES`, `role`…) avec des **données de démo** en dur.
Le build (`maquette_build.py`) injecte, juste avant le script principal :

```js
if(window.PPA_ADAPT && PPA_ADAPT.real){ const A=PPA_ADAPT;
  TEAM=A.TEAM; ROLES=A.ROLES; ENTS=A.ENTS; DEALS=A.DEALS; EVS=A.EVS; role=A.myRole; … }
```

- `app/ppa-data.js` construit `window.PPA_ADAPT` à partir de la vraie base Supabase et
  **traduit** la base réelle vers les shapes qu'attend la maquette. C'est le **seul endroit**
  qui connaît à la fois la DB et l'UI. Si `PPA_ADAPT` est absent → la maquette reste en démo.
- Avantage : on dessine/valide l'UI en démo (déployable comme présentation commerciale), et
  on branche le réel sans retoucher l'UI.

**Chargement de l'app réelle :** `beta/index.html` connecte l'utilisateur (Supabase Auth),
lit `app_meta.app_version`, puis **télécharge `app.html` depuis le bucket privé `app`**
(accessible seulement aux membres actifs) et l'injecte. Le code n'est donc jamais servi en
clair publiquement. Le cache navigateur est clé-é par version → bumper `app_version` force
le rechargement.

**Déploiement (deux cibles) :**
1. **Pages publiques** (login, émargement, démo) → branche `main`, servies par GitHub Pages
   sur `https://<user>.github.io/<repo>/`. Déployées via worktree (`git push origin <tmp>:main`).
2. **Code privé de l'app** → build obfusquée téléversée dans **Supabase Storage** bucket
   `app` objet `app.html` (+ `app-test.html` pour la préprod), puis `app_meta.app_version`
   bumpé. Upload par **clé service_role** (jamais exposée au navigateur).

**Rôles & droits.** `ROLES = { direction:{…,v:[routes visibles]}, admin:{…}, … }`. La nav est
filtrée par `v`. En réel, `role = A.myRole` (dérivé du compte connecté) ; en démo, un sélecteur
de rôle. Règle posée récemment : l'onglet **Paramètres est réservé à `direction`** (bouton
masqué + garde dans `render()` qui redirige + redirection au changement de rôle).

---

## 4. Décisions & pièges à NE PAS refaire (durement appris)

1. **Obfuscation : niveau `base` uniquement.** Le niveau `strong` (stringArray + rc4)
   **corrompt aléatoirement le texte français** (« Cannot read … charAt ») de façon non
   déterministe. `obfuscate.js` utilise `base` (compact + identifiants manglés, **sans**
   stringArray). Ne jamais passer à `strong`.
2. **`<meta viewport>` obligatoire** (`width=device-width,initial-scale=1`). Sans lui, iOS
   Safari rend la page à 980 px → menu latéral cassé, taps à côté.
3. **Pas de `backdrop-filter: blur()` sur un élément `position:sticky`/`fixed`.** Safari iOS
   recalcule le flou à chaque frame de scroll → interface « lourde »/saccadée. Utiliser un
   fond opaque.
4. **Libs en local (`/lib`), pas de CDN en prod.** Et pour une page lourde (ex. pdf-lib
   525 Ko), charger la lib **à la demande** (lazy, au clic), pas en inline, sinon l'écran de
   connexion rame avant d'être interactif.
5. **Tables → cartes sur mobile.** Les tableaux passent en cartes (`data-label`) sous 560 px ;
   `display:contents` sert à aligner les groupes de nav. Patterns déjà dans `ppa-pilot.html`.
6. **Sécurité des clés.** La clé **anon** Supabase est publique (safe, RLS protège). La clé
   **service_role** ne sort jamais du serveur/build (upload du code, admin). Jamais dans la page.
7. **PDF (pdf-lib) : police Helvetica = WinAnsi.** Elle **n'encode pas** l'apostrophe typographique
   `'` ni `…`, `œ`, tirets longs. Passer tout texte dynamique par une fonction `san()` qui les
   remplace, sinon la génération PDF jette une exception.
8. **Démo publique = non récupérable.** Pattern `make_demo.py` : code d'accès (hash djb2),
   filigrane « DÉMONSTRATION », `noindex`, données encodées base64, obfuscation base, aucun
   secret/gabarit/vraie donnée embarqués.
9. **Push git :** toujours sur la branche de dev dédiée ; déploiement `main` via worktree
   (`git worktree add … origin/main` → copier le fichier → commit → `git push origin <tmp>:main`).
   Ne jamais committer de fichier buildé sur la branche de dev (ils sont dans `.gitignore`).

---

## 5. Plan de démarrage du nouveau CRM

**A. Bootstrap du repo (toi, une fois) :**
1. Créer le repo GitHub dédié (ex. `crmppa/<nouveau>`), privé.
2. Connecter Claude au repo (Settings GitHub App) et l'autoriser dans l'org.
3. Activer **GitHub Pages** sur la branche `main`.
4. Décider la base Supabase : **nouveau projet Supabase** (recommandé, données cloisonnées)
   ou réutiliser l'existant avec un schéma séparé.

**B. Dans la nouvelle conversation Claude Code (sur le nouveau repo) :**
1. `add_repo crmppa/ppa` en lecture pour disposer du socle de référence.
2. Copier le socle générique (⭐ du §2) : `lib/`, `build/obfuscate.js`,
   `build/maquette_build.py`, `build/make_demo.py`, `beta/index.html` (+ `test.html`,
   `emargement.html` si utiles), `supabase/migrations/002/003/004`, fichiers racine Pages.
   Changer l'URL projet Supabase + les noms (« PPA Pilot » → nom du nouveau CRM).
3. **Définir le métier** (voir §6) : entités, écrans, rôles, sources de données.
4. Écrire le schéma SQL métier (repartir de `001_base.sql` : garder `members` + RLS, refaire
   les tables).
5. Construire la **maquette** (`<nouveau>-pilot.html`) écran par écran avec données de démo —
   déployable immédiatement comme présentation commerciale.
6. Écrire l'**adaptateur** (`<nouveau>-data.js`) qui mappe la vraie base vers les shapes de la
   maquette.
7. `maquette_build.py` → `obfuscate.js base` → upload Supabase Storage + bump version.
8. Déployer login + démo sur Pages.

**C. Garde-fous :** reprendre tels quels les points du §4. C'est ce qui a coûté le plus de
temps sur PPA ; ne pas les redécouvrir.

---

## 6. À préciser au tout début de la nouvelle conversation

Le CRM est « pour une autre activité » — la nouvelle session doit cadrer, avant d'écrire du code :

- **Activité exacte** et nom du produit.
- **Entités métier** = l'équivalent des `ENTS` (clients/contacts), `DEALS` (affaires/pipeline),
  `EVS` (agenda/événements), plus les objets propres au métier. Lister les écrans.
- **Rôles** et qui voit quoi (direction / admin / commercial / terrain…).
- **Sources de données** : saisie manuelle ? imports (quels fichiers) ? API externe ?
- **Sorties** : documents à générer (devis, contrats, PDF…), signatures/émargement utiles ou non.
- **Workflow / cycle de vie** d'une affaire (les étapes du pipeline).

> Rappel de style de travail : solutions **gratuites d'abord**, exécution directe, pas de
> sur-ingénierie. Poser une position claire plutôt que dérouler des options.

---

*Généré depuis la session PPA (socle CRM + outil d'audit). Repo de référence : `crmppa/ppa`.*
