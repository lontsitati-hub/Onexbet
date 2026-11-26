import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('onexbet.db');
  }
  return dbInstance;
}

export interface MacheRow {
  id?: number;
  fixtureId?: number;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  league: string;
  date: string;
  score: string;
  odd: number;
  betOption: string;
  sport?: 'football' | 'fifa' | 'mortal-kombat' | 'poker';
  fifaDurationMs?: number;
  mortalKombatDurationMs?: number;
  pokerDurationMs?: number;
  scorePeriod1?: string;
  scorePeriod2?: string;
  // ── Toutes les options de paris avec leur cote dédiée ──
  oddV1?: number;
  oddNul?: number;
  oddV2?: number;
  oddDc1x?: number;
  oddDc12?: number;
  oddDcX2?: number;
  oddOver15?: number;
  oddOver25?: number;
  oddOver35?: number;
  oddUnder15?: number;
  oddUnder25?: number;
  oddUnder35?: number;
  oddBttsYes?: number;
  oddBttsNo?: number;
  oddScoreExact?: number;
  oddHtV1?: number;
  oddHtNul?: number;
  oddHtV2?: number;
  oddHandicap?: number;
}

export interface CouponRow {
  id: string;
  type: string;
  date: string;
  eventCount: number;
  totalOdds: number;
  stake: number;
  potentialGain: number;
  status: string;
  eventsJson: string; // JSON string of BetEvent[]
  sellAmount?: number;
  code?: string;
  gainCredited?: number;
}

export interface CompteRow {
  id: number;
  balance: number;
  randomSessionId: string;
  theme?: string;
}

/**
 * Initializes the SQLite database and creates the tables if they do not exist.
 */
export function initDatabase() {
  try {
    // Enable WAL mode in a separate block to avoid failing table creation if WAL pragma is not supported
    try {
      getDb().execSync('PRAGMA journal_mode = WAL;');
    } catch (e) {
      console.warn('Could not set journal_mode to WAL:', e);
    }

    // Create tables
    getDb().execSync(`
      CREATE TABLE IF NOT EXISTS mache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fixtureId INTEGER,
        sport TEXT,
        fifaDurationMs INTEGER,
        mortalKombatDurationMs INTEGER,
        pokerDurationMs INTEGER,
        homeTeam TEXT NOT NULL,
        homeLogo TEXT,
        awayTeam TEXT NOT NULL,
        awayLogo TEXT,
        league TEXT,
        date TEXT,
        score TEXT,
        odd REAL,
        betOption TEXT
      );

      CREATE TABLE IF NOT EXISTS coupon (
        id TEXT PRIMARY KEY,
        type TEXT,
        date TEXT,
        eventCount INTEGER,
        totalOdds REAL,
        stake REAL,
        potentialGain REAL,
        status TEXT,
        eventsJson TEXT,
        sellAmount REAL DEFAULT 470.0,
        gainCredited INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS compte (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        balance REAL DEFAULT 10000.0,
        randomSessionId TEXT,
        theme TEXT DEFAULT 'blue'
      );

      CREATE TABLE IF NOT EXISTS activation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        activated_at TEXT NOT NULL
      );
    `);
    console.log('SQLite database initialized successfully.');

    // Métadonnées nécessaires pour retrouver le même événement dans Populaire
    // et conserver les logos/durées choisis au moment de sa création.
    const matchColumns: Array<[string, string]> = [
      ['fixtureId', 'INTEGER'], ['sport', 'TEXT'], ['fifaDurationMs', 'INTEGER'],
      ['mortalKombatDurationMs', 'INTEGER'], ['pokerDurationMs', 'INTEGER'],
    ];
    for (const [col, type] of matchColumns) {
      try { getDb().execSync(`ALTER TABLE mache ADD COLUMN ${col} ${type}`); } catch (_) { }
    }

    // Database Migration: Add scorePeriod1 and scorePeriod2 columns if they don't exist
    try {
      getDb().execSync('ALTER TABLE mache ADD COLUMN scorePeriod1 TEXT DEFAULT "0 - 0"');
    } catch (_) { }
    try {
      getDb().execSync('ALTER TABLE mache ADD COLUMN scorePeriod2 TEXT DEFAULT "0 - 0"');
    } catch (_) { }
    try {
      getDb().execSync('ALTER TABLE coupon ADD COLUMN sellAmount REAL DEFAULT 470.0');
    } catch (_) { }
    try {
      getDb().execSync('ALTER TABLE coupon ADD COLUMN code TEXT');
    } catch (_) { }
    try {
      getDb().execSync('ALTER TABLE coupon ADD COLUMN gainCredited INTEGER DEFAULT 0');
    } catch (_) { }

    // ── Migration : colonnes d'options de paris avec cotes dédiées ──
    const oddsColumns: Array<[string, string]> = [
      ['oddV1', 'REAL'], ['oddNul', 'REAL'], ['oddV2', 'REAL'],
      ['oddDc1x', 'REAL'], ['oddDc12', 'REAL'], ['oddDcX2', 'REAL'],
      ['oddOver15', 'REAL'], ['oddOver25', 'REAL'], ['oddOver35', 'REAL'],
      ['oddUnder15', 'REAL'], ['oddUnder25', 'REAL'], ['oddUnder35', 'REAL'],
      ['oddBttsYes', 'REAL'], ['oddBttsNo', 'REAL'],
      ['oddScoreExact', 'REAL'],
      ['oddHtV1', 'REAL'], ['oddHtNul', 'REAL'], ['oddHtV2', 'REAL'],
      ['oddHandicap', 'REAL'],
    ];
    for (const [col, type] of oddsColumns) {
      try {
        getDb().execSync(`ALTER TABLE mache ADD COLUMN ${col} ${type}`);
      } catch (_) { }
    }
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
  }
}

