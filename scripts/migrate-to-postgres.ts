/**
 * One-time migration script: local sql.js DB -> PostgreSQL (Supabase / Neon).
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-to-postgres.ts
 *
 * This reads every table from data/academy.db and inserts the rows into
 * PostgreSQL, preserving IDs and relationships.
 */
import initSqlJs from "sql.js";
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POSTGRES_SCHEMA_SQL } from "../db.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "academy.db");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required.");
  process.exit(1);
}  // Tables in dependency order. Columns are matched dynamically: only columns
  // present in both the local table and the Postgres table are inserted, and
  // generated columns (e.g. results.total_score) are skipped automatically.
  const TABLES: { name: string }[] = [
    { name: "classes" },
    { name: "users" },
    { name: "subjects" },
    { name: "students" },
    { name: "results" },
    { name: "sessions" },
    { name: "password_resets" },
    { name: "site_content" },
    { name: "teacher_classes" },
    { name: "result_sheet_config" },
  ];

  // Foreign keys: table -> { localCol: parentTable }. Rows whose parent is
  // missing (orphaned data from old database states) are skipped.
  const FKS: Record<string, Record<string, string>> = {
    subjects: { class_id: "classes" },
    students: { class_id: "classes" },
    results: { student_id: "students", subject_id: "subjects" },
    sessions: { user_id: "users" },
    password_resets: { user_id: "users" },
    teacher_classes: { teacher_id: "users", class_id: "classes" },
  };

  // Tracks the IDs present in Postgres for each table (for FK filtering).
  const migratedIds: Record<string, Set<number>> = {};


async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Local database not found at ${DB_PATH}`);
    process.exit(1);
  }

  console.log("📖 Reading local database...");
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  console.log("🔌 Connecting to PostgreSQL...");
  const sql = postgres(DATABASE_URL, { max: 5, prepare: false, idle_timeout: 20, connect_timeout: 15 });

  // Make sure the tables exist before inserting (works with Supabase pooler).
  console.log("📋 Ensuring schema exists...");
  await sql.unsafe(POSTGRES_SCHEMA_SQL);

  for (const table of TABLES) {
    // Read all rows from sql.js
    const stmt = db.prepare(`SELECT * FROM ${table.name}`);
    const rows: Record<string, any>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    if (rows.length === 0) {
      console.log(`  ${table.name}: 0 rows (skip)`);
      continue;
    }

    // Which columns exist in the target Postgres table? (exclude generated ones)
    const targetCols = await sql.unsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'`,
      [table.name]
    );
    const targetColSet = new Set(targetCols.map((c: any) => c.column_name));

    // Intersection: local columns that also exist in Postgres (schema drift-safe)
    const cols = Object.keys(rows[0]).filter((c) => targetColSet.has(c));
    if (cols.length === 0) {
      console.log(`  ${table.name}: no matching columns (skip)`);
      continue;
    }
    const colList = cols.join(", ");
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");

    // Filter out orphaned rows (missing parent records)
    const fk = FKS[table.name];
    const filtered = rows.filter((row) => {
      if (!fk) return true;
      return Object.entries(fk).every(([localCol, parentTable]) => {
        const parentIds = migratedIds[parentTable];
        return parentIds && parentIds.has(Number(row[localCol]));
      });
    });
    const skipped = rows.length - filtered.length;
    if (skipped > 0) {
      console.log(`  ⚠️  ${table.name}: skipped ${skipped} orphaned row(s)`);
    }
    if (filtered.length === 0) {
      continue;
    }

    // Insert in batches to keep memory reasonable
    const BATCH = 100;
    for (let i = 0; i < filtered.length; i += BATCH) {
      const batch = filtered.slice(i, i + BATCH);
      for (const row of batch) {
        const values = cols.map((c) => (row[c] === undefined ? null : row[c]));
        await sql.unsafe(
          `INSERT INTO ${table.name} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
          values
        );
      }
    }

    // Record migrated IDs for FK filtering of later tables
    migratedIds[table.name] = new Set(filtered.map((r) => Number(r.id)));

    // Advance the id sequence so new inserts don't collide with migrated IDs
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('${table.name}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table.name}))`
    );

    console.log(`  ✅ ${table.name}: ${filtered.length} rows migrated`);
  }

  await sql.end({ timeout: 5 });
  console.log("\n🎉 Migration complete! All data is now in PostgreSQL.");
  console.log("Next steps: set DATABASE_URL on Vercel and deploy.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
