import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  value?: Date;
  onClose: () => void;
  onConfirm: (value: Date) => void;
  title?: string;
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function DateTimePickerModal({ visible, value, onClose, onConfirm, title = 'Choisir la date et l’heure' }: Props) {
  const initial = value && !Number.isNaN(value.getTime()) ? value : new Date();
  const [draft, setDraft] = useState(() => new Date(initial));
  const [monthCursor, setMonthCursor] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [hourText, setHourText] = useState(() => String(initial.getHours()).padStart(2, '0'));
  const [minuteText, setMinuteText] = useState(() => String(initial.getMinutes()).padStart(2, '0'));

  React.useEffect(() => {
    if (!visible) return;
    const next = value && !Number.isNaN(value.getTime()) ? new Date(value) : new Date();
    setDraft(next);
    setMonthCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    setHourText(String(next.getHours()).padStart(2, '0'));
    setMinuteText(String(next.getMinutes()).padStart(2, '0'));
  }, [visible, value]);

  const days = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: offset + count }, (_, i) => i < offset ? null : i - offset + 1);
  }, [monthCursor]);

  const confirm = () => {
    const next = new Date(draft);
    const hour = Math.min(23, Math.max(0, Number.parseInt(hourText, 10) || 0));
    const minute = Math.min(59, Math.max(0, Number.parseInt(minuteText, 10) || 0));
    next.setHours(hour, minute, 0, 0);
    onConfirm(next);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
          </View>
          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.nav} onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={18} color="#1976D2" /></TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}</Text>
            <TouchableOpacity style={styles.nav} onPress={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={18} color="#1976D2" /></TouchableOpacity>
          </View>
          <View style={styles.weekRow}>{WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.grid}>
            {days.map((day, index) => day === null ? <View key={`empty-${index}`} style={styles.day} /> : (
              <TouchableOpacity key={day} style={[styles.day, draft.getDate() === day && draft.getMonth() === monthCursor.getMonth() && draft.getFullYear() === monthCursor.getFullYear() && styles.dayActive]} onPress={() => setDraft(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day, draft.getHours(), draft.getMinutes()))}>
                <Text style={[styles.dayText, draft.getDate() === day && draft.getMonth() === monthCursor.getMonth() && draft.getFullYear() === monthCursor.getFullYear() && styles.dayTextActive]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.timeSection}>
            <Text style={styles.timeLabel}>HEURE</Text>
            <View style={styles.timeRow}>
              <TextInput value={hourText} onChangeText={(v) => setHourText(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={styles.timeInput} maxLength={2} />
              <Text style={styles.colon}>:</Text>
              <TextInput value={minuteText} onChangeText={(v) => setMinuteText(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={styles.timeInput} maxLength={2} />
              <Text style={styles.timeHint}>24 h</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Annuler</Text></Pressable>
            <Pressable onPress={confirm} style={styles.confirm}><Text style={styles.confirmText}>Valider</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 },
  modal: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, maxWidth: 420, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: '#16324F' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  nav: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 15, fontWeight: '700', color: '#16324F' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.28%', textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#94A3B8', paddingBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.28%', height: 38, alignItems: 'center', justifyContent: 'center' },
  dayActive: { borderRadius: 19, backgroundColor: '#2F86D2' },
  dayText: { fontSize: 13, color: '#334155', fontWeight: '600' },
  dayTextActive: { color: '#FFF', fontWeight: '800' },
  timeSection: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 12, paddingTop: 12 },
  timeLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginBottom: 7 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeInput: { width: 54, height: 40, borderRadius: 9, borderWidth: 1, borderColor: '#CBD5E1', textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#16324F', backgroundColor: '#F8FAFC' },
  colon: { fontSize: 20, fontWeight: '800', color: '#64748B', marginHorizontal: 7 },
  timeHint: { marginLeft: 10, color: '#64748B', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  cancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, backgroundColor: '#F1F5F9' },
  cancelText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  confirm: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, backgroundColor: '#2F86D2' },
  confirmText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
});
