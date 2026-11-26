const moneyText = value => Number(value).toFixed(2).replace(/\.?0+$/, '');
const testMode = new URLSearchParams(window.location.search).has('test');
const quickAmounts = [200, 800, 2000, 6000, 20000, 70000];
const walletSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
let walletReady = false;
const startingRows = [
  ['******41','x0','29675.98','0'],['******41','x0','19783.99','0'],['******35','x0','8141.66','0'],['******43','x0','5281.51','0'],
  ['******41','x0','4941.85','0'],['******71','x0','4282.02','0'],['******19','x0','3802.69','0'],['******19','x0','3420.55','0'],
  ['******08','x0','3112.24','0'],['******32','x0','2841.60','0'],['******96','x0','2460.88','0'],['******11','x0','2055.40','0'],
  ['******83','x0','1970.21','0'],['******17','x0','1850.00','0'],['******61','x0','1645.75','0'],['******26','x0','1420.10','0'],
  ['******54','x0','1198.42','0'],['******02','x0','940.00','0'],['******78','x0','810.50','0'],['******38','x0','625.20','0']
];
const bets = [
  { id: 1, amount: 400, state: 'ready', targetRound: null, win: 0 },
  { id: 2, amount: 400, state: 'ready', targetRound: null, win: 0 }
];
const playerCashoutTargets = [1.02, 1.08, 1.14, 1.21, 1.35, 1.50, 1.74, 2.10, 2.47, 3.18, 4.03, 5.07, 6.14, 8.82, 12.04, 21.47];
let simulatedPlayers = [];
let lastPlayerRowsRender = 0;
let nextBetId = 3;
let totalBetAmount = 1781268.6;
let totalWinAmount = 37282.44;
let publicBetCount = 2436;
let balance = 0;
let roundNumber = 1;
let phase = 'flight';
let phaseStart = Date.now();
let currentMultiplier = 1.49;
let displayedCrash = 3.18;
let videoFlightProfile = false;
let noticeTimer;
let autoEnabled = false;
let autoConfig = { base: 400, max: 0, cashout: 0, onWin: 'base', onLoss: 'base' };
let autoNextBet = 400;
const upcomingCrashes = [21.47, 3.18, 1.00, 5.07, 3.42, 1.04];
let crashCursor = 0;
let pendingBotCrashTarget = null;
const appliedBotCrashCommandIds = new Set();
const roundLength = 6800;
const COUNTDOWN_SECONDS = 4;
const COUNTDOWN_DISPLAY_LENGTH = COUNTDOWN_SECONDS * 1000;
const countdownLength = COUNTDOWN_DISPLAY_LENGTH;
const crashPause = 1900;
const countdownMarkerPositions = [[386,31],[348,29],[315,46],[300,79],[289,112]];
const countdownMarkerAngles = [108,77,48,18,0];
const horizontalDotBase = 50;
const horizontalDotSpacing = 73;
const horizontalDotSpeed = 18.3;
const verticalDotBase = 16;
const verticalDotSpacing = 22;
const verticalDotCount = 6;
const verticalDotSpeed = 9;
let chartDotOffsetX = 0;
let chartDotOffsetY = 0;

const cardsHost = document.getElementById('bet-cards');
const chart = document.querySelector('.game-scene');
const multiplierNode = document.getElementById('multiplier');
const countdownNode = document.getElementById('countdown');
const countdownIndicatorNode = document.getElementById('countdown-active-bar');
const countdownSegmentNodes = [
  { node: document.getElementById('countdown-segment-4'), stage: 0 },
  { node: document.getElementById('countdown-segment-3'), stage: 1 },
  { node: document.getElementById('countdown-segment-2'), stage: 2 },
  { node: document.getElementById('countdown-segment-1'), stage: 4 }
];
const trailNode = document.getElementById('flight-trail');
const planeNode = document.getElementById('plane');
const flareNode = document.getElementById('crash-flare');
const noticeNode = document.getElementById('game-notice');
const acceptedBetNoticeNode = document.getElementById('countdown-accepted');
const videoCrashFrames = window.__CRASH_GAME_ASSETS__.crashFrames;

