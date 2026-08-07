import fs from "node:fs";

const [originalPath, outputPath] = process.argv.slice(2);
if (!originalPath || !outputPath) {
  throw new Error(
    "usage: node patch-host-profile-environment.mjs <original> <output>",
  );
}

let text = fs.readFileSync(originalPath, "utf8").replace(/\r\n/g, "\n");

function replaceExactlyOnce(oldValue, newValue, label) {
  const first = text.indexOf(oldValue);
  if (first < 0) throw new Error(`missing source anchor: ${label}`);
  if (text.indexOf(oldValue, first + oldValue.length) >= 0) {
    throw new Error(`duplicate source anchor: ${label}`);
  }
  text = text.slice(0, first) + newValue + text.slice(first + oldValue.length);
}

replaceExactlyOnce(
  "#include <userenv.h>",
  "#include <userenv.h>\n#include <objbase.h>",
  "objbase include",
);
replaceExactlyOnce(
  '#pragma comment(lib, "Userenv.lib")',
  '#pragma comment(lib, "Userenv.lib")\n#pragma comment(lib, "Ole32.lib")',
  "ole32 library",
);
replaceExactlyOnce(
  "std::vector<wchar_t> build_environment(const std::wstring& work_directory, uint16_t port) {",
  "std::vector<wchar_t> build_environment(const std::wstring& app_container_folder, uint16_t port) {",
  "environment signature",
);
replaceExactlyOnce(
  String.raw`      L"TEMP=" + work_directory,
      L"TMP=" + work_directory,`,
  String.raw`      L"LOCALAPPDATA=" + app_container_folder,
      L"TEMP=" + app_container_folder + L"\\Temp",
      L"TMP=" + app_container_folder + L"\\Temp",`,
  "profile environment entries",
);
replaceExactlyOnce(
  "    const std::wstring sid_text(sid_text_raw);\n    LocalFree(sid_text_raw);",
  String.raw`    const std::wstring sid_text(sid_text_raw);
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
    std::filesystem::create_directories(app_container_folder + L"\\Temp");`,
  "profile path derivation",
);
replaceExactlyOnce(
  "    auto environment = build_environment(work_directory, loopback_port);",
  "    auto environment = build_environment(app_container_folder, loopback_port);",
  "profile environment call",
);
replaceExactlyOnce(
  String.raw`    TOKEN_APPCONTAINER_INFORMATION app_container_info{};
    require(GetTokenInformation(
                token.get(), TokenAppContainerSid, &app_container_info,
                sizeof(app_container_info), &returned),
            "TokenAppContainerSid failed");
    const bool app_container_sid_exact =
        app_container_info.TokenAppContainer != nullptr &&
        EqualSid(app_container_info.TokenAppContainer, app_container_sid);`,
  String.raw`    DWORD app_container_info_bytes = 0;
    SetLastError(ERROR_SUCCESS);
    const BOOL app_container_size_result = GetTokenInformation(
        token.get(), TokenAppContainerSid, nullptr, 0, &app_container_info_bytes);
    require(
        app_container_size_result == FALSE &&
            GetLastError() == ERROR_INSUFFICIENT_BUFFER &&
            app_container_info_bytes >= sizeof(TOKEN_APPCONTAINER_INFORMATION),
        "TokenAppContainerSid size failed");
    std::vector<unsigned char> app_container_info_storage(app_container_info_bytes);
    require(GetTokenInformation(
                token.get(), TokenAppContainerSid, app_container_info_storage.data(),
                app_container_info_bytes, &app_container_info_bytes),
            "TokenAppContainerSid failed");
    const auto* app_container_info = reinterpret_cast<const TOKEN_APPCONTAINER_INFORMATION*>(
        app_container_info_storage.data());
    const bool app_container_sid_exact =
        app_container_info->TokenAppContainer != nullptr &&
        EqualSid(app_container_info->TokenAppContainer, app_container_sid);`,
  "variable-length AppContainer token query",
);

for (const marker of [
  "#include <objbase.h>",
  '#pragma comment(lib, "Ole32.lib")',
  "GetAppContainerFolderPath(sid_text.c_str(), &app_container_folder_raw)",
  'L"LOCALAPPDATA=" + app_container_folder',
  "build_environment(app_container_folder, loopback_port)",
  "app_container_info_storage(app_container_info_bytes)",
]) {
  if (!text.includes(marker)) {
    throw new Error(`patched source lacks marker: ${marker}`);
  }
}

fs.writeFileSync(outputPath, text, "utf8");

// Triggered after registering the native Windows capability workflow.
