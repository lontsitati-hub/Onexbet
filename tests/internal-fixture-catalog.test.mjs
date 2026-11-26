import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildInternalFixtureGroups, buildInternalFixturePairs, getInternalFixturePairCount } = require('../src/constants/internalFixtureCatalog.ts');

const record = (id, name, country = 'France', league = 'Ligue 1') => ({ id, name, country, league, logoUrl: `https://example.test/${id}.svg` });

test('exclut les tournois, doublons, entrées incomplètes et groupes isolés', () => {
  const groups = buildInternalFixtureGroups([
    record('a', 'Alpha'), record('b', 'Beta'), record('solo', 'Solo', 'France', 'Ligue 2'),
    record('tournament', 'CAN', 'Tournaments'), record('a', 'Alpha duplicate'),
    { ...record('missing-logo', 'Sans logo'), logoUrl: '' },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].teams.map((team) => team.id), ['a', 'b']);
  assert.equal(groups[0].pairCount, 1);
});

test('produit toutes les paires distinctes dans un ordre stable sans propriétés de match', () => {
  const [group] = buildInternalFixtureGroups([record('c', 'Charlie'), record('a', 'Alpha'), record('b', 'Bravo')]);
  const pairs = buildInternalFixturePairs(group);
  assert.deepEqual(pairs.map(({ homeTeam, awayTeam }) => [homeTeam.name, awayTeam.name]), [
    ['Alpha', 'Bravo'], ['Alpha', 'Charlie'], ['Bravo', 'Charlie'],
  ]);
  assert.equal(new Set(pairs.map((pair) => pair.id)).size, 3);
  for (const pair of pairs) {
    assert.equal(pair.homeTeam.id === pair.awayTeam.id, false);
    for (const field of ['date', 'score', 'status', 'odd']) assert.equal(field in pair, false);
  }
  assert.equal(getInternalFixturePairCount(4), 6);
});

test('snapshot local contient uniquement des clubs associés à une compétition', () => {
  const payload = JSON.parse(readFileSync(new URL('../public/data/club-league-mappings.json', import.meta.url), 'utf8'));
  assert.equal(payload.records.length, 1128);
  assert.ok(payload.records.every((item) => item.id && item.name && item.country && item.league && item.logoUrl));
  assert.ok(payload.records.every((item) => item.country.toLowerCase() !== 'tournaments'));
  const groups = buildInternalFixtureGroups(payload.records);
  assert.ok(groups.length > 0);
  assert.ok(groups.every((group) => group.teams.length >= 2));
});
