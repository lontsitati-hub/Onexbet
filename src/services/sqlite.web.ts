export type SQLiteDatabase = any;

const emptyDatabase = {
  execSync: () => undefined,
  runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
  getFirstSync: () => undefined,
  getAllSync: () => [],
};

export function openDatabaseSync(_name: string): SQLiteDatabase {
  return emptyDatabase;
}

export default { openDatabaseSync };
