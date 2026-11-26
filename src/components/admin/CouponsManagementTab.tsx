import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import { useBetStore, BetHistoryItem } from '@/store/useBetStore';
import { BetEvent, BetStatus } from '@/types/bet';
import { formatTicketNumberForDisplay } from '@/services/couponCode';
import { normalizeScorePeriods } from '@/utils/scorePeriods';
import { isMortalKombatEvent } from '@/utils/mortalKombat';

// ── Statuts disponibles pour un match individuel ──────────────────────────────
const EVENT_STATUSES: { value: BetStatus; label: string; color: string; bg: string }[] = [
  { value: 'Accepté',    label: 'Accepté',    color: '#2E79C9', bg: '#EBF3FC' },
  { value: 'Gagné',      label: 'Gagné',      color: '#10B981', bg: '#D1FAE5' },
  { value: 'Perdu',      label: 'Perdu',      color: '#EF4444', bg: '#FEE2E2' },
  { value: 'En attente', label: 'En attente', color: '#F59E0B', bg: '#FEF3C7' },
  { value: 'Payé',       label: 'Payé',       color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'Remboursé',  label: 'Remboursé',  color: '#0F766E', bg: '#CCFBF1' },
];

// ── Config badge coupon entier ─────────────────────────────────────────────────
const GLOBAL_COUPON_STATUSES: { value: BetStatus; label: string }[] = [
  { value: 'Gagné', label: 'Gagner' },
  { value: 'Perdu', label: 'Perdu' },
  { value: 'En attente', label: 'En direct' },
  { value: 'Accepté', label: 'Accepter' },
  { value: 'Payé', label: 'Payer' },
];

const COUPON_STATUS_CFG: Record<string, { color: string; bg: string; icon: string }> = {
  Accepté:    { color: '#2E79C9', bg: '#EBF3FC', icon: 'clock-o'       },
  Payé:       { color: '#7C3AED', bg: '#EDE9FE', icon: 'check-circle'   },
  Gagné:      { color: '#10B981', bg: '#D1FAE5', icon: 'trophy'         },
  Perdu:      { color: '#EF4444', bg: '#FEE2E2', icon: 'times-circle'   },
  'En attente': { color: '#F59E0B', bg: '#FEF3C7', icon: 'hourglass-half' },
  Remboursé: { color: '#0F766E', bg: '#CCFBF1', icon: 'refresh' },
};

interface Props {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function CouponsManagementTab({ onSuccess, onError }: Props) {
  const betHistory       = useBetStore((s) => s.betHistory);
  const payCoupon        = useBetStore((s) => s.payCoupon);
  const deleteBetHistory = useBetStore((s) => s.deleteBetHistoryItem);
  const updateEventStatus = useBetStore((s) => s.updateEventStatus);
  const toggleEventLive  = useBetStore((s) => s.toggleEventLive);
  const updateCouponGlobalStatus = useBetStore((s) => s.updateCouponGlobalStatus);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<BetHistoryItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStake, setEditStake] = useState('');
  const [editEvents, setEditEvents] = useState<BetEvent[]>([]);
  const updateCouponComplete = useBetStore((s) => s.updateCouponComplete);
  const [liveTimeDraft, setLiveTimeDraft] = useState('00:00');
  const [liveTimeTarget, setLiveTimeTarget] = useState<{ couponId: string; eventId: string; teamLabel: string } | null>(null);

  const openEditor = (item: BetHistoryItem) => {
    setEditingItem(item);
    setEditDate(item.date);
    setEditStake(String(item.stake));
    setEditEvents((item.events ?? []).map((event) => ({ ...event })));
  };

  const saveEditor = () => {
    if (!editingItem) return;
    const events = (editEvents ?? []).map((event) => {
      // Le score édité est la source unique : les périodes sont recalculées
      // si elles ne correspondent plus au nouveau score final.
      const periods = normalizeScorePeriods(event.score, event.scorePeriod1, event.scorePeriod2);
      const normalizedScore = String(event.score || '').trim();
      const nextBetType = /^score exact/i.test(event.betType || '') && normalizedScore
        ? String(event.betType).replace(/^(score exact)(?:\s*[.:]\s*.*)?$/i, `$1. ${normalizedScore.replace(/\s+/g, '')}`)
        : event.betType;
      return {
        ...event,
        betType: nextBetType,
        score: normalizedScore || event.score,
        scorePeriod1: periods.period1,
        scorePeriod2: periods.period2,
      };
    });
    const totalOdds = Number(events.reduce((acc, event) => acc * (Number(event.odd) || 1), 1).toFixed(3));
    const stakeValue = Number(editStake.replace(',', '.')) || 0;
    updateCouponComplete(editingItem.id, {
      date: editDate.trim() || editingItem.date,
      eventCount: events.length,
      totalOdds,
      stake: stakeValue,
      potentialGain: Number((stakeValue * totalOdds).toFixed(2)),
      status: editingItem.status,
      events,
    });
    setEditingItem(null);
    onSuccess('Coupon modifié sans duplication');
  };

