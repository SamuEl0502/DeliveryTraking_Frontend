// Prueba de la familia y el tamaño del icono: npm test
import assert from 'node:assert/strict';
import { type AircraftFamily, familyOf, sizePx } from '../src/utils/aircraftFamily.ts';

const cases: [string | null, AircraftFamily][] = [
  [null, 'generic'], ['XXXX', 'generic'],
  ['C172', 'cessna-high'], ['C72R', 'cessna-high'], ['C152', 'cessna-high'], ['C182', 'cessna-high'],
  ['P28A', 'piston-low'], ['SR22', 'piston-low'], ['S22T', 'piston-low'], ['DA40', 'piston-low'], ['M20P', 'piston-low'],
  ['PA44', 'piston-twin'], ['BE58', 'piston-twin'], ['DA42', 'piston-twin'], ['C310', 'piston-twin'],
  ['PC12', 'turboprop-single'], ['C208', 'turboprop-single'], ['TBM9', 'turboprop-single'],
  ['BE20', 'kingair'], ['B350', 'kingair'], ['BE9L', 'kingair'],
  ['C25B', 'bizjet-light'], ['E55P', 'bizjet-light'], ['C56X', 'bizjet-light'], ['C68A', 'bizjet-light'], ['LJ45', 'bizjet-light'],
  ['CL35', 'bizjet-large'], ['CL60', 'bizjet-large'], ['GLF5', 'bizjet-large'], ['GL7T', 'bizjet-large'], ['C750', 'bizjet-large'],
  ['CRJ9', 'regional-rear'], ['CRJ7', 'regional-rear'], ['E145', 'regional-rear'],
  ['E75L', 'ejet'], ['E170', 'ejet'], ['E190', 'ejet'],
  ['BCS3', 'a220'],
  ['A321', 'a320'], ['A320', 'a320'], ['A318', 'a320'], ['A319', 'a320'], ['A21N', 'a320'], ['A20N', 'a320'],
  ['B738', 'b737'], ['B38M', 'b737'], ['B39M', 'b737'],
  ['B752', 'b757-767'], ['B763', 'b757-767'],
  ['B77W', 'b777-787'], ['B789', 'b777-787'],
  ['A333', 'a330-a350'], ['A359', 'a330-a350'], ['A310', 'a330-a350'],
  ['B748', 'jumbo'], ['A388', 'jumbo'],
  ['AT76', 'turboprop-regional'], ['DH8D', 'turboprop-regional'], ['SF34', 'turboprop-regional'],
  ['H60', 'heli'], ['R44', 'heli'], ['EC35', 'heli'], ['AS50', 'heli'], ['B407', 'heli'],
  ['TEX2', 'military-trainer'], ['T38', 'military-trainer'],
];
for (const [type, expected] of cases) assert.equal(familyOf(type), expected, String(type));

assert.equal(sizePx('C172'), 14); // tope inferior
assert.equal(sizePx('A320'), 23);
assert.equal(sizePx('B77W'), 36);
assert.equal(sizePx('A388'), 36); // tope superior
assert.ok(sizePx('B763') > sizePx('B752')); // misma silueta, el tamaño los distingue
assert.equal(sizePx(null), 22); // genérico: el tamaño de antes

console.log('aircraftFamily: ok');
