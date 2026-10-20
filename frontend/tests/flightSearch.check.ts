// Prueba del buscador: npm test (Node quita los tipos, no hace falta framework)
import assert from 'node:assert/strict';
import { airlineName, callsignPrefixes, searchFlights } from '../src/utils/flightSearch.ts';

assert.deepEqual(callsignPrefixes(' wn 590 '), ['WN590', 'SWA590']);
assert.deepEqual(callsignPrefixes('B6123'), ['B6123', 'JBU123']);
assert.deepEqual(callsignPrefixes('UAL1855'), ['UAL1855']); // ICAO funciona directo
assert.deepEqual(callsignPrefixes('AA'), ['AA']); // sin número no se traduce
assert.deepEqual(callsignPrefixes('ZZ12'), ['ZZ12']); // aerolínea desconocida
assert.deepEqual(callsignPrefixes('  '), []);
assert.equal(airlineName('SWA590'), 'Southwest Airlines');
assert.equal(airlineName('XYZ1'), null);

const list = [{ callsign: 'SWA5901' }, { callsign: 'SWA590' }, { callsign: 'SWA12' }, { callsign: null }];
assert.deepEqual(
  searchFlights(list, 'wn590').map((a) => a.callsign),
  ['SWA590', 'SWA5901'],
);
assert.equal(searchFlights(list, 'S', 2).length, 2);

console.log('flightSearch: ok');
