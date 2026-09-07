const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

const coreCategoryIds = [12, 46, 51, 52, 53, 54, 55];
const categoryPlaceholders = coreCategoryIds.map(() => "?").join(", ");

console.log("\n=== MECHANICAL CORE PART PAIRS ===\n");

const pairs = db.prepare(`
  SELECT
    ip1.part_num AS part_a,
    p1.name AS part_a_name,
    c1.name AS part_a_category,

    ip2.part_num AS part_b,
    p2.name AS part_b_name,
    c2.name AS part_b_category,

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

  JOIN categories c1
    ON p1.category_id = c1.id

  JOIN categories c2
    ON p2.category_id = c2.id

  WHERE ip1.is_spare = 0
    AND ip2.is_spare = 0
    AND p1.category_id IN (${categoryPlaceholders})
    AND p2.category_id IN (${categoryPlaceholders})

  GROUP BY
    ip1.part_num,
    p1.name,
    c1.name,
    ip2.part_num,
    p2.name,
    c2.name

  ORDER BY set_count DESC
  LIMIT 50;
`).all(...coreCategoryIds, ...coreCategoryIds);

console.table(pairs);

console.log(`\nFound ${pairs.length} mechanical core pairs.`);

db.close();
