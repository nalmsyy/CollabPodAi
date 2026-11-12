$stdoutPath = "C:\Users\LEGION\AppData\Local\Temp\pw-stdout.txt"
$stderrPath = "C:\Users\LEGION\AppData\Local\Temp\pw-stderr.txt"
if (Test-Path $stdoutPath) { Remove-Item $stdoutPath -Force }
if (Test-Path $stderrPath) { Remove-Item $stderrPath -Force }

$process = Start-Process -FilePath "npx.cmd" `
  -ArgumentList "playwright", "install", "chromium" `
  -NoNewWindow `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

$process.WaitForExit()

if ((Test-Path $stdoutPath)) {
  $stdout = Get-Content $stdoutPath -Raw
} else {
  $stdout = "(no stdout captured)"
}
if ((Test-Path $stderrPath)) {
  $stderr = Get-Content $stderrPath -Raw
} else {
  $stderr = "(no stderr captured)"
}

$result = "EXIT=$([math]::Round($process.ExitCode))" + [char]10 + $stdout
$result += [char]10 + "STDERR_START" + [char]10 + $stderr

Write-Output $result
