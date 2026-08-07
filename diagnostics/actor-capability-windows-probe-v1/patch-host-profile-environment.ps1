param(
  [Parameter(Mandatory = $true)]
  [string]$Original,

  [Parameter(Mandatory = $true)]
  [string]$Output
)

$ErrorActionPreference = 'Stop'

function Replace-ExactlyOnce {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value,

    [Parameter(Mandatory = $true)]
    [string]$Old,

    [Parameter(Mandatory = $true)]
    [string]$New,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $first = $Value.IndexOf($Old, [StringComparison]::Ordinal)
  if ($first -lt 0) {
    throw "missing source anchor: $Label"
  }
  if ($Value.IndexOf($Old, $first + $Old.Length, [StringComparison]::Ordinal) -ge 0) {
    throw "duplicate source anchor: $Label"
  }
  return $Value.Substring(0, $first) + $New + $Value.Substring($first + $Old.Length)
}

$text = (Get-Content $Original -Raw).Replace("`r`n", "`n")

$text = Replace-ExactlyOnce `
  -Value $text `
  -Old '#include <userenv.h>' `
  -New "#include <userenv.h>`n#include <objbase.h>" `
  -Label 'objbase include'

$text = Replace-ExactlyOnce `
  -Value $text `
  -Old '#pragma comment(lib, "Userenv.lib")' `
  -New "#pragma comment(lib, `"Userenv.lib`")`n#pragma comment(lib, `"Ole32.lib`")" `
  -Label 'ole32 library'

$text = Replace-ExactlyOnce `
  -Value $text `
  -Old 'std::vector<wchar_t> build_environment(const std::wstring& work_directory, uint16_t port) {' `
  -New 'std::vector<wchar_t> build_environment(const std::wstring& app_container_folder, uint16_t port) {' `
  -Label 'environment signature'

$text = Replace-ExactlyOnce `
  -Value $text `
  -Old "      L`"TEMP=`" + work_directory,`n      L`"TMP=`" + work_directory," `
  -New "      L`"LOCALAPPDATA=`" + app_container_folder,`n      L`"TEMP=`" + app_container_folder + L`"\\Temp`",`n      L`"TMP=`" + app_container_folder + L`"\\Temp`," `
  -Label 'profile environment entries'

$profileInsertion = @'
    const std::wstring sid_text(sid_text_raw);
    LocalFree(sid_text_raw);

    PWSTR app_container_folder_raw = nullptr;
    result = GetAppContainerFolderPath(sid_text.c_str(), &app_container_folder_raw);
    if (FAILED(result)) {
      std::ostringstream message;
      message << "GetAppContainerFolderPath failed (HRESULT=0x" << std::hex << static_cast<uint32_t>(result) << ")";
      throw std::runtime_error(message.str());
    }
    const std::wstring app_container_folder(app_container_folder_raw);
    CoTaskMemFree(app_container_folder_raw);
    std::filesystem::create_directories(app_container_folder + L"\\Temp");
'@

$text = Replace-ExactlyOnce `
  -Value $text `
  -Old "    const std::wstring sid_text(sid_text_raw);`n    LocalFree(sid_text_raw);" `
  -New $profileInsertion `
  -Label 'profile path derivation'

$text = Replace-ExactlyOnce `
  -Value $text `
  -Old '    auto environment = build_environment(work_directory, loopback_port);' `
  -New '    auto environment = build_environment(app_container_folder, loopback_port);' `
  -Label 'profile environment call'

[IO.File]::WriteAllText($Output, $text, [Text.UTF8Encoding]::new($false))

$final = Get-Content $Output -Raw
foreach ($marker in @(
  '#include <objbase.h>',
  '#pragma comment(lib, "Ole32.lib")',
  'GetAppContainerFolderPath(sid_text.c_str(), &app_container_folder_raw)',
  'L"LOCALAPPDATA=" + app_container_folder',
  'build_environment(app_container_folder, loopback_port)'
)) {
  if (-not $final.Contains($marker, [StringComparison]::Ordinal)) {
    throw "patched source lacks marker: $marker"
  }
}

# Triggered after registering the v4 profile-environment workflow.