function renderCards() {
  cardsHost.innerHTML = '';
  bets.forEach((bet, index) => {
    const card = document.createElement('article');
    card.className = 'bet-card';
    card.classList.toggle('active-bet', bet.state === 'queued' || bet.state === 'live' || bet.state === 'cashed');
    card.dataset.betId = String(bet.id);
    const inputWrap = document.createElement('div');
    inputWrap.className = 'bet-input-wrap';
    const input = document.createElement('input');
    input.className = 'bet-input';
    input.type = 'number';
    input.min = '200';
    input.step = '1';
    input.value = String(bet.amount);
    input.setAttribute('aria-label', `Montant du pari ${index + 1}`);
    input.disabled = !walletReady || bet.state !== 'ready' || Boolean(bet.processing);
    input.addEventListener('input', () => { bet.amount = Math.max(0, Number(input.value) || 0); });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'clear-input';
    clear.textContent = '×';
    clear.setAttribute('aria-label', 'Effacer le montant');
    clear.disabled = !walletReady || bet.state !== 'ready' || Boolean(bet.processing);
    clear.addEventListener('click', () => { input.value = ''; bet.amount = 0; input.focus(); });
    inputWrap.append(input, clear);

    const autoButton = document.createElement('button');
    autoButton.type = 'button';
    autoButton.className = 'auto-toggle';
    autoButton.textContent = autoEnabled ? 'JEU AUTOMATIQUE ACTIF' : 'ACTIVER LE JEU AUTOMATIQUE';
    autoButton.setAttribute('aria-label', 'Activer le jeu automatique');
    autoButton.disabled = !walletReady || Boolean(bet.processing);
    autoButton.addEventListener('click', openAutoModal);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-bet';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Supprimer ce pari');
    remove.disabled = Boolean(bet.processing) || bet.state === 'queued' || bet.state === 'live';
    remove.addEventListener('click', () => {
      if (bets.length <= 1) return;
      const position = bets.findIndex(item => item.id === bet.id);
      bets.splice(position, 1);
      renderCards();
    });

    const quick = document.createElement('div');
    quick.className = 'quick-bets';
    quickAmounts.forEach(amount => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-bet';
      button.textContent = String(amount);
      button.setAttribute('aria-label', `Miser ${amount}`);
      button.disabled = !walletReady || bet.state !== 'ready' || Boolean(bet.processing);
      button.addEventListener('click', () => {
        bet.amount = amount;
        input.value = String(amount);
      });
      quick.append(button);
    });

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'action-button';
    action.disabled = !walletReady || Boolean(bet.processing);
    action.addEventListener('click', () => handleBetAction(bet));
    if (bet.state === 'live') {
      action.classList.add('cashout');
      action.innerHTML = 'OBTENIR';
    } else if (bet.state === 'cashed') {
      action.classList.add('cashed');
      action.textContent = 'PARI ACCEPTÉ';
    } else if (bet.state === 'queued') {
      action.classList.add('queued');
      action.textContent = 'PARI ACCEPTÉ';
    } else {
      action.innerHTML = 'PLACER UN PARI<small>(sur le prochain tour)</small>';
    }
    card.append(inputWrap, autoButton, remove, quick, action);
    cardsHost.append(card);
  });
  document.getElementById('add-bet').hidden = bets.length >= 3;
}

function applyWalletSnapshot(snapshot) {
  const nextBalance = Number(snapshot?.amount);
  if (!Number.isFinite(nextBalance) || nextBalance < 0) return;
  balance = nextBalance;
  document.getElementById('balance').textContent = `${moneyText(balance)} F`;
  walletReady = true;
  renderCards();
}

async function recordStake(amount, bet, targetRound) {
  if (!walletReady || !window.AviatorWalletBridge) throw new Error('Portefeuille indisponible.');
  const result = await window.AviatorWalletBridge.debit({
    requestId: `stake:${walletSessionId}:${targetRound}:${bet.id}`,
    amount,
    gameId: 'crash',
    roundId: String(targetRound),
    betId: String(bet.id)
  });
  applyWalletSnapshot(result);
  totalBetAmount += amount;
  publicBetCount += 1;
  document.getElementById('total-bets').textContent = moneyText(totalBetAmount);
  document.getElementById('bet-count').textContent = String(publicBetCount);
  return result;
}

function queueStake(bet, targetRound) {
  if (!walletReady || bet.processing) return Promise.resolve(false);
  bet.processing = true;
  renderCards();
  return recordStake(bet.amount, bet, targetRound)
    .then(() => {
      bet.targetRound = targetRound;
      bet.state = phase === 'flight' && roundNumber >= targetRound ? 'live' : 'queued';
      if (bet.state === 'live') {
        bet.targetRound = null;
        void window.AviatorWalletBridge.activateBet({
          requestId: `activate:${walletSessionId}:${targetRound}:${bet.id}`,
          gameId: 'crash',
          roundId: String(targetRound),
          betId: String(bet.id)
        }).catch(error => showNotice(error?.message || 'Mise non activée.', 'danger', 2600));
      }
      showNotice('Votre pari est accepté !', 'success', 1800);
      return true;
    })
    .catch(error => {
      bet.targetRound = null;
      bet.state = 'ready';
      showNotice(error?.message || 'Mise refusée par le portefeuille.', 'danger', 2600);
      return false;
    })
    .finally(() => {
      bet.processing = false;
      renderCards();
    });
}

function nextAutoAmount(won, currentAmount) {
  const choice = won ? autoConfig.onWin : autoConfig.onLoss;
  const requested = choice === 'double' ? currentAmount * 2 : autoConfig.base;
  const limited = autoConfig.max >= 200 ? Math.min(requested, autoConfig.max) : requested;
  return Math.max(200, limited);
}

