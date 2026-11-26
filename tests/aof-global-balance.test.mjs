import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const store = fs.readFileSync(path.join(projectRoot, 'src/components/aof/v4/game-store.tsx'), 'utf8');

test('Apple of Fortune utilise le solde global du projet', () => {
  assert.match(store, /import \{ useBetStore \} from ['"]@\/store\/useBetStore['"]/);
  assert.match(store, /const globalBalance = useBetStore\(\(state\) => state\.balance\)/);
  assert.match(store, /const updateGlobalBalance = useBetStore\(\(state\) => state\.updateBalance\)/);
  assert.match(store, /balance: globalBalance/);
  assert.doesNotMatch(store, /const \[balance,\s*setBalance\] = useState/);
  assert.match(store, /const addWager = useCallback\([\s\S]*?updateGlobalBalance\(balanceRef\.current\)/);
  assert.match(store, /const addPayout = useCallback\([\s\S]*?updateGlobalBalance\(balanceRef\.current\)/);
  assert.doesNotMatch(store, /AsyncStorage\.getItem\(STORAGE_KEYS\.balance\)/);
  assert.doesNotMatch(store, /\[STORAGE_KEYS\.balance,/);
});
