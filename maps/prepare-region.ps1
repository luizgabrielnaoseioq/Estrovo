param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9][a-z0-9/-]*$')]
  [string]$Area,

  [ValidateRange(1, 128)]
  [int]$MemoryGb = 8
)

$ErrorActionPreference = 'Stop'
$dataPath = Join-Path $PSScriptRoot 'data'
$outputPath = Join-Path $dataPath 'region.mbtiles'

if (Test-Path -LiteralPath $outputPath) {
  throw "O arquivo $outputPath ja existe. Guarde ou remova o pacote antigo antes de gerar outro."
}

New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'Inicie o Docker antes de gerar o mapa.'
}

Write-Host "Gerando mapas OpenStreetMap para a area Geofabrik: $Area"
Write-Host 'O download e o processamento podem consumir muito espaco, memoria e tempo.'

& docker run --rm `
  -e "JAVA_TOOL_OPTIONS=-Xmx${MemoryGb}g" `
  -v "${dataPath}:/data" `
  ghcr.io/onthegomap/planetiler:latest `
  --download `
  "--area=$Area" `
  --output=/data/region.mbtiles

if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputPath)) {
  throw 'Falha ao gerar region.mbtiles. Veja a saida do Planetiler acima.'
}

Write-Host "Mapa pronto: $outputPath"