async function cashOutBet(bet) {
  if (bet.state !== 'live' || bet.processing || phase !== 'flight' || currentMultiplier >= displayedCrash) return;
  bet.processing = true;
  renderCards();
  const multiplier = currentMultiplier;
  const payout = Math.round(bet.amount * multiplier * 100) / 100;
  try {
    const result = await window.AviatorWalletBridge.credit({
      requestId: `cashout:${walletSessionId}:${roundNumber}:${bet.id}:${multiplier.toFixed(2)}`,
      amount: payout,
      betAmount: bet.amount,
      multiplier,
      gameId: 'crash',
      roundId: String(roundNumber),
      betId: String(bet.id)
    });
    applyWalletSnapshot(result);
    bet.win = payout;
    totalWinAmount += payout;
    document.getElementById('total-wins').textContent = moneyText(totalWinAmount);
    if (autoEnabled) autoNextBet = nextAutoAmount(true, bet.amount);
    showNotice(`Vous avez gagné: ${moneyText(payout)} XAF`, 'success', 5000);
    bet.state = 'ready';
    bet.targetRound = null;
  } catch (error) {
    if (phase !== 'flight' || currentMultiplier >= displayedCrash) {
      bet.state = 'ready';
      bet.win = 0;
    }
    showNotice(error?.message || 'Gain non confirmé par le portefeuille.', 'danger', 2600);
  } finally {
    bet.processing = false;
    renderCards();
  }
}

function handleBetAction(bet) {
  if (bet.processing || !walletReady) return;
  if (bet.state === 'live') {
    void cashOutBet(bet);
  } else if (bet.state === 'ready') {
    if (bet.amount < 200) {
      showNotice('La mise minimale est de 200 XAF.', 'danger', 2200);
      return;
    }
    void queueStake(bet, roundNumber + 1);
  }
  renderCards();
}

function showNotice(text, type, duration = 1600) {
  clearTimeout(noticeTimer);
  noticeNode.textContent = text;
  noticeNode.className = `game-notice ${type}`;
  noticeNode.hidden = false;
  noticeTimer = setTimeout(() => { noticeNode.hidden = true; }, duration);
}

function flightDuration() {
  if (videoFlightProfile) return 26000;
  if (displayedCrash <= 1.05) return 2000;
  const relativeCrash = Math.log(Math.max(1.01, displayedCrash)) / Math.log(3.18);
  return roundLength * Math.max(0.08, relativeCrash);
}

