import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Line, Path, Stop } from 'react-native-svg';
import { GameState, GROWTH_RATE, OPPONENT_ROUNDS, OpponentCashout } from './engine';

const HEIGHT = 364;
const LEFT = 26;
const RIGHT = 12;
const TOP = 24;
const BOTTOM = 31;
const CHART_BG = ['#100F30', '#100F30', '#14123B'];

function getAxis(multiplier: number) {
  const max = Math.max(2.5, Math.ceil((multiplier * 1.15 + 0.2) * 2) / 2);
  const step = max < 3 ? 0.5 : max < 5 ? 1 : max < 10 ? 2 : 4;
  const ticks = [1];
  for (let value = 1 + step; value <= max + 0.001; value += step) ticks.push(Number(value.toFixed(1)));
  return { max, ticks };
}

function stageColor(multiplier: number, phase: GameState['phase']): string {
  if (phase === 'crashed') return '#ed3547';
  if (multiplier >= 9) return '#ff9c22';
  if (multiplier >= 6) return '#e9d625';
  if (multiplier >= 3) return '#35d087';
  if (multiplier >= 1.5) return '#26bce9';
  return '#38aaff';
}

function makePath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(value);
}

function CashoutBubble({ item, top }: { item: OpponentCashout; top: number }) {
  return (
    <View pointerEvents="none" style={[styles.cashoutBubble, { top }]}>
      <Text style={styles.cashoutName}>{item.name}</Text>
      <Text style={styles.cashoutValue}>{money(item.payout)} XAF</Text>
    </View>
  );
}

