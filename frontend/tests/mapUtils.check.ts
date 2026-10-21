// Prueba del arco de ruta y del color por altitud: npm test
import assert from 'node:assert/strict';
import { ALT_BANDS, altColor, GROUND_COLOR } from '../src/utils/altitude.ts';
import { greatCircle } from '../src/utils/greatCircle.ts';

const jfk = { lat: 40.64, lng: -73.78 };
const lax = { lat: 33.94, lng: -118.41 };
const arc = greatCircle(jfk, lax);
assert.equal(arc.length, 65);
assert.deepEqual(arc[0]!.map((v) => +v.toFixed(6)), [jfk.lat, jfk.lng]);
assert.deepEqual(arc[64]!.map((v) => +v.toFixed(6)), [lax.lat, lax.lng]);
// El círculo máximo se curva hacia el norte respecto a la recta en el mapa
assert.ok(arc[32]![0] > (jfk.lat + lax.lat) / 2);

// Antimeridiano (Anchorage → Tokio): sin saltos de longitud de más de 180°
const cross = greatCircle({ lat: 61.17, lng: -149.99 }, { lat: 35.55, lng: 139.78 });
for (let i = 1; i < cross.length; i++) assert.ok(Math.abs(cross[i]![1] - cross[i - 1]![1]) < 180);

assert.equal(greatCircle(jfk, jfk).length, 2); // mismo punto: no divide por cero

assert.equal(altColor(null), null);
assert.equal(altColor(11000, true), GROUND_COLOR);
assert.equal(altColor(100), ALT_BANDS[0]!.color);
assert.equal(altColor(600), ALT_BANDS[1]!.color);
assert.equal(altColor(10668), ALT_BANDS[4]!.color);
assert.equal(altColor(13000), ALT_BANDS[5]!.color);

console.log('mapUtils: ok');
