# ==============================================================================
# Emadco ERP - Pure ASCII Native Windows Offline Server (PowerShell)
# 100% Pure 7-bit ASCII - Works on Windows 7, 8, 10, 11 (PowerShell 2.0 to 7+)
# Zero dependencies, zero third-party packages, zero internet required.
# ==============================================================================

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$root = $PSScriptRoot
if (-not $root) {
    try {
        $root = Split-Path -Parent $MyInvocation.MyCommand.Definition
    } catch {}
}
if (-not $root -or -not (Test-Path $root)) {
    $root = (Get-Location).Path
}

$expensesFile = Join-Path $root "expenses_data.json"
if (-not (Test-Path $expensesFile)) {
    try {
        '{"expenses":[]}' | Out-File -FilePath $expensesFile -Encoding utf8
    } catch {}
}

$mimeTypes = @{
    ".html"   = "text/html; charset=utf-8"
    ".htm"    = "text/html; charset=utf-8"
    ".js"     = "application/javascript; charset=utf-8"
    ".mjs"    = "application/javascript; charset=utf-8"
    ".css"    = "text/css; charset=utf-8"
    ".json"   = "application/json; charset=utf-8"
    ".png"    = "image/png"
    ".jpg"    = "image/jpeg"
    ".jpeg"   = "image/jpeg"
    ".gif"    = "image/gif"
    ".svg"    = "image/svg+xml"
    ".ico"    = "image/x-icon"
    ".woff"   = "font/woff"
    ".woff2"  = "font/woff2"
    ".ttf"    = "font/ttf"
    ".webp"   = "image/webp"
}

function Find-ServerFile($urlPath) {
    $rawClean = $urlPath.Split("?")[0].TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
    $cleanPath = $rawClean
    try {
        $cleanPath = [System.Uri]::UnescapeDataString($rawClean)
    } catch {}
    if (-not $cleanPath -or $cleanPath -eq "") {
        $cleanPath = "index.html"
    }

    $candidates = @(
        (Join-Path $root $cleanPath),
        (Join-Path (Join-Path $root "public") $cleanPath),
        (Join-Path (Join-Path $root "dist") $cleanPath)
    )

    if ($cleanPath.StartsWith("assets") -or $cleanPath.StartsWith("public")) {
        $candidates = @(
            (Join-Path $root $cleanPath),
            (Join-Path (Join-Path $root "public") $cleanPath),
            (Join-Path (Join-Path $root "dist") $cleanPath)
        ) + $candidates
    }

    foreach ($cand in $candidates) {
        if (Test-Path $cand -PathType Leaf) {
            return $cand
        }
    }

    # SPA Routing Fallback
    $ext = [System.IO.Path]::GetExtension($cleanPath)
    if (-not $ext) {
        $indexCandidates = @(
            (Join-Path $root "index.html"),
            (Join-Path (Join-Path $root "dist") "index.html"),
            (Join-Path (Join-Path $root "public") "index.html")
        )
        foreach ($cand in $indexCandidates) {
            if (Test-Path $cand -PathType Leaf) {
                return $cand
            }
        }
    }

    return $null
}

# Find available port starting from 3000
$port = 3000
$portsToTry = @(3000, 3001, 8080, 8088)
$tcpListener = $null

foreach ($p in $portsToTry) {
    try {
        $testListener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $p)
        $testListener.Start()
        $tcpListener = $testListener
        $port = $p
        break
    } catch {
        # Port in use, try next
    }
}

