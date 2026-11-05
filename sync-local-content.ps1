<#
.SYNOPSIS
    Sync local site-content from live Vercel DB into local SQLite (data/academy.db).

.DESCRIPTION
    1. Fetches live content from https://al-mustafa-academy-chi.vercel.app/api/content
    2. Opens local SQLite DB via sql.js + tsx
    3. Replaces site_content rows with live data
    4. Restarts local dev server
    5. Prints side-by-side comparison of first 8 keys
#>
$ErrorActionPreference = "Stop"

$VerbosePreference = "Continue"

Write-Host "=== STEP 1: Fetch live content from Vercel ===" -ForegroundColor Yellow
$liveJson = Invoke-WebRequest -Uri "https://al-mustafa-academy-chi.vercel.app/api/content" -UseBasicParsing
$liveContent = $liveJson.Content | ConvertFrom-Json
if (-not $liveContent.content) {
    Write-Host "ERROR: No content returned from live." -ForegroundColor Red
    exit 1
}
$keyCount = $liveContent.content.PSObject.Properties.Count
Write-Host "   Got $keyCount keys" -ForegroundColor Green

# Save raw JSON to file so Node can read it cleanly (avoids PS quoting issues)
$liveJsonRaw = $liveJson.Content
$liveJsonRaw | Out-File -FilePath "C:\temp\live-content.json" -Encoding UTF8
Write-Host "   Raw JSON saved to C:\temp\live-content.json" -ForegroundColor Green

Write-Host "=== STEP 2: Update local SQLite via sql.js ===" -ForegroundColor Yellow
& npx tsx -e "
const fs = require('fs');
const { initSqlJs } = require('sql.js');
(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('data/academy.db'));
  db.run('CREATE TABLE IF NOT EXISTS site_content (id INTEGER PRIMARY KEY AUTOINCREMENT, content_key TEXT UNIQUE NOT NULL, content_value TEXT NOT NULL DEFAULT \'\')');
  db.run('DELETE FROM site_content');
  const raw = fs.readFileSync('C:/temp/live-content.json', 'utf8');
  const parsed = JSON.parse(raw);
  const content = parsed.content || {};
  for (const [key, value] of Object.entries(content)) {
    db.run('INSERT OR REPLACE INTO site_content (content_key, content_value) VALUES (?, ?)', [key, String(value)]);
  }
  db.close();
  fs.writeFileSync('data/academy.db', db.export());
  console.log('Updated ' + Object.keys(content).length + ' keys');
})();
" 2>&1 | Out-File -FilePath "C:\temp\update-log.txt" -Encoding UTF8
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Host "ERROR: Update failed (exit code $exitCode)" -ForegroundColor Red
    Get-Content "C:\temp\update-log.txt"
    exit 1
}
Write-Host "   data/academy.db updated" -ForegroundColor Green

Write-Host "=== STEP 3: Restart local dev server ===" -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process -FilePath "npm" -ArgumentList "run dev" -NoNewWindow
Start-Sleep -Seconds 6
Write-Host "   Server restarted" -ForegroundColor Green

Write-Host "=== STEP 4: Compare live vs local ===" -ForegroundColor Yellow
$liveContent2 = $liveJson.Content | ConvertFrom-Json
$localContent = (Invoke-WebRequest -Uri "http://localhost:3000/api/content" -UseBasicParsing).Content | ConvertFrom-Json

$keys = $liveContent2.content.PSObject.Properties.Name | Select-Object -First 8
foreach ($k in $keys) {
    $lVal = $liveContent2.content.$k
    $lvVal = $localContent.content.$k
    if ($lVal -eq $lvVal) {
        Write-Host "   $k : ✅ MATCH" -ForegroundColor Green
    } else {
        Write-Host "   $k : ❌ DIFFER" -ForegroundColor Red
        Write-Host "      Live:   $lVal" -ForegroundColor Gray
        Write-Host "      Local:  $lvVal" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host "Local server running at http://localhost:3000" -ForegroundColor Green
