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
  return match[1].replace(/^['\\"]|['\\"]$/g, '').trim();
};

const resolvedValue = (name, property) => {
  const current = style(name);
  const spreadName = current.match(/\.\.(\w+)/)?.[1];
  if (spreadName) {
    const shared = source.match(new RegExp(`const ${spreadName} = \\{([^}]*)\\}`))?.[1];
    assert.ok(shared, `shared style ${spreadName} exists`);
    const inherited = shared.match(new RegExp(`${property}: ('[^']*'|\\"[^\\"]*\\"|[^,}]+)`));
    if (inherited) return value(shared, property);
  }
  const flattened = current.replace(/\{[^{}]*\}/g, '');
  return value(flattened, property);
};

test('les paires de boutons Apple ont les mêmes dimensions déclarées', () => {
  assert.equal(resolvedValue('gainsPill', 'height'), resolvedValue('cashButton', 'height'));
  assert.equal(resolvedValue('gainsPill', 'width'), resolvedValue('cashButton', 'width'));
  assert.equal(resolvedValue('gainsPill', 'maxWidth'), resolvedValue('cashButton', 'maxWidth'));
  assert.equal(resolvedValue('replayButton', 'height'), resolvedValue('newBetButton', 'height'));
  assert.equal(resolvedValue('replayButton', 'width'), resolvedValue('newBetButton', 'width'));
  assert.equal(resolvedValue('endActionButton', 'height'), resolvedValue('replayButton', 'height'));
  assert.equal(resolvedValue('endActionButton', 'maxWidth'), resolvedValue('cashButton', 'maxWidth'));
  assert.equal(resolvedValue('gainsPill', 'height'), '38');
  assert.equal(resolvedValue('replayButton', 'height'), '38');
  assert.equal(resolvedValue('cashButton', 'maxWidth'), '450');
});

test('les libellés des boutons AOF gardent leur échelle de référence en natif', () => {
  const screen = readFileSync(resolve(here, '../src/components/aof/v4/game-screen.tsx'), 'utf8');
  for (const labelStyle of ['plusButtonText', 'betChipText', 'playButtonText', 'bottomBarText', 'replayButtonText', 'newBetButtonText', 'gainsPillText']) {
    assert.ok(screen.includes(`allowFontScaling={false} style={styles.${labelStyle}}`), `${labelStyle} must not inherit system font scaling`);
  }
  assert.match(screen, /<Text allowFontScaling=\{false\} style=\{\[styles\.cashButtonText/);
  assert.match(screen, /<TextInput\s+style=\{styles\.betInput\}\s+allowFontScaling=\{false\}/);
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
