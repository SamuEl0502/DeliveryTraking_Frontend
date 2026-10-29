// Prueba del buscador: npm test (Node quita los tipos, no hace falta framework)
import assert from 'node:assert/strict';
import { airlineName, callsignPrefixes, flightNumber, searchFlights } from '../src/utils/flightSearch.ts';

assert.deepEqual(callsignPrefixes(' wn 590 '), ['WN590', 'SWA590']);
assert.deepEqual(callsignPrefixes('B6123'), ['B6123', 'JBU123']);
assert.deepEqual(callsignPrefixes('UAL1855'), ['UAL1855']); // ICAO funciona directo
assert.deepEqual(callsignPrefixes('AA'), ['AA']); // sin número no se traduce
assert.deepEqual(callsignPrefixes('ZZ12'), ['ZZ12']); // aerolínea desconocida
assert.deepEqual(callsignPrefixes('  '), []);
assert.equal(airlineName('SWA590'), 'Southwest Airlines');
assert.equal(airlineName('XYZ1'), null);

// Conversión inversa: callsign ICAO → número comercial IATA
assert.equal(flightNumber('SWA590'), 'WN590');
assert.equal(flightNumber('AAL100'), 'AA100');
assert.equal(flightNumber('N123AB'), null); // matrícula de aviación general
assert.equal(flightNumber('XYZ12'), null); // aerolínea desconocida
assert.equal(flightNumber('ACA855', { icao: 'ACA', iata: 'AC' }), 'AC855'); // con la aerolínea de adsbdb
assert.equal(flightNumber('SWA590', { icao: 'ACA', iata: 'AC' }), 'WN590'); // otra aerolínea: manda la tabla

const list = [{ callsign: 'SWA5901' }, { callsign: 'SWA590' }, { callsign: 'SWA12' }, { callsign: null }];
assert.deepEqual(
  searchFlights(list, 'wn590').map((a) => a.callsign),
  ['SWA590', 'SWA5901'],
);
assert.equal(searchFlights(list, 'S', 2).length, 2);

console.log('flightSearch: ok');
