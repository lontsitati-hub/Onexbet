import {
  deleteFirebaseUserProfile,
  registerFirebase,
  renewFirebaseUserSubscription,
  subscribeToUsers,
  updateFirebaseUserDisplayName,
  updateFirebaseUserStatus,
} from '@/services/firebase';
import { useBetStore, type UserListItem } from '@/store/useBetStore';
import {
  getSubscriptionInfo,
  MAX_SUBSCRIPTION_DAYS,
  type SubscriptionInfo,
  validateSubscriptionDays,
} from '@/utils/subscription';
import { getSubscriptionNow } from '@/services/subscriptionAccess';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface UsersManagementTabProps {
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

type ModalMode = 'create' | 'renew' | 'edit';
type FilterTab = 'all' | 'active' | 'suspended';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatExpiry(info: SubscriptionInfo) {
  return info.expiresAtMs === null ? null : dateFormatter.format(new Date(info.expiresAtMs));
}

function isExpired(info: SubscriptionInfo) {
  return info.state === 'expired';
}

export default function UsersManagementTab({ onSuccess, onError }: UsersManagementTabProps) {
  const users = useBetStore((state) => state.usersList);
  const setUsersList = useBetStore((state) => state.setUsersList);
  const sessionRole = useBetStore((state) => state.sessionRole);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [nowMs, setNowMs] = useState(() => getSubscriptionNow());

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [durationDays, setDurationDays] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(getSubscriptionNow()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let unsubscribe = () => { };
    try {
      unsubscribe = subscribeToUsers((firebaseUsers) => {
        const mapped: UserListItem[] = firebaseUsers.map((u) => ({
          id: u.uid || u.id,
          uid: u.uid || u.id,
          username: u.displayName || u.username || 'unknown',
          role: u.role || 'user',
          status: u.status || 'active',
          subscriptionStartedAt: u.subscriptionStartedAt,
          subscriptionDurationDays: u.subscriptionDurationDays,
        }));
        setUsersList(mapped);
      });
    } catch (error) {
      console.warn('Firebase users collection error:', error);
    }
    return () => unsubscribe();
  }, [setUsersList]);

  const reportError = (message: string) => {
    setModalError(message);
    onError?.(message);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalError('');
    setSelectedUser(null);
  };

  const openCreateModal = () => {
    if (sessionRole !== 'admin') {
      reportError("Seul l'administrateur peut créer de nouveaux comptes.");
      return;
    }
    setModalMode('create');
    setSelectedUser(null);
    setNewUsername('');
    setNewPassword('');
    setNewRole('user');
    setDurationDays('');
    setModalError('');
    setModalVisible(true);
  };

  const openRenewModal = (user: UserListItem) => {
    if (sessionRole !== 'admin') {
      reportError("Seul l'administrateur peut gérer les abonnements.");
      return;
    }
    setModalMode('renew');
    setSelectedUser(user);
    setDurationDays('');
    setModalError('');
    setModalVisible(true);
  };
  const openEditModal = (user: UserListItem) => {
    if (sessionRole !== 'admin' || String(user.role).toLowerCase() === 'admin') {
      reportError("Seul l'administrateur peut modifier un compte utilisateur.");
      return;
    }
    setModalMode('edit');
    setSelectedUser(user);
    setNewUsername(user.username);
    setNewPassword('');
    setDurationDays('');
    setModalError('');
    setModalVisible(true);
  };

  const handleUpdateStatus = (user: UserListItem, status: 'active' | 'suspended') => {
    if (sessionRole !== 'admin') {
      reportError("Seul l'administrateur peut suspendre ou activer des comptes.");
      return;
    }

    const info = getSubscriptionInfo(user, getSubscriptionNow());
    if (status === 'active' && isExpired(info)) {
      // Une activation expirée doit obligatoirement passer par le renouvellement.
      openRenewModal(user);
      return;
    }

    Alert.alert(
      status === 'active' ? 'Activer le compte' : 'Suspendre le compte',
      `Voulez-vous vraiment ${status === 'active' ? 'activer' : 'suspendre'} le compte de @${user.username} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: status === 'active' ? 'Activer' : 'Suspendre',
          onPress: async () => {
            try {
              await updateFirebaseUserStatus(String(user.uid || user.id), status);
              onSuccess?.(`Compte @${user.username} mis à jour.`);
            } catch (error: any) {
              const message = error?.message || 'Impossible de mettre à jour le compte.';
              reportError(message);
            }
          },
        },
      ],
    );
  };

  const handleDeleteUser = (user: UserListItem) => {
    if (sessionRole !== 'admin') {
      reportError("Seul l'administrateur peut supprimer des comptes.");
      return;
    }

    Alert.alert(
      'Supprimer le profil Firestore',
      `Voulez-vous vraiment supprimer le profil Firestore de @${user.username} ? Le compte Firebase Authentication et ses sous-collections resteront présents, mais l’utilisateur ne pourra plus utiliser son profil dans l’application.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFirebaseUserProfile(String(user.uid || user.id));
              onSuccess?.(`Profil Firestore de @${user.username} supprimé. Le compte Authentication est conservé.`);
            } catch (error: any) {
              reportError(error?.message || 'Impossible de supprimer le profil Firestore.');
            }
          },
        },
      ],
    );
  };
  const handleUpdateUser = async () => {
    if (saving) return;
    if (sessionRole !== 'admin' || !selectedUser) {
      reportError("Seul l'administrateur peut modifier un compte.");
      return;
    }
    const displayName = newUsername.trim();
    if (!displayName) {
      reportError('Le nom affiché ne peut pas être vide.');
      return;
    }
    if (displayName === selectedUser.username) {
      reportError('Aucune modification à enregistrer.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      await updateFirebaseUserDisplayName(String(selectedUser.uid || selectedUser.id), displayName);
      closeModal();
      onSuccess?.(`Nom affiché de @${selectedUser.username} mis à jour dans Firestore.`);
    } catch (error: any) {
      reportError(error?.message || 'Impossible de modifier le nom affiché.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (saving) return;
    if (sessionRole !== 'admin') {
      reportError("Seul l'administrateur peut créer de nouveaux comptes.");
      return;
    }

    const cleanUser = newUsername.trim();
    const cleanPass = newPassword.trim();
    if (!cleanUser || !cleanPass) {
      reportError('Veuillez remplir le nom d’utilisateur et le mot de passe.');
      return;
    }

    let validatedDays: number | undefined;
    try {
      // Aucun défaut : les utilisateurs doivent fournir une durée explicite.
      if (newRole === 'user') validatedDays = validateSubscriptionDays(durationDays);
    } catch (error: any) {
      reportError(error?.message || `La durée doit être comprise entre 1 et ${MAX_SUBSCRIPTION_DAYS} jours.`);
      return;
    }

    setSaving(true);
    setModalError('');
    try {
      await registerFirebase(cleanUser, cleanPass, newRole, 'active', validatedDays);
      closeModal();
      onSuccess?.(`Utilisateur @${cleanUser} créé.`);
    } catch (error: any) {
      let message = error?.message || 'Une erreur est survenue lors de la création.';
      if (error?.code === 'auth/email-already-in-use') message = "Ce nom d'utilisateur existe déjà.";
      if (error?.code === 'auth/weak-password') message = 'Le mot de passe doit comporter au moins 6 caractères.';
      reportError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async () => {
    if (saving) return;
    if (sessionRole !== 'admin' || !selectedUser) {
      reportError("Seul l'administrateur peut renouveler un abonnement.");
      return;
    }

    let days: number;
    try {
      days = validateSubscriptionDays(durationDays);
    } catch (error: any) {
      reportError(error?.message || `La durée doit être comprise entre 1 et ${MAX_SUBSCRIPTION_DAYS} jours.`);
      return;
    }

    setSaving(true);
    setModalError('');
    try {
      await renewFirebaseUserSubscription(String(selectedUser.uid || selectedUser.id), days);
      closeModal();
      onSuccess?.(`Abonnement de @${selectedUser.username} renouvelé pour ${days} jours.`);
    } catch (error: any) {
      reportError(error?.message || 'Impossible de renouveler cet abonnement.');
    } finally {
      setSaving(false);
    }
  };

  const enrichedUsers = useMemo(() => users.map((user) => ({
    user,
    info: getSubscriptionInfo(user, nowMs),
  })), [users, nowMs]);

  const filteredUsers = enrichedUsers.filter(({ user, info }) => {
    const matchSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (filterTab === 'all') return true;
    const effectiveStatus = info.state === 'expired' ? 'suspended' : user.status;
    return effectiveStatus === filterTab;
  });

  const totalCount = users.length;
  const activeCount = enrichedUsers.filter(({ user, info }) => info.state !== 'expired' && user.status === 'active').length;
  const suspendedCount = enrichedUsers.filter(({ user, info }) => info.state === 'expired' || user.status === 'suspended').length;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#3882C7' }]}>
          <Text style={styles.statVal}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total comptes</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
          <Text style={styles.statVal}>{activeCount}</Text>
          <Text style={styles.statLabel}>Actifs</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
          <Text style={styles.statVal}>{suspendedCount}</Text>
          <Text style={styles.statLabel}>Suspendus / expirés</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <FontAwesome name="search" size={14} color="#758C9E" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un utilisateur..."
            placeholderTextColor="#758C9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal} activeOpacity={0.8}>
          <FontAwesome name="user-plus" size={14} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.addBtnText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterTabs}>
        {(['all', 'active', 'suspended'] as FilterTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTabBtn, filterTab === tab && styles.filterTabBtnActive]}
            onPress={() => setFilterTab(tab)}
          >
            <Text style={[styles.filterTabLabel, filterTab === tab && styles.filterTabLabelActive]}>
              {tab === 'all' ? 'Tous' : tab === 'active' ? 'Actifs' : 'Suspendus / expirés'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollListContent}>
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#758C9E" />
            <Text style={styles.emptyText}>Aucun utilisateur trouvé.</Text>
          </View>
        ) : filteredUsers.map(({ user, info }) => {
          const expired = isExpired(info);
          const effectiveSuspended = expired || user.status === 'suspended' || info.state === 'suspended';
          const expiry = formatExpiry(info);
          const isAdmin = String(user.role).toLowerCase() === 'admin';
          return (
            <View key={String(user.id)} style={styles.userCard}>
              <View style={styles.cardInfo}>
                <View style={styles.userMainInfo}>
                  <View style={styles.avatarMini}>
                    <FontAwesome name="user" size={14} color="#0C2751" />
                  </View>
                  <View style={styles.userIdentity}>
                    <Text style={styles.userNameText}>@{user.username}</Text>
                    <View style={styles.roleBadgeContainer}>
                      <Text style={[styles.roleBadge, isAdmin ? styles.roleAdmin : styles.roleUser]}>
                        {String(user.role).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.statusTag, expired ? styles.statusExpired : effectiveSuspended ? styles.statusSuspended : styles.statusActive]}>
                  <Text style={[styles.statusTagText, expired ? styles.statusExpiredText : effectiveSuspended ? styles.statusSuspendedText : styles.statusActiveText]}>
                    {expired ? 'Expiré' : effectiveSuspended ? 'Suspendu' : isAdmin ? 'Admin' : 'Actif'}
                  </Text>
                </View>
              </View>

              <View style={styles.subscriptionSummary}>
                {isAdmin ? (
                  <Text style={styles.subscriptionText}>Accès administrateur — abonnement non requis</Text>
                ) : info.state === 'not_configured' ? (
                  <Text style={styles.subscriptionWarning}>Durée non définie — contactez administrateur</Text>
                ) : (
                  <>
                    <Text style={[styles.subscriptionText, expired && styles.subscriptionWarning]}>
                      {expired ? 'Abonnement expiré' : `${info.remainingDays ?? 0} jour${info.remainingDays === 1 ? '' : 's'} restant${info.remainingDays === 1 ? '' : 's'}`}
                    </Text>
                    {expiry && <Text style={styles.expiryText}>Expire le {expiry}</Text>}
                  </>
                )}
              </View>

              <View style={styles.cardActions}>
                {!isAdmin && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnBlue]} onPress={() => openRenewModal(user)} disabled={saving}>
                    <FontAwesome name="calendar-plus-o" size={12} color="#3882C7" />
                    <Text style={styles.actionBtnTextBlue}>{info.state === 'not_configured' ? 'Définir durée' : 'Renouveler'}</Text>
                  </TouchableOpacity>
                )}
                {!isAdmin && (effectiveSuspended ? (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={() => handleUpdateStatus(user, 'active')} disabled={saving}>
                    <FontAwesome name="check" size={12} color="#10B981" />
                    <Text style={styles.actionBtnTextGreen}>{expired ? 'Activer + durée' : 'Activer'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOrange]} onPress={() => handleUpdateStatus(user, 'suspended')} disabled={saving}>
                    <FontAwesome name="ban" size={12} color="#F59E0B" />
                    <Text style={styles.actionBtnTextOrange}>Suspendre</Text>
                  </TouchableOpacity>
                ))}
                {!isAdmin && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnBlue]} onPress={() => openEditModal(user)} disabled={saving}>
                    <FontAwesome name="pencil" size={12} color="#3882C7" />
                    <Text style={styles.actionBtnTextBlue}>Modifier</Text>
                  </TouchableOpacity>
                )}
                {!isAdmin && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed]} onPress={() => handleDeleteUser(user)} disabled={saving}>
                    <FontAwesome name="trash" size={12} color="#EF4444" />
                    <Text style={styles.actionBtnTextRed}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => { if (!saving) closeModal(); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {modalMode === 'create' ? 'Créer un utilisateur' : modalMode === 'edit' ? `Nom affiché de @${selectedUser?.username || ''}` : selectedUser?.subscriptionDurationDays ? 'Renouveler l’abonnement' : 'Définir une durée'}
                </Text>
                <TouchableOpacity onPress={closeModal} disabled={saving}>
                  <Ionicons name="close" size={24} color="#758C9E" />
                </TouchableOpacity>
              </View>

              {modalMode === 'renew' ? (
                <Text style={styles.modalDescription}>Compte : @{selectedUser?.username}</Text>
              ) : modalMode === 'edit' ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nom affiché</Text>
                    <TextInput
                      style={[styles.modalInput, modalError && styles.modalInputError]}
                      placeholder="Ex : nomdutilisateur"
                      placeholderTextColor="#758C9E"
                      value={newUsername}
                      onChangeText={(value) => { setNewUsername(value); setModalError(''); }}
                      autoCapitalize="none"
                      maxLength={64}
                      editable={!saving}
                    />
                    <Text style={styles.inputHint}>Enregistré directement dans le profil Firestore. L’identifiant de connexion et le mot de passe Firebase Authentication restent inchangés.</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nom d’utilisateur</Text>
                    <TextInput style={styles.modalInput} placeholder="Ex : nomdutilisateur" placeholderTextColor="#758C9E" value={newUsername} onChangeText={setNewUsername} autoCapitalize="none" />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Mot de passe</Text>
                    <TextInput style={styles.modalInput} placeholder="Saisir le mot de passe" placeholderTextColor="#758C9E" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Rôle</Text>
                    <View style={styles.roleSelectRow}>
                      <TouchableOpacity style={[styles.roleSelectBtn, newRole === 'user' && styles.roleSelectBtnActive]} onPress={() => setNewRole('user')} disabled={saving}>
                        <Text style={[styles.roleSelectLabel, newRole === 'user' && styles.roleSelectLabelActive]}>Utilisateur</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.roleSelectBtn, newRole === 'admin' && styles.roleSelectBtnActive]} onPress={() => setNewRole('admin')} disabled={saving}>
                        <Text style={[styles.roleSelectLabel, newRole === 'admin' && styles.roleSelectLabelActive]}>Admin</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {modalMode === 'create' && newRole === 'admin' ? (
                <Text style={styles.adminHint}>Les comptes admin sont exemptés d’abonnement.</Text>
              ) : modalMode === 'create' || modalMode === 'renew' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Durée en jours *</Text>
                  <TextInput
                    style={[styles.modalInput, modalError && styles.modalInputError]}
                    placeholder="1 à 36500 jours"
                    placeholderTextColor="#758C9E"
                    value={durationDays}
                    onChangeText={(value) => { setDurationDays(value); setModalError(''); }}
                    keyboardType="number-pad"
                    editable={!saving}
                  />
                  <Text style={styles.inputHint}>Entier requis, sans fraction ni zéro. Les comptes legacy restent sans durée tant qu’un admin ne la définit pas.</Text>
                </View>
              ) : null}

              {!!modalError && <Text style={styles.inlineError}>{modalError}</Text>}

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
                onPress={modalMode === 'create' ? handleCreateUser : modalMode === 'edit' ? handleUpdateUser : handleRenew}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>{modalMode === 'create' ? 'Enregistrer le compte' : modalMode === 'edit' ? 'Enregistrer le nom affiché' : 'Enregistrer la durée'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 8, padding: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  statVal: { fontSize: 18, fontWeight: '800', color: '#0C2751' },
  statLabel: { fontSize: 11, color: '#758C9E', marginTop: 2, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 13, color: '#0C2751', fontWeight: '600' },
  addBtn: { backgroundColor: '#0C2751', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  filterTabs: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 8, padding: 3, marginBottom: 16 },
  filterTabBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  filterTabBtnActive: { backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  filterTabLabel: { fontSize: 11, fontWeight: '600', color: '#5C7C99', textAlign: 'center' },
  filterTabLabelActive: { color: '#0C2751', fontWeight: '700' },
  scrollList: { flex: 1 },
  scrollListContent: { paddingBottom: 30 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: '#758C9E', marginTop: 8, fontWeight: '600' },
  userCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  userMainInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  userIdentity: { flex: 1 },
  avatarMini: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  userNameText: { fontSize: 14, fontWeight: '700', color: '#0C2751' },
  roleBadgeContainer: { flexDirection: 'row', marginTop: 2 },
  roleBadge: { fontSize: 9, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4, overflow: 'hidden' },
  roleAdmin: { backgroundColor: '#E0F2FE', color: '#0284C7' },
  roleUser: { backgroundColor: '#F1F5F9', color: '#475569' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusActive: { backgroundColor: '#D1FAE5' },
  statusSuspended: { backgroundColor: '#FEF3C7' },
  statusExpired: { backgroundColor: '#FEE2E2' },
  statusTagText: { fontSize: 11, fontWeight: '700' },
  statusActiveText: { color: '#059669' },
  statusSuspendedText: { color: '#D97706' },
  statusExpiredText: { color: '#DC2626' },
  subscriptionSummary: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 9, marginBottom: 10 },
  subscriptionText: { color: '#3882C7', fontSize: 12, fontWeight: '700' },
  subscriptionWarning: { color: '#C2410C', fontSize: 12, fontWeight: '700' },
  expiryText: { color: '#758C9E', fontSize: 11, marginTop: 3, fontWeight: '600' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  actionBtnBlue: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  actionBtnGreen: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  actionBtnOrange: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  actionBtnRed: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionBtnTextBlue: { fontSize: 11.5, fontWeight: '700', color: '#3882C7' },
  actionBtnTextGreen: { fontSize: 11.5, fontWeight: '700', color: '#10B981' },
  actionBtnTextOrange: { fontSize: 11.5, fontWeight: '700', color: '#F59E0B' },
  actionBtnTextRed: { fontSize: 11.5, fontWeight: '700', color: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 12, width: '100%', maxWidth: 390, maxHeight: '90%', overflow: 'hidden' },
  modalScrollContent: { padding: 20, paddingBottom: 26 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0C2751', marginRight: 12 },
  modalDescription: { color: '#5C7C99', fontSize: 13, fontWeight: '600', marginBottom: 16 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#5C7C99', marginBottom: 6 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 10, height: 40, fontSize: 13, color: '#0C2751', fontWeight: '600' },
  modalInputError: { borderColor: '#DC2626' },
  inputHint: { fontSize: 10.5, color: '#758C9E', lineHeight: 15, marginTop: 6 },
  adminHint: { color: '#3882C7', backgroundColor: '#EFF6FF', borderRadius: 6, padding: 10, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  inlineError: { color: '#B91C1C', backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 6, padding: 9, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  roleSelectRow: { flexDirection: 'row', gap: 10 },
  roleSelectBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  roleSelectBtnActive: { backgroundColor: '#0C2751', borderColor: '#0C2751' },
  roleSelectLabel: { fontSize: 12.5, fontWeight: '600', color: '#5C7C99' },
  roleSelectLabelActive: { color: '#FFF', fontWeight: '700' },
  submitBtn: { backgroundColor: '#3882C7', borderRadius: 6, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
