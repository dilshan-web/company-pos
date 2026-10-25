# Build GitHub Pages Ready Deployment
$ErrorActionPreference = "Stop"
$base = "c:\Users\dilshan\Desktop\MOB POS"
$ghPagesDir = "c:\Users\dilshan\Desktop\spice-pos-github"

Write-Output "Deploying to GitHub Pages folder: $ghPagesDir..."

if (-not (Test-Path $ghPagesDir)) {
    New-Item -ItemType Directory -Path $ghPagesDir | Out-Null
}

# 1. Copy index.html
Copy-Item "$base\index.html" "$ghPagesDir\index.html" -Force
Write-Output "  Written: index.html ($([Math]::Round((Get-Item "$ghPagesDir\index.html").Length/1024))KB)"

# 2. Copy js folder recursively
$destJs = "$ghPagesDir\js"
if (-not (Test-Path $destJs)) { New-Item -ItemType Directory -Path $destJs | Out-Null }
Copy-Item "$base\js\*" $destJs -Recurse -Force
Write-Output "  Copied: js/ directory (modular scripts & libraries)"

# 3. Copy css folder recursively
$destCss = "$ghPagesDir\css"
if (-not (Test-Path $destCss)) { New-Item -ItemType Directory -Path $destCss | Out-Null }
Copy-Item "$base\css\*" $destCss -Recurse -Force
Write-Output "  Copied: css/ directory"

# 4. Copy icons folder recursively
$iconDestDir = "$ghPagesDir\icons"
if (-not (Test-Path $iconDestDir)) { New-Item -ItemType Directory -Path $iconDestDir | Out-Null }
Copy-Item "$base\icons\*" $iconDestDir -Recurse -Force
Write-Output "  Copied: icons/ directory"

# 5. Copy root icon files for PWA / browser compatibility
foreach ($file in (Get-ChildItem "$base\icons\*")) {
    try {
        Copy-Item $file.FullName "$ghPagesDir\$($file.Name)" -Force
    } catch {}
}
Write-Output "  Copied: root icon files"

# 6. Copy manifest.json & Service Worker sw.js
Copy-Item "$base\manifest.json" "$ghPagesDir\manifest.json" -Force
Copy-Item "$base\sw.js" "$ghPagesDir\sw.js" -Force
Write-Output "  Copied: manifest.json & sw.js"

# 7. Write .nojekyll (bypasses Jekyll processing on GitHub Pages)
[System.IO.File]::WriteAllText("$ghPagesDir\.nojekyll", "", [System.Text.Encoding]::UTF8)
Write-Output "  Written: .nojekyll"

# 8. Write README.md
$readme = @'
# 🌶️ Spice & Wholesale Card POS

Offline-First Mobile POS for Spice Card & Sachet Wholesale Business.

## 🚀 GitHub Pages Setup Instructions
1. Open this repository on GitHub.
2. Go to **Settings** -> **Pages**.
3. Under **Branch**, select `main` (or `master`) and folder `/ (root)`.
4. Click **Save**.
5. Your live POS web app will be available at: `https://<your-username>.github.io/<repo-name>/`

## 📲 Mobile Installation (PWA)
- Open the GitHub Pages URL in Google Chrome (Android) or Safari (iOS).
- Tap **Menu (⋮)** or **Share**.
- Tap **"Add to Home screen"** / **"Install App"**.
'@
[System.IO.File]::WriteAllText("$ghPagesDir\README.md", $readme, [System.Text.Encoding]::UTF8)
Write-Output "  Written: README.md"

# 9. Clean up any zip files (User requested: no zip files)
$zipWebPath = "c:\Users\dilshan\Desktop\spice-pos-web.zip"
if (Test-Path $zipWebPath) { Remove-Item -LiteralPath $zipWebPath -Force -ErrorAction SilentlyContinue }

Write-Output ""
Write-Output "============================================"
Write-Output "DONE! GitHub Pages folder ready at:"
Write-Output "  $ghPagesDir"
Write-Output ""
Write-Output "Files & folders to upload to GitHub:"
Get-ChildItem $ghPagesDir | ForEach-Object { Write-Output "  - $($_.Name)" }
Write-Output "============================================"