  const formatCurrency = (val: number) =>
    val % 1 !== 0 ? val.toFixed(2) : val.toString();

  // ── Basculer le mode Direct (Live) d'un match ──────────────────────────────
  const handleToggleLive = useCallback(
    (couponId: string, eventId: string, isLive: boolean, teamLabel: string, liveTime?: string) => {
      try {
        toggleEventLive(couponId, eventId, isLive, liveTime);
        onSuccess(isLive ? `Match en DIRECT : ${teamLabel}` : `Match passe en Différé`);
      } catch {
        onError('Erreur lors du changement de statut direct');
      }
    },
    [toggleEventLive, onSuccess, onError]
  );

  const openLiveTimeConfig = (couponId: string, eventId: string, teamLabel: string, currentTime?: string) => {
    setLiveTimeDraft(/^\d{1,3}:\d{2}$/.test(currentTime || '') ? currentTime! : '00:00');
    setLiveTimeTarget({ couponId, eventId, teamLabel });
  };

  const confirmLiveTimeConfig = () => {
    if (!liveTimeTarget) return;
    const normalized = liveTimeDraft.trim().match(/^(\d{1,3}):(\d{2})$/);
    if (!normalized || Number(normalized[2]) > 59) {
      onError('Temps invalide. Utilisez le format MM:SS, par exemple 12:30.');
      return;
    }
    handleToggleLive(
      liveTimeTarget.couponId,
      liveTimeTarget.eventId,
      true,
      liveTimeTarget.teamLabel,
      `${normalized[1].padStart(2, '0')}:${normalized[2]}`,
    );
    setLiveTimeTarget(null);
  };

