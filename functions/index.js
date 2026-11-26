const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const firestore = admin.firestore();

/**
 * Suppression définitive d'un compte : Auth, profil Firestore, sous-collections,
 * droits Fast Games et canal Aviator associé.
 * L'autorisation est toujours vérifiée côté serveur.
 */
exports.deleteUserAccount = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const targetUid = String(request.data?.uid || '').trim();
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Connexion administrateur requise.');
  }
  if (!targetUid || targetUid === callerUid) {
    throw new HttpsError('invalid-argument', 'Compte cible invalide.');
  }

  const callerProfile = await firestore.collection('users').doc(callerUid).get();
  if (!callerProfile.exists || String(callerProfile.data().role || '').toLowerCase() !== 'admin') {
    throw new HttpsError('permission-denied', 'Seul un administrateur peut supprimer un compte.');
  }

  const targetRef = firestore.collection('users').doc(targetUid);
  const targetProfile = await targetRef.get();
  if (!targetProfile.exists) {
    throw new HttpsError('not-found', 'Compte utilisateur introuvable.');
  }
  const targetData = targetProfile.data() || {};
  if (String(targetData.role || '').toLowerCase() === 'admin') {
    throw new HttpsError('failed-precondition', 'Un compte administrateur ne peut pas être supprimé depuis cette interface.');
  }

  // Supprime d'abord l'identité Auth : aucune suppression partielle ne doit
  // être signalée comme réussie si l'identité Firebase reste active.
  await admin.auth().deleteUser(targetUid);

  // Supprime le profil et toutes ses sous-collections éventuelles.
  await firestore.recursiveDelete(targetRef);
  await firestore.collection('aviator_channels').doc(targetUid).delete().catch(() => undefined);
  if (targetData.username) {
    await firestore.collection('fastGamesGrants').doc(String(targetData.username).toLowerCase()).delete().catch(() => undefined);
  }

  return { ok: true, uid: targetUid };
});
