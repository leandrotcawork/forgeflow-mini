#!/usr/bin/env powershell

$ErrorActionPreference = 'Stop'

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Get-PythonExe {
  $candidates = @('python', 'py')

  foreach ($candidate in $candidates) {
    $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($cmd) {
      if ($cmd.Source) {
        return $cmd.Source
      }
      return $cmd.Name
    }
  }

  throw 'No python executable found for hook execution.'
}

function Get-BashExe {
  $preferred = @(
    'C:\Program Files\Git\bin\bash.exe',
    'C:\Program Files\Git\usr\bin\bash.exe'
  )

  foreach ($candidate in $preferred) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  $cmd = Get-Command 'bash' -ErrorAction SilentlyContinue
  if ($cmd) {
    if ($cmd.Source) {
      return $cmd.Source
    }
    return $cmd.Name
  }

  throw 'No bash executable found for hook execution.'
}

function Get-NodeExe {
  $cmd = Get-Command 'node' -ErrorAction SilentlyContinue
  if ($cmd) {
    if ($cmd.Source) {
      return $cmd.Source
    }
    return $cmd.Name
  }

  throw 'No node executable found for workflow-state smoke execution.'
}

function New-TempProject {
  $root = Join-Path ([System.IO.Path]::GetTempPath()) ("forgeflow-kernel-smoke-" + [System.Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $root | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $root '.brain\working-memory') -Force | Out-Null
  return $root
}

function Write-State {
  param(
    [string]$ProjectDir,
    [object]$State
  )

  $statePath = Join-Path $ProjectDir '.brain\working-memory\workflow-state.json'
  $State | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

function Invoke-Hook {
  param(
    [string]$ScriptPath,
    [string]$Payload,
    [string]$ProjectDir
  )

  $previous = @{
    CLAUDE_PROJECT_DIR = $env:CLAUDE_PROJECT_DIR
  }

  $env:CLAUDE_PROJECT_DIR = $ProjectDir
  try {
    try {
      $rawOutput = $Payload | & $script:BashExe $ScriptPath 2>&1
      if ($LASTEXITCODE -ne 0) {
        throw "hook exited with code ${LASTEXITCODE}: $rawOutput"
      }

      $trimmed = (($rawOutput | Out-String).Trim())
      $parsed = $trimmed | ConvertFrom-Json
      Assert-True ($null -ne $parsed.hookSpecificOutput) "hook must emit hookSpecificOutput JSON: $ScriptPath"
      return $parsed
    } catch {
      # Fallback for environments where bash cannot be spawned reliably.
      $scriptContent = Get-Content -LiteralPath $ScriptPath -Raw
      $match = [regex]::Match($scriptContent, "(?s)python3\s+-\s+<<'PY'\r?\n(.*?)\r?\nPY\s*$")
      if (-not $match.Success) {
        throw
      }

      $tempPython = Join-Path $ProjectDir ("hook-runner-" + [System.Guid]::NewGuid().ToString('N') + '.py')
      $previousInputJson = $env:INPUT_JSON
      $previousProjectDir = $env:PROJECT_DIR
      $previousStateFile = $env:STATE_FILE
      $previousOrientationFile = $env:ORIENTATION_FILE

      Set-Content -LiteralPath $tempPython -Value $match.Groups[1].Value -Encoding UTF8
      $env:INPUT_JSON = $Payload
      $env:PROJECT_DIR = $ProjectDir
      $env:STATE_FILE = Join-Path $ProjectDir '.brain\working-memory\workflow-state.json'
      $env:ORIENTATION_FILE = Join-Path (Split-Path (Split-Path $ScriptPath -Parent) -Parent) 'skills\brain-orientation\SKILL.md'
      try {
        $rawOutput = & $script:PythonExe $tempPython
        if ($LASTEXITCODE -ne 0) {
          throw "fallback python hook exited with code ${LASTEXITCODE}: $rawOutput"
        }
      } finally {
        $env:INPUT_JSON = $previousInputJson
        $env:PROJECT_DIR = $previousProjectDir
        $env:STATE_FILE = $previousStateFile
        $env:ORIENTATION_FILE = $previousOrientationFile
        Remove-Item -LiteralPath $tempPython -Force -ErrorAction SilentlyContinue
      }

      $trimmed = (($rawOutput | Out-String).Trim())
      $parsed = $trimmed | ConvertFrom-Json
      Assert-True ($null -ne $parsed.hookSpecificOutput) "hook must emit hookSpecificOutput JSON: $ScriptPath"
      return $parsed
    }
  } finally {
    $env:CLAUDE_PROJECT_DIR = $previous.CLAUDE_PROJECT_DIR
  }
}

function Invoke-WorkflowStateSmoke {
  param(
    [string]$NodeExe,
    [string]$WorkflowStatePath
  )

  $script = @"
const mod = require(process.argv[1]);
const state = mod.createState();
const result = {
  initialPhase: state.phase,
  approvePlanFailed: false,
  approvePlanError: null,
  approvePlanAfterSpec: null
};

try {
  mod.transition(state, 'approve_plan');
} catch (err) {
  result.approvePlanFailed = true;
  result.approvePlanError = err && err.message ? err.message : String(err);
}

const afterOpenSpec = mod.transition(state, 'open_spec');
const afterSubmitReview = mod.transition(afterOpenSpec, 'submit_spec_review');
const approvedSpec = mod.transition(afterSubmitReview, 'approve_spec');
const approvedPlan = mod.transition(approvedSpec, 'approve_plan', {
  allowed_files: ['src/app.js']
});
result.approvePlanAfterSpec = {
  phase: approvedPlan.phase,
  plan_status: approvedPlan.plan_status,
  allowed_files: approvedPlan.allowed_files
};

process.stdout.write(JSON.stringify(result));
"@

  $output = & $NodeExe -e $script $WorkflowStatePath
  if ($LASTEXITCODE -ne 0) {
    throw "workflow-state smoke helper exited with code ${LASTEXITCODE}: $output"
  }

  return ($output | ConvertFrom-Json)
}

$script:PythonExe = Get-PythonExe
$script:BashExe = Get-BashExe
$script:NodeExe = Get-NodeExe
$hookScriptRoot = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'hooks'

$scriptPath = Join-Path $hookScriptRoot 'pre-tool-use.sh'
$stopScriptPath = Join-Path $hookScriptRoot 'stop.sh'
$sessionStartScriptPath = Join-Path $hookScriptRoot 'session-start.sh'
$hippocampusGuardScriptPath = Join-Path $hookScriptRoot 'hippocampus-guard.sh'

$tempProject = New-TempProject
try {
  Write-Host '[smoke] verifying hook behavior'

  $payloadOutsideBrain = @{ tool_input = @{ file_path = 'src/app.js' } } | ConvertTo-Json -Depth 10
  $decisionOutsideBrain = (Invoke-Hook -ScriptPath $scriptPath -Payload $payloadOutsideBrain -ProjectDir $tempProject).hookSpecificOutput.permissionDecision
  Assert-True ($decisionOutsideBrain -eq 'deny') 'pre-tool-use must deny source writes when workflow-state is missing'

  Write-State -ProjectDir $tempProject -State @{
    task_id = 'task-1'
    phase = 'review'
    plan_status = 'approved'
    allowed_files = @()
    verify_status = 'pending'
  }
  $decisionEmptyAllowed = (Invoke-Hook -ScriptPath $scriptPath -Payload $payloadOutsideBrain -ProjectDir $tempProject).hookSpecificOutput.permissionDecision
  Assert-True ($decisionEmptyAllowed -eq 'deny') 'pre-tool-use must deny source writes when allowed_files is empty'

  $payloadBrainWrite = @{ tool_input = @{ file_path = '.brain/working-memory/temp.json' } } | ConvertTo-Json -Depth 10
  Remove-Item -LiteralPath (Join-Path $tempProject '.brain\working-memory\workflow-state.json') -Force
  $decisionBrainWrite = (Invoke-Hook -ScriptPath $scriptPath -Payload $payloadBrainWrite -ProjectDir $tempProject).hookSpecificOutput.permissionDecision
  Assert-True ($decisionBrainWrite -eq 'allow') 'pre-tool-use must allow writes inside .brain'

  $hippocampusPayload = @{ tool_input = @{ file_path = '.brain/hippocampus/architecture.md' } } | ConvertTo-Json -Depth 10
  $hippocampusDecision = (Invoke-Hook -ScriptPath $hippocampusGuardScriptPath -Payload $hippocampusPayload -ProjectDir $tempProject).hookSpecificOutput.permissionDecision
  Assert-True ($hippocampusDecision -eq 'deny') 'hippocampus-guard must deny writes under .brain/hippocampus'

  $nonHippocampusDecision = (Invoke-Hook -ScriptPath $hippocampusGuardScriptPath -Payload $payloadOutsideBrain -ProjectDir $tempProject).hookSpecificOutput.permissionDecision
  Assert-True ($nonHippocampusDecision -eq 'allow') 'hippocampus-guard must allow writes outside .brain/hippocampus'

  $sessionStartOutput = Invoke-Hook -ScriptPath $sessionStartScriptPath -Payload '{}' -ProjectDir $tempProject
  $additionalContext = [string]$sessionStartOutput.hookSpecificOutput.additionalContext
  Assert-True ($additionalContext.Length -gt 0) 'session-start must emit additionalContext'

  Write-State -ProjectDir $tempProject -State @{
    task_id = $null
    phase = 'plan'
    verify_status = 'pending'
  }
  $stopDecision = (Invoke-Hook -ScriptPath $stopScriptPath -Payload '{}' -ProjectDir $tempProject).hookSpecificOutput.permissionDecision
  Assert-True ($stopDecision -eq 'allow') 'stop must allow when no task_id is active'

} finally {
  Remove-Item -LiteralPath $tempProject -Recurse -Force
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$hookDir = Join-Path $root 'hooks'
$hooksJsonRaw = Get-Content -LiteralPath (Join-Path $hookDir 'hooks.json') -Raw

$hooksJson = $hooksJsonRaw | ConvertFrom-Json

Write-Host '[smoke] verifying workflow-state transitions'

$workflowStatePath = Join-Path $root 'scripts\workflow-state.js'
$workflowStateSmoke = Invoke-WorkflowStateSmoke -NodeExe $script:NodeExe -WorkflowStatePath $workflowStatePath

Assert-True ($workflowStateSmoke.initialPhase -eq 'SPEC_PENDING') 'workflow-state must start in SPEC_PENDING phase'
Assert-True ($workflowStateSmoke.approvePlanFailed -eq $true) 'approve_plan must fail before spec is approved'
Assert-True ($workflowStateSmoke.approvePlanError -like '*approved spec*') 'approve_plan failure must explain approved spec precondition'
Assert-True ($workflowStateSmoke.approvePlanAfterSpec.plan_status -eq 'approved') 'approve_spec -> approve_plan must approve the plan'
Assert-True ($workflowStateSmoke.approvePlanAfterSpec.allowed_files.Count -eq 1) 'approve_plan must retain allowed_files from payload'

Write-Host '[smoke] verifying hook contract strings'

$hookKeys = @($hooksJson.hooks.PSObject.Properties.Name)
Assert-True ($hookKeys -contains 'SessionStart') 'hooks.json must register SessionStart'
Assert-True ($hookKeys -contains 'PreToolUse') 'hooks.json must register PreToolUse'
Assert-True ($hookKeys -contains 'Stop') 'hooks.json must register Stop'
Assert-True ($hookKeys -contains 'SubagentStart') 'hooks.json must register SubagentStart'

$subagentStartEntry = $hooksJson.hooks.SubagentStart | Select-Object -First 1
Assert-True ($subagentStartEntry.command -eq 'bash hooks/subagent-start.sh') 'SubagentStart command must point to subagent-start.sh'

$preToolNames = @($hooksJson.hooks.PreToolUse | ForEach-Object { $_.name })
Assert-True ($preToolNames -contains 'hippocampus-guard') 'PreToolUse must include hippocampus-guard'
Assert-True ($preToolNames -contains 'workflow-pre-tool-use') 'PreToolUse must include workflow-pre-tool-use'

$sessionStartEntry = $hooksJson.hooks.SessionStart | Select-Object -First 1
Assert-True ($sessionStartEntry.command -eq 'bash hooks/session-start.sh') 'SessionStart command must point to session-start.sh'

$stopEntry = $hooksJson.hooks.Stop | Select-Object -First 1
Assert-True ($stopEntry.command -eq 'bash hooks/stop.sh') 'Stop command must point to stop.sh'

Write-Host 'Workflow kernel smoke checks passed.'
