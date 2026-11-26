import React, { useEffect, useMemo, useState } from "react";
import { Image, Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { timeForMultiplier } from "@/services/aviatorLogic";
import { AVIATOR_PROFILE_AVATARS, getRandomAviatorAvatars } from "@/components/aviator/avatarAssets";
import { createFlightProjection } from "./flightProjection";

const PLANE_IMG = require("@/assets/game/plane-official.png");
// Overlay transparent : UFC, Aviator, Official Partners et SPRIBE reposent directement
// sur le fond radial du jeu, sans rectangle noir embarqué.
const PROMO_IMG = require("@/assets/game/ufc-aviator-promo-overlay-no-bar.png");

interface Props {
  phase: "waiting" | { kind: "flying"; multiplier: number } | { kind: "crashed"; multiplier: number };
  countdown?: number;
  connectedPlayers?: number;
  canvasHeightHint?: number;
  /** Notifications de gain en bulles vertes (fidèle à la vidéo officielle) */
  winNotifications?: Array<{ id: number; at: number; payout: number }>;
}

/**
 * Le viewport réutilise directement les fonctions de la logique centrale :
 * l’avion, la courbe et le multiplicateur partagent ainsi le même temps,
 * y compris la légère accélération des premières secondes.
 */

/**
 * Comportement fidèle au vrai Aviator :
 * - Z-order strict : fond (sunburst) < courbe < multiplicateur < avion
 * - Caméra défilante (v17) : l'avion est stabilisé au centre-droit du cadre,
 *   la courbe et le décor défilent vers la gauche — impression de vol continu.
 *   Fenêtre temporelle de 4,5 s : au décollage l'avion accélère du coin
 *   bas-gauche vers sa position cible, puis reste fixe pendant que le monde
 *   avance. Aux cotes élevées la courbe ne s'aplatit jamais.
 * - Au crash : l'avion "fuit" hors du cadre vers le haut, puis message « Pas de chance »
 */

function useEscaped(planeY: number, crashed: boolean, elapsedMs: number) {
  // position verticale de l'avion pendant la fuite (sortie du cadre vers le haut)
  const [escapeOffset, setEscapeOffset] = useState(0);
  useEffect(() => {
    if (!crashed) {
      setEscapeOffset(0);
      return;
    }
    // Fuite « en grande vitesse » au crash : hors du cadre en 420 ms avec
    // une accélération rapide (le vrai Aviator : l'avion décolle du cadre).
    const start = performance.now();
    let raf = 0;
    const anim = () => {
      const dt = performance.now() - start;
      const progress = Math.min(dt / 420, 1);
      const ease = progress * progress * progress; // accélère en sortant
      setEscapeOffset(-160 - ease * 520);
      if (progress < 1) raf = requestAnimationFrame(anim);
    };
    raf = requestAnimationFrame(anim);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crashed]);
  void elapsedMs;
  return escapeOffset;
}

export function GameViewport({ phase, countdown, connectedPlayers = 2909, winNotifications, canvasHeightHint }: Props) {
  const { width } = useWindowDimensions();
  // Les offsets de l'avion sont mesurés sur la référence mobile de 416 px.
  // Les garder proportionnels empêche l'asset de grossir relativement au
  // canevas sur les petits téléphones, sans modifier le cadrage de référence.
  const assetScale = Math.max(0.78, Math.min(1.18, width / 416));
  const [profileFrame, setProfileFrame] = useState(0);
  const [visiblePlayerAvatars, setVisiblePlayerAvatars] = useState(() => AVIATOR_PROFILE_AVATARS.slice(0, 4));
  useEffect(() => {
    const timer = setInterval(() => setProfileFrame((frame) => (frame + 1) % 4), 1800);
    const avatarTimer = setInterval(() => setVisiblePlayerAvatars(getRandomAviatorAvatars(4, true)), 10000);
    setVisiblePlayerAvatars(getRandomAviatorAvatars(4, true));
    return () => {
      clearInterval(timer);
      clearInterval(avatarTimer);
    };
  }, []);
  const canvasWidth = width;
  // Zone de vol plus généreuse sur écran large, tout en restant compacte sur mobile.
  // Cette hauteur conserve une lecture portrait claire sans pousser les mises hors écran.
  // Proportion de la référence mobile : la zone de vol domine l’écran
  // sans pousser les panneaux Bet hors de la hiérarchie visuelle.
  const canvasHeight = canvasHeightHint ?? Math.min(360, Math.max(276, Math.round(width * 0.70)));


  const visual = useMemo(() => {
    if (phase === "waiting") return { t: 0, crashed: false, multiplier: 1, crashElapsed: 0 };
    if (phase.kind === "flying")
      return { t: timeForMultiplier(phase.multiplier), crashed: false, multiplier: phase.multiplier, crashElapsed: 0 };
    return { t: timeForMultiplier(phase.multiplier), crashed: true, multiplier: phase.multiplier, crashElapsed: 0 };
  }, [phase]);

  // La projection est visuelle seulement : le multiplicateur et le crash
  // continuent de provenir du moteur existant, sans plafonnement à 1,20×.
  const { t, planeX, planeY, points: curvePoints } =
    createFlightProjection(visual.multiplier, canvasWidth, canvasHeight);
  // Conserver le décor d'avant la correction : seuls avion et tracé changent.
  const osc = Math.sin(t * 7.2) * canvasHeight * 0.012;
  const drawCurve = curvePoints.length > 1;
  const escaped = useEscaped(planeY, visual.crashed, 0);

  const d = useMemo(() => {
    if (curvePoints.length < 2) return "";
    const fmt = (p: [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    let path = `M${fmt(curvePoints[0])}`;
    const n = curvePoints.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = curvePoints[Math.max(0, i - 1)];
      const p1 = curvePoints[i];
      const p2 = curvePoints[i + 1];
      const p3 = curvePoints[Math.min(n - 1, i + 2)];
      let c1: [number, number];
      let c2: [number, number];
      if (i === 0) {
        // Tangente visible au décollage : départ bas-gauche à 15 degrés,
        // puis transition douce vers la pente naturelle de la trajectoire.
        const dx = Math.max(1, Math.min(24, (p2[0] - p1[0]) * 0.8));
        c1 = [p1[0] + dx, p1[1] - Math.tan((15 * Math.PI) / 180) * dx];
      } else {
        c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      }
      if (i === n - 2) {
        c2 = [p2[0] - (p2[0] - p1[0]) / 3, p2[1] - (p2[1] - p1[1]) / 3];
      } else {
        c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      }
      path += ` C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
    }
    return path;
  }, [curvePoints]);

  // === Courbe fidèle à la maquette officielle ===
  // Un trait vif qui S'ÉPAISSIT progressivement vers l'avion (tapering : 2px au
  // départ → 9px près de l'avion), dessiné comme un polygone avec des bords
  // arrondis, comme le rendu officiel d'Aviator.
  const taperedPath = useMemo(() => {
    if (curvePoints.length < 3) return "";
    const pts = curvePoints;
    const n = pts.length;
    // Longueur totale du trait (px) : l'arc est court au tout début du vol,
    // long en caméra défilante.
    let arcLen = 0;
    const firstX = pts[0][0];
    const lastX = pts[n - 1][0];
    for (let i = 1; i < n; i++) arcLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    // Courbe MINCE demandée : trait filiforme au départ (~0,5 px),
    // s'épaississant à peine près de l'avion. L'épaisseur est limitée par
    // la projection horizontale du trait : sur un arc raide (quasi vertical,
    // basses cotes), le ruban reste fin perceptuellement — pas de gros
    // triangle au début du vol.
    const maxW = Math.min(6, Math.max(2, (lastX - firstX) * 0.14));
      const widthAt = (i: number) => {
      return 1.5 + (maxW - 1.5) * Math.pow(i / Math.max(1, n - 1), 1.2);
    };
    const edge = (sign: 1 | -1): [number, number][] => {
      const out: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(n - 1, i + 1)];
        const dx = next[0] - prev[0];
        const dy = next[1] - prev[1];
        const len = Math.hypot(dx, dy) || 1;
        const w = widthAt(i) / 2;
        out.push([pts[i][0] + (-dy / len) * w * sign, pts[i][1] + (dx / len) * w * sign]);
      }
      return out;
    };
    const top = edge(1);
    const bottom = edge(-1);
    const f = (p: [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    // contour arrondi : arc d'extrémité simple via petits segments
    let s = "M" + f(top[0]);
    for (let i = 1; i < n; i++) s += " L" + f(top[i]);
    // arrondi à l'avion (dernier point)
    const tip = pts[n - 1];
    s += " Q" + f([tip[0] + (top[n - 1][0] + bottom[n - 1][0] - tip[0]) / 2, (top[n - 1][1] + bottom[n - 1][1]) / 2]) + " L" + f(bottom[n - 1]);
    for (let i = n - 2; i >= 0; i--) s += " L" + f(bottom[i]);
    // arrondi au départ
    const origin = pts[0];
    s += " Q" + f([(origin[0] + top[0][0] + bottom[0][0]) / 2, (top[0][1] + bottom[0][1]) / 2]) + " Z";
    return s;
  }, [curvePoints]);
  const areaD = useMemo(() => {
    if (curvePoints.length === 0) return "";
    const last = curvePoints[curvePoints.length - 1];
    const first = curvePoints[0];
    const bottom = canvasHeight;
    // Fermeture verticale stricte sous l’avion : le polygone descend tout droit
    // depuis la pointe (last[0], last[1]) jusqu’au bas de la zone (last[0], bottom).
    // Cette ligne verticale descendante reproduit l’impression de « chute »
    // signalée, tout en gardant la courbe principale en montée continue.
    return `${d} L${last[0].toFixed(1)} ${bottom} L${first[0].toFixed(1)} ${bottom} Z`;
  }, [d, curvePoints, canvasHeight]);

  // Points lumineux du décor : défilent avec la caméra en phase stable
  // (parallaxe horizontale — l'impression de voler), fixés au décollage.
  const bottomDots = useMemo(() => {
    const dots: { x: number; y: number; color: string }[] = [];
    const count = Math.max(6, Math.floor(canvasWidth / 34));
    for (let i = 0; i < count + 4; i++) {
      let x = 24 + ((i * (canvasWidth - 48)) / Math.max(1, count - 1)) % (canvasWidth - 8);
      if (x < 16) x += canvasWidth - 8;
      dots.push({
        x,
        y: canvasHeight - 14 + osc, // les points ondulent avec la caméra
        color: i % 2 === 0 ? "#4A90E2" : "#B465E8",
      });
    }
    return dots;
  }, [canvasWidth, canvasHeight, osc]);
  const leftDots = useMemo(() => {
    const dots: { x: number; y: number; color: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const f = i / 6;
      dots.push({
        x: 12,
        y: 20 + f * (canvasHeight - 52),
        color: f < 0.5 ? "#4A90E2" : "#B465E8",
      });
    }
    return dots;
  }, [canvasHeight]);

  const renderPlaneX = planeX;
  const renderPlaneY = planeY + escaped;

  // Compensation constante du cabrage intrinsèque de l’image : l’axe du
  // fuselage reste horizontal en vol comme au crash, sans rotation de nez.
  const thRad = 11.9;
  const thDeg = thRad;
  // Le halo bleu est réservé au vol actif : il disparaît pendant l’attente
  // et immédiatement après le crash, comme dans la référence fournie.
  const inFlight = typeof phase !== "string" && phase.kind === "flying";
  // Dans la vidéo, le halo froid du départ gagne une teinte violette lorsque
  // la cote prend de la hauteur. Le changement reste diffus et progressif.
  // Garder la valeur de décor antérieure; la nouvelle projection ne change
  // ni la palette ni les autres éléments visuels du jeu.
  const decorationMultiplier = Math.min(1.2, visual.multiplier);
  const purpleGlowOpacity = inFlight
    ? Math.min(0.32, Math.max(0, (decorationMultiplier - 1.65) / 2.35) * 0.32)
    : 0;
  // Le décor reste fixe avant le décollage. En vol, les rayons tournent
  // à vitesse constante dans une boucle modulo 2π : le retour de cycle est
  // mathématiquement identique au départ et donc imperceptible.
  // Le motif couvre 360° autour de l’origine bas-gauche : les bandes
  // hors champ entrent naturellement par le bord pendant que d’autres
  // sortent, sans jamais exposer la fin du fan. La période exacte est de
  // deux bandes, car les couleurs sont alternées.
  const RAY_COUNT = 84;
  const RAY_STEP = (Math.PI * 2) / RAY_COUNT;
  // Les rayons gardent leur origine bas-gauche, mais tournent nettement plus
  // vite pendant le vol. Le modulo conserve une boucle parfaitement continue.
  const rayMotion = inFlight ? (visual.t * 0.34) % (RAY_STEP * 2) : 0;

  return (
    <View style={[styles.viewport, { height: canvasHeight }]}>
      {/* === Z-ORDER 1 : fond de référence, origine bas-gauche === */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={canvasWidth} height={canvasHeight}>
          <Defs>
            <RadialGradient id="flightBlueGlow" cx="46%" cy="50%" r="72%">
              <Stop offset="0" stopColor="#43B8F0" stopOpacity={inFlight ? "0.38" : "0"} />
              <Stop offset="0.48" stopColor="#12648F" stopOpacity={inFlight ? "0.19" : "0"} />
              <Stop offset="1" stopColor="#07121D" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="flightPurpleGlow" cx="48%" cy="46%" r="76%">
              <Stop offset="0" stopColor="#9B4DFF" stopOpacity={purpleGlowOpacity} />
              <Stop offset="0.48" stopColor="#5D239E" stopOpacity={purpleGlowOpacity * 0.52} />
              <Stop offset="1" stopColor="#160824" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={`M0 0H${canvasWidth}V${canvasHeight}H0Z`} fill="#020305" />
          {Array.from({ length: RAY_COUNT }).map((_, i) => {
            const originX = -canvasWidth * 0.015;
            const originY = canvasHeight * 1.015;
            const a0 = (-88 * Math.PI) / 180 + rayMotion;
            const a = a0 + i * RAY_STEP;
            const nextA = a + RAY_STEP * 0.78;
            const len = Math.max(canvasWidth, canvasHeight) * 2.15;
            const x1 = originX + Math.cos(a) * len;
            const y1 = originY + Math.sin(a) * len;
            const x2 = originX + Math.cos(nextA) * len;
            const y2 = originY + Math.sin(nextA) * len;
            return (
              <Path
                key={`ray-${i}`}
                d={`M${originX} ${originY} L${x1} ${y1} L${x2} ${y2} Z`}
                fill={i % 2 === 0 ? "#17191C" : "#050607"}
                opacity={i % 2 === 0 ? 0.86 : 0.98}
              />
            );
          })}
          {inFlight ? <Path d={`M0 0H${canvasWidth}V${canvasHeight}H0Z`} fill="url(#flightBlueGlow)" /> : null}
          {purpleGlowOpacity > 0 ? <Path d={`M0 0H${canvasWidth}V${canvasHeight}H0Z`} fill="url(#flightPurpleGlow)" /> : null}
        </Svg>
      </View>

      {/* Profils des joueurs présents, visibles dès l'ouverture du jeu. */}
      <View style={styles.playersOnline} pointerEvents="none">
        <View style={styles.avatarStack}>
          {visiblePlayerAvatars.map((avatar, index) => (
            <View key={`${index}-${String(avatar)}`} style={[styles.profileHead, { marginLeft: index === 0 ? 0 : -6, opacity: profileFrame === index ? 0.7 : 1 }]}>
              <Image source={avatar} style={styles.profileAvatarImage} resizeMode="contain" />
            </View>
          ))}
        </View>
        <Text style={styles.playersOnlineText}>{Math.max(4, connectedPlayers).toLocaleString("fr-FR")} connectés</Text>
      </View>

      {/* === Z-ORDER 2 : courbe rouge avec décor de points (au-dessus du fond) === */}
      <Svg
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      >
        <Defs>
          {/* Remplissage rouge sous la courbe, plus dense vers le bas comme dans la vidéo. */}
          <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF233D" stopOpacity="0.38" />
            <Stop offset="0.30" stopColor="#E81934" stopOpacity="0.45" />
            <Stop offset="0.64" stopColor="#C40D28" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#A50A1D" stopOpacity="0.68" />
          </LinearGradient>
        </Defs>
        {(drawCurve || phase !== "waiting") && (
          <>
            {/* Trait vif rouge : ligne simple avec stroke, fidèle au rendu Aviator */}
            {d ? (
              <>
                {/* Base rouge lumineuse sous toute la trajectoire, plus dense au pied. */}
                {areaD ? <Path d={areaD} fill="url(#fillGrad)" opacity={0.98} /> : null}
                {/* Lueur rouge concentrée sous le trait et au point de départ. */}
                <Path d={d} fill="none" stroke="#FF1F3D" strokeWidth={12} opacity={0.11} strokeLinecap="round" strokeLinejoin="round" />
                <Path d={d} fill="none" stroke="#FF2E3D" strokeWidth={7} opacity={0.18} strokeLinecap="round" strokeLinejoin="round" />
                {/* Halo lumineux autour du trait */}
                <Path d={d} fill="none" stroke="#FF6B6B" strokeWidth={4} opacity={0.2} strokeLinecap="round" strokeLinejoin="round" />
                {/* Trait principal rouge vif */}
                <Path d={d} fill="none" stroke="#FF2E3D" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}
          </>
        )}
        {bottomDots.map((dot, i) => (
          <Circle key={`b${i}`} cx={dot.x} cy={dot.y} r={2} fill={dot.color} opacity={0.45} />
        ))}
        {leftDots.map((dot, i) => (
          <Circle key={`l${i}`} cx={dot.x} cy={dot.y} r={2} fill={dot.color} opacity={0.45} />
        ))}
      </Svg>

      {/* === Z-ORDER 3 : multiplicateur géant === */}
      <View style={styles.multiWrap} pointerEvents="none">
        {phase === "waiting" ? (
          <View style={styles.promoWrap}>
            <Image source={PROMO_IMG} style={styles.promoImage} resizeMode="contain" />
            <View style={styles.promoCountdownBar}>
              <View
                style={[
                  styles.promoCountdownFill,
                  // Une seule barre rouge : elle diminue avec le compte à rebours
                  // sans créer de second segment concurrent.
                  { width: `${Math.max(0, Math.min(1, (countdown ?? 0) / 5)) * 100}%` },
                ]}
              />
            </View>
          </View>
        ) : visual.crashed ? (
          <View style={styles.centerCol}>
            {/* Fidèle à la vidéo officielle : « FLEW AWAY! » en blanc, cote finale rouge */}
            <Text style={[styles.multiBig, styles.flewText]}>FLEW AWAY!</Text>
            <Text style={[styles.multiBig, styles.crashMult]}>×{visual.multiplier.toFixed(2)}</Text>
            <Text style={styles.tapSub}>Appuyez sur Placer le pari pour rejouer</Text>
          </View>
        ) : (
          <Text style={styles.multiBig}>×{visual.multiplier.toFixed(2)}</Text>
        )}
      </View>

      {/* === Notifications de gain : bulles vertes en haut à gauche (fidèle à la vidéo) === */}
      {winNotifications && winNotifications.length > 0 && (
        <View style={styles.winNotifWrap} pointerEvents="none">
          {winNotifications.map((n) => (
            <View key={n.id} style={styles.winNotif}>
              <Text style={styles.winNotifText}>
                GAGNÉE : +{n.payout.toFixed(2)} XAF
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* === Z-ORDER 4 : avion au premier plan === */}
      {/* Avion d'ATTENTE au coin inférieur gauche avant chaque tour (fidèle
          à la maquette officielle : l'avion attend prêt à décoller) */}
      {phase === "waiting" && (
          <View
          style={{
            position: "absolute",
            left: 24 * assetScale,
            top: canvasHeight - 74 * assetScale,
            width: 72 * assetScale,
            zIndex: 30,
            transform: [{ rotate: "11.9deg" }],
          }}
          pointerEvents="none">
          <Image source={PLANE_IMG} style={{ width: 72 * assetScale, height: 72 * assetScale * 0.5 }} resizeMode="contain" />
        </View>
      )}
      {/* En vol : QUEUE de l'avion posée sur la pointe de la courbe, fuselage
          aligné sur la tangente — la courbe sort de l'arrière du fuselage
          (fidèle à la maquette officielle) */}
      {phase !== "waiting" && (
        <View
          style={{
            position: "absolute",
            // Ancre mesurée par analyse de plane-official.png : la QUEUE du
            // fuselage est au point (1.5, 53) du canevas rendu 150×75
            // (régression du squelette : queue ≈ 1%×71%, nez ≈ 99%×40%).
            // L'image est intrinsèquement cabrée de 12.1° (nez plus haut que
            // la queue en position neutre) ; la rotation appliquée compense
            // ce cabrage pour que l'axe du fuselage suive EXACTEMENT la
            // tangente de la courbe. Position calculée pour une rotation
            // horaire autour de l'ancre (robuste web + natif).
            // La queue de l'image (1.1, 70.8) du canevas 150×75 doit atterrir
            // exactement sur la pointe de la courbe (PX, PY). La rotation
            // CSS tourne autour du centre ; taille et compensation sont donc
            // mises à l'échelle ensemble selon la largeur du téléphone.
            left:
              renderPlaneX -
              30 * assetScale -
              (-29.5 * assetScale * Math.cos((thRad * Math.PI) / 180) -
                13.3 * assetScale * Math.sin((thRad * Math.PI) / 180)),
            top:
              renderPlaneY -
              15 * assetScale -
              (-29.5 * assetScale * Math.sin((thRad * Math.PI) / 180) +
                13.3 * assetScale * Math.cos((thRad * Math.PI) / 180)),
            width: 60 * assetScale,
            zIndex: 30,
            transform: [
              // Compensation fixe de l'inclinaison native de l'image.
              { rotate: `${thDeg}deg` },
            ],
          }}
          pointerEvents="none">
          <Image source={PLANE_IMG} style={{ width: 60 * assetScale, height: 60 * assetScale * 0.5 }} resizeMode="contain" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    backgroundColor: "#050507",
    overflow: "hidden",
  },
  multiWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  centerCol: { alignItems: "center" },
  promoWrap: {
    position: "absolute",
    width: "64%",
    height: "72%",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  promoImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  promoCountdownBar: {
    position: "absolute",
    left: "10%",
    top: "49%",
    width: "80%",
    height: 7,
    borderRadius: 8,
    overflow: "hidden",
    // Rail totalement transparent : le fond radial reste visible derrière
    // la progression rouge du compte à rebours.
    backgroundColor: "transparent",
    justifyContent: "center",
  },
  promoCountdownFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#F3214A",
    borderRadius: 8,
  },
  multiBig: {
    color: "#FFFFFF",
    fontSize: 54,
    fontWeight: "900",
    lineHeight: 64,
    fontVariant: ["tabular-nums"],
  },
  flewText: { fontSize: 30, lineHeight: 40, color: "#FFFFFF", fontWeight: "900" },
  crashMult: { fontSize: 46, lineHeight: 56, color: "#E4331E" },
  playersOnline: { position: "absolute", bottom: 10, right: 12, zIndex: 12, flexDirection: "row", alignItems: "center" },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  profileHead: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden" },
  profileAvatarImage: { width: 24, height: 24, borderRadius: 12 },
  playersOnlineText: { color: "#fff", fontSize: 10, fontWeight: "800", marginLeft: 7, textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  winNotifWrap: {
    position: "absolute",
    top: 10,
    left: 12,
    zIndex: 40,
    gap: 4,
  },
  winNotif: {
    backgroundColor: "rgba(23, 198, 83, 0.92)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  winNotifText: { color: "#fff", fontSize: 11, fontWeight: "800", lineHeight: 15, fontVariant: ["tabular-nums"] },
  waitSub: { color: "#9C8FBC", fontSize: 12, lineHeight: 16, marginTop: 4 },
  tapSub: { color: "#9C8FBC", fontSize: 12, lineHeight: 16, marginTop: 6 },
});
