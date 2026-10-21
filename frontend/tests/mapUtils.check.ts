// Prueba del color por altitud de la estela: npm test
import assert from 'node:assert/strict';
import { ALT_BANDS, altColor, GROUND_COLOR } from '../src/utils/altitude.ts';

assert.equal(altColor(null), null);
assert.equal(altColor(11000, true), GROUND_COLOR);
assert.equal(altColor(100), ALT_BANDS[0]!.color);
assert.equal(altColor(600), ALT_BANDS[1]!.color);
assert.equal(altColor(10668), ALT_BANDS[4]!.color);
assert.equal(altColor(13000), ALT_BANDS[5]!.color);

console.log('mapUtils: ok');