function updateCountdownIndicator(elapsed) {
  const progress = Math.max(0, Math.min(4, elapsed / 1000));
  const index = Math.min(3, Math.floor(progress));
  const fraction = progress - index;
  const from = countdownMarkerPositions[index];
  const to = countdownMarkerPositions[index + 1];
  const x = from[0] + (to[0] - from[0]) * fraction;
  const y = from[1] + (to[1] - from[1]) * fraction;
  const angleFrom = countdownMarkerAngles[index];
  const angleTo = countdownMarkerAngles[index + 1];
  const angle = angleFrom + (angleTo - angleFrom) * fraction;
  countdownIndicatorNode.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(1)})`);
  countdownSegmentNodes.forEach(({ node, stage }) => {
    const distanceAhead = stage - progress;
    const opacity = stage === 4 ? 0.24 : distanceAhead <= 0.12 ? 0 : Math.min(0.84, 0.46 + distanceAhead * 0.18);
    node.style.opacity = opacity.toFixed(2);
  });
}

function setScene() {
  chart.classList.toggle('is-crashed', phase === 'crash');
  chart.classList.toggle('is-countdown', phase === 'countdown');
  countdownNode.style.display = phase === 'countdown' ? 'inline' : 'none';
  const showCountdownIndicator = phase === 'countdown' && Boolean(countdownNode.textContent);
  document.getElementById('countdown-spinner').style.display = showCountdownIndicator ? 'inline' : 'none';
  document.getElementById('countdown-indicator-overlay').style.display = showCountdownIndicator ? 'block' : 'none';
  countdownIndicatorNode.style.display = showCountdownIndicator ? '' : 'none';
  acceptedBetNoticeNode.hidden = phase !== 'countdown' || !bets.some(bet => bet.state === 'queued');
  multiplierNode.style.display = phase === 'countdown' ? 'none' : '';
  flareNode.style.opacity = phase === 'crash' ? '1' : '0';
  if (phase === 'countdown') {
    multiplierNode.textContent = '1.00x';
    multiplierNode.style.opacity = '.82';
  } else if (phase === 'crash') {
    multiplierNode.textContent = `${displayedCrash.toFixed(2)}x`;
    multiplierNode.style.opacity = '1';
  } else {
    multiplierNode.textContent = `${currentMultiplier.toFixed(2)}x`;
    multiplierNode.style.opacity = '1';
  }
}

function updateFlight(t) {
  const progress = Math.max(0, Math.min(1, t / flightDuration()));
  if (videoFlightProfile) {
    const anchors = [[0,1],[1,1.02],[3,1.26],[5,1.74],[7,2.47],[10,4.03],[13,6.14],[16,8.82],[19,12.04],[22,15.83],[24,18.66],[26,21.47]];
    const seconds = progress * 26;
    const right = anchors.findIndex(point => point[0] >= seconds);
    const hi = right < 0 ? anchors.length - 1 : right;
    const lo = Math.max(0, hi - 1);
    const mix = hi === lo ? 0 : (seconds - anchors[lo][0]) / (anchors[hi][0] - anchors[lo][0]);
    currentMultiplier = anchors[lo][1] + (anchors[hi][1] - anchors[lo][1]) * mix;
  } else {
    currentMultiplier = 1 + (displayedCrash - 1) * Math.pow(progress, 1.66);
  }
  const position = videoFlightProfile
    ? Math.max(0, Math.min(1, Math.log(Math.max(1, currentMultiplier)) / Math.log(21.47)))
    : Math.max(0, Math.min(1, Math.pow(Math.max(0, (currentMultiplier - 1) / (3.42 - 1)), .48)));
  const lowCurveCorrection = Math.min(1, position / 0.3);
  let x, y, trailX, trailY, c1x, c1y, c2x, c2y;
  if (videoFlightProfile) {
    displayedCrash = 21.47;
    const flightPoints = [[1,18,126],[1.02,48,121],[1.26,120,102],[1.74,190,77],[2.47,260,45],[4.03,330,34],[6.14,334,33],[8.82,336,34],[12.04,336,35],[15.83,337,36],[18.66,337,37],[21.47,337,40]];
    const right = flightPoints.findIndex(point => point[0] >= currentMultiplier);
    const hi = right < 0 ? flightPoints.length - 1 : right;
    const lo = Math.max(0, hi - 1);
    const mix = hi === lo ? 0 : (currentMultiplier - flightPoints[lo][0]) / (flightPoints[hi][0] - flightPoints[lo][0]);
    x = flightPoints[lo][1] + (flightPoints[hi][1] - flightPoints[lo][1]) * mix;
    y = flightPoints[lo][2] + (flightPoints[hi][2] - flightPoints[lo][2]) * mix;
    trailX = Math.max(18, x - 25);
    trailY = y + 11;
    const curveStretch = Math.max(0, Math.min(1, (trailX - 95) / 210));
    c1x = 18 + (trailX - 18) * (.32 + .13 * curveStretch);
    c1y = 142;
    c2x = 18 + (trailX - 18) * .76;
    c2y = trailY + 14 + 35 * curveStretch;
    flareNode.setAttribute('x', '294');
    flareNode.setAttribute('y', '2');
    flareNode.setAttribute('width', '87');
    flareNode.setAttribute('height', '82');
    flareNode.setAttribute('transform', 'translate(0 0)');
  } else {
    x = 18 + 310 * Math.pow(position, 0.854) - 7 * Math.min(1, position / 0.28) - 38 * Math.pow(1 - position, 2) * lowCurveCorrection;
    y = 126 - position * 145 + position * position * 28 + 15.5 * Math.pow(1 - position, 2) * lowCurveCorrection;
    trailX = x;
    trailY = y;
    c1x = 18 + position * 75;
    c1y = 126 - position * 12;
    c2x = 18 + position * 218;
    c2y = 126 - position * 102;
    flareNode.setAttribute('href', window.__CRASH_GAME_ASSETS__.crashSprite);
    flareNode.setAttribute('x', '-18');
    flareNode.setAttribute('y', '-28');
    flareNode.setAttribute('width', '65');
    flareNode.setAttribute('height', '54');
    flareNode.setAttribute('transform', `translate(${x} ${y})`);
  }
  trailNode.setAttribute('d', `M18 ${videoFlightProfile ? 142 : 126} C${c1x} ${c1y} ${c2x} ${c2y} ${trailX} ${trailY}`);
  planeNode.setAttribute('transform', `translate(${x} ${y + (videoFlightProfile ? 0 : 5 * (1 - position))}) rotate(${videoFlightProfile ? -18 : 0})`);
}

function applyBotCrashTarget(command) {
  if (!command || typeof command.commandId !== 'string' || !command.commandId.trim()) return;
  const target = command.target;
  if (!Number.isFinite(target) || target < 1 || target > 1000 || appliedBotCrashCommandIds.has(command.commandId)) return;
  appliedBotCrashCommandIds.add(command.commandId);
  if (appliedBotCrashCommandIds.size > 128) appliedBotCrashCommandIds.delete(appliedBotCrashCommandIds.values().next().value);

  const now = Date.now();
  if (phase === 'flight' && !videoFlightProfile && target !== 21.47 && currentMultiplier < target) {
    const normalizedMultiplier = Math.max(0, Math.min(1, (currentMultiplier - 1) / (target - 1)));
    const progress = Math.pow(normalizedMultiplier, 1 / 1.66);
    displayedCrash = target;
    const nextDuration = flightDuration();
    phaseStart = now - progress * nextDuration;
    pendingBotCrashTarget = null;
    const elapsed = now - phaseStart;
    updateFlight(elapsed);
    updateChartDots(elapsed, true);
    setScene();
    return;
  }

  pendingBotCrashTarget = target;
}

function tick() {
  const now = Date.now();
  const elapsed = now - phaseStart;
  if (phase === 'flight') {
    updateFlight(elapsed);
    updateChartDots(elapsed, true);
    if (autoEnabled && autoConfig.cashout >= 1.01) {
      bets.forEach(bet => {
        if (bet.state === 'live' && currentMultiplier >= autoConfig.cashout) {
          cashOutBet(bet);
          renderCards();
        }
      });
    }
    if (elapsed >= flightDuration()) {
      phase = 'crash';
      phaseStart = now;
      currentMultiplier = displayedCrash;
      if (videoFlightProfile) flareNode.setAttribute('href', videoCrashFrames[0]);
      bets.forEach(bet => {
        if (bet.state === 'live') {
          void window.AviatorWalletBridge?.settleLoss({
            requestId: `loss:${walletSessionId}:${roundNumber}:${bet.id}`,
            gameId: 'crash',
            roundId: String(roundNumber),
            betId: String(bet.id)
          }).catch(() => {});
          if (!bet.processing) {
            if (autoEnabled) autoNextBet = nextAutoAmount(false, bet.amount);
            bet.state = 'ready';
            bet.win = 0;
          }
        }
      });
      renderCards();
      if (!videoFlightProfile) showNotice('Vous aurez plus de chance la prochaine fois !', 'danger', 2100);
    }
  } else if (phase === 'crash' && videoFlightProfile && elapsed < crashPause) {
    const frameIndex = Math.min(videoCrashFrames.length - 1, Math.floor(elapsed / (crashPause / videoCrashFrames.length)));
    flareNode.setAttribute('href', videoCrashFrames[frameIndex]);
  } else if (phase === 'crash' && elapsed >= crashPause) {
    phase = 'countdown';
    phaseStart = now;
    countdownNode.textContent = String(COUNTDOWN_SECONDS);
    createSimulatedPlayers();
    updateChartDots(0, false);
    updateCountdownIndicator(0);
    chart.classList.add('is-countdown');
  } else if (phase === 'countdown') {
    const remain = Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000));
    countdownNode.textContent = String(remain);
    updateCountdownIndicator(elapsed);
    if (elapsed >= countdownLength) {
      phase = 'flight';
      phaseStart = now;
      roundNumber += 1;
      displayedCrash = pendingBotCrashTarget ?? upcomingCrashes[crashCursor % upcomingCrashes.length];
      pendingBotCrashTarget = null;
      videoFlightProfile = displayedCrash === 21.47;
      crashCursor += 1;
      currentMultiplier = 1;
      updateFlight(0);
      updateChartDots(0, true);
      bets.forEach(bet => {
        if (bet.state === 'queued' && bet.targetRound <= roundNumber) {
          bet.state = 'live';
          bet.targetRound = null;
          void window.AviatorWalletBridge.activateBet({
            requestId: `activate:${walletSessionId}:${roundNumber}:${bet.id}`,
            gameId: 'crash',
            roundId: String(roundNumber),
            betId: String(bet.id)
          }).catch(error => showNotice(error?.message || 'Mise non activée.', 'danger', 2600));
        } else if (bet.state === 'cashed') {
          bet.state = 'ready';
          bet.win = 0;
          if (autoEnabled) {
            bet.amount = autoNextBet;
            bet.autoAttemptedRound = roundNumber;
            void queueStake(bet, roundNumber);
          }
        } else if (bet.state === 'ready' && autoEnabled && !bet.processing && bet.autoAttemptedRound !== roundNumber) {
          bet.amount = autoNextBet;
          bet.autoAttemptedRound = roundNumber;
          void queueStake(bet, roundNumber);
        }
      });
      renderCards();
    }
  }
  updateSimulatedPlayers(now);
  setScene();
}

const chartDotsXNode = document.getElementById('chart-dots-x');
const chartDotsYNode = document.getElementById('chart-dots-y');
const horizontalDots = [];
const verticalDots = [];
for (let i = 0; i < 8; i += 1) {
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '2');
  chartDotsXNode.append(dot);
  horizontalDots.push(dot);
}
for (let i = 0; i < verticalDotCount; i += 1) {
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', '10');
  dot.setAttribute('r', '2.1');
  chartDotsYNode.append(dot);
  verticalDots.push(dot);
}

function updateChartDots(elapsed = 0, scrolling = phase === 'flight') {
  if (scrolling) {
    const crashReference = Math.max(1.01, displayedCrash);
    const oddsProgress = Math.max(0, Math.min(1,
      Math.log(Math.max(1, currentMultiplier)) / Math.log(crashReference)
    ));
    // À mesure que la cote monte, les repères accélèrent pour renforcer
    // l'impression de vitesse du vol sans déplacer les lignes de grille.
    const motionRate = 1 + oddsProgress * 2.2;
    const motionElapsed = elapsed / 1000 * motionRate;
    chartDotOffsetX = (motionElapsed * horizontalDotSpeed) % horizontalDotSpacing;
    chartDotOffsetY = (motionElapsed * verticalDotSpeed) % (verticalDotSpacing * verticalDotCount);
  } else if (elapsed === 0) {
    chartDotOffsetX = 0;
    chartDotOffsetY = 0;
  }
  horizontalDots.forEach((dot, index) => {
    dot.setAttribute('cx', String(horizontalDotBase + index * horizontalDotSpacing - chartDotOffsetX));
    dot.setAttribute('cy', '130');
  });
  verticalDots.forEach((dot, index) => {
    const cycle = verticalDotSpacing * verticalDotCount;
    const y = verticalDotBase + ((index * verticalDotSpacing + chartDotOffsetY) % cycle);
    dot.setAttribute('cy', String(y));
  });
}
updateChartDots(0, false);

function renderRows(rows = startingRows) {
  const rowsHost = document.getElementById('bet-rows');
  rowsHost.innerHTML = '';
  rows.forEach((row, index) => {
    const line = document.createElement('div');
    line.className = 'bet-row';
    const colorClass = index % 6 === 0 ? 'positive' : '';
    line.innerHTML = `<span>${row[0]}</span><span class="${colorClass}">${row[1]}</span><span class="amount">${row[2]} XAF</span><span class="gain">${row[3]} XAF</span>`;
    rowsHost.append(line);
  });
}

function playerName(index, round) {
  const suffix = String((41 + index * 17 + round * 13) % 90).padStart(2, '0');
  return `******${suffix}`;
}

function createSimulatedPlayers() {
  const betsByTarget = [200400, 200400, 160400, 94000, 70000, 60000, 20000, 20000, 6000, 2000, 2000, 800, 800, 400, 400, 200];
  simulatedPlayers = playerCashoutTargets.map((target, index) => ({
    name: playerName(index, roundNumber),
    target,
    bet: betsByTarget[index],
    state: 'queued',
    payout: 0
  }));
  renderSimulatedPlayers();
}

function renderSimulatedPlayers() {
  const rowsHost = document.getElementById('bet-rows');
  rowsHost.innerHTML = '';
  simulatedPlayers.slice()
    .sort((a, b) => (b.payout - a.payout) || (a.target - b.target))
    .forEach(player => {
      const line = document.createElement('div');
      line.className = `bet-row player-${player.state}`;
      const odds = player.state === 'cashed' ? `x${player.target.toFixed(2)}` : 'x0';
      const payout = player.state === 'cashed' ? moneyText(player.payout) : '0';
      line.innerHTML = `<span>${player.name}</span><span class="${player.state === 'cashed' ? 'positive' : ''}">${odds}</span><span class="amount">${moneyText(player.bet)} XAF</span><span class="gain">${payout} XAF</span>`;
      rowsHost.append(line);
    });
}

function updateSimulatedPlayers(now) {
  if (!simulatedPlayers.length) return;
  if (phase === 'countdown') {
    simulatedPlayers.forEach(player => {
      player.state = 'queued';
      player.payout = 0;
    });
  } else if (phase === 'flight') {
    simulatedPlayers.forEach(player => {
      if (player.state === 'queued') player.state = 'live';
      if (player.state === 'live' && currentMultiplier >= player.target) {
        player.state = 'cashed';
        player.payout = Math.round(player.bet * player.target * 100) / 100;
      }
    });
  } else if (phase === 'crash') {
    simulatedPlayers.forEach(player => {
      if (player.state === 'live' || player.state === 'queued') player.state = 'lost';
    });
  }
  if (now - lastPlayerRowsRender >= 100 || phase !== 'flight') {
    renderSimulatedPlayers();
    lastPlayerRowsRender = now;
  }
}

const modalLayer = document.getElementById('modal-layer');
const rulesModal = document.getElementById('rules-modal');
const autoModal = document.getElementById('auto-modal');
function openModal(modal) {
  modalLayer.hidden = false;
  rulesModal.hidden = modal !== rulesModal;
  autoModal.hidden = modal !== autoModal;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modalLayer.hidden = true;
  rulesModal.hidden = true;
  autoModal.hidden = true;
  document.body.style.overflow = '';
}
function openAutoModal() {
  document.getElementById('base-bet').value = String(autoConfig.base);
  document.getElementById('max-bet').value = autoConfig.max || '';
  document.getElementById('auto-cashout').value = autoConfig.cashout || '';
  document.querySelector(`input[name="win-choice"][value="${autoConfig.onWin}"]`).checked = true;
  document.querySelector(`input[name="loss-choice"][value="${autoConfig.onLoss}"]`).checked = true;
  openModal(autoModal);
}
document.getElementById('open-rules').addEventListener('click', () => openModal(rulesModal));
document.getElementById('add-bet').addEventListener('click', () => {
  if (bets.length >= 3) return;
  bets.push({ id: nextBetId++, amount: 400, state: 'ready', targetRound: null, win: 0 });
  renderCards();
});
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modalLayer.hidden) closeModal(); });
document.getElementById('auto-form').addEventListener('submit', event => {
  event.preventDefault();
  const requestedMax = Number(document.getElementById('max-bet').value) || 0;
  autoConfig = {
    base: Math.max(200, Number(document.getElementById('base-bet').value) || 400),
    max: requestedMax >= 200 ? requestedMax : 0,
    cashout: Number(document.getElementById('auto-cashout').value) || 0,
    onWin: document.querySelector('input[name="win-choice"]:checked').value,
    onLoss: document.querySelector('input[name="loss-choice"]:checked').value
  };
  if (autoConfig.max) autoConfig.base = Math.min(autoConfig.base, autoConfig.max);
  autoNextBet = autoConfig.base;
  autoEnabled = true;
  bets.forEach(bet => {
    if (bet.state === 'ready') {
      bet.amount = autoNextBet;
      bet.autoAttemptedRound = roundNumber + 1;
      void queueStake(bet, roundNumber + 1);
    }
  });
  renderCards();
  closeModal();
  showNotice('Jeu automatique activé.', 'success', 1800);
});
document.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => {
  const field = document.getElementById(button.dataset.clear);
  field.value = '';
  field.focus();
}));
document.getElementById('history-tab').addEventListener('click', event => {
  event.currentTarget.classList.toggle('history-selected');
  setTimeout(() => event.currentTarget.classList.remove('history-selected'), 450);
});

document.getElementById('balance').textContent = 'Connexion…';
renderCards();
renderRows();
document.querySelector('.back-button')?.addEventListener('click', () => window.AviatorWalletBridge?.exit?.());
if (window.AviatorWalletBridge) {
  window.AviatorWalletBridge.onCrashTarget?.(applyBotCrashTarget);
  window.AviatorWalletBridge.subscribe(applyWalletSnapshot);
  window.AviatorWalletBridge.getBalance()
    .then(applyWalletSnapshot)
    .catch(error => showNotice(error?.message || 'Portefeuille indisponible.', 'danger', 5000));
} else {
  showNotice('Portefeuille indisponible.', 'danger', 5000);
}

const visualPreset = (window.location.hash.slice(1) || 'play').toLowerCase();
const appShell = document.querySelector('.app-shell');
const referenceRows = {
  countdown: [['******85','x0','929.55','0'],['******51','x0','800','0'],['******29','x0','722.03','0'],['******25','x0','575.79','0'],['******51','x0','464.78','0'],['******59','x0','400','0'],['******59','x0','400','0']],
  accepted: [['******09','x0','1605.72','0'],['******81','x0','1584.46','0'],['******83','x0','1200','0'],['******57','x0','1176.02','0']],
  cashout: [['******57','x0','1176.02','0'],['******79','x0','1134.22','0'],['******83','x0','1038.66','0'],['******39','x0','1025.83','0']],
  crash104: [['******53','x0','1260.25','0'],['******57','x0','1176.02','0'],['******83','x0','1038.66','0'],['******47','x0','1000','0'],['******09','x0','1000','0'],['******61','x0','1000','0']]
};

function setReferenceStats(count, total, wins, shownBalance) {
  publicBetCount = count;
  totalBetAmount = total;
  totalWinAmount = wins;
  balance = shownBalance;
  document.getElementById('bet-count').textContent = String(count);
  document.getElementById('total-bets').textContent = moneyText(total);
  document.getElementById('total-wins').textContent = moneyText(wins);
  document.getElementById('balance').textContent = `${moneyText(balance)} F`;
}

function setReferenceCards(states) {
  bets.splice(0, bets.length);
  states.forEach((state, index) => bets.push({
    id: index + 1,
    amount: 400,
    state,
    targetRound: state === 'queued' ? roundNumber + 1 : null,
    win: 0
  }));
  nextBetId = states.length + 1;
  renderCards();
}

function setReferenceCountdown(number, states, stats, rowSet, dimmed = false) {
  phase = 'countdown';
  phaseStart = Date.now();
  displayedCrash = 1;
  currentMultiplier = 1;
  setReferenceCards(states);
  setReferenceStats(...stats);
  renderRows(rowSet || startingRows);
  countdownNode.textContent = number || '';
  const referenceRemaining = Math.max(1, Math.min(5, Number(number) || 5));
  updateCountdownIndicator((5 - referenceRemaining) * 1000);
  updateChartDots(0, false);
  if (!number) countdownNode.style.display = 'none';
  setScene();
  multiplierNode.style.display = 'none';
  appShell.classList.toggle('reference-dim', dimmed);
}

function setReferenceFlight(multiplier, crash, states, stats, rowSet) {
  phase = 'flight';
  videoFlightProfile = false;
  displayedCrash = crash;
  const progress = crash <= 1.05 ? 0 : Math.pow((multiplier - 1) / (crash - 1), 1 / 1.66);
  phaseStart = Date.now() - flightDuration() * Math.max(0, Math.min(1, progress));
  setReferenceCards(states);
  setReferenceStats(...stats);
  renderRows(rowSet || startingRows);
  const elapsed = flightDuration() * Math.max(0, Math.min(1, progress));
  updateFlight(elapsed);
  updateChartDots(elapsed, true);
  setScene();
  appShell.classList.remove('reference-dim');
}

function setReferenceNotice(text, type = 'success', duration = 60000) {
  showNotice(text, type, duration);
}

if (visualPreset === 'play') {
  phase = 'countdown';
  phaseStart = Date.now();
  currentMultiplier = 1;
  displayedCrash = 21.47;
  videoFlightProfile = true;
  countdownNode.textContent = String(COUNTDOWN_SECONDS);
  createSimulatedPlayers();
  updateCountdownIndicator(0);
  updateChartDots(0, false);
  setScene();
  renderCards();
  const animateGame = () => {
    tick();
    if (testMode) window.setTimeout(animateGame, 16);
    else window.requestAnimationFrame(animateGame);
  };
  if (testMode) window.setTimeout(animateGame, 0);
  else window.requestAnimationFrame(animateGame);
} else if (visualPreset === 'initial') {
  const initialProgress = Math.pow((1.49 - 1) / (3.18 - 1), 1 / 1.66);
  phase = 'flight';
  displayedCrash = 3.18;
  phaseStart = Date.now() - initialProgress * flightDuration();
  updateFlight(initialProgress * flightDuration());
  updateChartDots(initialProgress * flightDuration(), true);
  setScene();
} else if (visualPreset === 'countdown') {
  setReferenceCountdown('7', ['queued','queued'], [39,36004.62,0,5427511.69], referenceRows.countdown, true);
  setReferenceNotice('Votre pari est accepté !','success');
} else if (visualPreset === 'accepted') {
  setReferenceCountdown('', ['queued','queued','ready'], [2760,2283804.6,0,5427511.69], referenceRows.accepted, true);
  setReferenceNotice('Votre pari est accepté !', 'success');
} else if (visualPreset === 'rules') {
  setReferenceCountdown('', ['ready','ready','ready'], [1038,518125.34,0,5427511.69], startingRows);
  openModal(rulesModal);
} else if (visualPreset === 'flightstart' || visualPreset === 'round-start') {
  setReferenceFlight(1.00,3.18,['live','live','ready'],[2760,2283804.6,0,5427511.69],referenceRows.accepted);
} else if (visualPreset === 'flight106') {
  setReferenceFlight(1.06,3.18,['live','live','ready'],[2760,2283804.6,0,5427511.69],referenceRows.accepted);
} else if (visualPreset === 'auto-early' || visualPreset === 'auto30' || visualPreset === 'flight126') {
  setReferenceFlight(1.26,5.07,['queued','queued'],[2760,2611214.68,3013.08,5427511.69]);
  setReferenceNotice('Bet on the next round has been accepted','success-early');
  if (visualPreset !== 'flight126') openAutoModal();
} else if (visualPreset === 'highflight') {
  setReferenceFlight(5.07,5.07,['ready','ready','ready'],[2760,2611214.68,3013.08,5427511.69]);
} else if (visualPreset === 'live') {
  setReferenceFlight(2.74,3.42,['live','live','ready'],[4698,2649996,1479361.5,5427511.69],referenceRows.cashout);
} else if (visualPreset === 'cashed') {
  setReferenceFlight(3.23,3.42,['live','live','ready'],[4698,2649996,1841592.42,5428451.69],referenceRows.cashout);
  setReferenceNotice('Vous avez gagné: 940 XAF','success');
} else if (visualPreset === 'crash342') {
  videoFlightProfile = false;
  phase = 'crash';
  displayedCrash = 3.42;
  setReferenceCards(['cashed','ready','ready']);
  setReferenceStats(4698,2649996,1841592.42,5428451.69);
  renderRows(referenceRows.cashout);
  updateFlight(flightDuration());
  updateChartDots(flightDuration(), true);
  setScene();
  setReferenceNotice('Vous aurez plus de chance la prochaine fois !','danger');
  appShell.classList.remove('reference-dim');
} else if (visualPreset === 'crash') {
  videoFlightProfile = false;
  phase = 'crash';
  displayedCrash = 1;
  currentMultiplier = 1;
  setReferenceCards(['ready','ready','ready']);
  setReferenceStats(2760,2283804.6,0,5427511.69);
  renderRows(referenceRows.accepted);
  updateFlight(0);
  updateChartDots(0, false);
  setScene();
  setReferenceNotice('Vous aurez plus de chance la prochaine fois !','danger');
  appShell.classList.remove('reference-dim');
} else if (visualPreset === 'crash104') {
  videoFlightProfile = false;
  phase = 'crash';
  displayedCrash = 1.04;
  setReferenceCards(['ready','ready']);
  setReferenceStats(4572,4463392.68,0,5426451.69);
  renderRows(referenceRows.crash104);
  updateFlight(flightDuration());
  updateChartDots(flightDuration(), true);
  setScene();
  setReferenceNotice('Vous aurez plus de chance la prochaine fois !','danger');
} else if (visualPreset === 'final-countdown' || visualPreset === 'countdown-final') {
  setReferenceCountdown('7',['queued','queued','ready'],[4572,4463392.68,0,5426451.69],referenceRows.crash104,true);
  setReferenceNotice('Votre pari est accepté !','success');
} else if (visualPreset === 'auto' || visualPreset === 'auto-final') {
  setReferenceCountdown('1', ['queued','queued','ready'], [2736,2130017.76,0,5426511.69]);
  setReferenceNotice('Votre pari est accepté !','success');
  openAutoModal();
} else if (visualPreset === 'video-crash' || visualPreset === 'video-explosion') {
  phase = 'crash';
  videoFlightProfile = true;
  displayedCrash = 21.47;
  currentMultiplier = 21.47;
  setReferenceCards(['ready','ready']);
  setReferenceStats(2760,2283804.6,0,5427511.69);
  renderRows(referenceRows.accepted);
  updateFlight(flightDuration());
  updateChartDots(flightDuration(), true);
  flareNode.setAttribute('href', visualPreset === 'video-explosion' ? videoCrashFrames[0] : videoCrashFrames[3]);
  setScene();
  noticeNode.hidden = true;
  appShell.classList.remove('reference-dim');
} else {
  setInterval(tick, 160);
}
