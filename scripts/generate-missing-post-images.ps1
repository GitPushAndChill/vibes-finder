Add-Type -AssemblyName System.Drawing

$workspaceRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$jsonPath = Join-Path $workspaceRoot "posts\places\posts-places.json"

if (-not (Test-Path $jsonPath)) {
    throw "Could not find JSON file at $jsonPath"
}

$posts = Get-Content -Raw -Path $jsonPath | ConvertFrom-Json

function Save-Jpeg {
    param(
        [Parameter(Mandatory = $true)] [System.Drawing.Bitmap] $Bitmap,
        [Parameter(Mandatory = $true)] [string] $OutputPath,
        [int] $Quality = 92
    )

    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }

    $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality,
        [long]$Quality
    )

    $Bitmap.Save($OutputPath, $jpegCodec, $encoderParameters)
    $encoderParameters.Dispose()
}

function Get-VibeColors {
    param([string] $Vibe)

    switch (($Vibe | ForEach-Object { "$($_)".ToLowerInvariant() })) {
        "classy"            { return @{ Start = "#162824"; End = "#2E5A4F"; Accent = "#C6A76E" } }
        "easygoing"         { return @{ Start = "#1F3A34"; End = "#3F7868"; Accent = "#E8DCC5" } }
        "do_mode"           { return @{ Start = "#0F1C1A"; End = "#2E5A4F"; Accent = "#C6A76E" } }
        "social"            { return @{ Start = "#0F1C1A"; End = "#3F7868"; Accent = "#C6A76E" } }
        "culture_craving"   { return @{ Start = "#0F1C1A"; End = "#2E5A4F"; Accent = "#B88A5A" } }
        "date_night"        { return @{ Start = "#162824"; End = "#3F7868"; Accent = "#E8DCC5" } }
        "alternative"       { return @{ Start = "#0F1C1A"; End = "#2E5A4F"; Accent = "#B88A5A" } }
        "little_ones"       { return @{ Start = "#1F3A34"; End = "#2E5A4F"; Accent = "#E8DCC5" } }
        "outdoorsy"         { return @{ Start = "#0F1C1A"; End = "#1F3A34"; Accent = "#C6A76E" } }
        "hidden_gems"       { return @{ Start = "#162824"; End = "#2E5A4F"; Accent = "#B88A5A" } }
        "beer_lovers"       { return @{ Start = "#1F3A34"; End = "#2E5A4F"; Accent = "#C6A76E" } }
        "golden_summertime" { return @{ Start = "#2E5A4F"; End = "#3F7868"; Accent = "#F8F3E7" } }
        "coffee_and_chill"  { return @{ Start = "#162824"; End = "#2E5A4F"; Accent = "#E8DCC5" } }
        "cute_girl_brunch"  { return @{ Start = "#2E5A4F"; End = "#3F7868"; Accent = "#E8DCC5" } }
        default              { return @{ Start = "#0F1C1A"; End = "#2E5A4F"; Accent = "#C6A76E" } }
    }
}

$imageWidth = 1600
$imageHeight = 1000
$randomSeed = 20260310
$randomGenerator = New-Object System.Random($randomSeed)

$generatedCount = 0
$skippedExistingCount = 0

