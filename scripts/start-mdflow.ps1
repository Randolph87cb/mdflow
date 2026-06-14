[CmdletBinding()]
param(
  [int]$ApiPort = 8765,
  [int]$WebPort = 4176,
  [switch]$NoBrowser,
  [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WebDir = Join-Path $ProjectRoot "web"
$LogDir = Join-Path $ProjectRoot ".mdflow-studio"
$ApiLog = Join-Path $LogDir "api.out.log"
$ApiErr = Join-Path $LogDir "api.err.log"
$WebLog = Join-Path $LogDir "web.out.log"
$WebErr = Join-Path $LogDir "web.err.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-CommandPath {
  param([string[]]$Names)

  foreach ($Name in $Names) {
    $Command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($Command) {
      return $Command.Source
    }
  }
  throw "Required command not found: $($Names -join ', ')"
}

function Get-ListeningProcessId {
  param([int]$Port)

  $Connection = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($Connection) {
    return [int]$Connection.OwningProcess
  }
  return $null
}

function Stop-PortIfRequested {
  param(
    [int]$Port,
    [string]$Name
  )

  $PidOnPort = Get-ListeningProcessId -Port $Port
  if (-not $PidOnPort) {
    return
  }

  if (-not $ForceRestart) {
    Write-Host "$Name already listening on port $Port (PID $PidOnPort). Reusing it."
    return
  }

  Write-Host "Stopping $Name on port $Port (PID $PidOnPort)..."
  Stop-Process -Id $PidOnPort -Force
  Start-Sleep -Milliseconds 500
}

function Wait-Http {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 30
  )

  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $Deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
      return
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

function Start-StudioApi {
  $Python = Get-CommandPath -Names @("python.exe", "python")
  $ExistingPid = Get-ListeningProcessId -Port $ApiPort
  if ($ExistingPid) {
    Wait-Http -Url "http://127.0.0.1:$ApiPort/api/health" -Name "Studio API" -TimeoutSeconds 5
    return
  }

  Write-Host "Starting Studio API on http://127.0.0.1:$ApiPort ..."
  $env:PYTHONPATH = "src"
  $env:PYTHONUTF8 = "1"
  Start-Process `
    -FilePath $Python `
    -ArgumentList @("-m", "mdflow.studio_api") `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ApiLog `
    -RedirectStandardError $ApiErr
  Wait-Http -Url "http://127.0.0.1:$ApiPort/api/health" -Name "Studio API"
}

function Ensure-WebDependencies {
  if (Test-Path (Join-Path $WebDir "node_modules")) {
    return
  }

  $Npm = Get-CommandPath -Names @("npm.cmd", "npm")
  Write-Host "web/node_modules not found. Running npm install..."
  Push-Location $WebDir
  try {
    & $Npm install
  } finally {
    Pop-Location
  }
}

function Start-WebUi {
  $Npm = Get-CommandPath -Names @("npm.cmd", "npm")
  $ExistingPid = Get-ListeningProcessId -Port $WebPort
  if ($ExistingPid) {
    Write-Host "Web UI already listening on port $WebPort (PID $ExistingPid). Reusing it."
    Wait-Http -Url "http://127.0.0.1:$WebPort/" -Name "Web UI" -TimeoutSeconds 5
    return
  }

  Write-Host "Starting Web UI on http://127.0.0.1:$WebPort ..."
  Start-Process `
    -FilePath $Npm `
    -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$WebPort", "--strictPort") `
    -WorkingDirectory $WebDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $WebLog `
    -RedirectStandardError $WebErr
  Wait-Http -Url "http://127.0.0.1:$WebPort/" -Name "Web UI"
}

Write-Host "mdflow one-click startup"
Write-Host "Project: $ProjectRoot"

Stop-PortIfRequested -Port $ApiPort -Name "Studio API"
Stop-PortIfRequested -Port $WebPort -Name "Web UI"
Ensure-WebDependencies
Start-StudioApi
Start-WebUi

$Url = "http://127.0.0.1:$WebPort/"
Write-Host ""
Write-Host "Ready."
Write-Host "UI:  $Url"
Write-Host "API: http://127.0.0.1:$ApiPort"
Write-Host "Logs:"
Write-Host "  $ApiLog"
Write-Host "  $ApiErr"
Write-Host "  $WebLog"
Write-Host "  $WebErr"

if (-not $NoBrowser) {
  Start-Process $Url
}
