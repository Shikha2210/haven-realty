# Builds ONE deployable jar that contains the API and the web app:  backend\target\haven-realty.jar
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = "$env:USERPROFILE\tools"
if (-not (Get-Command java -ErrorAction SilentlyContinue) -and (Test-Path "$tools\jdk")) { $env:JAVA_HOME = "$tools\jdk"; $env:Path = "$tools\jdk\bin;$tools\maven\bin;$env:Path" }

Push-Location "$root\frontend"; npm install; npm run build; Pop-Location
$static = "$root\backend\src\main\resources\static"
if (Test-Path $static) { Remove-Item $static -Recurse -Force }
Copy-Item "$root\frontend\dist" $static -Recurse

Push-Location "$root\backend"; mvn -B -DskipTests package; Pop-Location
Copy-Item (Get-ChildItem "$root\backend\target\*.jar" | Where-Object { $_.Name -notlike '*original*' } | Select-Object -First 1).FullName "$root\backend\target\haven-realty.jar" -Force
Write-Host "Built $root\backend\target\haven-realty.jar"
