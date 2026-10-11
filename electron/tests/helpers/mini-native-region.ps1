param([Parameter(Mandatory=$true)][string]$WindowHandle, [string]$CapturePath, [string]$RendererCapturePath)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MiniNativeRegion {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr hwnd, IntPtr region);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
  [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int left, int top, int right, int bottom);
  [DllImport("gdi32.dll")] public static extern int GetRgnBox(IntPtr region, out Rect rect);
  [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr region, int x, int y);
  [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr obj);
}
'@
$handle = [IntPtr]::new([long]::Parse($WindowHandle))
if (-not [MiniNativeRegion]::IsWindow($handle)) { throw 'Window handle is no longer valid.' }
$region = [MiniNativeRegion]::CreateRectRgn(0, 0, 0, 0)
try {
  $kind = [MiniNativeRegion]::GetWindowRgn($handle, $region)
  $rect = [MiniNativeRegion+Rect]::new()
  [void][MiniNativeRegion]::GetRgnBox($region, [ref]$rect)
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  $style = [MiniNativeRegion]::GetWindowLongPtr($handle, -16).ToInt64()
  $windowRect = [MiniNativeRegion+Rect]::new()
  [void][MiniNativeRegion]::GetWindowRect($handle, [ref]$windowRect)
  $clientRect = [MiniNativeRegion+Rect]::new()
  [void][MiniNativeRegion]::GetClientRect($handle, [ref]$clientRect)
  $pixels = @()
  $blendChecked = 0
  $blendMismatches = 0
  $blendExamples = @()
  if ($CapturePath) {
    Add-Type -AssemblyName System.Drawing
    $bitmap = [System.Drawing.Bitmap]::new($windowRect.Right - $windowRect.Left, $windowRect.Bottom - $windowRect.Top)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CopyFromScreen($windowRect.Left, $windowRect.Top, 0, 0, $bitmap.Size)
      $bitmap.Save([IO.Path]::GetFullPath($CapturePath), [System.Drawing.Imaging.ImageFormat]::Png)
      foreach ($point in @(@(1,1), @(($bitmap.Width - 2),1), @(1,($bitmap.Height - 2)), @(($bitmap.Width - 2),($bitmap.Height - 2)))) {
        $pixel = $bitmap.GetPixel($point[0], $point[1])
        $pixels += ,@($pixel.R, $pixel.G, $pixel.B)
      }
      if ($RendererCapturePath) {
        $rendered = [System.Drawing.Bitmap]::new([IO.Path]::GetFullPath($RendererCapturePath))
        try {
          if ($rendered.Size -ne $bitmap.Size) { throw 'Renderer and screen dimensions differ.' }
          for ($y = 0; $y -lt 32; $y++) { for ($x = 0; $x -lt 32; $x++) {
            foreach ($point in @(@($x,$y), @(($bitmap.Width - $x - 1),$y), @($x,($bitmap.Height - $y - 1)), @(($bitmap.Width - $x - 1),($bitmap.Height - $y - 1)))) {
              $source = $rendered.GetPixel($point[0], $point[1])
              if ($source.A -eq 0 -or $source.A -eq 255) { continue }
              $blendChecked++
              $actual = $bitmap.GetPixel($point[0], $point[1])
              $alpha = $source.A / 255.0
              $expected = @([Math]::Round($source.R * $alpha + 41 * (1 - $alpha)), [Math]::Round($source.G * $alpha + 214 * (1 - $alpha)), [Math]::Round($source.B * $alpha + 91 * (1 - $alpha)))
              if ([Math]::Abs($actual.R - $expected[0]) -gt 3 -or [Math]::Abs($actual.G - $expected[1]) -gt 3 -or [Math]::Abs($actual.B - $expected[2]) -gt 3) {
                $blendMismatches++
                if ($blendExamples.Count -lt 8) { $blendExamples += ,[ordered]@{ x=$point[0]; y=$point[1]; alpha=$source.A; expected=$expected; actual=@($actual.R,$actual.G,$actual.B) } }
              }
            }
          } }
        } finally { $rendered.Dispose() }
      }
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  }
  [ordered]@{
    kind = $kind
    width = $width
    height = $height
    windowWidth = $windowRect.Right - $windowRect.Left
    windowHeight = $windowRect.Bottom - $windowRect.Top
    clientWidth = $clientRect.Right - $clientRect.Left
    clientHeight = $clientRect.Bottom - $clientRect.Top
    visible = [MiniNativeRegion]::IsWindowVisible($handle)
    style = $style.ToString('X')
    extendedStyle = [MiniNativeRegion]::GetWindowLongPtr($handle, -20).ToInt64().ToString('X')
    cornerPixels = $pixels
    cornerBlendChecked = $blendChecked
    cornerBlendMismatches = $blendMismatches
    cornerBlendExamples = $blendExamples
    thickFrame = ($style -band 0x40000) -ne 0
    corner = [MiniNativeRegion]::PtInRegion($region, 0, 0)
    center = [MiniNativeRegion]::PtInRegion($region, [int]($width / 2), [int]($height / 2))
    top = [MiniNativeRegion]::PtInRegion($region, [int]($width / 2), 0)
    right = [MiniNativeRegion]::PtInRegion($region, $width - 1, [int]($height / 2))
    bottomCorner = [MiniNativeRegion]::PtInRegion($region, $width - 1, $height - 1)
    topInset = $(for ($x = 0; $x -lt $width; $x++) { if ([MiniNativeRegion]::PtInRegion($region, $x, 0)) { $x; break } })
  } | ConvertTo-Json -Compress
} finally { [void][MiniNativeRegion]::DeleteObject($region) }
