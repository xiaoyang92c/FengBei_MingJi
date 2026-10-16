# Rebuild the three four-character mastheads as editable SVG outlines on Windows.
# The browser needs only the generated JSON, not the source font or this script.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$fontFamily = [System.Drawing.FontFamily]::new('Microsoft YaHei')
$format = [System.Drawing.StringFormat]::GenericTypographic
$titles = @('成渝记忆', '铁道纪事', '建设手记')
$outlines = @{}
$minY = [double]::PositiveInfinity
$maxY = [double]::NegativeInfinity
$maxWidth = 0.0
try {
    foreach ($title in $titles) {
        foreach ($letter in $title.ToCharArray()) {
            $key = [string]$letter
            if ($outlines.ContainsKey($key)) { continue }
            $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $path.AddString($key, $fontFamily, [int][System.Drawing.FontStyle]::Bold, 1000, [System.Drawing.PointF]::new(0, 0), $format)
            $bounds = $path.GetBounds()
            $minY = [Math]::Min($minY, $bounds.Top)
            $maxY = [Math]::Max($maxY, $bounds.Bottom)
            $maxWidth = [Math]::Max($maxWidth, $bounds.Width)
            $outlines[$key] = @{ Points = $path.PathPoints; Types = $path.PathTypes; CenterX = $bounds.Left + $bounds.Width / 2 }
            $path.Dispose()
        }
    }
    $scale = 96.0 / [Math]::Max($maxY - $minY, $maxWidth)
    $centerY = ($minY + $maxY) / 2
    $culture = [Globalization.CultureInfo]::InvariantCulture
    $shapes = @{}
    foreach ($key in $outlines.Keys) {
        $outline = $outlines[$key]
        $segments = [Collections.Generic.List[string]]::new()
        $pointIndex = 0
        while ($pointIndex -lt $outline.Points.Length) {
            $kind = $outline.Types[$pointIndex] -band 7
            $count = if ($kind -eq 3) { 3 } else { 1 }
            $command = switch ($kind) { 0 { 'M' } 1 { 'L' } 3 { 'C' } default { throw "Unsupported outline segment: $kind" } }
            $coordinates = for ($offset = 0; $offset -lt $count; $offset++) {
                $point = $outline.Points[$pointIndex + $offset]
                (($point.X - $outline.CenterX) * $scale + 50).ToString('0.##', $culture)
                (($point.Y - $centerY) * $scale + 50).ToString('0.##', $culture)
            }
            $segments.Add($command + ($coordinates -join ' '))
            if (($outline.Types[$pointIndex + $count - 1] -band 128) -ne 0) { $segments.Add('Z') }
            $pointIndex += $count
        }
        $shapes[$key] = $segments -join ' '
    }
    $result = @(foreach ($title in $titles) {
        @{ text = $title; glyphs = @($title.ToCharArray() | ForEach-Object { $shapes[[string]$_] }) }
    })
    $target = Join-Path $PSScriptRoot '../src/masthead-shapes.json'
    [IO.File]::WriteAllText($target, ($result | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    Write-Output "Generated $($titles.Length) mastheads / $($shapes.Count) unique glyphs."
} finally {
    $fontFamily.Dispose()
    $format.Dispose()
}
