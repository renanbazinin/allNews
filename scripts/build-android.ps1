param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GradleTasks = @('assembleDebug')
)

$ErrorActionPreference = 'Stop'
$taskAndroidRoot = Join-Path $PSScriptRoot '..\android'
# Keep the bundled readable policy synchronized with its canonical text source.
& node (Join-Path $PSScriptRoot 'build-policy.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not generate the bundled privacy policy.' }
$taskJavaHome = $env:ALLNEWS_JAVA_HOME
if (-not $taskJavaHome) {
    $taskJavaHome = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.jdks') -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $taskJavaHome) { $taskJavaHome = $env:JAVA_HOME }
if (-not $taskJavaHome -or -not (Test-Path -LiteralPath (Join-Path $taskJavaHome 'bin\java.exe'))) {
    throw 'Set ALLNEWS_JAVA_HOME to a JDK 17 installation.'
}

$taskPreviousJava = $env:JAVA_HOME
$taskPreviousAndroid = $env:ANDROID_HOME
try {
    $env:JAVA_HOME = $taskJavaHome
    if (-not $env:ANDROID_HOME) {
        $env:ANDROID_HOME = Join-Path $env:USERPROFILE 'Android\Sdk'
    }
    Push-Location $taskAndroidRoot
    try {
        & '.\gradlew.bat' @GradleTasks --console=plain
        $taskExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
} finally {
    $env:JAVA_HOME = $taskPreviousJava
    $env:ANDROID_HOME = $taskPreviousAndroid
}
exit $taskExitCode
