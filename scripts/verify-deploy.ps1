# 部署自检（Windows PowerShell 5.1+）
#
# 用途：目录改名/搬移、服务器重启、拉取新代码之后，一条命令确认部署是否健康。
# 用法：
#   npm run docker:verify
#   或  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-deploy.ps1
#
# 退出码：0 全部通过；1 有失败项。

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$script:fail = 0
$script:warn = 0

function Pass($label) { Write-Host ("  [OK]   " + $label) -ForegroundColor Green }
function Fail($label, $hint) {
  Write-Host ("  [FAIL] " + $label) -ForegroundColor Red
  if ($hint) { Write-Host ("         → " + $hint) -ForegroundColor Yellow }
  $script:fail++
}
function Warn($label, $hint) {
  Write-Host ("  [WARN] " + $label) -ForegroundColor Yellow
  if ($hint) { Write-Host ("         → " + $hint) -ForegroundColor Yellow }
  $script:warn++
}

Write-Host "`n=== 校园失物招领 · 部署自检 ===" -ForegroundColor Cyan
Write-Host "仓库目录: $root`n"

# ---------- 1. Docker 引擎 ----------
Write-Host "[1/5] Docker 引擎"
$null = docker info --format '{{.ServerVersion}}' 2>$null
if ($LASTEXITCODE -eq 0) {
  Pass ("Docker 已就绪：" + (docker info --format '{{.ServerVersion}}' 2>$null))
} else {
  Fail 'Docker 守护进程未运行' '请启动 Docker Desktop，等图标变绿后重试'
  Write-Host "`n结论：Docker 没起来，后面的检查跳过。`n" -ForegroundColor Red
  exit 1
}

# ---------- 2. 容器状态 ----------
Write-Host "`n[2/5] 容器状态"
$psRaw = docker compose ps --format "{{.Name}}|{{.Status}}" 2>$null
if (-not $psRaw) {
  Fail '没有查到容器' '执行 npm run docker:recreate 重新创建'
} else {
  $rows = $psRaw -split "`n" | Where-Object { $_.Trim() }
  foreach ($row in $rows) {
    $parts = $row -split '\|'
    $name = $parts[0]
    $status = if ($parts.Length -gt 1) { $parts[1] } else { '' }
    if ($status -match 'Up' -and $status -notmatch 'unhealthy') {
      Pass ("$name — $status")
    } else {
      Fail ("$name — $status") "docker compose logs $name 看具体原因"
    }
  }
}

# ---------- 3. 挂载路径是否指向当前目录 ----------
Write-Host "`n[3/5] 配置文件挂载路径（改名后最容易踩的坑）"
$mountSrc = (docker inspect campus-lostfound-nginx --format '{{range .Mounts}}{{.Source}}{{end}}' 2>$null)
if (-not $mountSrc) {
  Warn 'nginx 容器不存在或没有挂载' '执行 npm run docker:recreate'
} elseif ($mountSrc.StartsWith($root)) {
  Pass "挂载指向当前目录：$mountSrc"
} else {
  Fail "挂载仍指向旧路径：$mountSrc" '目录被改名了。在新目录执行 npm run docker:recreate'
}

# ---------- 4. 站点接口 ----------
Write-Host "`n[4/5] 站点可用性（http://localhost:8080）"
$checks = @(
  @{ name = '健康检查 /api/health'; url = 'http://localhost:8080/api/health'; expect = '"db":"up"' },
  @{ name = '首页 /'; url = 'http://localhost:8080/'; expect = '<div id="app">' },
  @{ name = '部门概况接口'; url = 'http://localhost:8080/api/public/profile'; expect = '"code":0' },
  @{ name = '公开分类接口'; url = 'http://localhost:8080/api/public/categories'; expect = '"code":0' },
  @{ name = '根 robots.txt'; url = 'http://localhost:8080/robots.txt'; expect = 'Disallow: /admin/' },
  @{ name = '根站点地图'; url = 'http://localhost:8080/sitemap.xml'; expect = '<urlset' }
)
foreach ($c in $checks) {
  try {
    $resp = Invoke-WebRequest -Uri $c.url -UseBasicParsing -TimeoutSec 10
    if ($resp.StatusCode -eq 200 -and $resp.Content -match [regex]::Escape($c.expect)) {
      Pass $c.name
    } else {
      Fail $c.name ("状态码 " + $resp.StatusCode + "，内容里没找到 " + $c.expect)
    }
  } catch {
    Fail $c.name $_.Exception.Message
  }
}

# ---------- 5. 数据是否完好 ----------
Write-Host "`n[5/5] 数据完整性"
$sql = "SELECT CONCAT((SELECT COUNT(*) FROM users WHERE role='admin'),'|',(SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'),'|',(SELECT COUNT(*) FROM items),'|',(SELECT COUNT(*) FROM categories),'|',(SELECT COUNT(*) FROM audit_logs));"
$out = $sql | docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B' 2>$null
$counts = ($out | Where-Object { $_ -match '\|' } | Select-Object -First 1)
if ($counts) {
  $p = $counts.Trim() -split '\|'
  $admins = $p[0]; $activeAdmins = $p[1]; $items = $p[2]; $cats = $p[3]; $logs = $p[4]
  if ([int]$admins -eq 1 -and [int]$activeAdmins -eq 1 -and [int]$items -ge 0 -and [int]$cats -gt 0) {
    Pass "数据可读：唯一管理员已启用 / $items 条失物记录 / $cats 个分类 / $logs 条审计日志"
  } else {
    Fail "数据异常：admins=$admins activeAdmins=$activeAdmins items=$items categories=$cats" '应只有一个启用的专用管理员账号，且至少有一个分类'
  }
} else {
  Fail '无法查询数据库' '检查 MySQL 健康状态，并确认 MYSQL_PASSWORD 与已初始化的数据卷一致'
}

# ---------- 摘要 ----------
Write-Host "`n=== 结果 ===" -ForegroundColor Cyan
if ($script:fail -eq 0) {
  Write-Host ("全部通过" + $(if ($script:warn -gt 0) { "（$($script:warn) 条警告）" } else { '' })) -ForegroundColor Green
  Write-Host "站点：http://localhost:8080`n"
  exit 0
} else {
  Write-Host ("$($script:fail) 项失败" + $(if ($script:warn -gt 0) { "，$($script:warn) 条警告" } else { '' })) -ForegroundColor Red
  Write-Host "常见修复：npm run docker:recreate`n" -ForegroundColor Yellow
  exit 1
}