foreach ($post in $posts) {
    if (-not $post.images -or $post.images.Count -eq 0) {
        continue
    }

    $relativeImagePath = [string]$post.images[0]
    if ([string]::IsNullOrWhiteSpace($relativeImagePath)) {
        continue
    }

    $normalizedRelativePath = $relativeImagePath -replace '/', '\\'
    $absoluteImagePath = Join-Path $workspaceRoot $normalizedRelativePath

    if (Test-Path $absoluteImagePath) {
        $skippedExistingCount++
        continue
    }

    $absoluteDirectoryPath = Split-Path -Parent $absoluteImagePath
    if (-not (Test-Path $absoluteDirectoryPath)) {
        New-Item -ItemType Directory -Path $absoluteDirectoryPath -Force | Out-Null
    }

    $primaryVibe = [string]$post.vibe
    if ([string]::IsNullOrWhiteSpace($primaryVibe) -and $post.vibes -and $post.vibes.Count -gt 0) {
        $primaryVibe = [string]$post.vibes[0]
    }

    $palette = Get-VibeColors -Vibe $primaryVibe

    $startColor = [System.Drawing.ColorTranslator]::FromHtml($palette.Start)
    $endColor = [System.Drawing.ColorTranslator]::FromHtml($palette.End)
    $accentColor = [System.Drawing.ColorTranslator]::FromHtml($palette.Accent)
    $creamColor = [System.Drawing.ColorTranslator]::FromHtml("#E8DCC5")
    $sparkleColor = [System.Drawing.ColorTranslator]::FromHtml("#F8F3E7")

    $bitmap = New-Object System.Drawing.Bitmap($imageWidth, $imageHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    try {
        $fullRect = New-Object System.Drawing.Rectangle(0, 0, $imageWidth, $imageHeight)

        $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $fullRect,
            $startColor,
            $endColor,
            [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
        )
        $graphics.FillRectangle($backgroundBrush, $fullRect)
        $backgroundBrush.Dispose()

        for ($index = 0; $index -lt 10; $index++) {
            $ellipseWidth = $randomGenerator.Next(220, 620)
            $ellipseHeight = $randomGenerator.Next(160, 520)
            $ellipseX = $randomGenerator.Next(-180, $imageWidth - 40)
            $ellipseY = $randomGenerator.Next(-120, $imageHeight - 20)
            $alpha = $randomGenerator.Next(18, 60)

            $glowColor = [System.Drawing.Color]::FromArgb($alpha, $accentColor)
            $glowBrush = New-Object System.Drawing.SolidBrush($glowColor)
            $graphics.FillEllipse($glowBrush, $ellipseX, $ellipseY, $ellipseWidth, $ellipseHeight)
            $glowBrush.Dispose()
        }

        for ($sparkleIndex = 0; $sparkleIndex -lt 180; $sparkleIndex++) {
            $sparkleX = $randomGenerator.Next(20, $imageWidth - 20)
            $sparkleY = $randomGenerator.Next(20, $imageHeight - 20)
            $sparkleRadius = $randomGenerator.Next(1, 4)
            $sparkleAlpha = $randomGenerator.Next(70, 180)

            $smallSparkleColor = [System.Drawing.Color]::FromArgb($sparkleAlpha, $sparkleColor)
            $smallSparkleBrush = New-Object System.Drawing.SolidBrush($smallSparkleColor)
            $graphics.FillEllipse($smallSparkleBrush, $sparkleX, $sparkleY, $sparkleRadius, $sparkleRadius)
            $smallSparkleBrush.Dispose()
        }

        $titleText = [string]$post.place
        if ([string]::IsNullOrWhiteSpace($titleText)) {
            $titleText = [string]$post.title
        }

        $cityText = [string]$post.city
        $vibeText = [string]$primaryVibe
        $subtitleText = "{0} • {1}" -f $cityText, $vibeText.Replace('_', ' ')

        $titleFont = New-Object System.Drawing.Font("Georgia", 56, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $subtitleFont = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

        $titleBrush = New-Object System.Drawing.SolidBrush($creamColor)
        $subtitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 220, 197))
        $accentPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(210, $accentColor), 4)

        $leftMargin = 92
        $titleTop = $imageHeight - 270
        $subtitleTop = $imageHeight - 165

        $graphics.DrawLine($accentPen, $leftMargin, $imageHeight - 300, $leftMargin + 220, $imageHeight - 300)
        $graphics.DrawString($titleText, $titleFont, $titleBrush, $leftMargin, $titleTop)
        $graphics.DrawString($subtitleText, $subtitleFont, $subtitleBrush, $leftMargin, $subtitleTop)

        $titleFont.Dispose()
        $subtitleFont.Dispose()
        $titleBrush.Dispose()
        $subtitleBrush.Dispose()
        $accentPen.Dispose()

        Save-Jpeg -Bitmap $bitmap -OutputPath $absoluteImagePath -Quality 92
        $generatedCount++
        Write-Host "Generated: $relativeImagePath"
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

Write-Host "Done. Generated $generatedCount images. Skipped $skippedExistingCount existing images."
