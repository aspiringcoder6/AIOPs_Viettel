param(
  [int]$TimeoutSeconds = 180,
  [string]$ComposeFile = "docker\docker-compose.yml",
  [string]$ApiBaseUrl = "http://localhost:3000",
  [string]$DashboardApiBaseUrl = "http://localhost:3100/api",
  [switch]$TriggerIncident
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Wait-Until {
  param(
    [string]$Name,
    [scriptblock]$Check,
    [int]$Timeout = $TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($Timeout)
  $lastError = $null

  while ((Get-Date) -lt $deadline) {
    try {
      if (& $Check) {
        Write-Host "OK  $Name" -ForegroundColor Green
        return
      }
    }
    catch {
      $lastError = $_.Exception.Message
    }

    Start-Sleep -Seconds 3
  }

  if ($lastError) {
    throw "$Name did not become ready. Last error: $lastError"
  }

  throw "$Name did not become ready."
}

function Invoke-Json {
  param([string]$Url)
  Invoke-RestMethod -Uri $Url -TimeoutSec 10
}

function Invoke-DbScalar {
  param([string]$Sql)

  $output = docker compose -f $ComposeFile exec -T postgres `
    psql -U admin -d aiops -t -A -c $Sql

  if ($LASTEXITCODE -ne 0) {
    throw "Database query failed: $Sql"
  }

  return ($output | Select-Object -Last 1).Trim()
}

Write-Step "Checking containers and service health"

Wait-Until "Postgres" {
  docker compose -f $ComposeFile exec -T postgres pg_isready -U admin -d aiops | Out-Null
  return $LASTEXITCODE -eq 0
}

Wait-Until "Node API" {
  Invoke-Json "$ApiBaseUrl/api/health" | Out-Null
  return $true
}

Wait-Until "Prometheus" {
  $result = Invoke-Json "http://localhost:9090/api/v1/query?query=up"
  return $result.status -eq "success"
}

Wait-Until "Dashboard API" {
  $result = Invoke-Json "$DashboardApiBaseUrl/health"
  return $result.status -eq "ok"
}

if ($TriggerIncident) {
  Write-Step "Triggering sample error incident"
  try {
    Invoke-Json "$ApiBaseUrl/api/incident/error-spike" | Out-Null
  }
  catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 500) {
      throw
    }
  }
}

Write-Step "Checking database pipeline milestones"

$checks = @(
  @{ Name = "events"; Sql = "SELECT COUNT(*) FROM events;" },
  @{ Name = "context_bundles"; Sql = "SELECT COUNT(*) FROM context_bundles;" },
  @{ Name = "ai_analyses"; Sql = "SELECT COUNT(*) FROM ai_analyses;" },
  @{ Name = "active_incidents"; Sql = "SELECT COUNT(*) FROM active_incidents;" },
  @{ Name = "alerts"; Sql = "SELECT COUNT(*) FROM alerts;" }
)

foreach ($check in $checks) {
  $count = Invoke-DbScalar $check.Sql

  if ([int]$count -lt 1) {
    throw "$($check.Name) has no rows yet."
  }

  Write-Host "OK  $($check.Name): $count row(s)" -ForegroundColor Green
}

Write-Step "Checking dashboard data endpoints"

$summary = Invoke-Json "$DashboardApiBaseUrl/summary"
$incidents = Invoke-Json "$DashboardApiBaseUrl/incidents"
$alerts = Invoke-Json "$DashboardApiBaseUrl/alerts"

if ($null -eq $summary.incidents) {
  throw "Dashboard summary response is missing incidents."
}

if ($incidents.Count -lt 1) {
  throw "Dashboard incidents endpoint returned no rows."
}

if ($alerts.Count -lt 1) {
  throw "Dashboard alerts endpoint returned no rows."
}

Write-Host "OK  Dashboard summary/incidents/alerts returned data" -ForegroundColor Green

Write-Host ""
Write-Host "Smoke test passed." -ForegroundColor Green
