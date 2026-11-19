# Construction de la nouvelle version

1. `python3 -I build_app.py <v112.html> <patch_v113.py> app.html`
   Reprend le moteur v112 + correctifs v113, retire la carte 3D, pointe vers les bibliothèques hébergées (`/lib`), branche Supabase.
2. `node obfuscate.js app.html app.obf.html base`
   Minifie et brouille les noms internes (chaînes conservées : le brouillage de chaînes casse ce code ancien, cf. essais).
3. Déposer `app.obf.html` dans le stockage Supabase (bucket privé `app`, objet `app.html`) et mettre à jour `app_meta.app_version`.
   Le code n'est téléchargeable qu'après connexion d'un membre actif.
