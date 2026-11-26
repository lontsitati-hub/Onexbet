const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { validateSubscriptionDays, getSubscriptionInfo, SUBSCRIPTION_DAY_MS: D } = require(path.resolve(process.argv[2]));
let cases = 0;
for (const value of [1, 2, 30, 365, 36500, '14', ' 7 ']) {
  assert.equal(validateSubscriptionDays(value), Number(value)); cases++;
}
for (const value of [0, -1, 0.5, 3.5, '', ' ', '1.5', '1e3', Infinity, NaN, 36501, null, undefined, 'abc', '2 jours']) {
  assert.throws(() => validateSubscriptionDays(value)); cases++;
}
const start = 1800000000000;
const ts = n => ({ toMillis: () => n });
const user = { role: 'user', status: 'active', subscriptionStartedAt: ts(start), subscriptionDurationDays: 3 };
for (const [now, state, remainingDays] of [
  [start, 'active', 3], [start + 1, 'active', 3], [start + D, 'active', 2],
  [start + 2*D + 1, 'active', 1], [start + 3*D - 1, 'active', 1],
  [start + 3*D, 'expired', 0], [start + 30*D, 'expired', 0],
]) {
  const result = getSubscriptionInfo(user, now);
  assert.equal(result.state, state); assert.equal(result.remainingDays, remainingDays);
  assert.equal(result.expiresAtMs, start + 3*D); cases++;
}
assert.equal(getSubscriptionInfo({...user, status: 'suspended'}, start + D).state, 'suspended');cases++;
assert.equal(getSubscriptionInfo({...user, role: 'admin'}, start + 30*D).state, 'admin');cases++;
assert.equal(getSubscriptionInfo({role:'user',status:'active'}, start).state, 'not_configured');cases++;
assert.equal(getSubscriptionInfo({role:'user',status:'suspended'}, start).state, 'suspended');cases++;
for (const patch of [
  {subscriptionDurationDays: 0}, {subscriptionDurationDays: 1.2},
  {subscriptionDurationDays: null}, {subscriptionStartedAt: null},
  {subscriptionStartedAt: start}, {subscriptionStartedAt: {toMillis:()=>NaN}},
]) {
  assert.equal(getSubscriptionInfo({...user,...patch}, start).state, 'suspended');cases++;
}
for (const partial of [{subscriptionDurationDays: 30},{subscriptionStartedAt:ts(start)}]) {
  assert.equal(getSubscriptionInfo({role:'user',...partial}, start).state,'suspended');cases++;
}
const renewed = {...user,subscriptionStartedAt:ts(start+4*D),subscriptionDurationDays:7};
assert.equal(getSubscriptionInfo(renewed,start+4*D).remainingDays,7);cases++;
assert.equal(getSubscriptionInfo(renewed,start+11*D).state,'expired');cases++;
const root=path.resolve(__dirname,'..');
const firebase=fs.readFileSync(path.join(root,'src/services/firebase.ts'),'utf8');
const register=firebase.slice(firebase.indexOf('export async function registerFirebase('),firebase.indexOf('const DEVICE_ID_KEY'));
assert.match(register,/requireFirebaseAdministrator\(\)/);
assert.match(register,/createUserWithEmailAndPassword\(creationAuth/);
assert.doesNotMatch(register,/signOut\(auth\)/);
assert.match(register,/subscriptionStartedAt: serverTimestamp\(\)/);
assert.doesNotMatch(firebase,/mello123|mello@onexbet\.com/);
const listener=firebase.slice(firebase.indexOf('export function listenToAuthSession('),firebase.indexOf('export async function initializeAdminAccount('));
assert.match(listener,/AppState\.addEventListener/);
assert.match(listener,/setInterval\([^]*60000\)/);
assert.match(listener,/SUBSCRIPTION_EXPIRED_MESSAGE/);
assert.match(listener,/synchronizeSubscriptionClock/);
console.log(`PASS : ${cases} cas de durée, échéance exacte, jours restants, renouvellement, anciens comptes et périodes invalides.`);
console.log('PASS : contrôles statiques création secondaire, horodatage serveur, contrôle continu et retour au premier plan.');