/**
 * Generates a random session ID (aliatoire ID) and updates it in the 'compte' table.
 * If no record exists, it inserts a default one.
 */
export function generateAndSaveSessionId(): { sessionId: string; balance: number } {
  try {
    // Generate random alphanumeric ID (e.g. Session-8A7B39)
    const randomHex = Math.floor(0x100000 + Math.random() * 0x900000)
      .toString(16)
      .toUpperCase();
    const sessionId = `Session-${randomHex}`;

    // Check if a row exists in 'compte'
    const row = getDb().getFirstSync<CompteRow>('SELECT * FROM compte LIMIT 1');

    if (row) {
      getDb().runSync(
        'UPDATE compte SET randomSessionId = ? WHERE id = ?',
        sessionId,
        row.id
      );
      return { sessionId, balance: row.balance };
    } else {
      const defaultBalance = 15000.0; // Default startup balance
      getDb().runSync(
        'INSERT INTO compte (balance, randomSessionId) VALUES (?, ?)',
        defaultBalance,
        sessionId
      );
      return { sessionId, balance: defaultBalance };
    }
  } catch (error) {
    console.error('Error generating/saving session ID:', error);
    return { sessionId: 'Session-ERROR', balance: 0 };
  }
}

/**
 * Updates the balance in the database.
 */
export function updateCompteBalance(balance: number): boolean {
  try {
    const row = getDb().getFirstSync<CompteRow>('SELECT * FROM compte LIMIT 1');
    if (row) {
      getDb().runSync('UPDATE compte SET balance = ? WHERE id = ?', balance, row.id);
    } else {
      getDb().runSync('INSERT INTO compte (balance) VALUES (?)', balance);
    }
    return true;
  } catch (error) {
    console.error('Error updating balance in database:', error);
    return false;
  }
}

/**
 * Updates the theme in the database.
 */
export function updateCompteTheme(theme: string) {
  try {
    const row = getDb().getFirstSync<CompteRow>('SELECT * FROM compte LIMIT 1');
    if (row) {
      getDb().runSync('UPDATE compte SET theme = ? WHERE id = ?', theme, row.id);
    } else {
      getDb().runSync('INSERT INTO compte (theme) VALUES (?)', theme);
    }
  } catch (error) {
    console.error('Error updating theme in database:', error);
  }
}

/**
 * Fetches the current balance, session ID and theme.
 */
