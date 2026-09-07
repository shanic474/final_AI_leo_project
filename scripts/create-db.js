const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "..", "database", "lego.db");

// Make sure database directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

console.log("Creating LEGO database...");

// Categories
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
`);

// Parts
db.exec(`
  CREATE TABLE IF NOT EXISTS parts (
    part_num TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id INTEGER,
    material TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`);

// Sets
db.exec(`
  CREATE TABLE IF NOT EXISTS sets (
    set_num TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER,
    theme_id INTEGER,
    num_parts INTEGER
  );
`);

// Inventories
db.exec(`
  CREATE TABLE IF NOT EXISTS inventories (
    id INTEGER PRIMARY KEY,
    version INTEGER,
    set_num TEXT NOT NULL,
    FOREIGN KEY (set_num) REFERENCES sets(set_num)
  );
`);

// Parts inside inventories
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_parts (
    inventory_id INTEGER NOT NULL,
    part_num TEXT NOT NULL,
    color_id INTEGER,
    quantity INTEGER NOT NULL,
    is_spare BOOLEAN NOT NULL DEFAULT 0,

    PRIMARY KEY (inventory_id, part_num, color_id, is_spare),

    FOREIGN KEY (inventory_id) REFERENCES inventories(id),
    FOREIGN KEY (part_num) REFERENCES parts(part_num)
  );
`);

// Useful indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_parts_category
  ON parts(category_id);

  CREATE INDEX IF NOT EXISTS idx_inventory_parts_part
  ON inventory_parts(part_num);

  CREATE INDEX IF NOT EXISTS idx_inventory_parts_inventory
  ON inventory_parts(inventory_id);

  CREATE INDEX IF NOT EXISTS idx_inventories_set
  ON inventories(set_num);
`);

console.log("Database created successfully!");
db.close();