import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readDescription, parseFreezeDate, splitJobs, warningsFor } from '../server/lib/governance.js';

const sample = JSON.parse(readFileSync(new URL('../server/providers/sample-data/dam-sample.json', import.meta.url), 'utf8')).data;
const byName = (name) => sample.find((a) => a.attributes.name === name).attributes.description;
const TODAY = new Date('2026-10-08T12:00:00Z');

test('a plain description is kept as the description', () => {
  const r = readDescription(byName('GettyImages-2226833382'), TODAY);
  assert.equal(r.description, 'Woman Paddleboarding Alone on Calm Ocean Water');
  assert.deepEqual(r.associatedJobs, []);
  assert.equal(r.freeze, null);
});

test('empty and null descriptions give nothing', () => {
  assert.deepEqual(readDescription('', TODAY), { description: '', freeze: null, associatedJobs: [] });
  assert.deepEqual(readDescription(null, TODAY), { description: '', freeze: null, associatedJobs: [] });
});

test('"Associated Jobs:" lists become jobs, not a description', () => {
  const r = readDescription(byName('Laguna BEACH 1062 R2'), TODAY);
  assert.equal(r.description, '');
  assert.deepEqual(r.associatedJobs, [
    'ACME24_103080_MKTG_ACQ_March_Banners&Social',
    'ACME24_103779_MKTG_Ice-Media-Partnership',
  ]);
});

test('bare job codes with no label are treated as jobs', () => {
  const r = readDescription(byName('GettyImages-1199881954'), TODAY);
  assert.equal(r.description, '');
  assert.equal(r.associatedJobs.length, 2);
  assert.match(r.associatedJobs[0], /^ACME22_101735_MKTG_Foundation/);
});

test('market freezes are pulled out and their date is checked', () => {
  const r = readDescription(byName('GettyImages-1490384557'), TODAY);
  assert.equal(r.freeze.text, 'INDUSTRY MARKET FREEZE THRU 12.31.2025');
  assert.equal(r.freeze.until, '2025-12-31');
  assert.equal(r.freeze.expired, true);
  assert.equal(r.associatedJobs.length, 5);
  assert.equal(r.associatedJobs[3], 'BRND25_104018P_2Q 2025 Gate Stanchion Posters');

  const active = readDescription(byName('GettyImages-1490384557'), new Date('2025-06-01T00:00:00Z'));
  assert.equal(active.freeze.expired, false);
});

test('freeze dates in other formats', () => {
  assert.equal(parseFreezeDate('FREEZE THROUGH 3/1/26'), '2026-03-01');
  assert.equal(parseFreezeDate('FREEZE'), null);
});

test('splitJobs keeps a leading label-less phrase', () => {
  assert.deepEqual(splitJobs('Spring promo ABCD20_1 One ABCD21_2 Two'), ['Spring promo', 'ABCD20_1 One', 'ABCD21_2 Two']);
});

test('warnings for active freeze, ended freeze and unapproved assets', () => {
  assert.deepEqual(warningsFor({ approved: false, freeze: null }), ['Not approved for use']);
  assert.deepEqual(warningsFor({ approved: true, freeze: { text: 'FREEZE THRU 1.1.2030', until: '2030-01-01', expired: false } }), ['⚠ FREEZE THRU 1.1.2030']);
  assert.match(warningsFor({ approved: true, freeze: { text: 'X', until: '2025-12-31', expired: true } })[0], /^Freeze ended 2025-12-31/);
});
