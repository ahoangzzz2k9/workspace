# Đóng gói Cùng Làm thành file zip để tải về.
# - Bản win64: kèm sẵn Node.js, giải nén là chạy, không cần cài gì.
# - Bản source: mã nguồn đầy đủ cho máy đã có Node >= 22.5.
param(
  [string]$Version = "0.3.0",
  [string]$NodeExe = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"

if (-not $NodeExe) {
  $bundled = Join-Path $env:USERPROFILE ".dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path $bundled) { $NodeExe = $bundled }
  else {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if (-not $command) { throw "Không tìm thấy node.exe. Truyền -NodeExe đường-dẫn." }
    $NodeExe = $command.Source
  }
}

$nodeDir = Split-Path -Parent $NodeExe
$license = Join-Path (Split-Path -Parent $nodeDir) "LICENSE"

New-Item -ItemType Directory -Force $dist | Out-Null

function Reset-Dir([string]$path) {
  if (Test-Path $path) { Remove-Item -Recurse -Force $path }
  New-Item -ItemType Directory -Force $path | Out-Null
}

# ---------- Bản chạy ngay cho Windows ----------
$win = Join-Path $dist "CungLam-$Version-win64"
Reset-Dir $win
$appDir = Join-Path $win "app"
New-Item -ItemType Directory -Force $appDir | Out-Null

foreach ($item in @("server.js", "src", "public", "package.json", "README.md", "docs")) {
  Copy-Item (Join-Path $root $item) -Destination $appDir -Recurse -Force
}

New-Item -ItemType Directory -Force (Join-Path $win "node") | Out-Null
Copy-Item $NodeExe (Join-Path $win "node\node.exe") -Force
if (Test-Path $license) { Copy-Item $license (Join-Path $win "node\LICENSE") -Force }

$bat = @"
@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Cung Lam - ung dung du an

if not exist "node\node.exe" goto missing
if not exist "app\server.js" goto missing

echo.
echo   Dang khoi dong Cung Lam...
echo   Neu trinh duyet khong tu mo, mo: http://127.0.0.1:4321
echo   (Neu cong 4321 ban, xem dong "dang chay tai" ben duoi)
echo.

rem Mo trinh duyet bang PowerShell (khong phu thuoc Node), cho URL that trong app\data\url.txt
if not defined CUNGLAM_NO_OPEN start "" /b powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0MO-TRINH-DUYET.ps1"
set CUNGLAM_OPEN=0
"node\node.exe" "app\server.js"
set CODE=%ERRORLEVEL%

echo.
if "%CODE%"=="0" echo   Ung dung da dung.
if not "%CODE%"=="0" echo   Ung dung dung voi loi. Xem HUONG-DAN-NHANH.txt
echo   Nhan phim bat ky de dong cua so.
pause >nul
exit /b 0

:missing
echo.
echo   [LOI] Thieu file node\node.exe hoac app\server.js
echo   Hay giai nen lai toan bo goi zip ra mot thu muc moi.
echo.
pause
exit /b 1
"@
Set-Content -Path (Join-Path $win "CHAY-CUNG-LAM.bat") -Value $bat -Encoding ascii

# Trình mở trình duyệt độc lập: đọc đúng cổng thật từ app\data\url.txt
$openerPs = @'
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$url = 'http://127.0.0.1:4321'
for ($i = 0; $i -lt 40; $i++) {
  if (Test-Path 'app\data\url.txt') {
    $candidate = (Get-Content 'app\data\url.txt' -Raw).Trim()
    if ($candidate) { $url = $candidate; break }
  }
  Start-Sleep -Milliseconds 500
}
Start-Process $url
'@
Set-Content -Path (Join-Path $win "MO-TRINH-DUYET.ps1") -Value $openerPs -Encoding utf8BOM

$openerBat = @"
@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0MO-TRINH-DUYET.ps1"
"@
Set-Content -Path (Join-Path $win "MO-TRINH-DUYET.bat") -Value $openerBat -Encoding ascii

$guide = @"
CUNG LAM - UNG DUNG KET NOI DU AN
Phien ban $Version - Windows 64-bit

----------------------------------------
CHAY NGAY
----------------------------------------
1. Giai nen toan bo thu muc ra Desktop hoac Documents.
   (Dung chay truc tiep trong file zip, va tranh thu muc he thong
   nhu Program Files vi ung dung can ghi du lieu.)
2. Nhap dup file: CHAY-CUNG-LAM.bat
3. Trinh duyet se tu mo. Neu khong thay trinh duyet:
      - Nhap dup file MO-TRINH-DUYET.bat, hoac
      - Copy dia chi trong cua so den (vi du http://127.0.0.1:4321)
        dan vao Chrome/Edge.
   Cua so den luon in dong:
      CUNG LAM DA SAN SANG:  http://127.0.0.1:4321
4. Dang nhap demo: an@cunglam.vn  /  mat khau: demo1234
5. Tat ung dung: dong cua so den (Command Prompt).

Khong can cai Node.js - da kem san trong thu muc node.

----------------------------------------
DU LIEU
----------------------------------------
- Du lieu luu trong: app\data\cunglam.db
- Xoa thu muc app\data de tao lai du lieu demo tu dau.
- Du lieu mau la hua cau, khong co giao dich tien that.

----------------------------------------
CAI THANH APP (PWA)
----------------------------------------
- Tren Chrome/Edge: bieu tuong cai dat tren thanh dia chi,
  hoac menu trinh duyet > "Cai dat ung dung".
- Tren iPhone: mo bang Safari > Chia se > "Them vao MH chinh".
- Tren dien thoai Android: mo bang Chrome > menu > "Cai dat ung dung".

----------------------------------------
NEU GAP SU CO
----------------------------------------
- Khong thay giao dien / trinh duyet bao khong ket noi duoc:
    + Nhap dup MO-TRINH-DUYET.bat de mo lai trinh duyet.
    + Xem cua so den co dong "CUNG LAM DA SAN SANG: ..." khong.
    + Mo dung dia chi do (co the la cong 4322 neu 4321 bi chiem).
- Windows SmartScreen canh bao: bam "More info" > "Run anyway".
  (node.exe chua ky so, day la canh bao binh thuong.)
- Cong 4321 dang bi chiem: ung dung tu chuyen sang 4322, 4323...
  Dia chi that duoc in trong cua so den.
- Diem danh gia bao loi khi mo: thu dung Chrome/Edge ban moi.

Huong dan day du: app\README.md
"@
Set-Content -Path (Join-Path $win "HUONG-DAN-NHANH.txt") -Value $guide -Encoding utf8BOM

$winZip = Join-Path $dist "CungLam-$Version-win64.zip"
if (Test-Path $winZip) { Remove-Item $winZip -Force }
Compress-Archive -Path (Join-Path $win "*") -DestinationPath $winZip -CompressionLevel Optimal

# ---------- Bản mã nguồn ----------
$source = Join-Path $dist "CungLam-$Version-source"
Reset-Dir $source
$exclude = @("data", "dist", ".tmp-chrome", ".qa", ".pkgtest", ".srctest", "node_modules")
Get-ChildItem $root -Force | Where-Object { $exclude -notcontains $_.Name -and $_.Extension -ne ".log" } | ForEach-Object {
  Copy-Item $_.FullName -Destination $source -Recurse -Force
}
$sourceZip = Join-Path $dist "CungLam-$Version-source.zip"
if (Test-Path $sourceZip) { Remove-Item $sourceZip -Force }
Compress-Archive -Path (Join-Path $source "*") -DestinationPath $sourceZip -CompressionLevel Optimal

Remove-Item -Recurse -Force $win, $source

Get-ChildItem $dist -Filter "*.zip" | Select-Object Name, @{n = "MB"; e = { [math]::Round($_.Length / 1MB, 1) } } | Format-Table -AutoSize


