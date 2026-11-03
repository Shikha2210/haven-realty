# Starts the whole project (backend + frontend) with demo data and opens the browser.
# Needs JDK 17+, Maven and Node 20+. If java/mvn are not on PATH it falls back to %USERPROFILE%\tools.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = "$env:USERPROFILE\tools"
if (-not (Get-Command java -ErrorAction SilentlyContinue) -and (Test-Path "$tools\jdk")) { $env:JAVA_HOME = "$tools\jdk"; $env:Path = "$tools\jdk\bin;$env:Path" }
if (-not (Get-Command mvn -ErrorAction SilentlyContinue) -and (Test-Path "$tools\maven")) { $env:Path = "$tools\maven\bin;$env:Path" }
foreach ($c in 'java', 'mvn', 'node', 'npm') { if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { Write-Host "Missing: $c - install it first (see README.md)" -ForegroundColor Red; exit 1 } }

if (-not (Test-Path "$root\frontend\node_modules")) { Push-Location "$root\frontend"; npm install; Pop-Location }

$env:SEED_DEMO = 'true'; $env:DEV_EXPOSE_OTP = 'true'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:JAVA_HOME='$env:JAVA_HOME'; `$env:Path='$env:Path'; `$env:SEED_DEMO='true'; `$env:DEV_EXPOSE_OTP='true'; cd '$root\backend'; mvn spring-boot:run"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:Path='$env:Path'; cd '$root\frontend'; npm run dev"

Write-Host 'Waiting for the backend (first run downloads dependencies and can take a few minutes)...'
for ($i = 0; $i -lt 180; $i++) { try { Invoke-WebRequest http://localhost:8080/api/health -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 2 } }
Start-Process 'http://localhost:5173'
Write-Host "`nOpen http://localhost:5173   |  buyer priya@haven.test  seller meera@haven.test (Demo@12345)  agent agent@haven.test / Agent@12345 (Agent tab)"
