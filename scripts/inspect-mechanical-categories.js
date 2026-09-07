const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

console.log("\n=== MECHANICAL CANDIDATE CATEGORIES ===\n");

const rows = db.prepare(`
  SELECT
    p.category_id,
    COUNT(*) AS part_count,
    GROUP_CONCAT(
      CASE
        WHEN p.name IS NOT NULL THEN p.name
      END,
      ' | '
    ) AS examples
  FROM parts p
  WHERE
       LOWER(p.name) LIKE '%gear%'
    OR LOWER(p.name) LIKE '%axle%'
    OR LOWER(p.name) LIKE '%wheel%'
    OR LOWER(p.name) LIKE '%beam%'
    OR LOWER(p.name) LIKE '%pin%'
    OR LOWER(p.name) LIKE '%hinge%'
    OR LOWER(p.name) LIKE '%connector%'
    OR LOWER(p.name) LIKE '%pulley%'
    OR LOWER(p.name) LIKE '%differential%'
    OR LOWER(p.name) LIKE '%worm%'
    OR LOWER(p.name) LIKE '%shaft%'
    OR LOWER(p.name) LIKE '%joint%'
  GROUP BY p.category_id
  ORDER BY part_count DESC;
`).all();

console.table(rows);

db.close();