if (-not $tcpListener) {
    Write-Host "[!] Could not bind to local port. Please close any application using port 3000." -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

try {
    [Console]::Title = "Emadco ERP Offline Server - Port $port"
} catch {}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  EMADCO ERP - OFFLINE LOCAL SERVER" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " [OK] Server running successfully at: http://localhost:$port" -ForegroundColor Green
Write-Host " [OK] Alternative URL:               http://127.0.0.1:$port" -ForegroundColor Cyan
Write-Host " [OK] System status: READY - 100% Offline (No Internet Needed)" -ForegroundColor Green
Write-Host ""
Write-Host " ------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  IMPORTANT NOTICE:" -ForegroundColor Yellow
Write-Host "  Keep this window open while working on the system." -ForegroundColor White
Write-Host "  Closing this window will stop the local server." -ForegroundColor White
Write-Host " ------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Automatically launch browser
try {
    Start-Process "http://localhost:$port"
} catch {
    try { Start-Process "http://127.0.0.1:$port" } catch {}
}

# TCP Request Handling Loop
try {
    while ($true) {
        try {
            $client = $tcpListener.AcceptTcpClient()
            $stream = $client.GetStream()
            $stream.ReadTimeout = 4000
            $stream.WriteTimeout = 6000

            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $firstLine = $reader.ReadLine()

            if (-not $firstLine) {
                $client.Close()
                continue
            }

            # Drain HTTP headers
            $contentLength = 0
            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line -or $line.Trim() -eq "") { break }
                if ($line.ToLower().StartsWith("content-length:")) {
                    $partsCL = $line.Split(":")
                    if ($partsCL.Length -gt 1) {
                        [int]::TryParse($partsCL[1].Trim(), [ref]$contentLength) | Out-Null
                    }
                }
            }

            # Read POST body if present
            $postBody = ""
            if ($contentLength -gt 0) {
                $buf = New-Object char[] $contentLength
                $totalRead = 0
                while ($totalRead -lt $contentLength) {
                    $readNow = $reader.Read($buf, $totalRead, $contentLength - $totalRead)
                    if ($readNow -le 0) { break }
                    $totalRead += $readNow
                }
                $postBody = -join $buf
            }

            $parts = $firstLine.Split(" ")
            $method = $parts[0].ToUpper()
            $rawUrl = if ($parts.Length -gt 1) { $parts[1] } else { "/" }
            $cleanUrl = $rawUrl.Split("?")[0]

            $corsHeaders = "Access-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type, Authorization`r`nConnection: close`r`n"

            if ($method -eq "OPTIONS") {
                $resp = "HTTP/1.1 200 OK`r`n$corsHeaders`r`nContent-Length: 0`r`n`r`n"
                $respBytes = [System.Text.Encoding]::ASCII.GetBytes($resp)
                $stream.Write($respBytes, 0, $respBytes.Length)
                $stream.Flush()
                $client.Close()
                continue
            }

            # Health Check API
            if ($cleanUrl -eq "/api/health") {
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok","mode":"offline_native","port":' + $port + '}')
                $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                $stream.Write($headBytes, 0, $headBytes.Length)
                $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                $stream.Flush()
                $client.Close()
                continue
            }

            # Local Disk Database APIs (/api/db/*)
            $dataDir = Join-Path $root "data"
            if (-not (Test-Path $dataDir)) {
                try { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null } catch {}
            }

            if ($cleanUrl -eq "/api/db/health" -or $cleanUrl -eq "/api/db/status") {
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true,"storageType":"PowerShell Local Disk Files","databaseLocation":"' + ($dataDir -replace '\\','\\') + '","isOfflineReady":true}')
                $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                $stream.Write($headBytes, 0, $headBytes.Length)
                $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                $stream.Flush()
                $client.Close()
            if ($cleanUrl -eq "/api/db-batch" -and $method -eq "POST") {
                try {
                    $batchReq = $postBody | ConvertFrom-Json
                    if ($batchReq.operations) {
                        $groupedOps = @{}
                        foreach ($op in $batchReq.operations) {
                            $cName = $op.collection -replace '[^a-zA-Z0-9_-]', ''
                            if (-not $cName) { continue }
                            if (-not $groupedOps.ContainsKey($cName)) {
                                $cFile = Join-Path $dataDir ($cName + ".json")
                                $existing = if (Test-Path $cFile) { [System.IO.File]::ReadAllText($cFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json } else { @() }
                                $groupedOps[$cName] = [System.Collections.ArrayList]@($existing)
                            }
                            $itemsList = $groupedOps[$cName]
                            $opId = if ($op.id) { [string]$op.id } elseif ($op.data -and $op.data.id) { [string]$op.data.id } else { "doc_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
                            $fIdx = -1
                            for ($i = 0; $i -lt $itemsList.Count; $i++) {
                                if ([string]$itemsList[$i].id -eq $opId) {
                                    $fIdx = $i
                                    break
                                }
                            }
                            if ($op.type -eq "delete") {
                                if ($fIdx -ge 0) { $itemsList.RemoveAt($fIdx) }
                            } else {
                                $fullData = $op.data
                                if (-not $fullData) { $fullData = [PSCustomObject]@{} }
                                $fullData | Add-Member -MemberType NoteProperty -Name "id" -Value $opId -Force
                                $fullData | Add-Member -MemberType NoteProperty -Name "updatedAt" -Value ([DateTime]::UtcNow.ToString("o")) -Force
                                if ($fIdx -ge 0) {
                                    $itemsList[$fIdx] = $fullData
                                } else {
                                    $fullData | Add-Member -MemberType NoteProperty -Name "createdAt" -Value ([DateTime]::UtcNow.ToString("o")) -Force
                                    $itemsList.Insert(0, $fullData)
                                }
                            }
                        }
                        foreach ($key in $groupedOps.Keys) {
                            $cFile = Join-Path $dataDir ($key + ".json")
                            $sJson = $groupedOps[$key] | ConvertTo-Json -Depth 6
                            [System.IO.File]::WriteAllText($cFile, $sJson, [System.Text.Encoding]::UTF8)
                        }
                    }
                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                } catch {
                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"' + ($_.Exception.Message -replace '"','\"') + '"}')
                }
                $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                $stream.Write($headBytes, 0, $headBytes.Length)
                $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                $stream.Flush()
                $client.Close()
                continue
            }

            if ($cleanUrl.StartsWith("/api/db/")) {
                $collPart = $cleanUrl.Substring("/api/db/".Length).Trim("/")
                $subParts = $collPart.Split("/")
                $collName = $subParts[0] -replace '[^a-zA-Z0-9_-]', ''
                $docId = if ($subParts.Length -gt 1) { $subParts[1] } else { $null }
                $collFile = Join-Path $dataDir ($collName + ".json")

                if ($method -eq "GET" -and -not $docId) {
                    $jsonContent = if (Test-Path $collFile) { [System.IO.File]::ReadAllText($collFile, [System.Text.Encoding]::UTF8) } else { "[]" }
                    $respStr = '{"success":true,"collection":"' + $collName + '","data":' + $jsonContent + '}'
                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($respStr)
                    $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                    $stream.Write($headBytes, 0, $headBytes.Length)
                    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                    $stream.Flush()
                    $client.Close()
                    continue
                }

                if ($method -eq "POST" -or $method -eq "PUT") {
                    try {
                        $items = if (Test-Path $collFile) { [System.IO.File]::ReadAllText($collFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json } else { @() }
                        $newItem = $postBody | ConvertFrom-Json
                        $targetId = if ($docId) { $docId } elseif ($newItem.id) { $newItem.id } else { "doc_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
                        $newItem | Add-Member -MemberType NoteProperty -Name "id" -Value ([string]$targetId) -Force
                        $newItem | Add-Member -MemberType NoteProperty -Name "updatedAt" -Value ([DateTime]::UtcNow.ToString("o")) -Force

                        $list = [System.Collections.ArrayList]@($items)
                        $foundIdx = -1
                        for ($i = 0; $i -lt $list.Count; $i++) {
                            if ([string]$list[$i].id -eq [string]$targetId) {
                                $foundIdx = $i
                                break
                            }
                        }
                        if ($foundIdx -ge 0) {
                            $list[$foundIdx] = $newItem
                        } else {
                            $list.Insert(0, $newItem)
                        }
                        $savedJson = $list | ConvertTo-Json -Depth 5
                        [System.IO.File]::WriteAllText($collFile, $savedJson, [System.Text.Encoding]::UTF8)
                        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                    } catch {
                        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"' + ($_.Exception.Message -replace '"','\"') + '"}')
                    }
                    $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                    $stream.Write($headBytes, 0, $headBytes.Length)
                    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                    $stream.Flush()
                    $client.Close()
                    continue
                }

                if ($method -eq "DELETE" -and $docId) {
                    try {
                        $items = if (Test-Path $collFile) { [System.IO.File]::ReadAllText($collFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json } else { @() }
                        $list = [System.Collections.ArrayList]@()
                        foreach ($it in $items) {
                            if ([string]$it.id -ne [string]$docId) { $list.Add($it) | Out-Null }
                        }
                        $savedJson = $list | ConvertTo-Json -Depth 5
                        [System.IO.File]::WriteAllText($collFile, $savedJson, [System.Text.Encoding]::UTF8)
                        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                    } catch {
                        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false}')
                    }
                    $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                    $stream.Write($headBytes, 0, $headBytes.Length)
                    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                    $stream.Flush()
                    $client.Close()
                    continue
                }
            }

            # Get Expenses API
            if ($cleanUrl -eq "/api/expenses" -and $method -eq "GET") {
                $content = if (Test-Path $expensesFile) { [System.IO.File]::ReadAllText($expensesFile, [System.Text.Encoding]::UTF8) } else { '{"expenses":[]}' }
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
                $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                $stream.Write($headBytes, 0, $headBytes.Length)
                $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                $stream.Flush()
                $client.Close()
                continue
            }

            # Add Expense API
            if ($cleanUrl -eq "/api/expenses" -and $method -eq "POST") {
                try {
                    $newExp = $postBody | ConvertFrom-Json
                    $currentData = if (Test-Path $expensesFile) { [System.IO.File]::ReadAllText($expensesFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json } else { [PSCustomObject]@{ expenses = @() } }
                    $list = [System.Collections.ArrayList]@($currentData.expenses)
                    $list.Insert(0, $newExp)
                    $currentData.expenses = $list
                    $updatedJson = $currentData | ConvertTo-Json -Depth 5
                    [System.IO.File]::WriteAllText($expensesFile, $updatedJson, [System.Text.Encoding]::UTF8)
                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                } catch {
                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Invalid data"}')
                }
                $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`n`r`n"
                $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                $stream.Write($headBytes, 0, $headBytes.Length)
                $stream.Write($bodyBytes, 0, $bodyBytes.Length)
                $stream.Flush()
                $client.Close()
                continue
            }

            # Serve Static Files
            $filePath = Find-ServerFile $cleanUrl

            if ($filePath -and (Test-Path $filePath -PathType Leaf)) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
                $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
                $head = "HTTP/1.1 200 OK`r`n$corsHeaders" + "Content-Type: $mime`r`nContent-Length: $($fileBytes.Length)`r`nCache-Control: no-cache`r`n`r`n"
                $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                $stream.Write($headBytes, 0, $headBytes.Length)
                $stream.Write($fileBytes, 0, $fileBytes.Length)
            } else {
                $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                $head = "HTTP/1.1 404 Not Found`r`n$corsHeaders" + "Content-Length: $($notFoundBytes.Length)`r`n`r`n"
                $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
                $stream.Write($headBytes, 0, $headBytes.Length)
                $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
            }

            $stream.Flush()
            $client.Close()
        } catch {
            try { if ($client) { $client.Close() } } catch {}
        }
    }
} finally {
    if ($tcpListener) { $tcpListener.Stop() }
}
