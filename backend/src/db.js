import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const TABLES = ['caregivers', 'patients', 'delegates', 'pairingCodes', 'devices', 'refreshTokens',
  'drugs', 'prescriptions', 'doses', 'confirmations', 'alerts', 'labResults', 'appointments', 'reports', 'auditLogs'];
const PATIENT_TABLES = TABLES.filter(name => !['caregivers', 'patients', 'refreshTokens', 'drugs'].includes(name));

export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const sql = new DatabaseSync(filename);
  sql.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  sql.exec('CREATE TABLE IF NOT EXISTS schemaMigrations (version INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL)');
  if (!sql.prepare('SELECT version FROM schemaMigrations WHERE version = 1').get()) {
    sql.exec('BEGIN IMMEDIATE');
    try {
      for (const table of TABLES) {
        const links = PATIENT_TABLES.includes(table)
          ? ", patientId TEXT GENERATED ALWAYS AS (json_extract(data, '$.patientId')) VIRTUAL REFERENCES patients(id)"
          : table === 'patients'
            ? ", caregiverId TEXT GENERATED ALWAYS AS (json_extract(data, '$.caregiverId')) VIRTUAL REFERENCES caregivers(id)" : '';
        sql.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data))${links}, CHECK(json_extract(data, '$.id') = id))`);
        if (PATIENT_TABLES.includes(table)) sql.exec(`CREATE INDEX ${table}_patient_idx ON ${table}(patientId)`);
      }
      sql.exec(`
        CREATE UNIQUE INDEX caregiver_email ON caregivers(json_extract(data, '$.email'));
        CREATE UNIQUE INDEX one_active_prescription ON prescriptions(patientId) WHERE json_extract(data, '$.status') = 'ACTIVE';
        CREATE UNIQUE INDEX dose_schedule ON doses(json_extract(data, '$.prescriptionItemId'), json_extract(data, '$.date'), json_extract(data, '$.slot'));
        CREATE UNIQUE INDEX one_initial_confirmation ON confirmations(json_extract(data, '$.doseId')) WHERE json_extract(data, '$.correctsConfirmationId') IS NULL;
        CREATE UNIQUE INDEX one_correction_successor ON confirmations(json_extract(data, '$.correctsConfirmationId')) WHERE json_extract(data, '$.correctsConfirmationId') IS NOT NULL;
        CREATE UNIQUE INDEX device_token ON devices(json_extract(data, '$.tokenHash'));
        CREATE UNIQUE INDEX refresh_token ON refreshTokens(json_extract(data, '$.tokenHash'));
        CREATE UNIQUE INDEX pairing_code ON pairingCodes(json_extract(data, '$.codeHash'));
      `);
      for (const table of ['confirmations', 'auditLogs']) {
        for (const operation of ['UPDATE', 'DELETE']) {
          sql.exec(`CREATE TRIGGER immutable_${table}_${operation} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only record'); END`);
        }
      }
      sql.prepare('INSERT INTO schemaMigrations VALUES (1, ?)').run(new Date().toISOString());
      sql.exec('COMMIT');
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  }
  function tableName(name) {
    if (!TABLES.includes(name)) throw new Error('Unknown collection');
    return name;
  }
  const db = {
    get(table, id) {
      const row = sql.prepare(`SELECT data FROM ${tableName(table)} WHERE id = ?`).get(id);
      return row ? JSON.parse(row.data) : undefined;
    },
    list(table, filters = {}) {
      const clauses = [], values = [];
      for (const [key, value] of Object.entries(filters)) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw new Error('Invalid filter key');
        clauses.push(key === 'patientId' && PATIENT_TABLES.includes(table) ? 'patientId IS ?' : `json_extract(data, '$.${key}') IS ?`);
        values.push(typeof value === 'boolean' ? Number(value) : value);
      }
      return sql.prepare(`SELECT data FROM ${tableName(table)}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}`).all(...values).map(row => JSON.parse(row.data));
    },
    insert(table, record) {
      sql.prepare(`INSERT INTO ${tableName(table)} (id, data) VALUES (?, ?)`).run(record.id, JSON.stringify(record));
      return structuredClone(record);
    },
    update(table, id, patch) {
      const current = db.get(table, id);
      if (!current) throw new Error(`Missing ${table} record`);
      const record = { ...current, ...patch, id };
      sql.prepare(`UPDATE ${tableName(table)} SET data = ? WHERE id = ?`).run(JSON.stringify(record), id);
      return structuredClone(record);
    },
    transaction(fn) {
      if (sql.isTransaction) return fn();
      sql.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        if (result && typeof result.then === 'function') throw new Error('Transactions must be synchronous');
        sql.exec('COMMIT');
        return result;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
    close: () => sql.close(),
  };
  return db;
}
