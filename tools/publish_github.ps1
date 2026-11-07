# Đưa mã nguồn lên GitHub: kiểm tra git, init repo, commit và push.
# Ví dụ:
#   pwsh tools/publish_github.ps1 -Remote https://github.com/<user>/cunglam.git
param(
  [string]$Remote = "",
  [string]$Message = "feat: Cung Lam MVP 0.3.0"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "  Chua cai Git. Tai ban Windows: https://git-scm.com/download/win" -ForegroundColor Yellow
  Write-Host "  Cai xong, mo lai PowerShell va chay lai script nay." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

if (-not (Test-Path ".git")) {
  git init -b main
  Write-Host "Da tao repo moi (nhanh main)."
}

git add .

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "Khong co thay doi moi de commit."
} else {
  git commit -m $Message
}

if ($Remote) {
  $remotes = git remote
  if ($remotes -contains "origin") {
    git remote set-url origin $Remote
  } else {
    git remote add origin $Remote
  }
  git push -u origin main
  Write-Host "Da push len $Remote"
} else {
  Write-Host ""
  Write-Host "Da commit xong. Tao repo tren GitHub (dung PUBLIC/PRIVATE tuy y), roi chay:"
  Write-Host "  pwsh tools/publish_github.ps1 -Remote https://github.com/<tai-khoan>/cunglam.git"
}
