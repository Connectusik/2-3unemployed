import Database from 'better-sqlite3';

const db = new Database('orders.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    subtotal REAL NOT NULL,
    composite_tax_rate REAL NOT NULL,
    tax_amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    state_rate REAL NOT NULL,
    county_rate REAL NOT NULL,
    city_rate REAL NOT NULL,
    special_rate REAL NOT NULL DEFAULT 0,
    special_rates TEXT NOT NULL DEFAULT '[]',
    special_rate_total REAL NOT NULL DEFAULT 0,
    jurisdictions TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS failed_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL,
    longitude REAL,
    subtotal REAL,
    reason TEXT NOT NULL,
    source TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing('orders', 'special_rate', 'REAL NOT NULL DEFAULT 0');
addColumnIfMissing('orders', 'special_rates', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('orders', 'special_rate_total', 'REAL NOT NULL DEFAULT 0');

db.exec(`
  UPDATE orders
  SET
    special_rates = CASE
      WHEN special_rates IS NULL OR special_rates = '' THEN
        CASE
          WHEN IFNULL(special_rate_total, special_rate) > 0 THEN
            '[{"name":"MCTD","rate":' || printf('%.6f', IFNULL(special_rate_total, special_rate)) || '}]'
          ELSE
            '[]'
        END
      ELSE special_rates
    END,
    special_rate_total = CASE
      WHEN IFNULL(special_rate_total, 0) = 0 THEN IFNULL(special_rate, 0)
      ELSE special_rate_total
    END,
    special_rate = IFNULL(special_rate, IFNULL(special_rate_total, 0))
`);

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', 'SecureAdmin2026!');
}

export default db;
