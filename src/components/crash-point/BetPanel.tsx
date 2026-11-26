import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { Bet, BetSettings, GameState } from './engine';

const PURPLE = ['#9078ff', '#6048da'] as [string, string];
const GREEN = ['#25d9a1', '#078c67'] as [string, string];
const ORANGE = ['#ffc34a', '#f07b0a'] as [string, string];
const STEP_PURPLE = ['#9b88ff', '#6253d1'] as [string, string];
const QUICK_PURPLE = ['#4b438f', '#29225b'] as [string, string];
const QUICK_AMOUNTS = [200, 3000, 10000, 70000];

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(value);
}

function Toggle({ value, label, onPress, disabled = false }: { value: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.toggle, disabled && styles.muted]} accessibilityRole="checkbox" accessibilityState={{ checked: value, disabled }}>
      <View style={[styles.checkBox, value && styles.checkBoxOn]}>{value ? <Text style={styles.check}>✓</Text> : null}</View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

function GradientSurface({ colors, radius, style, children }: { colors: [string, string]; radius: number; style: object; children: React.ReactNode }) {
  const gradientId = `bet-gradient-${colors[0].slice(1)}-${colors[1].slice(1)}`;
  return (
    <View style={[styles.gradientSurface, style]}>
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
            <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0.22" y2="1">
            <Stop offset="0" stopColor={colors[0]} stopOpacity="1" />
            <Stop offset="0.52" stopColor={colors[0]} stopOpacity="0.96" />
            <Stop offset="1" stopColor={colors[1]} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={radius} fill={`url(#${gradientId})`} />
        <Rect x="1" y="1" width="98%" height="38%" rx={Math.max(1, radius - 1)} fill="#ffffff" opacity="0.08" />
      </Svg>
      {children}
    </View>
  );
}

export interface BetPanelProps {
  index: number;
  bet: Bet | null;
  settings: BetSettings;
  phase: GameState['phase'];
  multiplier: number;
  canRemove: boolean;
  allowAutoSettings?: boolean;
  allowCancel?: boolean;
  onPlace: (amount: number) => void;
  onCancel: () => void;
  onCashOut: () => void;
  onRemove: () => void;
  onSetting: (patch: Partial<BetSettings>) => void;
}

