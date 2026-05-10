# Build & Deploy Script — avoids CDN cache issues by cloning from a preview channel
# Usage: powershell -ExecutionPolicy Bypass -File deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Building project ===" -ForegroundColor Cyan
Remove-Item -LiteralPath "dist" -Recurse -Force -ErrorAction SilentlyContinue
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

Write-Host "=== Deploying to preview channel ===" -ForegroundColor Cyan
$channelName = "deploy-" + (Get-Date -Format "MMdd-HHmmss")
firebase hosting:channel:deploy $channelName --expires 1h
if ($LASTEXITCODE -ne 0) { throw "Preview deploy failed" }

Write-Host "=== Cloning preview to live (bypasses CDN cache) ===" -ForegroundColor Cyan
firebase hosting:clone im-smrti:$channelName im-smrti:live
if ($LASTEXITCODE -ne 0) { throw "Clone to live failed" }

Write-Host "=== Cleaning up preview channel ===" -ForegroundColor Cyan
firebase hosting:channel:delete $channelName --force

Write-Host "=== Deploy complete! https://im-smrti.web.app ===" -ForegroundColor Green