export function CrashChart({ state }: { state: GameState }) {
  const [width, setWidth] = useState(384);
  const [soundMuted, setSoundMuted] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpProgress = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const animation = Animated.spring(helpProgress, { toValue: helpOpen ? 1 : 0, useNativeDriver: true, speed: 24, bounciness: 5 });
    animation.start();
    return () => animation.stop();
  }, [helpOpen, helpProgress]);
  const helpScale = helpProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] });
  const helpPopoverLift = helpProgress.interpolate({ inputRange: [0, 1], outputRange: [7, 0] });
  const running = state.phase === 'flying' || state.phase === 'crashed';
  const displayMultiplier = running ? state.multiplier : 1;
  const axis = getAxis(displayMultiplier);
  const currentColor = stageColor(displayMultiplier, state.phase);
  const plotWidth = Math.max(20, width - LEFT - RIGHT);
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const elapsed = running ? Math.max(0, Math.log(Math.max(1, state.multiplier)) / GROWTH_RATE) : 0;
  const xWindow = Math.max(6.4, elapsed);
  const endpointX = LEFT + Math.min(1, elapsed / xWindow) * plotWidth;
  const yFor = (value: number) => HEIGHT - BOTTOM - ((Math.max(1, value) - 1) / Math.max(0.5, axis.max - 1)) * plotHeight;
  const endpointY = yFor(displayMultiplier);

  const points = useMemo(() => {
    if (!running) return [];
    const samples = 40;
    const result: Array<{ x: number; y: number }> = [];
    for (let index = 0; index <= samples; index += 1) {
      const t = elapsed * index / samples;
      const multiplierAtTime = Math.exp(t * GROWTH_RATE);
      const x = LEFT + Math.min(1, t / xWindow) * plotWidth;
      const y = yFor(multiplierAtTime);
      result.push({ x, y });
    }
    return result;
  }, [running, elapsed, xWindow, plotWidth, axis.max]);

  const linePath = makePath(points);
  const endPoint = points[points.length - 1];
  const previousPoint = points[Math.max(0, points.length - 2)];
  const tangentX = endPoint ? endPoint.x - previousPoint.x : 1;
  const tangentY = endPoint ? endPoint.y - previousPoint.y : 0;
  const tangentLength = Math.max(1e-6, Math.hypot(tangentX, tangentY));
  const directionX = tangentX / tangentLength;
  const directionY = tangentY / tangentLength;
  const perpendicularX = -directionY;
  const perpendicularY = directionX;
  const headLength = 25;
  const headHalfWidth = 9;
  const headBaseX = endpointX - directionX * headLength;
  const headBaseY = endpointY - directionY * headLength;
  const arrowHeadPath = `M ${endpointX.toFixed(1)} ${endpointY.toFixed(1)} L ${(headBaseX + perpendicularX * headHalfWidth).toFixed(1)} ${(headBaseY + perpendicularY * headHalfWidth).toFixed(1)} L ${(headBaseX - perpendicularX * headHalfWidth).toFixed(1)} ${(headBaseY - perpendicularY * headHalfWidth).toFixed(1)} Z`;
  const areaPath = points.length ? `${linePath} L ${endpointX.toFixed(1)} ${HEIGHT - BOTTOM} L ${LEFT} ${HEIGHT - BOTTOM} Z` : '';
  const cashouts = OPPONENT_ROUNDS[Math.max(0, state.roundNumber - 1) % OPPONENT_ROUNDS.length]
    .filter((item) => item.target <= state.multiplier && state.phase !== 'waiting' && item.target < state.crashPoint)
    .slice(-4);
  const ticks = axis.ticks.filter((tick) => tick <= axis.max + 0.001);
  const colorStops = state.phase === 'crashed'
    ? ['#ed3547', '#ed3547', '#ed3547', '#ed3547']
    : ['#1596e8', '#20c8ee', '#37d27c', currentColor];

  return (
    <View style={styles.chartFrame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: CHART_BG[0] }]} />
      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="line-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colorStops[0]} />
            <Stop offset="34%" stopColor={colorStops[1]} />
            <Stop offset="68%" stopColor={colorStops[2]} />
            <Stop offset="100%" stopColor={colorStops[3]} />
          </SvgGradient>
          <SvgGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={currentColor} stopOpacity="0.20" />
            <Stop offset="100%" stopColor={currentColor} stopOpacity="0.015" />
          </SvgGradient>
        </Defs>
        {ticks.map((tick) => {
          const y = yFor(tick);
          return <Line key={`grid-${tick}`} x1={LEFT} y1={y} x2={width - RIGHT} y2={y} stroke="#ffffff" strokeOpacity={tick === 1 ? 0.13 : 0.055} strokeWidth={1} />;
        })}
        {running && areaPath ? <Path d={areaPath} fill="url(#area-gradient)" /> : null}
        {running && linePath ? <Path d={linePath} fill="none" stroke={state.phase === 'crashed' ? '#ed3547' : 'url(#line-gradient)'} strokeWidth={3.3} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {running && points.length ? <Path d={arrowHeadPath} fill={currentColor} /> : null}
      </Svg>

      {ticks.map((tick) => {
        const y = yFor(tick);
        if (y < TOP - 3 || y > HEIGHT - BOTTOM + 2) return null;
        return <Text key={`label-${tick}`} style={[styles.axisLabel, { top: y - 7 }]}>{`x${tick % 1 ? tick.toFixed(1) : tick}`}</Text>;
      })}

      <Text style={[styles.multiplier, { color: currentColor }]}>{`x${displayMultiplier.toFixed(2)}`}</Text>
      <View style={styles.chartTools}>
        <Pressable onPress={() => setSoundMuted((muted) => !muted)} style={styles.toolButton} accessibilityRole="button" accessibilityLabel={soundMuted ? 'Son coupé' : 'Son activé'}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M3 9v6h4l5 4V5L7 9H3Z" fill="none" stroke="#8a87d0" strokeWidth={1.8} strokeLinejoin="round" />
            {soundMuted ? <Path d="M4 4L21 21" fill="none" stroke="#8a87d0" strokeWidth={1.8} strokeLinecap="round" /> : <Path d="M15 9c2 2 2 4 0 6m3-9c4 4 4 8 0 12" fill="none" stroke="#8a87d0" strokeWidth={1.8} strokeLinecap="round" />}
          </Svg>
        </Pressable>
        <Pressable onPress={() => setHelpOpen((open) => !open)} style={styles.toolButton} accessibilityRole="button" accessibilityLabel="Aide sur le jeu">
          <Animated.View style={{ transform: [{ scale: helpScale }] }}><View style={styles.helpCircle}><Text style={styles.helpGlyph}>?</Text></View></Animated.View>
        </Pressable>
      </View>
      <Animated.View pointerEvents={helpOpen ? 'auto' : 'none'} style={[styles.helpPopover, { opacity: helpProgress, transform: [{ translateY: helpPopoverLift }] }]}>
        <Text style={styles.helpText}>La flèche suit la courbe. Encaissez avant que la manche ne s’arrête.</Text>
      </Animated.View>
      {cashouts.map((item, index) => {
        const y = yFor(item.target);
        const top = Math.max(82, Math.min(HEIGHT - 72, y - 15 - (index % 2) * 22));
        return <CashoutBubble key={`${state.roundNumber}-${item.name}-${item.target}`} item={item} top={top} />;
      })}

      {state.phase === 'crashed' ? <Text style={styles.crashedLabel}>Crashed</Text> : null}

      {state.phase === 'waiting' ? (
        <View style={styles.countdownWrap} pointerEvents="none">
          <Text style={styles.countdown}>{`${(state.remainingMs / 1000).toFixed(1)} s`}</Text>
          <Text style={styles.countdownCaption}>jusqu’au prochain tour</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, state.remainingMs / 8000)) * 100}%` }]} /></View>
        </View>
      ) : null}

      <View style={styles.timeAxis} pointerEvents="none">
        <Text style={styles.timeLabel}>0 s</Text>
        <Text style={[styles.timeLabel, { left: '49%' }]}>5 s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartFrame: { height: HEIGHT, width: '100%', overflow: 'hidden', backgroundColor: '#100F30', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, position: 'relative' },
  axisLabel: { position: 'absolute', left: 6, color: '#a19fbd', fontSize: 9, opacity: 0.6, fontVariant: ['tabular-nums'] },
  multiplier: { position: 'absolute', left: 20, top: 24, fontSize: 48, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'], textShadowColor: '#00000022', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 7 },
  chartTools: { position: 'absolute', top: 22, right: 15, flexDirection: 'row', gap: 14 },
  toolButton: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  helpCircle: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.4, borderColor: '#8a87d0', alignItems: 'center', justifyContent: 'center' },
  helpGlyph: { color: '#8a87d0', fontSize: 13, lineHeight: 16, fontWeight: '600' },
  helpPopover: { position: 'absolute', top: 48, right: 9, width: 210, zIndex: 6, padding: 9, borderRadius: 8, borderWidth: 1, borderColor: '#514b8f', backgroundColor: '#211f4d' },
  helpText: { color: '#e8e6fb', fontSize: 10, lineHeight: 14 },
  crashedLabel: { position: 'absolute', top: 75, left: 20, color: '#ff4b5d', fontSize: 24, fontWeight: '700' },
  cashoutBubble: { position: 'absolute', right: 7, minHeight: 19, maxWidth: '56%', paddingHorizontal: 5, borderRadius: 5, flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: '#0c1239cc' },
  cashoutName: { color: '#b7b6d4', fontSize: 7, fontWeight: '500' },
  cashoutValue: { color: '#7be4ab', fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countdownWrap: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center' },
  countdown: { color: '#a7a2ff', fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countdownCaption: { marginTop: 5, color: '#b8b6d5', fontSize: 12 },
  progressTrack: { marginTop: 14, width: 146, height: 10, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#484386', backgroundColor: '#1d1b4a' },
  progressFill: { height: '100%', backgroundColor: '#6956e9' },
  timeAxis: { position: 'absolute', left: 12, right: 12, bottom: 4, height: 15 },
  timeLabel: { position: 'absolute', left: 0, color: '#817eaa', fontSize: 8 },
  timeTotal: { position: 'absolute', right: 0, color: '#817eaa', fontSize: 8 },
});
