import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  analyzeLocalityRows,
  parseCoordinate,
} from '../src/features/localities/data/localityImport.ts';

describe('locality spreadsheet import', () => {
  test('parses decimal and DMS coordinates used by the real workbook', () => {
    assert.deepEqual(parseCoordinate('-19.897230, -43.909254'), {
      latitude: -19.89723,
      longitude: -43.909254,
      valid: true,
    });
    const dms = parseCoordinate(`19\u00b041\u201901,96\u201dS 43\u00b059\u201901,56\u201dO`);
    assert.equal(dms.valid, true);
    assert.ok(Math.abs(dms.latitude + 19.68387778) < 0.000001);
    assert.ok(Math.abs(dms.longitude + 43.98376667) < 0.000001);
    assert.equal(parseCoordinate('0').valid, false);
  });

  test('skips exact duplicates but preserves repeated references with different addresses', () => {
    const rows = [
      ['ORIGEM', 'CIDADE ORIGEM', 'ESTADO', 'ENDERECO', 'COORDENADAS'],
      ['110', 'Belo Horizonte', 'MG', 'Rua A, 100 - MG', '-19.90, -43.90'],
      ['110', 'Belo Horizonte', 'MG', 'Rua A, 100 - MG', '-19.90, -43.90'],
      ['110', 'Belo Horizonte', 'MG', 'Rua B, 200 - MG', '-19.91, -43.91'],
    ];
    const analysis = analyzeLocalityRows(rows, []);

    assert.equal(analysis.totalRows, 3);
    assert.equal(analysis.newRows, 2);
    assert.equal(analysis.duplicateRows, 1);
    assert.equal(analysis.rows[1].alreadyImported, true);
    assert.equal(analysis.rows[2].alreadyImported, false);
  });
});
