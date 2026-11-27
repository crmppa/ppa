"""Marchéo · génération des logos vectorisés (texte converti en tracés, aucune police requise).

Usage : python3 marcheo/marque/generer_logos.py <dossier_polices>
Polices attendues dans <dossier_polices> : CG-600.ttf (Cormorant Garamond SemiBold), Inter-600.ttf.
Sortie : marcheo/marque/logos/*.svg
"""
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, 'logos')

# Charte (identique à css/app.css)
VERT_NUIT = '#0e2a1d'   # fond de navigation, fond du monogramme
VERT = '#0f4a30'        # accent
IVOIRE = '#f6f0e2'
LAITON = '#c9ab74'
LAITON_FONCE = '#a8864f'
ENCRE = '#15211b'


def contours(font, ch, x0, base, taille):
    """Retourne la liste des contours (chemins SVG) d'un caractère, et son avance."""
    gs = font.getGlyphSet()
    nom = font.getBestCmap()[ord(ch)]
    upm = font['head'].unitsPerEm
    k = taille / upm
    rec = RecordingPen()
    gs[nom].draw(rec)
    morceaux, courant = [], []
    for op, args in rec.value:
        courant.append((op, args))
        if op in ('closePath', 'endPath'):
            morceaux.append(courant)
            courant = []
    res = []
    for m in morceaux:
        r = RecordingPen(); r.value = m
        bp = BoundsPen(gs); r.replay(bp)
        sp = SVGPathPen(gs)
        r.replay(TransformPen(sp, (k, 0, 0, -k, x0, base)))
        res.append((sp.getCommands(), bp.bounds))
    return res, gs[nom].width * k


def texte(font, s, x, base, taille, espacement=0.0, accent_separe=False):
    """Chemins SVG du texte. Si accent_separe : renvoie (corps, accents) ; les accents sont les contours au-dessus de la hauteur d'x."""
    xh = font['OS/2'].sxHeight
    corps, accents = [], []
    for ch in s:
        cs, av = contours(font, ch, x, base, taille)
        for d, b in cs:
            if accent_separe and b and ch in 'éèêà' and b[1] > xh * 0.98:
                accents.append(d)
            else:
                corps.append(d)
        x += av + espacement * taille
    largeur = x - espacement * taille
    return ' '.join(corps), ' '.join(accents), largeur


def monogramme(cx, cy, r, fond, filet, trait):
    k = r / 32
    t = lambda x, y: f'{cx + (x - 32) * k:.2f} {cy + (y - 32) * k:.2f}'
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fond}"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{28.5 * k:.2f}" fill="none" stroke="{filet}" stroke-width="{1.5 * k:.2f}"/>'
            f'<path d="M{t(18, 44)} L{t(18, 21)} L{t(32, 34)} L{t(46, 21)} L{t(46, 44)}" fill="none" stroke="{trait}" '
            f'stroke-width="{4 * k:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')


def svg(w, h, corps, fond=None):
    f = f'<rect width="{w:.0f}" height="{h:.0f}" fill="{fond}"/>' if fond else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">{f}{corps}</svg>\n'


def main(dossier):
    cg = TTFont(os.path.join(dossier, 'CG-600.ttf'))
    inter = TTFont(os.path.join(dossier, 'Inter-600.ttf'))
    os.makedirs(SORTIE, exist_ok=True)

    # Déclinaisons : (nom, fond, couleur du mot, couleur de l'accent et de la signature, monogramme fond/filet/trait)
    versions = {
        'clair':  (IVOIRE, VERT_NUIT, LAITON_FONCE, (VERT_NUIT, LAITON, LAITON)),
        'sombre': (VERT_NUIT, IVOIRE, LAITON, (VERT_NUIT, LAITON, LAITON)),
        'transparent': (None, IVOIRE, LAITON, ('none', LAITON, LAITON)),  # sur fond vert métallisé
        'noir':   (None, '#000000', '#000000', ('#000000', '#ffffff', '#ffffff')),
        'blanc':  (None, '#ffffff', '#ffffff', ('none', '#ffffff', '#ffffff')),
    }

    for nom, (fond, mot, acc, (mf, mfi, mt)) in versions.items():
        # 1. Mot seul
        taille = 120
        corps, accents, larg = texte(cg, 'Marchéo', 0, 0, taille, accent_separe=True)
        pad = 24
        base = pad + taille * 0.86  # hauteur de l'accent au-dessus de la ligne de base
        h = base + pad
        corps, accents, larg = texte(cg, 'Marchéo', pad, base, taille, accent_separe=True)
        W = larg + 2 * pad
        g = f'<path d="{corps}" fill="{mot}"/><path d="{accents}" fill="{acc}"/>'
        open(os.path.join(SORTIE, f'marcheo-mot-{nom}.svg'), 'w').write(svg(W, h, g, fond))

        # 2. Signature horizontale : monogramme + mot + « MARCHAND DE BIENS »
        R = 64
        pad = 32
        cx, cy = pad + R, pad + R
        x0 = cx + R + 30
        taille = 104
        base_mot = cy + 14
        corps, accents, larg = texte(cg, 'Marchéo', x0, base_mot, taille, accent_separe=True)
        sig, _, larg_sig = texte(inter, 'MARCHAND DE BIENS', x0 + 4, cy + 50, 17, espacement=0.24)
        W = x0 + max(larg - x0, larg_sig - x0) + pad
        H = 2 * R + 2 * pad
        g = (monogramme(cx, cy, R, mf, mfi, mt) + f'<path d="{corps}" fill="{mot}"/><path d="{accents}" fill="{acc}"/>'
             f'<path d="{sig}" fill="{acc}"/>')
        open(os.path.join(SORTIE, f'marcheo-signature-{nom}.svg'), 'w').write(svg(W, H, g, fond))

        # 3. Signature verticale (carte, avatar, couverture)
        taille = 96
        corps, accents, larg = texte(cg, 'Marchéo', 0, 0, taille, accent_separe=True)
        sig, _, larg_sig = texte(inter, 'MARCHAND DE BIENS', 0, 0, 15, espacement=0.26)
        W = max(larg, larg_sig) + 2 * pad
        R = 58
        cx = W / 2
        cy = pad + R
        base_mot = cy + R + 26 + taille * 0.625 + 6
        corps, accents, _ = texte(cg, 'Marchéo', (W - larg) / 2, base_mot, taille, accent_separe=True)
        sig, _, _ = texte(inter, 'MARCHAND DE BIENS', (W - larg_sig) / 2, base_mot + 42, 15, espacement=0.26)
        H = base_mot + 42 + pad
        g = (monogramme(cx, cy, R, mf, mfi, mt) + f'<path d="{corps}" fill="{mot}"/><path d="{accents}" fill="{acc}"/>'
             f'<path d="{sig}" fill="{acc}"/>')
        open(os.path.join(SORTIE, f'marcheo-vertical-{nom}.svg'), 'w').write(svg(W, H, g, fond))

        # 4. Monogramme seul
        open(os.path.join(SORTIE, f'marcheo-monogramme-{nom}.svg'), 'w').write(svg(128, 128, monogramme(64, 64, 64, mf, mfi, mt)))

    print('Logos écrits dans', SORTIE)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
