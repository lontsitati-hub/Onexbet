const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const navigationColorsPath = path.resolve(process.argv[2] || path.join(root, 'src/utils/navigationColors.ts'));
const { getNavigationInactiveColor, getNavigationItemColor } = require(navigationColorsPath);
const themes = { blue: '#2E79C9', red_mega: '#E60000', light_green: '#7CB342', green: '#008264', royal_blue: '#2e45d1', gold: '#E5A93B' };
const modes = ['light', 'dark', 'navy', 'midnight'];
const rails = {
  footer: ['populaire', 'favoris', 'coupon', 'historique', 'menu'],
  header: ['populaire', 'sports', 'esport', 'casino', 'games'],
};
let cases = 0;
for (const [theme, activeColor] of Object.entries(themes)) {
  for (const mode of modes) {
    const inactive = getNavigationInactiveColor(mode);
    assert.equal(inactive, mode === 'light' ? '#78818B' : '#ABB3BC');
    assert.notEqual(inactive, activeColor);
    for (const [rail, tabs] of Object.entries(rails)) {
      for (const selected of tabs) {
        const colors = tabs.map(tab => getNavigationItemColor(tab === selected, activeColor, inactive));
        assert.equal(colors.filter(color => color === activeColor).length, 1, `${theme}/${mode}/${rail}/${selected}`);
        assert.equal(colors[tabs.indexOf(selected)], activeColor);
        colors.forEach((color, index) => { if (tabs[index] !== selected) assert.equal(color, inactive); });
        // La sélection suivante ne dépend d'aucun délai ni de la couleur précédente.
        const next = tabs[(tabs.indexOf(selected) + 1) % tabs.length];
        assert.equal(getNavigationItemColor(selected === next, activeColor, inactive), inactive);
        assert.equal(getNavigationItemColor(true, activeColor, inactive), activeColor);
        cases++;
      }
    }
  }
}
const footer = fs.readFileSync(path.join(root, 'src/components/TabBar.tsx'), 'utf8');
const popular = fs.readFileSync(path.join(root, 'src/components/tabs/PopularTab.tsx'), 'utf8');
const store = fs.readFileSync(path.join(root, 'src/store/useBetStore.ts'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src/app/index.tsx'), 'utf8');
assert.match(store, /activeTab:\s*'populaire'/, 'Populaire doit être l’onglet initial');
assert.match(index, /class TabContentErrorBoundary/);
assert.match(index, /console\.error\('\[TabContentErrorBoundary\]/);
assert.match(index, /<TabContentErrorBoundary key=\{activeTab\}>/);
assert.match(footer, /tintColor: inactiveColor/);
assert.match(footer, /tintColor: activeColor/);
const couponBlock = footer.slice(footer.indexOf('<Pressable style={styles.couponTabItem}'), footer.indexOf('<AnimatedFooterTab label="Historique"'));
assert.match(couponBlock, /icon_coupon_tab_light_green\.png/);
assert.match(couponBlock, /icon_coupon_tab_green\.png/);
assert.match(couponBlock, /icon_coupon_tab_royal_transparent\.png/);
assert.doesNotMatch(couponBlock, /icon_coupon_tab_royal\.png/);
assert.match(couponBlock, /icon_coupon_tab_gold\.png/);
assert.match(couponBlock, /icon_coupon_tab\.png/);
assert.match(couponBlock, /style={styles\.couponIconImage}/);
assert.doesNotMatch(couponBlock, /tintColor/);
const couponWrapperStyle = footer.match(/couponIconWrapper:\s*\{([^}]*)\}/)?.[1] || '';
assert.doesNotMatch(couponWrapperStyle, /backgroundColor|border(?:Width|Color)/);
assert.match(footer, /const activeColor = theme === 'red_mega' \? '#E60000'/);
assert.match(popular, /const isActive = item\.id === activeTopTab/);
assert.match(popular, /const isActive = sportFilter === sport\.id/);
const headerRail = popular.slice(popular.indexOf('topNavigation.map'), popular.indexOf('</ScrollView>', popular.indexOf('topNavigation.map')));
assert.match(headerRail, /getNavigationItemColor\(isActive, activeColor, navigationInactiveColor\)/);
const sportRail = popular.slice(popular.indexOf('sportTypes.map'), popular.indexOf('</ScrollView>', popular.indexOf('sportTypes.map')));
assert.match(sportRail, /tintColor: activeColor/);
assert.match(sportRail, /color: activeColor/);
assert.match(sportRail, /borderColor: isActive \? activeColor : 'transparent'/);
assert.doesNotMatch(sportRail, /getNavigationItemColor\(isActive/);
const callback = footer.slice(footer.indexOf('const navigateTab'), footer.indexOf('const onCouponPressIn'));
assert.match(callback, /setActiveTab\(tab\)/);
assert.doesNotMatch(callback, /setTimeout|setInterval|await/);
const footerPressIn = footer.slice(footer.indexOf('const onPressIn'), footer.indexOf('const onPressOut'));
assert.doesNotMatch(footerPressIn, /setActiveTab|onActivate/, 'un onglet ne doit pas changer d’écran pendant le toucher');
assert.doesNotMatch(footer, /onActivate/, 'la sélection d’un onglet ne doit pas être déclenchée deux fois');
assert.match(footer, /onPressIn=\{onCouponPressIn\}/, 'le bouton Coupon conserve son animation sans sélectionner l’écran au toucher');
assert.doesNotMatch(popular.slice(popular.indexOf('const onTopNavigation'), popular.indexOf('const toggleFavorite')), /setTimeout|setInterval|await/);
console.log(`PASS : ${cases} cas de sélection, six thèmes et quatre fonds ; invariants header/footer/Coupon vérifiés.`);
console.log('Limite : tests des règles et du code uniquement, pas de rendu Android ni de mesure de latence sur appareil.');
