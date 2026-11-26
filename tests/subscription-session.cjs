// Aucun SDK Firebase réel n'est chargé et aucune requête réseau n'est effectuée.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.resolve(process.argv[2]), 'utf8');
const D = 86400000;
let checks = 0;
function sandbox() {
  let now = 1800000000000;
  let timerId = 0;
  const timers = new Map(), records = new Map(), local = new Map();
  const authListeners = new Set(), appListeners = new Set(), snapshots = new Map(), snapshotErrors = new Map();
  const primary = { app: {options:{}}, currentUser:null };
  const secondary = {app:{options:{}},currentUser:null};
  const events = [];
  let offline = false;
  let authInitialization = null;
  const stamp = n => ({toMillis:()=>n});
  const snapshot = ref => ({exists:()=>records.has(ref),data:()=>records.get(ref)});
  const subscriptionSDK = {
    SUBSCRIPTION_EXPIRED_MESSAGE:'Votre abonnement a expiré. Seul l’administrateur peut renouveler et réactiver votre compte.',
    validateSubscriptionDays:value=>{const days=Number(String(value??'').trim());if(!Number.isSafeInteger(days)||days<1||days>36500)throw new Error('durée invalide');return days;},
    getSubscriptionInfo:(profile,time)=>{
      if(String(profile.role).toLowerCase()==='admin')return{state:'admin',expiresAtMs:null};
      const start=profile.subscriptionStartedAt?.toMillis?.();
      const days=profile.subscriptionDurationDays;
      if(!Number.isFinite(start)||!Number.isInteger(days)||days<1)return{state:'suspended',expiresAtMs:null};
      const expiresAtMs=start+days*D;
      const status=String(profile.status||'').toLowerCase();
      return{state:time>=expiresAtMs?'expired':['suspended','suspendu','blocked','disabled'].includes(status)?'suspended':'active',expiresAtMs};
    },
  };
  const resolve = v => {
    if (v && v.serverTimestamp) return stamp(now);
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === 'object' && !v.toMillis) return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)]));
    return v;
  };
  const fire = () => { for (const cb of authListeners) queueMicrotask(()=>cb(primary.currentUser)); };
  const notify = ref => { for(const cb of snapshots.get(ref)||[]) queueMicrotask(()=>cb(snapshot(ref))); };
  const write = (ref,value,merge=false) => {records.set(ref, {...(merge?records.get(ref):{}),...resolve(value)});notify(ref);};
  const appSDK = {initializeApp:(options,name)=>({options,name}),deleteApp:async()=>{}};
  const authSDK = {
    getAuth:app=>app?.name?secondary:primary,
    initializeAuth:(_app,options)=>{authInitialization=options;return primary;},
    getReactNativePersistence:storage=>({type:'react-native',storage}),
    signInWithEmailAndPassword:async(a,email)=>{a.currentUser={uid:'user',email};if(a===primary)fire();return{user:a.currentUser};},
    signOut:async a=>{events.push(['signOut',a===primary?'primary':'secondary']);a.currentUser=null;if(a===primary)fire();},
    createUserWithEmailAndPassword:async(a,email)=>{a.currentUser={uid:'new-user',email,delete:async()=>events.push(['deleteOrphan'])};return{user:a.currentUser};},
    onAuthStateChanged:(_a,cb)=>{authListeners.add(cb);queueMicrotask(()=>cb(primary.currentUser));return()=>authListeners.delete(cb);},
  };
  const storeSDK = {
    initializeFirestore:()=>({}),getFirestore:()=>({}),
    doc:(_db,...parts)=>parts.join('/'),collection:(_db,...parts)=>parts.join('/'),
    serverTimestamp:()=>({serverTimestamp:true}),enableNetwork:async()=>{events.push(['enableNetwork']);},
    getDocFromServer:async ref=>{if(offline)throw Object.assign(new Error('client is offline'),{code:'unavailable'});return snapshot(ref);},getDoc:async ref=>snapshot(ref),
    setDoc:async(ref,data,options)=>write(ref,data,!!options?.merge),
    updateDoc:async(ref,data)=>write(ref,data,true),deleteDoc:async ref=>records.delete(ref),
    getDocs:async()=>({forEach:()=>{},docs:[]}),
    onSnapshot:(ref,cb,onError)=>{const cbs=snapshots.get(ref)||new Set();cbs.add(cb);snapshots.set(ref,cbs);if(onError){const errors=snapshotErrors.get(ref)||new Set();errors.add(onError);snapshotErrors.set(ref,errors);}queueMicrotask(()=>cb(snapshot(ref)));return()=>{cbs.delete(cb);snapshotErrors.get(ref)?.delete(onError);};},
    runTransaction:async(_db,fn)=>fn({get:async ref=>snapshot(ref),set:(ref,data,options)=>write(ref,data,!!options?.merge),update:(ref,data)=>write(ref,data,true)}),
  };
  class FakeDate extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
  const moduleExports={};
  const context={module:{exports:moduleExports},exports:moduleExports,require:name=>{
    if(name==='firebase/app')return appSDK;
    if(name==='firebase/auth')return authSDK;
    if(name==='firebase/firestore')return storeSDK;
    if(name==='@/utils/subscription')return subscriptionSDK;
    if(name==='./subscriptionClock')return{getSubscriptionNow:()=>now,synchronizeSubscriptionClock:async()=>now};
    if(name==='react-native')return{Platform:{OS:'android'},AppState:{addEventListener:(_name,cb)=>{appListeners.add(cb);return{remove:()=>appListeners.delete(cb)};}}};
    if(name==='expo-device')return{modelName:'test-device'};
    if(name==='@react-native-async-storage/async-storage')return{getItem:async k=>local.get(k)||null,setItem:async(k,v)=>local.set(k,v),removeItem:async k=>local.delete(k)};
    throw new Error('Dépendance inattendue en test: '+name);
  },console:{log(){},warn(){},error(){}},Date:FakeDate,performance:{now:()=>now},Math,Promise,
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms,interval:false});return id;},
    clearTimeout:id=>timers.delete(id),
    setInterval:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms,interval:true});return id;},
    clearInterval:id=>timers.delete(id),
  };
  vm.runInNewContext(code,context,{filename:'firebase-isolated-tests.cjs'});
  return{api:context.module.exports,primary,secondary,events,records,timers,appListeners,stamp,
    now:()=>now,setNow:n=>{now=n;},write,authInitialization:()=>authInitialization,setOffline:value=>{offline=value;},
    failSnapshot:(ref,error)=>{for(const cb of snapshotErrors.get(ref)||[])queueMicrotask(()=>cb(error));},
    user:(uid='user',role='user',days=1,start=now)=>{primary.currentUser={uid,email:uid+'@test.invalid'};write('users/'+uid,{uid,username:uid,role,status:'active',subscriptionStartedAt:stamp(start),subscriptionDurationDays:days});},
  };
}
async function settle(){for(let i=0;i<100;i++)await Promise.resolve();}
(async()=>{
  {const s=sandbox();s.user('admin','admin');await s.api.registerFirebase('new','secret','user','active',7);
    assert.equal(s.primary.currentUser.uid,'admin');
    assert.equal(s.records.get('users/new-user').subscriptionDurationDays,7);
    assert.equal(s.records.get('users/new-user').subscriptionStartedAt.toMillis(),s.now());
    assert(!s.events.some(e=>e[0]==='signOut'&&e[1]==='primary'));checks++;
  }
  {const s=sandbox();s.user();await assert.rejects(()=>s.api.registerFirebase('new','secret','user','active',7),/administrateur/);
    await assert.rejects(()=>s.api.renewFirebaseUserSubscription('user',7),/administrateur/);checks++;
  }
  {const s=sandbox();s.user('admin','admin');s.write('users/user',{uid:'user',role:'user',status:'active',subscriptionStartedAt:s.stamp(s.now()-2*D),subscriptionDurationDays:1});
    await assert.rejects(()=>s.api.updateFirebaseUserStatus('user','active'),/expiré/);
    await s.api.renewFirebaseUserSubscription('user',5);
    assert.equal(s.records.get('users/user').subscriptionDurationDays,5);
    assert.equal(s.records.get('users/user').subscriptionStartedAt.toMillis(),s.now());
    await s.api.updateFirebaseUserDisplayName('user','Nouveau nom');
    await s.api.updateFirebaseUserStatus('user','suspended');
    await s.api.deleteFirebaseUserProfile('user');
    assert(!s.events.some(([event])=>event==='enableNetwork'));checks++;
  }
  {const s=sandbox();s.user('user','user',1,s.now()-2*D);await assert.rejects(()=>s.api.loginFirebase('user','secret'),/expiré/);assert.equal(s.primary.currentUser,null);checks++;}
  {const s=sandbox();s.user();const output=[];const stop=s.api.listenToAuthSession((p,e)=>output.push([p,e]));await settle();
    assert(output.some(([p])=>p?.uid==='user'));
    const expiry=[...s.timers.values()].find(t=>!t.interval&&t.ms===D);assert(expiry);
    s.setNow(s.now()+D);expiry.fn();await settle();assert(output.some(([p,e])=>!p&&e?.includes('expiré')));assert.equal(s.primary.currentUser,null);
    stop();assert.equal(s.timers.size,0);assert.equal(s.appListeners.size,0);checks++;
  }
  {const s=sandbox();s.user('user','user',36500);const output=[];const stop=s.api.listenToAuthSession((p,e)=>output.push([p,e]));await settle();
    const cap=[...s.timers.values()].find(t=>!t.interval&&t.ms===2147483647);assert(cap);cap.fn();await settle();
    assert.equal(s.primary.currentUser.uid,'user');assert(!output.some(([,e])=>e?.includes('expiré')));stop();checks++;
  }
  {const s=sandbox();s.user();const output=[];const stop=s.api.listenToAuthSession((p,e)=>output.push([p,e]));await settle();
    s.write('users/user',{role:'user',username:'user',status:'suspended'});await settle();assert(output.some(([p,e])=>!p&&e?.includes('suspendu')));assert.equal(s.primary.currentUser,null);stop();checks++;
  }
  {const s=sandbox();s.user();const output=[];const stop=s.api.listenToAuthSession((p,e)=>output.push([p,e]));await settle();
    s.setNow(s.now()+2*D);for(const cb of s.appListeners)cb('active');await settle();assert(output.some(([p,e])=>!p&&e?.includes('expiré')));assert.equal(s.primary.currentUser,null);stop();checks++;
  }
  {const s=sandbox();s.user('admin','admin',1,s.now()-2*D);const output=[];const stop=s.api.listenToAuthSession((p,e)=>output.push([p,e]));await settle();assert(output.some(([p])=>p?.role==='admin'));assert(![...s.timers.values()].some(t=>!t.interval));stop();checks++;}
  {const s=sandbox();s.user();const output=[];const stop=s.api.listenToAuthSession((p,e)=>output.push([p,e]));await settle();
    const oldAlarm=[...s.timers.values()].find(t=>!t.interval&&t.ms===D);assert(oldAlarm);
    s.setNow(s.now()+D);
    // Mise à jour serveur déjà faite, snapshot client pas encore livré.
    s.records.set('users/user',{uid:'user',username:'user',role:'user',status:'active',subscriptionStartedAt:s.stamp(s.now()),subscriptionDurationDays:7});
    oldAlarm.fn();await settle();
    assert.equal(s.primary.currentUser.uid,'user');assert(!output.some(([,e])=>e?.includes('expiré')));
    assert(output.at(-1)[0]?.uid==='user');stop();checks++;
  }
  {const s=sandbox();
    assert.equal(s.authInitialization()?.persistence?.type,'react-native');
    checks++;
  }
  {const s=sandbox();s.user();const output=[];const stop=s.api.listenToAuthSession((p,e)=>output.push([p,e]));await settle();
    assert(output.some(([p])=>p?.uid==='user'));
    const initialNulls=output.filter(([p])=>!p).length;
    for(const cb of s.appListeners)cb('active');await settle();
    assert.equal(output.filter(([p])=>!p).length,initialNulls);
    s.setOffline(true);
    s.failSnapshot('users/user',Object.assign(new Error('client is offline'),{code:'unavailable'}));await settle();
    const poll=[...s.timers.values()].find(t=>t.interval&&t.ms===60000);assert(poll);poll.fn();await settle();
    for(const delay of [600,1200]){
      const retry=[...s.timers.entries()].find(([,t])=>!t.interval&&t.ms===delay);assert(retry);
      s.timers.delete(retry[0]);retry[1].fn();await settle();
    }
    assert(output.some(([p])=>p?.uid==='user'));
    assert.equal(output.filter(([p])=>!p).length,initialNulls);
    s.setOffline(false);poll.fn();await settle();
    assert.equal(output.at(-1)[0]?.uid,'user');
    stop();checks++;
  }
  console.log(`PASS : ${checks} scénarios de session Firebase simulée : création sans déconnexion admin, admin seul, renouvellement, login expiré, échéance en session, durée longue, suspension, retour au premier plan, exemption admin.`);
})().catch(error=>{console.error(error);process.exit(1);});
