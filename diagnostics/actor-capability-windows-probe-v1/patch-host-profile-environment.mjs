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
  String.raw`std::vector<wchar_t> build_environment(const std::wstring& work_directory, uint16_t port) {
  wchar_t windows_directory[MAX_PATH]{};
  require(GetWindowsDirectoryW(windows_directory, MAX_PATH) > 0, "GetWindowsDirectoryW failed");
  std::vector<std::wstring> entries = {
      L"AXM_PROBE_PORT=" + std::to_wstring(port),
      L"LANG=C",
      L"NODE_DISABLE_COLORS=1",
      L"SystemRoot=" + std::wstring(windows_directory),
      L"TEMP=" + work_directory,
      L"TMP=" + work_directory,
      L"WINDIR=" + std::wstring(windows_directory),
  };
  std::sort(entries.begin(), entries.end(), [](const std::wstring& a, const std::wstring& b) {
    return _wcsicmp(a.c_str(), b.c_str()) < 0;
  });
  std::vector<wchar_t> block;
  for (const auto& entry : entries) {
    block.insert(block.end(), entry.begin(), entry.end());
    block.push_back(L'\0');
  }
  block.push_back(L'\0');
  return block;
}`,
  String.raw`std::vector<wchar_t> build_environment(const std::wstring& app_container_folder, uint16_t port) {
  wchar_t windows_directory[MAX_PATH]{};
  require(GetWindowsDirectoryW(windows_directory, MAX_PATH) > 0, "GetWindowsDirectoryW failed");

  const wchar_t* overridden_keys[] = {
      L"AXM_PROBE_PORT", L"LANG", L"NODE_DISABLE_COLORS", L"SystemRoot",
      L"LOCALAPPDATA", L"TEMP", L"TMP", L"WINDIR",
      L"AXM_WINDOWS_PROBE_SECRET",
  };
  auto is_overridden = [&](const std::wstring& key) {
    for (const wchar_t* candidate : overridden_keys) {
      if (_wcsicmp(key.c_str(), candidate) == 0) return true;
    }
    return false;
  };

  LPWCH parent_block = GetEnvironmentStringsW();
  require(parent_block != nullptr, "GetEnvironmentStringsW failed");
  std::vector<std::wstring> entries;
  for (const wchar_t* cursor = parent_block; *cursor != L'\0';) {
    const std::wstring entry(cursor);
    cursor += entry.size() + 1;
    const size_t separator = entry.find(L'=');
    if (separator == std::wstring::npos) continue;
    const std::wstring key = entry.substr(0, separator);
    if (!is_overridden(key)) entries.push_back(entry);
  }
  FreeEnvironmentStringsW(parent_block);

  entries.push_back(L"AXM_PROBE_PORT=" + std::to_wstring(port));
  entries.push_back(L"LANG=C");
  entries.push_back(L"NODE_DISABLE_COLORS=1");
  entries.push_back(L"SystemRoot=" + std::wstring(windows_directory));
  entries.push_back(L"LOCALAPPDATA=" + app_container_folder);
  entries.push_back(L"TEMP=" + app_container_folder + L"\\Temp");
  entries.push_back(L"TMP=" + app_container_folder + L"\\Temp");
  entries.push_back(L"WINDIR=" + std::wstring(windows_directory));

  std::sort(entries.begin(), entries.end(), [](const std::wstring& a, const std::wstring& b) {
    return _wcsicmp(a.c_str(), b.c_str()) < 0;
  });
  std::vector<wchar_t> block;
  for (const auto& entry : entries) {
    block.insert(block.end(), entry.begin(), entry.end());
    block.push_back(L'\0');
  }
  block.push_back(L'\0');
  return block;
}`,
  "sanitized inherited profile environment",
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
replaceExactlyOnce(
  String.raw`    DWORD child_policy = PROCESS_CREATION_CHILD_PROCESS_RESTRICTED;
    require(UpdateProcThreadAttribute(
                startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_CHILD_PROCESS_POLICY,
                &child_policy, sizeof(child_policy), nullptr, nullptr),
            "child process policy attribute failed");

`,
  String.raw`    // Diagnostic isolation: omit the child-process mitigation attribute while
    // retaining AppContainer identity, exact handle inheritance, and Job Object custody.

`,
  "child-process mitigation isolation",
);
replaceExactlyOnce(
  String.raw`    const bool kernel_attested =
        process_in_job == TRUE && is_app_container != 0 && app_container_sid_exact &&
        active_process_limit_exact && kill_on_close && memory_limit_exact && child_process_restricted;`,
  String.raw`    const bool kernel_attested =
        process_in_job == TRUE && is_app_container != 0 && app_container_sid_exact &&
        active_process_limit_exact && kill_on_close && memory_limit_exact;`,
  "kernel attestation without child-process mitigation",
);

for (const marker of [
  "#include <objbase.h>",
  '#pragma comment(lib, "Ole32.lib")',
  "GetAppContainerFolderPath(sid_text.c_str(), &app_container_folder_raw)",
  "GetEnvironmentStringsW()",
  'L"AXM_WINDOWS_PROBE_SECRET"',
  'L"LOCALAPPDATA=" + app_container_folder',
  "build_environment(app_container_folder, loopback_port)",
  "app_container_info_storage(app_container_info_bytes)",
  "Diagnostic isolation: omit the child-process mitigation attribute",
  "active_process_limit_exact && kill_on_close && memory_limit_exact;",
]) {
  if (!text.includes(marker)) {
    throw new Error(`patched source lacks marker: ${marker}`);
  }
}
if (text.includes("PROC_THREAD_ATTRIBUTE_CHILD_PROCESS_POLICY")) {
  throw new Error("patched source still contains child-process policy attribute");
}

fs.writeFileSync(outputPath, text, "utf8");

// Diagnostic v10 isolates child-process mitigation from AppContainer startup.