  // ── Passer le coupon entier en Payé ────────────────────────────────────────
  const handleMarkCouponPaid = useCallback((item: BetHistoryItem) => {
    Alert.alert(
      'Marquer le coupon comme Payé',
      `Coupon N° ${formatTicketNumberForDisplay(item.id)}\nGain : ${formatCurrency(item.potentialGain)} ₣\n\nCette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            try {
              payCoupon(item.id);
              onSuccess(`Coupon N° ${formatTicketNumberForDisplay(item.id)} marqué comme Payé ✓`);
            } catch {
              onError('Erreur lors du paiement du coupon');
            }
          },
        },
      ]
    );
  }, [payCoupon, onSuccess, onError]);

  // ── Supprimer le coupon ─────────────────────────────────────────────────────
  const handleDelete = useCallback((item: BetHistoryItem) => {
    Alert.alert(
      'Supprimer le coupon',
      `Coupon N° ${formatTicketNumberForDisplay(item.id)} — action irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            try {
              deleteBetHistory(item.id);
              onSuccess(`Coupon N° ${formatTicketNumberForDisplay(item.id)} supprimé`);
            } catch {
              onError('Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  }, [deleteBetHistory, onSuccess, onError]);

  // ── Changer le statut d'un match individuel ─────────────────────────────────
  const handleEventStatusChange = useCallback(
    (couponId: string, eventId: string, newStatus: BetStatus, teamLabel: string) => {
      Alert.alert(
        'Changer le statut du match',
        `${teamLabel}\n→ Nouveau statut : ${newStatus}`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Confirmer',
            onPress: () => {
              try {
                updateEventStatus(couponId, eventId, newStatus);
                onSuccess(`Statut mis à jour : ${newStatus}`);
              } catch {
                onError('Erreur lors de la mise à jour du statut');
              }
            },
          },
        ]
      );
    },
    [updateEventStatus, onSuccess, onError]
  );

  if (betHistory.length === 0) {
    return (
      <View style={s.empty}>
        <FontAwesome name="ticket" size={52} color="#D0DDE8" />
        <Text style={s.emptyTitle}>Aucun coupon</Text>
        <Text style={s.emptySubtitle}>Les coupons publiés apparaîtront ici.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: BetHistoryItem }) => {
    const cfg = COUPON_STATUS_CFG[item.status] ?? COUPON_STATUS_CFG['En attente'];
    const isExpanded = expandedId === item.id;
    const events = item.events ?? [];
    const finishedCount = events.filter((ev) => ev.status === 'Gagné').length;
    const totalCount = events.length;

    return (
      <View style={s.card}>
        {/* ── Header coupon ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.cardHeader}
          activeOpacity={0.75}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
        >
          <View style={s.cardLeft}>
            <Text style={s.cardId}>N° {formatTicketNumberForDisplay(item.id)}</Text>
            <Text style={s.cardDate} numberOfLines={1}>{item.date}</Text>
            {totalCount > 0 && (
              <Text style={[
                s.finishedLabel,
                finishedCount === totalCount && { color: '#10B981' }
              ]}>
                {finishedCount} sur {totalCount} terminé{totalCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>

          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <FontAwesome name={cfg.icon as any} size={11} color={cfg.color} style={{ marginRight: 4 }} />
            <Text style={[s.statusText, { color: cfg.color }]}>{item.status}</Text>
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#9EAEC1"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>

        {/* ── Détails ───────────────────────────────────────────────────── */}
        {isExpanded && (
          <View style={s.cardBody}>
            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Matchs</Text>
                <Text style={s.statValue}>{item.eventCount}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Cotes</Text>
                <Text style={[s.statValue, { color: COLORS.primaryBlue }]}>
                  {item.totalOdds.toFixed(2)}
                </Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Mise</Text>
                <Text style={s.statValue}>{formatCurrency(item.stake)} ₣</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>Gain pot.</Text>
                <Text style={[s.statValue, { color: COLORS.successGreen }]}>
                  {formatCurrency(item.potentialGain)} ₣
                </Text>
              </View>
            </View>

            {/* ── Statut global décidé indépendamment des matchs ─────────── */}
            <View style={s.globalStatusSection}>
              <Text style={s.eventsSectionTitle}>Statut global du coupon</Text>
              <View style={s.chipsRow}>
                {GLOBAL_COUPON_STATUSES.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[s.chip, item.status === option.value && s.globalChipActive]}
                    onPress={() => updateCouponGlobalStatus(item.id, option.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipText, item.status === option.value && s.globalChipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Matchs avec sélecteur de statut ───────────────────────── */}
            {events.length > 0 && (
              <View style={s.eventsSection}>
                <Text style={s.eventsSectionTitle}>Matchs — statut individuel (indépendant du coupon)</Text>

                {events.map((ev, idx) => {
                  const evCfg = EVENT_STATUSES.find((x) => x.value === ev.status)
                    ?? EVENT_STATUSES[0];
                  const teamLabel = `${ev.team1} vs ${ev.team2}`;

                  return (
                    <View key={ev.id ?? idx} style={s.eventCard}>
                      {/* Match name + betType */}
                      <View style={s.eventInfo}>
                        <Text style={s.eventTeams} numberOfLines={1}>
                          {ev.team1}{' '}
                          <Text style={s.vsText}>vs</Text>{' '}
                          {ev.team2}
                        </Text>
                        <Text style={s.eventBetType} numberOfLines={1}>
                          {ev.betType} · {ev.odd}
                        </Text>
                      </View>

                      {/* Current status badge */}
                      <View style={[s.evStatusBadge, { backgroundColor: evCfg.bg }]}>
                        <Text style={[s.evStatusText, { color: evCfg.color }]}>
                          {ev.status}
                        </Text>
                      </View>

                      {/* Status selector chips */}
                      <View style={s.chipsRow}>
                        {EVENT_STATUSES.filter((x) => x.value !== ev.status).map((opt) => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[s.chip, { borderColor: opt.color }]}
                            activeOpacity={0.8}
                            onPress={() =>
                              handleEventStatusChange(item.id, ev.id, opt.value, teamLabel)
                            }
                          >
                            <Text style={[s.chipText, { color: opt.color }]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        {/* Icône discrète pour configurer le temps écoulé */}
                        <TouchableOpacity
                          style={s.liveTimeIconButton}
                          activeOpacity={0.75}
                          accessibilityLabel="Configurer le temps écoulé"
                          onPress={() => openLiveTimeConfig(item.id, ev.id, teamLabel, ev.liveTime)}
                        >
                          <Ionicons name="time-outline" size={15} color="#64748B" />
                        </TouchableOpacity>
                        {/* Chip Direct / Live */}
                        <TouchableOpacity
                          style={[
                            s.chip,
                            {
                              borderColor: ev.isLive ? '#DC2626' : '#94A3B8',
                              backgroundColor: ev.isLive ? '#FEE2E2' : 'transparent',
                            },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => ev.isLive
                            ? handleToggleLive(item.id, ev.id, false, teamLabel)
                            : handleToggleLive(
                              item.id,
                              ev.id,
                              true,
                              teamLabel,
                              /^\d{1,3}:\d{2}$/.test(ev.liveTime || '') ? ev.liveTime : '00:00',
                            )
                          }
                        >
                          <Text style={[s.chipText, { color: ev.isLive ? '#DC2626' : '#64748B', fontWeight: '700' }]}>
                            {ev.isLive ? '🔴 EN DIRECT' : '⚡ Passer Direct'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Actions coupon entier ──────────────────────────────────── */}
            <View style={s.actionRow}>
              <TouchableOpacity style={[s.actionBtn, s.editBtn]} activeOpacity={0.85} onPress={() => openEditor(item)}>
                <FontAwesome name="pencil" size={13} color="#FFF" style={{ marginRight: 5 }} />
                <Text style={s.actionBtnText}>Modifier complètement</Text>
              </TouchableOpacity>
              {item.status === 'Accepté' && (
                <TouchableOpacity
                  style={[s.actionBtn, s.payBtn]}
                  activeOpacity={0.85}
                  onPress={() => handleMarkCouponPaid(item)}
                >
                  <FontAwesome name="check-circle" size={13} color="#FFF" style={{ marginRight: 5 }} />
                  <Text style={s.actionBtnText}>Marquer coupon Payé</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.actionBtn, s.deleteBtn]}
                activeOpacity={0.85}
                onPress={() => handleDelete(item)}
              >
                <FontAwesome name="trash" size={13} color="#FFF" style={{ marginRight: 5 }} />
                <Text style={s.actionBtnText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <FlatList
      data={betHistory}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
    />

    <Modal visible={!!editingItem} transparent animationType="slide" onRequestClose={() => setEditingItem(null)}>
      <View style={s.editorBackdrop}>
        <View style={s.editorModal}>
          <Text style={s.editorTitle}>Modifier le coupon</Text>
          <Text style={s.editorHint}>Le même identifiant est conservé, aucune duplication.</Text>
          <Text style={s.editorLabel}>Date / heure</Text>
          <TextInput value={editDate} onChangeText={setEditDate} style={s.editorInput} />
          <Text style={s.editorLabel}>Mise</Text>
          <TextInput value={editStake} onChangeText={setEditStake} keyboardType="decimal-pad" style={s.editorInput} />
          <ScrollView style={s.editorEvents}>
            {editEvents.map((event, index) => (
              <View key={event.id || index} style={s.editorEvent}>
                <Text style={s.editorEventTitle}>{event.team1} vs {event.team2}</Text>
                <Text style={s.editorLabel}>Championnat</Text>
                <TextInput value={event.tournament} onChangeText={(value) => setEditEvents((prev) => prev.map((x, i) => i === index ? { ...x, tournament: value, sport: /mortal\s+(kombat|combat)/i.test(value) ? 'Mortal Kombat' : x.sport } : x))} style={s.editorInput} />
                <View style={s.editorTwoColumns}>
                  <View style={s.editorHalf}><Text style={s.editorLabel}>Score</Text><TextInput value={event.score || ''} onChangeText={(value) => setEditEvents((prev) => prev.map((x, i) => i === index ? { ...x, score: value } : x))} style={s.editorInput} /></View>
                  <View style={s.editorHalf}><Text style={s.editorLabel}>Cote</Text><TextInput value={String(event.odd)} onChangeText={(value) => setEditEvents((prev) => prev.map((x, i) => i === index ? { ...x, odd: Number(value.replace(',', '.')) || 0 } : x))} keyboardType="decimal-pad" style={s.editorInput} /></View>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={s.editorActions}>
            <TouchableOpacity onPress={() => setEditingItem(null)} style={s.editorCancel}><Text style={s.editorCancelText}>Annuler</Text></TouchableOpacity>
            <TouchableOpacity onPress={saveEditor} style={s.editorSave}><Text style={s.editorSaveText}>Enregistrer</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <Modal visible={!!liveTimeTarget} transparent animationType="fade" onRequestClose={() => setLiveTimeTarget(null)}>
      <View style={s.editorBackdrop}>
        <View style={s.liveTimeModal}>
          <Text style={s.editorTitle}>Configurer le temps écoulé</Text>
          <Text style={s.editorHint}>{liveTimeTarget?.teamLabel}</Text>
          <Text style={s.editorLabel}>Temps initial (MM:SS)</Text>
          <TextInput
            value={liveTimeDraft}
            onChangeText={setLiveTimeDraft}
            placeholder="00:00"
            placeholderTextColor="#9EAEC1"
            keyboardType="numbers-and-punctuation"
            maxLength={6}
            style={s.liveTimeInput}
            autoFocus
          />
          <Text style={s.liveTimeHelp}>Exemple : 12:30 pour démarrer à la 12e minute et 30 secondes.</Text>
          <View style={s.editorActions}>
            <TouchableOpacity onPress={() => setLiveTimeTarget(null)} style={s.editorCancel}>
              <Text style={s.editorCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmLiveTimeConfig} style={s.editorSave}>
              <Text style={s.editorSaveText}>Passer en direct</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const s = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.darkBlue,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#9EAEC1',
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    padding: 12,
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EFF6',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardLeft: { flex: 1 },
  cardId: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.darkBlue,
  },
  cardDate: {
    fontSize: 11,
    color: '#9EAEC1',
    marginTop: 2,
    fontWeight: '500',
  },
  finishedLabel: {
    fontSize: 10.5,
    color: '#758C9E',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: { alignItems: 'center' },
  statLabel: {
    fontSize: 10.5,
    color: '#9EAEC1',
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.darkBlue,
  },
  globalStatusSection: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  globalChipActive: { backgroundColor: COLORS.primaryBlue, borderColor: COLORS.primaryBlue },
  globalChipTextActive: { color: '#FFF', fontWeight: '800' },
  editBtn: { backgroundColor: '#2F86D2' },
  editorBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 14 },
  editorModal: { maxHeight: '90%', backgroundColor: '#FFF', borderRadius: 16, padding: 16 },
  editorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.darkBlue },
  editorHint: { fontSize: 11, color: '#758C9E', marginTop: 3, marginBottom: 10 },
  editorLabel: { fontSize: 11, fontWeight: '700', color: '#758C9E', marginBottom: 4, marginTop: 7 },
  editorInput: { minHeight: 38, borderWidth: 1, borderColor: '#DFE7F0', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6, color: COLORS.darkBlue, backgroundColor: '#F8FAFC' },
  editorEvents: { marginTop: 4 },
  editorEvent: { borderTopWidth: 1, borderTopColor: '#E8EFF6', paddingTop: 8, marginTop: 8 },
  editorEventTitle: { fontSize: 13, fontWeight: '700', color: COLORS.darkBlue },
  editorTwoColumns: { flexDirection: 'row', gap: 8 },
  editorHalf: { flex: 1 },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  editorCancel: { backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  editorCancelText: { color: '#64748B', fontWeight: '700' },
  editorSave: { backgroundColor: COLORS.primaryBlue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  editorSaveText: { color: '#FFF', fontWeight: '800' },
  liveTimeModal: { width: '100%', maxWidth: 390, backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignSelf: 'center' },
  liveTimeInput: { minHeight: 48, borderWidth: 1.5, borderColor: COLORS.primaryBlue, borderRadius: 9, paddingHorizontal: 12, color: COLORS.darkBlue, backgroundColor: '#F8FAFC', fontSize: 22, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  liveTimeHelp: { fontSize: 11, color: '#758C9E', lineHeight: 16, marginTop: 7 },
  eventsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  eventsSectionTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9EAEC1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  eventCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8EFF6',
    gap: 8,
  },
  eventInfo: { gap: 2 },
  eventTeams: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkBlue,
  },
  vsText: { color: '#9EAEC1', fontWeight: '400' },
  eventBetType: {
    fontSize: 11,
    color: '#758C9E',
    fontWeight: '500',
  },
  evStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 14,
  },
  evStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: '#FFF',
  },
  liveTimeIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  payBtn: { backgroundColor: COLORS.successGreen },
  deleteBtn: { backgroundColor: '#EF4444' },
  actionBtnText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
