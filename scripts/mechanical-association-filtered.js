const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

const coreCategoryIds = [12, 46, 51, 52, 53, 54, 55];
const minimumPairSets = 50;
const minimumPartSets = 100;
const categoryPlaceholders = coreCategoryIds.map(() => "?").join(", ");

console.log("\n=== FILTERED MECHANICAL ASSOCIATION STRENGTH ===\n");
console.log(`Minimum pair set count: ${minimumPairSets}`);
console.log(`Minimum sets per part: ${minimumPartSets}\n`);

const associations = db.prepare(`
  WITH core_parts AS (
    SELECT part_num
    FROM parts
    WHERE category_id IN (${categoryPlaceholders})
  ),
  total_set_count AS (
    SELECT COUNT(DISTINCT set_num) AS total_sets
    FROM inventories
  ),
  part_set_counts AS (
    SELECT
      ip.part_num,
      COUNT(DISTINCT i.set_num) AS part_set_count
    FROM inventory_parts ip
    JOIN inventories i
      ON ip.inventory_id = i.id
    JOIN core_parts cp
      ON ip.part_num = cp.part_num
    WHERE ip.is_spare = 0
    GROUP BY ip.part_num
    HAVING part_set_count >= ?
  ),
  pair_set_counts AS (
    SELECT
      ip1.part_num AS part_a,
      ip2.part_num AS part_b,
      COUNT(DISTINCT i.set_num) AS pair_set_count
    FROM inventory_parts ip1
    JOIN inventory_parts ip2
      ON ip1.inventory_id = ip2.inventory_id
      AND ip1.part_num < ip2.part_num
    JOIN inventories i
      ON ip1.inventory_id = i.id
    JOIN core_parts cp1
      ON ip1.part_num = cp1.part_num
    JOIN core_parts cp2
      ON ip2.part_num = cp2.part_num
    WHERE ip1.is_spare = 0
      AND ip2.is_spare = 0
    GROUP BY ip1.part_num, ip2.part_num
    HAVING pair_set_count >= ?
  )
  SELECT
    pair_set_counts.part_a,
    p1.name AS part_a_name,
    c1.name AS part_a_category,
    pair_set_counts.part_b,
    p2.name AS part_b_name,
    c2.name AS part_b_category,
    pair_set_counts.pair_set_count AS set_count,
    a.part_set_count AS part_a_set_count,
    b.part_set_count AS part_b_set_count,
    total_set_count.total_sets,
    ROUND(1.0 * pair_set_counts.pair_set_count / total_set_count.total_sets, 6) AS support,
    ROUND(1.0 * pair_set_counts.pair_set_count / a.part_set_count, 6) AS confidence_a_to_b,
    ROUND(1.0 * pair_set_counts.pair_set_count / b.part_set_count, 6) AS confidence_b_to_a,
    ROUND(
      1.0 * pair_set_counts.pair_set_count * total_set_count.total_sets
      / (a.part_set_count * b.part_set_count),
      4
    ) AS lift,
    ROUND(
      1.0 * pair_set_counts.pair_set_count
      / (a.part_set_count + b.part_set_count - pair_set_counts.pair_set_count),
      6
    ) AS jaccard
  FROM pair_set_counts
  JOIN part_set_counts a
    ON pair_set_counts.part_a = a.part_num
  JOIN part_set_counts b
    ON pair_set_counts.part_b = b.part_num
  JOIN parts p1
    ON pair_set_counts.part_a = p1.part_num
  JOIN parts p2
    ON pair_set_counts.part_b = p2.part_num
  JOIN categories c1
    ON p1.category_id = c1.id
  JOIN categories c2
    ON p2.category_id = c2.id
  CROSS JOIN total_set_count
  ORDER BY lift DESC
  LIMIT 20;
`).all(
  ...coreCategoryIds,
  minimumPartSets,
  minimumPairSets
);

associations.forEach((association, index) => {
  console.log(
    `${index + 1} | ${association.part_a} ${association.part_a_name} (${association.part_a_category}) `
      + `+ ${association.part_b} ${association.part_b_name} (${association.part_b_category}) `
      + `| sets=${association.set_count} `
      + `| part_a_sets=${association.part_a_set_count} `
      + `| part_b_sets=${association.part_b_set_count} `
      + `| support=${association.support} `
      + `| confidence_a_to_b=${association.confidence_a_to_b} `
      + `| confidence_b_to_a=${association.confidence_b_to_a} `
      + `| lift=${association.lift} `
      + `| jaccard=${association.jaccard}`
  );
});

console.log(`\nFound ${associations.length} filtered associations.`);

db.close();
