import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/components/wwg/WildWestGoldGame.tsx', import.meta.url), 'utf8');
const appleSource = fs.readFileSync(new URL('../src/components/aof/v4/game-screen.tsx', import.meta.url), 'utf8');
const botReferenceUrl = new URL('../../../wildwest/BotX-Wild-West-Apple-waiting-bottomup-2/src/BotXApp.tsx', import.meta.url);
const hasBotReference = fs.existsSync(botReferenceUrl);
const botSource = hasBotReference ? fs.readFileSync(botReferenceUrl, 'utf8') : null;
const botReferenceSkip = hasBotReference ? false : 'Référence BotX externe absente de cet environnement; test manuel non exécutable ici.';

test('Wild West prépare la case sans la sélectionner automatiquement', () => {
  assert.match(source, /status: 'prepared'/);
  assert.match(source, /pendingBot\.current = \{ uid: user\.uid, commandId, row, col \}/);
  assert.match(source, /pick\(index\)/);
  assert.doesNotMatch(source, /const nextSelected = new Set\(state\.selected\);\s*nextSelected\.add\(index\);/);
  assert.doesNotMatch(source, /writeChannel\(user\.uid, \{ status: hitSafe \? 'revealed' : 'lost'/);
});

test('les canaux BotX des jeux restent séparés', { skip: botReferenceSkip }, () => {
  assert.match(botSource, /apple_channels/);
  assert.match(botSource, /wild_west_gold_channels/);
  assert.match(botSource, /aviator/);
  assert.match(botSource, /crashPointChannel/);
});

test('Apple prépare la case suivante sans lancer immédiatement le jeu', () => {
  assert.match(appleSource, /status: 'prepared'/);
  assert.doesNotMatch(appleSource, /pendingBotAppleCommand\.current = \{ uid: user\.uid, commandId, row, col \};[\s\S]{0,500}handleCellPress\(row, col\)/);
});

test('BotX choisit automatiquement la case suivante sans ouvrir le jeu', { skip: botReferenceSkip }, () => {
  assert.match(botSource, /void issueAppleCommand\(0\)/);
  assert.match(botSource, /void issueAppleCommand\(nextRow\)/);
  assert.match(botSource, /void issueWildCommand\(0\)/);
  assert.match(botSource, /void issueWildCommand\(nextRow\)/);
  assert.match(botSource, /BotX choisit automatiquement une case au démarrage puis à chaque confirmation/);
  assert.doesNotMatch(botSource, /onClick=\{\(\) => onCell\(row, col\)\}/);
});
