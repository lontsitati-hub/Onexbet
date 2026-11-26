const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compiled = process.argv[2];
if (!compiled) throw new Error('Pass the compiled themeBranding.cjs file');
const { getThemeAccentColor, getThemeBranding, getThemeBrandLogo } = require(path.resolve(compiled));
const brands = {
  blue: ['1xBet', '1xbet-header-logo-user'],
  red_mega: ['MegaPari', 'megapari'],
  light_green: ['WinWin', 'winwin'],
  green: ['Linebet', 'linebet'],
  royal_blue: ['Paripesa', 'paripesa'],
  gold: ['Melbet', 'melbet'],
};
const accents = { blue: '#2E79C9', red_mega: '#E60000', light_green: '#7CB342', green: '#008264', royal_blue: '#2E45D1', gold: '#E5A93B' };
const modes = ['light', 'dark', 'navy', 'midnight'];
const sourcePath = (source) => typeof source === 'string' ? source : source.default;
let transitions = 0;
for (const [theme, [name, assetPrefix]] of Object.entries(brands)) {
  assert.equal(getThemeAccentColor(theme), accents[theme], `${theme} accent`);
  assert.equal(getThemeBranding(theme).name, name);
  for (const mode of modes) {
    const source = sourcePath(getThemeBrandLogo(theme, mode));
    assert.ok(source.includes(assetPrefix), `${theme}/${mode}: ${source}`);
      assert.ok(fs.existsSync(path.resolve(path.dirname(compiled), source)), source);
      if (theme !== 'blue' && theme !== 'red_mega') {
        assert.ok(!source.includes('1xbet'), theme);
        assert.ok(source.endsWith(mode === 'light' ? '-light.png' : '-dark.png'), source);
      }
  }
}
for (const previous of Object.keys(brands)) {
  for (const next of Object.keys(brands)) {
    for (const mode of modes) {
      getThemeBrandLogo(previous, mode);
      const actual = sourcePath(getThemeBrandLogo(next, mode));
      assert.ok(actual.includes(brands[next][1]));
      if (previous !== next) {
        assert.notEqual(actual, sourcePath(getThemeBrandLogo(previous, mode)));
      }
      transitions++;
    }
  }
}
assert.equal(getThemeBranding('unknown'), null);
assert.equal(getThemeBrandLogo('unknown', 'light'), null);
assert.equal(getThemeAccentColor('unknown'), accents.blue);
const root = path.resolve(__dirname, '..');
const component = fs.readFileSync(path.join(root, 'src/components/ThemeBrandLogo.tsx'), 'utf8');
assert.ok(component.includes('fadeDuration={0}'));
assert.ok(!component.includes('tintColor'));
assert.ok(!component.includes('<Text'));
assert.ok(component.includes('width: 96, height: 28, marginLeft: 8'));
const popular = fs.readFileSync(path.join(root, 'src/components/tabs/PopularTab.tsx'), 'utf8');
assert.ok(popular.includes('<ThemeBrandLogo theme={theme} backgroundMode={backgroundMode} />'));
assert.ok(!popular.includes("require('@/assets/images/1xbet-header-logo-user.png')"));
console.log(`PASS : 6 marques, 4 fonds, ${transitions} transitions ; aucun mélange ni ancien logo de repli.`);
console.log('PASS : aucun nom provisoire, aucune recoloration par le thème, dimensions du header conservées.');
