const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

const coreCategoryIds = [12, 46, 51, 52, 53, 54, 55];
const minimumTripleSets = 20;
const minimumPartSets = 100;
const categoryPlaceholders = coreCategoryIds.map(() => "?").join(", ");

console.log("\n=== MECHANICAL TRIPLE ASSOCIATION ===\n");
console.log(`Minimum triple set count: ${minimumTripleSets}`);
console.log(`Minimum sets per part: ${minimumPartSets}`);
console.log("Expected support: pairwise multiplicative model\n");

const associations = db.prepare(`
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
  eligible_inventory_parts AS (
    SELECT cip.inventory_id, cip.part_num
    FROM core_inventory_parts cip
    JOIN part_set_counts psc
      ON cip.part_num = psc.part_num
  ),
  pair_set_counts AS (
    SELECT
      ip1.part_num AS part_a,
      ip2.part_num AS part_b,
      COUNT(DISTINCT i.set_num) AS pair_set_count
    FROM eligible_inventory_parts ip1
    JOIN eligible_inventory_parts ip2
      ON ip1.inventory_id = ip2.inventory_id
      AND ip1.part_num < ip2.part_num
    JOIN inventories i
      ON ip1.inventory_id = i.id
    GROUP BY ip1.part_num, ip2.part_num
  ),
  triple_set_counts AS (
    SELECT
      ip1.part_num AS part_a,
      ip2.part_num AS part_b,
      ip3.part_num AS part_c,
      COUNT(DISTINCT i.set_num) AS triple_set_count
    FROM eligible_inventory_parts ip1
    JOIN eligible_inventory_parts ip2
      ON ip1.inventory_id = ip2.inventory_id
      AND ip1.part_num < ip2.part_num
    JOIN eligible_inventory_parts ip3
      ON ip2.inventory_id = ip3.inventory_id
      AND ip2.part_num < ip3.part_num
    JOIN inventories i
      ON ip1.inventory_id = i.id
    GROUP BY ip1.part_num, ip2.part_num, ip3.part_num
    HAVING triple_set_count >= ?
  ),
  total_set_count AS (
    SELECT COUNT(DISTINCT set_num) AS total_sets
    FROM inventories
  ),
  metrics AS (
    SELECT
      t.part_a,
      t.part_b,
      t.part_c,
      t.triple_set_count,
      ab.pair_set_count AS ab_set_count,
      ac.pair_set_count AS ac_set_count,
      bc.pair_set_count AS bc_set_count,
      a.part_set_count AS part_a_set_count,
      b.part_set_count AS part_b_set_count,
      c.part_set_count AS part_c_set_count,
      total_set_count.total_sets
    FROM triple_set_counts t
    JOIN pair_set_counts ab
      ON t.part_a = ab.part_a
      AND t.part_b = ab.part_b
    JOIN pair_set_counts ac
      ON t.part_a = ac.part_a
      AND t.part_c = ac.part_b
    JOIN pair_set_counts bc
      ON t.part_b = bc.part_a
      AND t.part_c = bc.part_b
    JOIN part_set_counts a
      ON t.part_a = a.part_num
    JOIN part_set_counts b
      ON t.part_b = b.part_num
    JOIN part_set_counts c
      ON t.part_c = c.part_num
    CROSS JOIN total_set_count
  )
  SELECT
    metrics.part_a,
    p1.name AS part_a_name,
    c1.name AS part_a_category,
    metrics.part_b,
    p2.name AS part_b_name,
    c2.name AS part_b_category,
    metrics.part_c,
    p3.name AS part_c_name,
    c3.name AS part_c_category,
    metrics.triple_set_count,
    metrics.ab_set_count,
    metrics.ac_set_count,
    metrics.bc_set_count,
    metrics.part_a_set_count,
    metrics.part_b_set_count,
    metrics.part_c_set_count,
    metrics.total_sets,
    ROUND(1.0 * metrics.triple_set_count / metrics.total_sets, 6)
      AS observed_support,
    ROUND(
      1.0 * metrics.ab_set_count * metrics.ac_set_count * metrics.bc_set_count
      / (metrics.part_a_set_count * metrics.part_b_set_count * metrics.part_c_set_count),
      6
    ) AS expected_support,
    ROUND(
      1.0 * metrics.triple_set_count / metrics.total_sets
      - 1.0 * metrics.ab_set_count * metrics.ac_set_count * metrics.bc_set_count
      / (metrics.part_a_set_count * metrics.part_b_set_count * metrics.part_c_set_count),
      6
    ) AS excess_support,
    ROUND(
      (1.0 * metrics.triple_set_count / metrics.total_sets)
      / (
        1.0 * metrics.ab_set_count * metrics.ac_set_count * metrics.bc_set_count
        / (metrics.part_a_set_count * metrics.part_b_set_count * metrics.part_c_set_count)
      ),
      4
    ) AS pairwise_lift
  FROM metrics
  JOIN parts p1
    ON metrics.part_a = p1.part_num
  JOIN parts p2
    ON metrics.part_b = p2.part_num
  JOIN parts p3
    ON metrics.part_c = p3.part_num
  JOIN categories c1
    ON p1.category_id = c1.id
  JOIN categories c2
    ON p2.category_id = c2.id
  JOIN categories c3
    ON p3.category_id = c3.id
  ORDER BY excess_support DESC, pairwise_lift DESC, triple_set_count DESC
  LIMIT 50;
`).all(
  ...coreCategoryIds,
  minimumPartSets,
  minimumTripleSets
);

associations.forEach((association, index) => {
  console.log(
    `${index + 1} | `
      + `${association.part_a} ${association.part_a_name} (${association.part_a_category}) + `
      + `${association.part_b} ${association.part_b_name} (${association.part_b_category}) + `
      + `${association.part_c} ${association.part_c_name} (${association.part_c_category}) `
      + `| triple_sets=${association.triple_set_count} `
      + `| AB=${association.ab_set_count} `
      + `| AC=${association.ac_set_count} `
      + `| BC=${association.bc_set_count} `
      + `| A=${association.part_a_set_count} `
      + `| B=${association.part_b_set_count} `
      + `| C=${association.part_c_set_count} `
      + `| observed=${association.observed_support} `
      + `| expected=${association.expected_support} `
      + `| excess=${association.excess_support} `
      + `| pairwise_lift=${association.pairwise_lift}`
  );
});

console.log(`\nFound ${associations.length} mechanical triple associations.`);

db.close();