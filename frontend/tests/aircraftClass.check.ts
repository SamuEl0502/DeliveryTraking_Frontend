// Prueba de la clase de avión: npm test
import assert from 'node:assert/strict';
import { classOf } from '../src/utils/aircraftClass.ts';

const cases: [string | null, ReturnType<typeof classOf>][] = [
  [null, null], ['C172', 'light'], ['C72R', 'light'], ['P28A', 'light'], ['SR20', 'light'], ['DA40', 'light'],
  ['PC12', 'light'], ['B350', 'light'], ['C208', 'light'], ['C152', 'light'],
  ['C560', 'business'], ['CL35', 'business'], ['GLF5', 'business'], ['E55P', 'business'], ['PC24', 'business'],
  ['CRJ9', 'regional'], ['E75L', 'regional'], ['E170', 'regional'], ['BCS3', 'regional'], ['DH8D', 'regional'],
  ['B738', 'narrow'], ['B38M', 'narrow'], ['B39M', 'narrow'], ['A321', 'narrow'], ['A319', 'narrow'],
  ['A20N', 'narrow'], ['B752', 'narrow'], ['MD88', 'narrow'], ['XXXX', 'narrow'],
  ['B763', 'wide'], ['B77W', 'wide'], ['A333', 'wide'], ['A310', 'wide'], ['MD11', 'wide'],
  ['B748', 'jumbo'], ['A388', 'jumbo'], ['A124', 'jumbo'],
  ['H60', 'heli'], ['EC35', 'heli'], ['AS50', 'heli'], ['R44', 'heli'], ['B407', 'heli'], ['A139', 'heli'],
];
for (const [type, expected] of cases) assert.equal(classOf(type), expected, String(type));

console.log('aircraftClass: ok');
