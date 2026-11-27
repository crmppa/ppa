# Marchéo · marque

Charte graphique : `charte.html`. Couleurs du CRM : `../css/app.css` (bloc « Finition vert anglais métallisé »).

| Dossier | Contenu |
|---|---|
| `logos/` | SVG vectorisés (texte en tracés) : signature, verticale, mot, monogramme × clair, sombre, transparent, noir, blanc |
| `supports/` | Carte de visite (PDF imprimeur 91 × 61 mm), papier à en-tête A4, avatar, bannière, visuel CRM, logos PNG |
| `captures/` | Écrans du CRM en mode démonstration |
| `coordonnees.json` | Nom, téléphone, e-mail, zone, accroche, mention EI (SIREN à compléter localement) |

## Régénérer

Polices (Google Fonts, OFL) dans un dossier : `CG-600.ttf`, `CG-500i.ttf` (Cormorant Garamond), `Inter-400.ttf`, `Inter-600.ttf`.

```
pip install fonttools
python3 marcheo/marque/generer_logos.py <dossier_polices>
node marcheo/marque/generer_supports.js <dossier_polices>
```

Impression de la carte : recto vert en dégradé ; pour un vrai effet métal, vernis sélectif sur le reflet ou dorure à chaud laiton sur le logo.
