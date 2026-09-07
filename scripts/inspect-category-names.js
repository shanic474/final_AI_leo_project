const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

console.log("\n=== CATEGORY NAMES ===\n");

const rows = db.prepare(`
  SELECT
    c.id AS category_id,
    c.name AS category_name,
    COUNT(p.part_num) AS part_count
  FROM categories c
  LEFT JOIN parts p
    ON p.category_id = c.id
  GROUP BY c.id, c.name
  ORDER BY c.id;
`).all();

rows.forEach(row => {
  console.log(
    `${row.category_id} | ${row.category_name} | ${row.part_count} parts`
  );
});

db.close();
