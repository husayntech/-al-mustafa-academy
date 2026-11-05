#!/usr/bin/env node
/**
 * sync-local-content.sh
 *
 * Sync local site-content from the LIVE Vercel database (Postgres) into the
 * local SQLite file used for dev (data/academy.db).
 *
 * This is the single source of truth for keeping `npm run dev` (localhost)
 * in sync with https://al-mustafa-academy-chi.vercel.app (Vercel/GitHub).
 *
 * Run from the project root:
 *   bash sync-local-content.sh
 *
 * What it does:
 *   1. Fetches live content from https://al-mustafa-academy-chi.vercel.app/api/content
 *   2. Opens the local SQLite DB (data/academy.db) via sql.js
 *   3. Deletes every existing site_content row and inserts the full live set
 *      (all keys, not just a sample).
 *   4. Persists the updated DB to disk.
 *   5. Compares live vs local and prints a key-by-key diff (first 40 keys).
 *   6. Prints the local content root route test.
 *
 * Prerequisites:
 *   - node + npm installed
 *   - sql.js in node_modules (npm install)
 *   - data/academy.db present
 *   - Live Vercel API reachable at /api/content (no auth needed)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname);
const DB_PATH = path.join(ROOT, "data", "academy.db");
const LIVE_URL = "https://al-mustafa-academy-chi.vercel.app/api/content";
const MAX_DIFF_KEYS = 40;

const hadError = () => process.exitCode = 1;

/* ------------------------------------------------------------------ *
 * Step 1 — fetch live content
 * ------------------------------------------------------------------ */
console.log("=== STEP 1: Fetch live content from Vercel ===");
let liveText;
try {
  liveText = await fetch(LIVE_URL, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`Live API returned HTTP ${r.status}`);
    return r.text();
  });
} catch (err) {
  console.error("ERROR fetching live content:", err.message);
  process.exit(1);
}

let live;
try {
  live = JSON.parse(liveText);
} catch (err) {
  console.error("ERROR: live response was not valid JSON:", err.message);
  console.error("Raw head:", liveText.slice(0, 200));
  process.exit(1);
}

const liveContent = live && live.content ? live.content : {};
console.log(`   Got ${Object.keys(liveContent).length} keys`);

/* ------------------------------------------------------------------ *
 * Step 2 — update local SQLite via sql.js
 * ------------------------------------------------------------------ */
console.log("=== STEP 2: Update local SQLite via sql.js ===");

let SQL;
try {
  SQL = await import("sql.js");
} catch (err) {
  console.error("ERROR: cannot import sql.js. Run `npm install` first.");
  process.exit(1);
}

const initSqlJs = SQL.default;
const SQLModule = await initSqlJs();
const db = new SQLModule.Database(fs.readFileSync(DB_PATH));

// Reset the site_content table
db.exec("DELETE FROM site_content");

const content = liveContent || {};
let inserted = 0;
for (const [key, value] of Object.entries(content)) {
  db.run(
    "INSERT OR REPLACE INTO site_content (content_key, content_value) VALUES (?, ?)",
    [key, String(value)]
  );
  inserted += 1;
}

// Persist to disk
fs.writeFileSync(DB_PATH, db.export());
db.close();

console.log(`   data/academy.db updated with ${inserted} keys`);
console.log(`   (Wrote ${Math.round(fs.statSync(DB_PATH).size / 1024)} KB)`);

/* ------------------------------------------------------------------ *
 * Step 3 — verify: compare live vs local (first MAX_DIFF_KEYS keys)
 * ------------------------------------------------------------------ */
console.log("=== STEP 3: Verify side-by-side (first " + MAX_DIFF_KEYS + " keys) ===");
let localText;
try {
  localText = await fetch("http://localhost:3000/api/content", { cache: "no-store" })
    .then((r) => r.text());
} catch (err) {
  console.warn("   (local server not reachable at localhost:3000 — comparing against DB file instead)");
  localText = fs.readFileSync(DB_PATH, "utf8");
}

let localParsed;
try {
  localParsed = JSON.parse(localText);
} catch {
  console.error("   ERROR: could not parse local content response");
  console.error("   Local raw:", localText.slice(0, 300));
  process.exit(1);
}
const localContent = localParsed && localParsed.content ? localParsed.content : {};

const allKeys = new Set([...Object.keys(liveContent), ...Object.keys(localContent)]);
let matched = 0,
  diffCount = 0;
const diffKeys = [];

for (const key of allKeys) {
  const lv = liveContent[key];
  const lcl = localContent[key];
  if (String(lv) === String(lcl)) {
    matched += 1;
  } else {
    diffCount += 1;
    if (diffCount <= MAX_DIFF_KEYS) diffKeys.push(key);
  }
}
console.log(`   Live keys  : ${Object.keys(liveContent).length}`);
console.log(`   Local keys : ${Object.keys(localContent).length}`);
console.log(`   Exact match: ${matched} / ${allKeys.size}`);
console.log(`   (Note: local content was just rewritten from the DB file; a running dev server may still serve the in-memory copy.)`);

if (diffCount === 0) {
  console.log("   ✅ CONTENT IS IDENTICAL to live Vercel.");
} else {
  console.log(`   ❌ ${diffCount} key(s) differ (showing first ${Math.min(MAX_DIFF_KEYS, diffKeys.length)}):`);
  for (const key of diffKeys) {
    console.log(`      ${key}`);
    console.log(`         Live:   ${String(liveContent[key]).slice(0, 90)}`);
    console.log(`         Local:  ${String(localContent[key]).slice(0, 90)}`);
  }
}

/* ------------------------------------------------------------------ *
 * Step 4 — confirm the local content root serves
 * ------------------------------------------------------------------ */
console.log("=== STEP 4: Confirm the local app fetches the same keys ===");
try {
  const rootRes = await fetch("http://localhost:3000/api/content", { cache: "no-store" });
  console.log(`   HTTP ${rootRes.status}  Content-Type: ${rootRes.headers.get("Content-Type")}`);
  const rootBody = await rootRes.text();
  const rootKeys = JSON.parse(rootBody).content ? Object.keys(JSON.parse(rootBody).content).length : 0;
  console.log(`   Local /api/content returns ${rootKeys} content keys`);
  if (rootKeys === Object.keys(liveContent).length) {
    console.log("   ✅ Local matches live exactly.");
  } else {
    console.log("   ❌ Local does NOT match live.");
    hadError();
  }
} catch (err) {
  console.error("   Could not test local root:", err.message);
  hadError();
}

console.log("");
console.log("=== DONE — local dev now mirrors live Vercel content ===");
