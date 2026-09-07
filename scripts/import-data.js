const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const dbPath = path.join(__dirname, "..", "database", "lego.db");
const dataPath = path.join(
  __dirname,
  "..",
  "server",
  "data",
  "raw",
  "rebrickable"
);

const db = new Database(dbPath);

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);

  return result;
}

async function importCSV(filename, insertStatement, transform) {
  const filePath = path.join(dataPath, filename);

  console.log(`\nImporting ${filename}...`);

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const insert = db.prepare(insertStatement);
  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(...row);
    }
  });

  let firstLine = true;
  let batch = [];
  let count = 0;

  for await (const line of rl) {
    if (firstLine) {
      firstLine = false;
      continue;
    }

    const transformed = transform(parseCSVLine(line));
    if (transformed === null) {
      continue;
    }

    batch.push(transformed);

    if (batch.length >= 5000) {
      transaction(batch);
      count += batch.length;
      batch = [];

      if (count % 50000 === 0) {
        console.log(`${count.toLocaleString()} rows imported`);
      }
    }
  }

  if (batch.length > 0) {
    transaction(batch);
    count += batch.length;
  }

  console.log(`Finished ${filename}: ${count.toLocaleString()} rows`);
}

async function main() {
  const requiredFiles = [
    "part_categories.csv",
    "parts.csv",
    "sets.csv",
    "inventories.csv",
    "inventory_parts.csv",
  ];
  const missingFiles = requiredFiles.filter(
    (filename) => !fs.existsSync(path.join(dataPath, filename))
  );

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing CSV files in ${dataPath}: ${missingFiles.join(", ")}`
    );
  }

  console.log("Creating LEGO database...");

  await importCSV(
    "part_categories.csv",
    `
    INSERT OR IGNORE INTO categories (id, name)
    VALUES (?, ?)
    `,
    (values) => [Number(values[0]), values[1]]
  );

  await importCSV(
    "parts.csv",
    `
    INSERT OR IGNORE INTO parts (part_num, name, category_id, material)
    VALUES (?, ?, ?, ?)
    `,
    (values) => [
      values[0],
      values[1],
      values[2] ? Number(values[2]) : null,
      values[3] || null,
    ]
  );

  await importCSV(
    "sets.csv",
    `
    INSERT OR IGNORE INTO sets (set_num, name, year, theme_id, num_parts)
    VALUES (?, ?, ?, ?, ?)
    `,
    (values) => [
      values[0],
      values[1],
      values[2] ? Number(values[2]) : null,
      values[3] ? Number(values[3]) : null,
      values[4] ? Number(values[4]) : null,
    ]
  );

  const validSetNumbers = new Set(
    db.prepare("SELECT set_num FROM sets").all().map((row) => row.set_num)
  );

  await importCSV(
    "inventories.csv",
    `
    INSERT OR IGNORE INTO inventories (id, version, set_num)
    VALUES (?, ?, ?)
    `,
    (values) =>
      validSetNumbers.has(values[2])
        ? [Number(values[0]), Number(values[1]), values[2]]
        : null
  );

  const validInventoryIds = new Set(
    db.prepare("SELECT id FROM inventories").all().map((row) => row.id)
  );

  await importCSV(
    "inventory_parts.csv",
    `
    INSERT OR IGNORE INTO inventory_parts
    (inventory_id, part_num, color_id, quantity, is_spare)
    VALUES (?, ?, ?, ?, ?)
    `,
    (values) =>
      validInventoryIds.has(Number(values[0]))
        ? [
            Number(values[0]),
            values[1],
            Number(values[2]),
            Number(values[3]),
            values[4] === "t" || values[4] === "1" ? 1 : 0,
          ]
        : null
  );

  console.log("\nAll data imported successfully!");
}

main()
  .catch((error) => {
    console.error(`\nImport failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.close());