# Keep the desktop Consolas digits as vector artwork on every device.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$family = [System.Drawing.FontFamily]::new('Consolas')
$format = [System.Drawing.StringFormat]::GenericTypographic
$culture = [Globalization.CultureInfo]::InvariantCulture
$shapes = @{}
try {
    foreach ($letter in '0123456789%'.ToCharArray()) {
        $key = [string]$letter
        $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $size = if ($key -eq '%') { 22 } else { 100 }
        $path.AddString($key, $family, 0, $size, [System.Drawing.PointF]::new(0, 0), $format)
        $bounds = $path.GetBounds()
        $segments = [Collections.Generic.List[string]]::new()
        $pointIndex = 0
        while ($pointIndex -lt $path.PointCount) {
            $kind = $path.PathTypes[$pointIndex] -band 7
            $count = if ($kind -eq 3) { 3 } else { 1 }
            $command = switch ($kind) { 0 { 'M' } 1 { 'L' } 3 { 'C' } default { throw 'Unsupported segment' } }
            $coordinates = for ($offset = 0; $offset -lt $count; $offset++) {
                $point = $path.PathPoints[$pointIndex + $offset]
                ($point.X - $bounds.Left).ToString('0.###', $culture)
                ($point.Y - $bounds.Bottom).ToString('0.###', $culture)
            }
            $segments.Add($command + ($coordinates -join ' '))
            if (($path.PathTypes[$pointIndex + $count - 1] -band 128) -ne 0) { $segments.Add('Z') }
            $pointIndex += $count
        }
        $shapes[$key] = @{ path = $segments -join ' '; width = [Math]::Round($bounds.Width, 3) }
        $path.Dispose()
    }
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot '../src/loading-digits.json'), ($shapes | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
} finally { $family.Dispose(); $format.Dispose() }
