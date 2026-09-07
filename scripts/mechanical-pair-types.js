const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const db = new Database(dbPath);

const coreCategoryIds = [12, 46, 51, 52, 53, 54, 55];
const categoryPlaceholders = coreCategoryIds.map(() => "?").join(", ");

console.log("\n=== MECHANICAL PAIR TYPE ANALYSIS ===\n");

const pairTypes = db.prepare(`
  WITH pair_counts AS (
    SELECT
      CASE
        WHEN p1.category_id <= p2.category_id THEN p1.category_id
        ELSE p2.category_id
      END AS category_a_id,
      CASE
        WHEN p1.category_id <= p2.category_id THEN c1.name
        ELSE c2.name
      END AS category_a,
      CASE
        WHEN p1.category_id <= p2.category_id THEN p2.category_id
        ELSE p1.category_id
      END AS category_b_id,
      CASE
        WHEN p1.category_id <= p2.category_id THEN c2.name
        ELSE c1.name
      END AS category_b,
      ip1.part_num AS part_a,
      ip2.part_num AS part_b,
      COUNT(DISTINCT i.set_num) AS set_count
    FROM inventory_parts ip1
    JOIN inventory_parts ip2
      ON ip1.inventory_id = ip2.inventory_id
      AND ip1.part_num < ip2.part_num
    JOIN inventories i
      ON ip1.inventory_id = i.id
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
      category_a_id,
      category_a,
      category_b_id,
      category_b,
      ip1.part_num,
      ip2.part_num
  ),
  pair_metrics AS (
    SELECT
      category_a_id,
      category_a,
      category_b_id,
      category_b,
      COUNT(*) AS distinct_part_pairs,
      MAX(set_count) AS max_set_count,
      ROUND(AVG(set_count), 2) AS average_set_count,
      SUM(set_count) AS total_set_count
    FROM pair_counts
    GROUP BY
      category_a_id,
      category_a,
      category_b_id,
      category_b
  ),
  participants AS (
    SELECT category_a_id, category_b_id, part_a AS part_num
    FROM pair_counts
    UNION
    SELECT category_a_id, category_b_id, part_b AS part_num
    FROM pair_counts
  ),
  participant_counts AS (
    SELECT
      category_a_id,
      category_b_id,
      COUNT(*) AS distinct_parts
    FROM participants
    GROUP BY category_a_id, category_b_id
  )
  SELECT
    pair_metrics.category_a,
    pair_metrics.category_b,
    pair_metrics.distinct_part_pairs,
    participant_counts.distinct_parts,
    pair_metrics.max_set_count,
    pair_metrics.average_set_count,
    pair_metrics.total_set_count
  FROM pair_metrics
  JOIN participant_counts
    ON pair_metrics.category_a_id = participant_counts.category_a_id
    AND pair_metrics.category_b_id = participant_counts.category_b_id
  ORDER BY pair_metrics.total_set_count DESC;
`).all(...coreCategoryIds, ...coreCategoryIds);

console.table(pairTypes);

console.log(`\nFound ${pairTypes.length} mechanical pair types.`);

db.close();