export function BetPanel({ index, bet, settings, phase, multiplier, canRemove, allowAutoSettings = true, allowCancel = true, onPlace, onCancel, onCashOut, onRemove, onSetting }: BetPanelProps) {
  const locked = phase === 'flying' || bet?.status === 'pending' || bet?.status === 'queued' || bet?.status === 'live';
  const [amountText, setAmountText] = React.useState(String(bet?.amount ?? 400));
  React.useEffect(() => { if (bet) setAmountText(String(bet.amount)); }, [bet?.amount]);
  const amount = Math.max(0, Number.parseInt(amountText, 10) || 0);
  const live = bet?.status === 'live';
  const pending = bet?.status === 'pending';
  const queued = bet?.status === 'queued';
  const cashed = bet?.status === 'cashed';
  const lost = bet?.status === 'lost';
  const canQueueNext = phase === 'crashed' && (!bet || lost || cashed);
  const payout = bet && live ? bet.amount * multiplier : bet?.payout ?? 0;
  const actionColors = pending || queued ? GREEN : live ? ORANGE : PURPLE;
  const actionLabel = pending || queued ? 'ACCEPTÉ' : live ? `OBTENIR\n${money(payout)} XAF` : cashed && !canQueueNext ? 'ENCAISSÉ' : lost || canQueueNext ? 'PARI\nsur le prochain tour' : 'PARI';
  const actionDisabled = pending || queued ? !allowCancel : live ? false : !canQueueNext && (phase === 'flying' || cashed || lost);

  const actionPress = () => {
    if (live) onCashOut();
    else if ((pending || queued) && allowCancel) onCancel();
    else if (!actionDisabled && (phase === 'waiting' || canQueueNext) && amount > 0) onPlace(amount);
  };

  return (
    <View style={styles.card}>
      <View style={styles.settingsRow}>
        <Toggle value={settings.autoPlay} label="Jeu\nautomatique" disabled={!allowAutoSettings} onPress={() => onSetting({ autoPlay: !settings.autoPlay })} />
        <Toggle value={settings.autoCash} label="Encaissement\nauto" disabled={!allowAutoSettings} onPress={() => onSetting({ autoCash: !settings.autoCash })} />
        <View style={styles.targetWrap}>
          <TextInput
            value={settings.autoCashTarget.toFixed(2)}
            onChangeText={(value) => onSetting({ autoCashTarget: Math.max(1.01, Number.parseFloat(value) || 2) })}
            keyboardType="decimal-pad"
            editable={!locked && allowAutoSettings}
            style={[styles.targetInput, !allowAutoSettings && styles.muted]}
            selectTextOnFocus
            accessibilityLabel={`Multiplicateur d’encaissement automatique, pari ${index + 1}`}
          />
          <Text style={styles.targetX}>×</Text>
        </View>
        {canRemove ? <Pressable onPress={onRemove} style={styles.removeButton} accessibilityRole="button" accessibilityLabel={`Supprimer le pari ${index + 1}`}><Text style={styles.removeText}>×</Text></Pressable> : null}
      </View>

      <View style={styles.betRow}>
        <Pressable disabled={locked} onPress={() => setAmountText(String(Math.max(100, amount - 200)))} style={({ pressed }) => [styles.stepButtonWrap, pressed && styles.buttonPressed, locked && styles.muted]} accessibilityRole="button" accessibilityLabel={`Diminuer la mise du pari ${index + 1}`}><GradientSurface colors={STEP_PURPLE} radius={9} style={styles.stepButton}><Text style={styles.stepText}>−</Text></GradientSurface></Pressable>
        <View style={[styles.amountField, locked && styles.muted]}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            editable={!locked}
            maxLength={8}
            style={styles.amountInput}
            selectTextOnFocus
            accessibilityLabel={`Montant du pari ${index + 1} en XAF`}
          />
        </View>
        <Pressable disabled={locked} onPress={() => setAmountText(String(amount + 200))} style={({ pressed }) => [styles.stepButtonWrap, pressed && styles.buttonPressed, locked && styles.muted]} accessibilityRole="button" accessibilityLabel={`Augmenter la mise du pari ${index + 1}`}><GradientSurface colors={STEP_PURPLE} radius={9} style={styles.stepButton}><Text style={styles.stepText}>+</Text></GradientSurface></Pressable>
        <Pressable onPress={actionPress} disabled={actionDisabled} style={styles.actionWrap} accessibilityRole="button" accessibilityLabel={actionLabel.replace('\n', ' ')}>
          {({ pressed }) => <View style={[styles.actionDepth, pressed && styles.actionDepthPressed]}>
            <GradientSurface colors={actionColors} radius={12} style={[styles.actionButton, (pending || queued || live) && styles.actionActive, actionDisabled && styles.actionDisabled, pressed && styles.actionPressed]}>
              <Text style={[styles.actionText, live && styles.actionTextLive]}>{actionLabel}</Text>
            </GradientSurface>
          </View>}
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map((preset) => (
            <Pressable key={preset} disabled={locked} onPress={() => setAmountText(String(preset))} style={({ pressed }) => [styles.quickButtonWrap, pressed && styles.buttonPressed, locked && styles.muted]} accessibilityRole="button" accessibilityLabel={`Mise rapide ${preset} XAF, pari ${index + 1}`}>
            <GradientSurface colors={QUICK_PURPLE} radius={13} style={styles.quickButton}><Text style={styles.quickText}>{preset}</Text></GradientSurface>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 8, marginTop: 7, padding: 9, borderRadius: 16, borderWidth: 1, borderColor: '#393662', backgroundColor: '#262058', shadowColor: '#08061e', shadowOpacity: 0.38, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  settingsRow: { minHeight: 29, flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  toggle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  checkBox: { width: 15, height: 15, marginTop: 1, borderRadius: 4, borderWidth: 1, borderColor: '#8d89c4', alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: '#6555de', borderColor: '#9b91ff' },
  check: { color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  toggleLabel: { color: '#f1f0fb', fontSize: 10, lineHeight: 12, fontWeight: '600' },
  targetWrap: { width: 76, height: 28, position: 'relative' },
  targetInput: { height: 28, paddingHorizontal: 12, paddingVertical: 0, borderRadius: 7, textAlign: 'right', color: '#f7f6ff', backgroundColor: '#121034', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  targetX: { position: 'absolute', left: 8, top: 5, color: '#b7b4d7', fontSize: 13 },
  removeButton: { position: 'absolute', right: -4, top: -13, width: 21, height: 21, borderRadius: 11, borderWidth: 1, borderColor: '#8d89c4', backgroundColor: '#25234f', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  removeText: { color: '#fff', fontSize: 16, lineHeight: 18 },
  betRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 5 },
  gradientSurface: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stepButtonWrap: { width: 38, height: 32, borderRadius: 9, shadowColor: '#130d3b', shadowOpacity: 0.72, shadowRadius: 1, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  stepButton: { width: '100%', height: '100%', borderRadius: 9, borderWidth: 1, borderColor: '#9b8fff', shadowColor: '#17113d', shadowOpacity: 0.45, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  stepText: { color: '#fff', fontSize: 21, lineHeight: 23, fontWeight: '600' },
  buttonPressed: { opacity: 0.78, transform: [{ translateY: 1 }] },
  amountField: { flex: 1, minWidth: 58, height: 36, borderRadius: 8, backgroundColor: '#352d7d', justifyContent: 'center', alignItems: 'center' },
  amountInput: { width: '100%', height: 36, paddingHorizontal: 2, paddingVertical: 0, textAlign: 'center', textAlignVertical: 'center', color: '#fff', fontSize: 17, lineHeight: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actionWrap: { width: '39%', minWidth: 108, alignSelf: 'stretch', marginLeft: 3, paddingBottom: 3 },
  actionDepth: { flex: 1, borderRadius: 12, shadowColor: '#120b3a', shadowOpacity: 0.72, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  actionDepthPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  actionButton: { flex: 1, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: '#c0b5ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, shadowColor: '#9a8cff', shadowOpacity: 0.84, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  actionActive: { borderColor: '#ffffff35' },
  actionDisabled: { opacity: 0.62 },
  actionPressed: { shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  actionText: { textAlign: 'center', color: '#fff', fontSize: 13, lineHeight: 15, letterSpacing: 0.25, fontWeight: '800' },
  actionTextLive: { color: '#23142b' },
  quickRow: { marginTop: 5, flexDirection: 'row', gap: 5 },
  quickButtonWrap: { flex: 1, minWidth: 0, height: 28, borderRadius: 13, shadowColor: '#130d3b', shadowOpacity: 0.68, shadowRadius: 1, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  quickButton: { width: '100%', height: '100%', borderRadius: 13, borderWidth: 1, borderColor: '#514a91', alignItems: 'center', justifyContent: 'center' },
  quickText: { color: '#d4d2e7', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  muted: { opacity: 0.47 },
});
