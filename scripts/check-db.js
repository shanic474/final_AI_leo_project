const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

console.log("\n=== LEGO DATABASE CHECK ===\n");

const tables = [
  "categories",
  "parts",
  "sets",
  "inventories",
  "inventory_parts",
];

for (const table of tables) {
  const result = db
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .get();

  console.log(`${table}: ${result.count.toLocaleString()}`);
}

console.log("\n=== SAMPLE PARTS ===\n");

const parts = db
  .prepare(`
    SELECT part_num, name, material
    FROM parts
    LIMIT 10
  `)
  .all();

console.table(parts);

console.log("\n=== SAMPLE SETS ===\n");

const sets = db
  .prepare(`
    SELECT set_num, name, year, num_parts
    FROM sets
    ORDER BY year DESC
    LIMIT 10
  `)
  .all();

console.table(sets);

db.close();