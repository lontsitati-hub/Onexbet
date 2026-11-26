const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const isolatedNodeModules = process.env.FIREBASE_TEST_NODE_MODULES
  || '/home/ubuntu/firebase_subscription_checks/node_modules';
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require(path.join(isolatedNodeModules, '@firebase/rules-unit-testing'));
const {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} = require(path.join(isolatedNodeModules, 'firebase/firestore'));

const PROJECT_ID = 'demo-onexbet-subscriptions';
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
let testEnv;

function adminDb() {
  return testEnv.authenticatedContext('admin-actor').firestore();
}

function userDb(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function anonymousDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seed(relativePath, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), ...relativePath.split('/')), data);
  });
}

async function cleanup(relativePaths) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const relativePath of relativePaths) {
      await deleteDoc(doc(context.firestore(), ...relativePath.split('/')));
    }
  });
}

function daysAgo(days) {
  return Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
}

function clientTimestamp(deltaMs) {
  return Timestamp.fromMillis(Date.now() + deltaMs);
}

async function test(name, fn) {
  await fn();
  process.stdout.write(`ok - ${name}\n`);
}

async function run() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });

  await seed('users/admin-actor', { role: 'admin', status: 'active' });

  await test('admin creates an active account and its first login may write profile clock and device binding', async () => {
    const db = adminDb();
    await assertSucceeds(setDoc(doc(db, 'users', 'new-user'), {
      uid: 'new-user',
      username: 'new-user',
      role: 'user',
      status: 'active',
      createdAt: serverTimestamp(),
      createdBy: 'admin-actor',
      subscriptionStartedAt: serverTimestamp(),
      subscriptionDurationDays: 30,
      subscriptionUpdatedBy: 'admin-actor',
    }));
    const firstLoginDb = userDb('new-user');
    await assertSucceeds(getDoc(doc(firstLoginDb, 'users', 'new-user')));
    await assertSucceeds(setDoc(doc(firstLoginDb, 'users', 'new-user', 'accessClock', 'current'), {
      at: serverTimestamp(),
    }));
    const binding = doc(firstLoginDb, 'users', 'new-user', 'security', 'deviceBinding');
    await assertSucceeds(runTransaction(firstLoginDb, async (transaction) => {
      const snapshot = await transaction.get(binding);
      assert.equal(snapshot.exists(), false);
      transaction.set(binding, { uid: 'new-user', deviceId: 'first-device', sessionId: 'first-session', active: true });
    }));
    await assertSucceeds(setDoc(doc(db, 'users', 'new-admin'), {
      role: 'admin',
      status: 'active',
    }));
    await assertFails(setDoc(doc(db, 'users', 'partial-new'), {
      role: 'user',
      status: 'active',
      subscriptionDurationDays: 30,
    }));
    await cleanup([
      'users/new-user/security/deviceBinding', 'users/new-user/accessClock/current',
      'users/new-user', 'users/new-admin', 'users/partial-new',
    ]);
  });

  await test('anonymous access is denied', async () => {
    const db = anonymousDb();
    await assertFails(getDoc(doc(db, 'users', 'admin-actor')));
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDoc(doc(db, 'fastGamesGrants', 'alice')));
  });

  await seed('users/reader', {
    role: 'user',
    status: 'active',
    subscriptionStartedAt: Timestamp.fromMillis(Date.now()),
    subscriptionDurationDays: 10,
  });
  await seed('users/other-reader', {
    role: 'user',
    status: 'active',
    subscriptionStartedAt: Timestamp.fromMillis(Date.now()),
    subscriptionDurationDays: 10,
  });
  await seed('fastGamesGrants/reader', { granted: true });
  await seed('fastGamesGrants/other-reader', { granted: true });

  await test('non-admin reads own profile and active grants, not other profiles or user list', async () => {
    const db = userDb('reader');
    await assertSucceeds(getDoc(doc(db, 'users', 'reader')));
    await assertFails(getDoc(doc(db, 'users', 'other-reader')));
    await assertFails(getDocs(collection(db, 'users')));
    await assertSucceeds(getDocs(query(collection(db, 'fastGamesGrants'), where('granted', '==', true))));
  });

  await test('coupon share code can be created by its owner and fetched by another active account, but not listed or overwritten', async () => {
    const ownerDb = userDb('reader');
    const shareRef = doc(ownerDb, 'coupon_shares', 'AB123');
    const originalPayload = JSON.stringify({
      version: 1,
      coupon: { code: 'AB123', events: [{ team1Logo: 'https://example.com/home.png', team2Logo: 'https://example.com/away.png' }] },
    });

    await assertSucceeds(setDoc(shareRef, {
      ownerUid: 'reader',
      code: 'AB123',
      payload: originalPayload,
      createdAt: serverTimestamp(),
    }));

    const received = await assertSucceeds(getDoc(doc(userDb('other-reader'), 'coupon_shares', 'AB123')));
    assert.equal(received.data().payload, originalPayload);
    await assertFails(getDocs(collection(userDb('other-reader'), 'coupon_shares')));
    await assertFails(getDoc(doc(anonymousDb(), 'coupon_shares', 'AB123')));
    await assertFails(setDoc(doc(userDb('other-reader'), 'coupon_shares', 'CD456'), {
      ownerUid: 'reader', code: 'CD456', payload: originalPayload, createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(userDb('other-reader'), 'coupon_shares', 'AB123'), {
      payload: 'coupon modifié', updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(shareRef, {
      payload: JSON.stringify({ version: 1, coupon: { code: 'AB123', events: [{ team1Logo: 'https://example.com/new-home.png' }] } }),
      updatedAt: serverTimestamp(),
    }));

    await cleanup(['coupon_shares/AB123']);
  });

  await test('self extension and self role change are denied', async () => {
    const db = userDb('reader');
    await assertFails(updateDoc(doc(db, 'users', 'reader'), {
      subscriptionStartedAt: serverTimestamp(),
      subscriptionDurationDays: 36500,
      status: 'active',
    }));
    await assertFails(updateDoc(doc(db, 'users', 'reader'), { role: 'admin' }));
  });

  await test('admin can list users and only admin can write grants', async () => {
    const db = adminDb();
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(setDoc(doc(db, 'fastGamesGrants', 'admin-grant'), { granted: true }));
    await assertFails(setDoc(doc(userDb('reader'), 'fastGamesGrants', 'reader-write'), { granted: true }));
    await cleanup(['fastGamesGrants/admin-grant']);
  });

  await seed('users/profile-change-target', {
    role: 'user',
    status: 'active',
    subscriptionStartedAt: Timestamp.fromMillis(Date.now()),
    subscriptionDurationDays: 10,
  });
  await test('admin may change a valid display name and delete only non-admin profiles', async () => {
    const db = adminDb();
    const target = doc(db, 'users', 'profile-change-target');
    await assertSucceeds(updateDoc(target, { displayName: 'Nouveau nom' }));
    await assertFails(updateDoc(target, { displayName: '' }));
    await assertFails(updateDoc(doc(userDb('profile-change-target'), 'users', 'profile-change-target'), { displayName: 'Nom refusé' }));
    await assertFails(deleteDoc(doc(db, 'users', 'admin-actor')));
    await assertSucceeds(deleteDoc(target));
  });

  await seed('users/expired', {
    role: 'user',
    status: 'active',
    subscriptionStartedAt: daysAgo(2),
    subscriptionDurationDays: 1,
  });
  await seed('fastGamesGrants/expired', { granted: true });

  await test('expired profile remains readable, but expired content access is denied', async () => {
    await assertSucceeds(getDoc(doc(userDb('expired'), 'users', 'expired')));
    await assertFails(getDoc(doc(userDb('expired'), 'fastGamesGrants', 'expired')));
    await assertSucceeds(getDoc(doc(adminDb(), 'fastGamesGrants', 'expired')));
  });

  await test('renewal requires server request time; status toggle preserves old timestamp without extending access', async () => {
    const uid = 'renew-target';
    await seed(`users/${uid}`, {
      role: 'user',
      status: 'suspended',
      subscriptionStartedAt: daysAgo(3),
      subscriptionDurationDays: 1,
    });
    const db = adminDb();
    await assertFails(updateDoc(doc(db, 'users', uid), {
      status: 'active',
      subscriptionStartedAt: clientTimestamp(20),
      subscriptionDurationDays: 30,
    }));
    await assertSucceeds(updateDoc(doc(db, 'users', uid), {
      status: 'active',
      subscriptionStartedAt: serverTimestamp(),
      subscriptionDurationDays: 30,
    }));

    const expiredUid = 'expired-toggle';
    await seed(`users/${expiredUid}`, {
      role: 'user',
      status: 'suspended',
      subscriptionStartedAt: daysAgo(3),
      subscriptionDurationDays: 1,
    });
    await assertSucceeds(updateDoc(doc(db, 'users', expiredUid), { status: 'active' }));
    await assertFails(getDoc(doc(userDb(expiredUid), 'fastGamesGrants', 'expired')));
    await cleanup([`users/${uid}`, `users/${expiredUid}`]);
  });

  await test('access clock accepts only a fresh server timestamp and never a client-forged/old timestamp', async () => {
    const db = userDb('expired');
    const ref = doc(db, 'users', 'expired', 'accessClock', 'current');
    await assertSucceeds(setDoc(ref, { at: serverTimestamp() }));
    await assertFails(updateDoc(ref, { at: clientTimestamp(-1) }));
    await assertFails(updateDoc(ref, { at: clientTimestamp(1) }));
  });

  await test('legacy active profile remains compatible; suspended and partial profiles do not', async () => {
    await seed('users/legacy-active', { role: 'user', status: 'active' });
    await seed('users/legacy-suspended', { role: 'user', status: 'suspended' });
    await seed('users/partial-legacy', {
      role: 'user', status: 'active', subscriptionStartedAt: daysAgo(1),
    });
    await seed('fastGamesGrants/legacy-active', { granted: true });
    const activeDb = userDb('legacy-active');
    await assertSucceeds(getDoc(doc(activeDb, 'users', 'legacy-active')));
    await assertSucceeds(getDocs(collection(activeDb, 'fastGamesGrants')));
    await assertFails(getDocs(collection(userDb('legacy-suspended'), 'fastGamesGrants')));
    await assertFails(getDoc(doc(userDb('partial-legacy'), 'users', 'partial-legacy')));
    await cleanup([
      'users/legacy-active', 'users/legacy-suspended', 'users/partial-legacy',
      'fastGamesGrants/legacy-active',
    ]);
  });

  await test('device ownership is enforced; expired owner may only release compatible state', async () => {
    const binding = doc(userDb('expired'), 'users', 'expired', 'security', 'deviceBinding');
    await assertFails(setDoc(binding, { uid: 'another-user', active: true }));
    await seed('users/expired/security/deviceBinding', {
      uid: 'expired', active: true, deviceId: 'd1', sessionId: 's1', lastSeenAt: Date.now(),
    });
    await assertSucceeds(updateDoc(binding, { active: false, signedOutAt: Date.now(), lastSeenAt: Date.now() }));
    await assertFails(updateDoc(binding, { uid: 'another-user' }));
    await cleanup(['users/expired/security/deviceBinding', 'users/expired/accessClock/current']);
  });

  await test('first login can transactionally read and create a missing own device binding', async () => {
    const db = userDb('reader');
    const ref = doc(db, 'users', 'reader', 'security', 'deviceBinding');
    await assertSucceeds(runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      assert.equal(snapshot.exists(), false);
      transaction.set(ref, { uid: 'reader', deviceId: 'first-device', sessionId: 'first-session', active: true });
    }));
    await assertFails(getDoc(doc(userDb('other-reader'), 'users', 'reader', 'security', 'deviceBinding')));
    await cleanup(['users/reader/security/deviceBinding']);
  });

  await cleanup([
    'users/reader', 'users/other-reader', 'users/expired',
    'fastGamesGrants/reader', 'fastGamesGrants/other-reader', 'fastGamesGrants/expired',
  ]);
  await testEnv.cleanup();
}

run().catch(async (error) => {
  process.stderr.write(`${error.stack || error}\n`);
  if (testEnv) await testEnv.cleanup();
  process.exitCode = 1;
});
