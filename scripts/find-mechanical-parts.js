const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

console.log("\n=== MECHANICAL LEGO PARTS ===\n");

const parts = db.prepare(`
  SELECT
    part_num,
    name,
    category_id
  FROM parts
  WHERE
       LOWER(name) LIKE '%gear%'
    OR LOWER(name) LIKE '%axle%'
    OR LOWER(name) LIKE '%wheel%'
    OR LOWER(name) LIKE '%beam%'
    OR LOWER(name) LIKE '%pin%'
    OR LOWER(name) LIKE '%hinge%'
    OR LOWER(name) LIKE '%connector%'
    OR LOWER(name) LIKE '%pulley%'
    OR LOWER(name) LIKE '%differential%'
    OR LOWER(name) LIKE '%worm%'
    OR LOWER(name) LIKE '%shaft%'
    OR LOWER(name) LIKE '%joint%'
  ORDER BY name;
`).all();

console.table(parts);

console.log(`\nFound ${parts.length} potentially mechanical parts.`);

db.close();
