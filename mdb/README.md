# Moteur de calcul · marchand de biens

- `calc.js` : module de calcul pur (navigateur et Node), extrait du simulateur d'origine.
- `reference/simulateur-marchand-de-biens.html` : simulateur d'origine, conservé comme référence des règles de calcul.
- `test/calc.test.js` : valeurs de contrôle du brief et équivalence avec le moteur d'origine sur 3 000 états tirés au hasard.

```
node --test mdb/test/calc.test.js
```