export function getCompteInfo(): { balance: number; sessionId: string; theme: string } {
  try {
    const row = getDb().getFirstSync<CompteRow>('SELECT * FROM compte LIMIT 1');
    return {
      balance: row?.balance ?? 15000.0,
      sessionId: row?.randomSessionId ?? 'Session-None',
      theme: row?.theme ?? 'blue',
    };
  } catch (error) {
    console.error('Error getting compte info:', error);
    return { balance: 15000.0, sessionId: 'Session-None', theme: 'blue' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚽  MACHE (MATCH) ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function insertMache(mache: MacheRow) {
  try {
    getDb().runSync(
      `INSERT INTO mache (
        fixtureId, sport, fifaDurationMs, mortalKombatDurationMs, pokerDurationMs,
        homeTeam, homeLogo, awayTeam, awayLogo, league, date, score, odd, betOption,
        scorePeriod1, scorePeriod2,
        oddV1, oddNul, oddV2, oddDc1x, oddDc12, oddDcX2,
        oddOver15, oddOver25, oddOver35, oddUnder15, oddUnder25, oddUnder35,
        oddBttsYes, oddBttsNo, oddScoreExact, oddHtV1, oddHtNul, oddHtV2, oddHandicap)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      mache.fixtureId ?? null,
      mache.sport ?? null,
      mache.fifaDurationMs ?? null,
      mache.mortalKombatDurationMs ?? null,
      mache.pokerDurationMs ?? null,
      mache.homeTeam,
      mache.homeLogo,
      mache.awayTeam,
      mache.awayLogo,
      mache.league,
      mache.date,
      mache.score,
      mache.odd,
      mache.betOption,
      mache.scorePeriod1 || '0 - 0',
      mache.scorePeriod2 || '0 - 0',
      mache.oddV1 ?? null, mache.oddNul ?? null, mache.oddV2 ?? null,
      mache.oddDc1x ?? null, mache.oddDc12 ?? null, mache.oddDcX2 ?? null,
      mache.oddOver15 ?? null, mache.oddOver25 ?? null, mache.oddOver35 ?? null,
      mache.oddUnder15 ?? null, mache.oddUnder25 ?? null, mache.oddUnder35 ?? null,
      mache.oddBttsYes ?? null, mache.oddBttsNo ?? null,
      mache.oddScoreExact ?? null,
      mache.oddHtV1 ?? null, mache.oddHtNul ?? null, mache.oddHtV2 ?? null,
      mache.oddHandicap ?? null
    );
  } catch (error) {
    console.error('Error inserting mache:', error);
  }
}

export function getAllMaches(): MacheRow[] {
  try {
    return getDb().getAllSync<MacheRow>('SELECT * FROM mache ORDER BY id DESC');
  } catch (error) {
    console.error('Error fetching all maches:', error);
    return [];
  }
}

export function clearMachesTable() {
  try {
    getDb().runSync('DELETE FROM mache');
  } catch (error) {
    console.error('Error clearing mache table:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎟️ ACTION ACTIONS / GESTION DES COUPONS DE PARI DANS LA BASE SQLITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insère un nouveau coupon de pari ou remplace un coupon existant (si même ID).
 * Sauvegarde toutes les informations de structure, les cotes, la mise et les événements en JSON.
 * @param coupon L'objet CouponRow représentant la ligne à insérer
 */
export function insertCoupon(coupon: CouponRow) {
  try {
    getDb().runSync(
      `INSERT OR REPLACE INTO coupon (id, type, date, eventCount, totalOdds, stake, potentialGain, status, eventsJson, sellAmount, code, gainCredited)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      coupon.id,
      coupon.type,
      coupon.date,
      coupon.eventCount,
      coupon.totalOdds,
      coupon.stake,
      coupon.potentialGain,
      coupon.status,
      coupon.eventsJson,
      coupon.sellAmount ?? 470.0,
      coupon.code ?? null, // Bind du code généré ou null si inexistant
      coupon.gainCredited ?? 0
    );
  } catch (error) {
    console.error('Erreur lors de l\'insertion du coupon :', error);
  }
}

/**
 * Met à jour le montant de revente estimé d'un coupon spécifique.
 * @param id Identifiant unique du coupon
 * @param sellAmount Nouveau montant proposé pour le rachat/revente du coupon
 */
export function updateCouponSellAmount(id: string, sellAmount: number) {
  try {
    getDb().runSync(
      'UPDATE coupon SET sellAmount = ? WHERE id = ?',
      sellAmount,
      id
    );
  } catch (error) {
    console.error('Erreur de mise à jour du montant de vente du coupon :', error);
  }
}

/**
 * Récupère l'intégralité des coupons enregistrés dans la table SQLite par ordre antéchronologique (du plus récent au plus ancien).
 * @returns Tableau d'objets CouponRow
 */
export function getAllCoupons(): CouponRow[] {
  try {
    return getDb().getAllSync<CouponRow>('SELECT * FROM coupon ORDER BY rowid DESC');
  } catch (error) {
    console.error('Erreur lors de la récupération de tous les coupons :', error);
    return [];
  }
}

/**
 * Supprime tous les enregistrements de la table coupon.
 */
export function clearCouponsTable() {
  try {
    getDb().runSync('DELETE FROM coupon');
  } catch (error) {
    console.error('Erreur lors du vidage de la table coupon :', error);
  }
}

/**
 * Supprime un coupon spécifique par son identifiant unique.
 * @param id Identifiant du coupon à supprimer
 */
export function deleteCouponById(id: string) {
  try {
    getDb().runSync('DELETE FROM coupon WHERE id = ?', id);
  } catch (error) {
    console.error('Erreur de suppression du coupon par ID :', error);
  }
}

/**
 * Récupère un unique coupon par son identifiant.
 * @param id Identifiant unique du coupon
 * @returns L'objet CouponRow correspondant ou null si introuvable
 */
export function getCouponById(id: string): CouponRow | null {
  try {
    return getDb().getFirstSync<CouponRow>('SELECT * FROM coupon WHERE id = ?', id);
  } catch (error) {
    console.error('Erreur de chargement du coupon par ID :', error);
    return null;
  }
}

/**
 * Recherche un coupon de pari de manière flexible, soit par son code court à 5 caractères
 * (insensible à la casse), soit par son identifiant numérique unique de transaction.
 * @param identifier Le code court (ex: ABCDE) ou l'identifiant (ex: 83331036291)
 * @returns La ligne CouponRow trouvée ou null si aucun match
 */
export function getCouponByCodeOrId(identifier: string): CouponRow | null {
  try {
    const db = getDb();
    // 1. Recherche par code court (converti en majuscules pour insensibilité à la casse)
    let row = db.getFirstSync<CouponRow>(
      'SELECT * FROM coupon WHERE UPPER(code) = ?',
      identifier.toUpperCase().trim()
    );
    if (!row) {
      // 2. Recherche alternative par identifiant transactionnel si le code ne donne rien
      row = db.getFirstSync<CouponRow>(
        'SELECT * FROM coupon WHERE id = ?',
        identifier.trim()
      );
    }
    return row;
  } catch (error) {
    console.error('Erreur lors de la récupération du coupon par code ou par ID :', error);
    return null;
  }
}

/**
 * Met à jour le statut d'un coupon de pari en 'Payé' (lorsque le pari est marqué gagnant par l'admin).
 * Enregistre également la nouvelle version JSON des événements contenant les scores mis à jour.
 * @param id Identifiant unique du coupon à clore
 * @param updatedEventsJson Chaîne JSON représentant les matches mis à jour avec leurs scores
 */
/**
 * Met à jour uniquement le JSON des événements d'un coupon (sans toucher au statut global).
 * Utilisé pour modifier le statut d'un match individuel au sein du coupon.
 * @param id Identifiant unique du coupon
 * @param updatedEventsJson Chaîne JSON des événements mis à jour
 */
export function updateCouponEventsJson(id: string, updatedEventsJson: string) {
  try {
    getDb().runSync(
      'UPDATE coupon SET eventsJson = ? WHERE id = ?',
      updatedEventsJson,
      id
    );
  } catch (error) {
    console.error('Erreur de mise à jour des événements du coupon :', error);
  }
}

/** Met à jour un coupon existant sans créer de nouvelle ligne ni changer son identifiant. */
export function updateCouponComplete(
  id: string,
  patch: { date: string; eventCount: number; totalOdds: number; stake: number; potentialGain: number; status: string; eventsJson: string }
) {
  try {
    getDb().runSync(
      `UPDATE coupon SET date = ?, eventCount = ?, totalOdds = ?, stake = ?, potentialGain = ?, status = ?, eventsJson = ? WHERE id = ?`,
      patch.date, patch.eventCount, patch.totalOdds, patch.stake, patch.potentialGain, patch.status, patch.eventsJson, id
    );
  } catch (error) {
    console.error('Erreur de mise à jour complète du coupon :', error);
  }
}

/**
 * Met à jour uniquement le statut global d'un coupon dans SQLite.
 * Utilisé pour passer automatiquement un coupon à "Gagné" quand tous ses matchs sont gagnés.
 */
export function updateCouponStatus(id: string, status: string) {
  try {
    getDb().runSync(
      'UPDATE coupon SET status = ? WHERE id = ?',
      status,
      id
    );
  } catch (error) {
    console.error('Erreur de mise à jour du statut du coupon :', error);
  }
}

export function markCouponAsPaid(id: string, updatedEventsJson: string) {
  try {
    getDb().runSync(
      'UPDATE coupon SET status = ?, eventsJson = ? WHERE id = ?',
      'Payé',
      updatedEventsJson,
      id
    );
  } catch (error) {
    console.error('Erreur de passage du coupon à l\'état Payé :', error);
  }
}

/** Réserve le crédit du gain une seule fois pour un coupon gagnant ou payé. */
export function claimCouponGain(id: string): boolean {
  try {
    const result = getDb().runSync(
      'UPDATE coupon SET gainCredited = 1 WHERE id = ? AND COALESCE(gainCredited, 0) = 0',
      id
    );
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur de réservation du gain du coupon :', error);
    return false;
  }
}

export function isAppActivated(): boolean {
  // Check localStorage first if on Web
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const webActivated = window.localStorage.getItem('onexbet_activated');
      if (webActivated === 'true') {
        return true;
      }
    } catch (e) {
      console.error('Error reading from localStorage:', e);
    }
  }

  try {
    const db = getDb();
    const result = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM activation'
    );
    return (result?.count ?? 0) > 0;
  } catch (e) {
    console.error('Error checking activation state:', e);
    return false;
  }
}

export function activateApp(code: string): void {
  // Save to localStorage if on Web
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('onexbet_activated', 'true');
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }

  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.runSync(
      'INSERT INTO activation (code, activated_at) VALUES (?, ?)',
      code,
      now
    );
  } catch (e) {
    console.error('Error saving activation:', e);
  }
}
