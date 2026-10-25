# Build Standalone Single-File POS HTML
$ErrorActionPreference = "Stop"
$base = "c:\Users\dilshan\Desktop\MOB POS"

# Helper to read UTF-8 files safely without BOM or encoding corruption
function Read-Utf8File($path) {
    return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

# 1. Read CSS
$leafletCss = Read-Utf8File "$base\css\leaflet.css"
$stylesCss  = Read-Utf8File "$base\css\styles.css"
$css = $leafletCss + "`n`n" + $stylesCss

# 2. Read Icon & encode Base64
$iconBytes = [System.IO.File]::ReadAllBytes("$base\icons\icon.svg")
$iconB64 = [System.Convert]::ToBase64String($iconBytes)
$iconDataUri = "data:image/svg+xml;base64,$iconB64"

# 3. Read Libraries
$tailwindJs = Read-Utf8File "$base\js\libs\tailwind.js"
$dexieJs    = Read-Utf8File "$base\js\libs\dexie.min.js"
$fbAppJs    = Read-Utf8File "$base\js\libs\firebase-app-compat.js"
$fbFsJs     = Read-Utf8File "$base\js\libs\firebase-firestore-compat.js"
$leafletJs  = Read-Utf8File "$base\js\libs\leaflet.js"
$qrcodeJs   = Read-Utf8File "$base\js\libs\qrcode.min.js"
$jsqrJs     = Read-Utf8File "$base\js\libs\jsqr.min.js"

# 4. Read App JS Modules in exact dependency order
$jsFiles = @(
    "sounds.js",
    "db.js",
    "hierarchy.js",
    "auth.js",
    "companyControl.js",
    "state.js",
    "ui.js",
    "dashboard.js",
    "bestShops.js",
    "pos.js",
    "repbills.js",
    "collections.js",
    "gps.js",
    "map.js",
    "routeSession.js",
    "routes.js",
    "shops.js",
    "products.js",
    "production.js",
    "stores.js",
    "lorry.js",
    "print.js",
    "reports.js",
    "settings.js",
    "hr.js",
    "payroll.js",
    "users.js",
    "rep_onboard.js",
    "app.js"
)

$combinedAppJs = $leafletJs + "`n`n" + $qrcodeJs + "`n`n" + $jsqrJs + "`n`n"
foreach ($f in $jsFiles) {
    $content = Read-Utf8File "$base\js\$f"
    $combinedAppJs += "`n// --- BEGIN: $f ---`n" + $content + "`n// --- END: $f ---`n"
}

# 5. Read index.html
$html = Read-Utf8File "$base\index.html"

# 6. Replace Favicon and App Icons with Data URIs
$html = $html.Replace('<link rel="icon" type="image/svg+xml" href="icons/icon.svg" />', "<link rel=`"icon`" type=`"image/svg+xml`" href=`"$iconDataUri`" />")
if (Test-Path "$base\icons\icon-192.png") {
    $pngBytes = [System.IO.File]::ReadAllBytes("$base\icons\icon-192.png")
    $pngB64 = [System.Convert]::ToBase64String($pngBytes)
    $pngDataUri = "data:image/png;base64,$pngB64"
    $html = $html.Replace('href="icon-192.png"', "href=`"$pngDataUri`"")
    $html = $html.Replace('href="icon-512.png"', "href=`"$pngDataUri`"")
    $html = $html.Replace('src="icon-192.png"', "src=`"$pngDataUri`"")
    $html = $html.Replace('src="icon.png"', "src=`"$pngDataUri`"")
    $html = $html.Replace('href="apple-touch-icon.png"', "href=`"$pngDataUri`"")
    $html = $html.Replace('href="favicon.png"', "href=`"$pngDataUri`"")
}

# 7. Replace CSS link with inline style
$html = $html.Replace('<link rel="stylesheet" href="css/leaflet.css" />', "")
$html = $html.Replace('<link rel="stylesheet" href="css/styles.css" />', "<style>`n$css`n</style>")

# 8. Replace Tailwind, Dexie & Firebase scripts
$html = $html.Replace('<script src="js/libs/tailwind.js"></script>', "<script>`n$tailwindJs`n</script>")
$html = $html.Replace('<script src="js/libs/dexie.min.js"></script>', "<script>`n$dexieJs`n</script>")
$html = $html.Replace('<script src="js/libs/firebase-app-compat.js"></script>', "<script>`n$fbAppJs`n</script>")
$html = $html.Replace('<script src="js/libs/firebase-firestore-compat.js"></script>', "<script>`n$fbFsJs`n</script>")

# 9. Replace bottom application script tags with single inline script
$scriptsPattern = '(?s)<script src="js/libs/(?:leaflet\.js.*?|)qrcode\.min\.js"></script>.*?<script src="js/app\.js"></script>'
$embeddedAppScripts = "<script>`n$combinedAppJs`n</script>"
$html = [System.Text.RegularExpressions.Regex]::Replace($html, $scriptsPattern, $embeddedAppScripts)

# 11. Write standalone.html with UTF-8
$standalonePath = "$base\standalone.html"
[System.IO.File]::WriteAllText($standalonePath, $html, [System.Text.Encoding]::UTF8)
Write-Output "Successfully generated standalone.html ($((Get-Item $standalonePath).Length) bytes)"

# 12. Optional sync to GitHub deployment folder
try {
    $githubFolder = "c:\Users\dilshan\Desktop\spice-pos-github"
    if (Test-Path $githubFolder -ErrorAction SilentlyContinue) {
        Copy-Item $standalonePath "$githubFolder\index.html" -Force
        if (Test-Path "$base\sw.js") { Copy-Item "$base\sw.js" "$githubFolder\sw.js" -Force }
        if (Test-Path "$base\manifest.json") { Copy-Item "$base\manifest.json" "$githubFolder\manifest.json" -Force }
        if (Test-Path "$base\icons") { 
            if (-not (Test-Path "$githubFolder\icons")) { New-Item -ItemType Directory -Path "$githubFolder\icons" | Out-Null }
            foreach ($file in (Get-ChildItem "$base\icons\*")) {
                try {
                    Copy-Item $file.FullName "$githubFolder\$($file.Name)" -Force
                    Copy-Item $file.FullName "$githubFolder\icons\$($file.Name)" -Force
                } catch {}
            }
        }
        Write-Output "Successfully synced updated build to GitHub folder: $githubFolder\index.html"
    }
} catch {
    Write-Output "GitHub folder sync skipped (workspace only mode)"
}
