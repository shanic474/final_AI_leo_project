const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

console.log("\n=== MOST COMMON LEGO PART PAIRS ===\n");

const pairs = db.prepare(`
  SELECT
    ip1.part_num AS part_a,
    p1.name AS part_a_name,
    
    ip2.part_num AS part_b,
    p2.name AS part_b_name,

    COUNT(DISTINCT i1.set_num) AS set_count

  FROM inventory_parts ip1

  JOIN inventory_parts ip2
    ON ip1.inventory_id = ip2.inventory_id
    AND ip1.part_num < ip2.part_num

  JOIN inventories i1
    ON ip1.inventory_id = i1.id

  JOIN parts p1
    ON ip1.part_num = p1.part_num

  JOIN parts p2
    ON ip2.part_num = p2.part_num

  WHERE ip1.is_spare = 0
    AND ip2.is_spare = 0

  GROUP BY
    ip1.part_num,
    ip2.part_num

  ORDER BY set_count DESC

  LIMIT 50;
`).all();

console.table(pairs);

db.close();