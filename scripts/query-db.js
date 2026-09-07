const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

// Change this to any set that exists in your database
const setNumber = "42100-1";

const rows = db.prepare(`
  SELECT
    s.set_num,
    s.name AS set_name,
    p.part_num,
    p.name AS part_name,
    c.name AS category,
    ip.quantity,
    ip.color_id
  FROM sets s
  JOIN inventories i
    ON s.set_num = i.set_num
  JOIN inventory_parts ip
    ON i.id = ip.inventory_id
  JOIN parts p
    ON ip.part_num = p.part_num
  LEFT JOIN categories c
    ON p.category_id = c.id
  WHERE s.set_num = ?
    AND ip.is_spare = 0
  ORDER BY c.name, p.name
`).all(setNumber);

console.log(`\n=== SET ${setNumber} ===\n`);

if (rows.length === 0) {
  console.log("No parts found for this set.");
} else {
  console.log(`Set: ${rows[0].set_name}`);
  console.log(`Parts records: ${rows.length}\n`);

  console.table(rows);
}

db.close();