import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../src/components/aof/v4/reference-styles.ts'), 'utf8');
const style = (name) => {
  const match = source.match(new RegExp(`^\\s*${name}: \\{([^\\n]*)\\},?$`, 'm'));
  assert.ok(match, `style ${name} exists`);
  return match[1];
};
const value = (line, property) => {
  const match = line.match(new RegExp(`${property}: ('[^']*'|\\"[^\\"]*\\"|[^,}]+)`));
  assert.ok(match, `${property} is declared`);
  return match[1].replace(/^['\"]|['\"]$/g, '').trim();
};

test('les paires de boutons Apple ont les mêmes dimensions déclarées', () => {
  const gains = style('gainsPill');
  const cash = style('cashButton');
  const replay = style('replayButton');
  const newBet = style('newBetButton');
  assert.equal(value(gains, 'height'), value(cash, 'height'));
  assert.equal(value(gains, 'width'), value(cash, 'width'));
  assert.equal(value(gains, 'maxWidth'), value(cash, 'maxWidth'));
  assert.equal(value(replay, 'height'), value(newBet, 'height'));
  assert.equal(value(replay, 'width'), value(newBet, 'width'));
  assert.equal(value(style('endActionButton'), 'height'), value(replay, 'height'));
  assert.equal(value(style('endActionButton'), 'maxWidth'), value(cash, 'maxWidth'));
  assert.equal(value(gains, 'height'), '38');
  assert.equal(value(replay, 'height'), '38');
});

test('les surfaces Apple reprennent les teintes relevées sur les frames vidéo', () => {
  assert.equal(value(style('replaySurface'), 'backgroundColor').toLowerCase(), '#3d7fcb');
  assert.equal(value(style('newBetSurface'), 'backgroundColor'), 'transparent');
  assert.equal(value(style('cashSurface'), 'backgroundColor').toLowerCase(), '#3d7fcb');
  assert.equal(value(style('cashSurfaceDisabled'), 'backgroundColor').toLowerCase(), '#3d7fcb');
});

test('le dock global Apple est transparent tandis que Gains actuels conserve son fond sombre', () => {
  assert.equal(value(style('cashOutDock'), 'backgroundColor'), 'transparent');
  assert.equal(value(style('gainsPill'), 'backgroundColor'), 'rgba(0, 15, 8, 0.45)');
});

test('la pilule des gains et les surfaces d’action partagent les paramètres d’ombre', () => {
  const gains = style('gainsPill');
  const action = style('actionButtonSurface');
  for (const key of ['shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset', 'elevation']) {
    assert.equal(value(gains, key), value(action, key), key);
  }
});

test('les contrôles de mise et JOUER exposent des libellés accessibles', () => {
  const screen = readFileSync(resolve(here, '../src/components/aof/v4/game-screen.tsx'), 'utf8');
  for (const label of ['Mise minimale', 'Doubler la mise', 'Diviser la mise par deux', 'Mise maximale', 'Jouer']) {
    assert.ok(screen.includes(`accessibilityLabel="${label}"`), `${label} has an accessibility label`);
  }
});
