const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

const coreCategoryIds = [12, 46, 51, 52, 53, 54, 55];
const minimumTripleSets = 20;
const minimumPartSets = 100;
const categoryPlaceholders = coreCategoryIds.map(() => "?").join(", ");

console.log("\n=== MECHANICAL CORE TRIPLES ===\n");
console.log(`Minimum triple set count: ${minimumTripleSets}`);
console.log(`Minimum sets per part: ${minimumPartSets}\n`);

const triples = db.prepare(`
  WITH core_parts AS (
    SELECT part_num
    FROM parts
    WHERE category_id IN (${categoryPlaceholders})
  ),
  core_inventory_parts AS (
    SELECT DISTINCT
      ip.inventory_id,
      ip.part_num
    FROM inventory_parts ip
    JOIN core_parts cp
      ON ip.part_num = cp.part_num
    WHERE ip.is_spare = 0
  ),
  part_set_counts AS (
    SELECT
      cip.part_num,
      COUNT(DISTINCT i.set_num) AS part_set_count
    FROM core_inventory_parts cip
    JOIN inventories i
      ON cip.inventory_id = i.id
    GROUP BY cip.part_num
    HAVING part_set_count >= ?
  ),
  triple_set_counts AS (
    SELECT
      ip1.part_num AS part_a,
      ip2.part_num AS part_b,
      ip3.part_num AS part_c,
      COUNT(DISTINCT i.set_num) AS triple_set_count
    FROM core_inventory_parts ip1
    JOIN core_inventory_parts ip2
      ON ip1.inventory_id = ip2.inventory_id
      AND ip1.part_num < ip2.part_num
    JOIN core_inventory_parts ip3
      ON ip2.inventory_id = ip3.inventory_id
      AND ip2.part_num < ip3.part_num
    JOIN part_set_counts psc1
      ON ip1.part_num = psc1.part_num
    JOIN part_set_counts psc2
      ON ip2.part_num = psc2.part_num
    JOIN part_set_counts psc3
      ON ip3.part_num = psc3.part_num
    JOIN inventories i
      ON ip1.inventory_id = i.id
    GROUP BY ip1.part_num, ip2.part_num, ip3.part_num
    HAVING triple_set_count >= ?
  )
  SELECT
    triple_set_counts.part_a,
    p1.name AS part_a_name,
    c1.name AS part_a_category,
    triple_set_counts.part_b,
    p2.name AS part_b_name,
    c2.name AS part_b_category,
    triple_set_counts.part_c,
    p3.name AS part_c_name,
    c3.name AS part_c_category,
    triple_set_counts.triple_set_count
  FROM triple_set_counts
  JOIN parts p1
    ON triple_set_counts.part_a = p1.part_num
  JOIN parts p2
    ON triple_set_counts.part_b = p2.part_num
  JOIN parts p3
    ON triple_set_counts.part_c = p3.part_num
  JOIN categories c1
    ON p1.category_id = c1.id
  JOIN categories c2
    ON p2.category_id = c2.id
  JOIN categories c3
    ON p3.category_id = c3.id
  ORDER BY triple_set_counts.triple_set_count DESC
  LIMIT 50;
`).all(
  ...coreCategoryIds,
  minimumPartSets,
  minimumTripleSets
);

triples.forEach((triple, index) => {
  console.log(
    `${index + 1} | `
      + `${triple.part_a} ${triple.part_a_name} (${triple.part_a_category}) + `
      + `${triple.part_b} ${triple.part_b_name} (${triple.part_b_category}) + `
      + `${triple.part_c} ${triple.part_c_name} (${triple.part_c_category}) `
      + `| sets=${triple.triple_set_count}`
  );
});

console.log(`\nFound ${triples.length} mechanical core triples.`);

db.close();
