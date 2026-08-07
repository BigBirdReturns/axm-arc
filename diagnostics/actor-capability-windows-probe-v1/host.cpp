#define UNICODE
#define _UNICODE
#define _WIN32_WINNT 0x0A00

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>
#include <userenv.h>

#include <algorithm>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#pragma comment(lib, "Advapi32.lib")
#pragma comment(lib, "Userenv.lib")
#pragma comment(lib, "Ws2_32.lib")

namespace {

struct Handle {
  HANDLE value{nullptr};
  Handle() = default;
  explicit Handle(HANDLE handle) : value(handle) {}
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  Handle(Handle&& other) noexcept : value(other.value) { other.value = nullptr; }
  Handle& operator=(Handle&& other) noexcept {
    if (this != &other) {
      reset();
      value = other.value;
      other.value = nullptr;
    }
    return *this;
  }
  ~Handle() { reset(); }
  void reset(HANDLE next = nullptr) {
    if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value);
    value = next;
  }
  HANDLE get() const { return value; }
  explicit operator bool() const { return value && value != INVALID_HANDLE_VALUE; }
};

struct SocketHandle {
  SOCKET value{INVALID_SOCKET};
  ~SocketHandle() { if (value != INVALID_SOCKET) closesocket(value); }
};

[[noreturn]] void fail(const std::string& message) {
  throw std::runtime_error(message + " (win32=" + std::to_string(GetLastError()) + ")");
}

void require(bool condition, const std::string& message) {
  if (!condition) fail(message);
}

std::wstring widen(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  require(size > 0, "MultiByteToWideChar size failed");
  std::wstring result(static_cast<size_t>(size), L'\0');
  require(MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size) == size,
          "MultiByteToWideChar failed");
  return result;
}

std::string narrow(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  require(size > 0, "WideCharToMultiByte size failed");
  std::string result(static_cast<size_t>(size), '\0');
  require(WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size, nullptr, nullptr) == size,
          "WideCharToMultiByte failed");
  return result;
}

std::string json_escape(const std::string& value) {
  std::ostringstream out;
  for (unsigned char ch : value) {
    switch (ch) {
      case '\\': out << "\\\\"; break;
      case '"': out << "\\\""; break;
      case '\b': out << "\\b"; break;
      case '\f': out << "\\f"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (ch < 0x20) out << "?";
        else out << ch;
    }
  }
  return out.str();
}

std::wstring quote_argument(const std::wstring& value) {
  std::wstring result = L"\"";
  size_t backslashes = 0;
  for (wchar_t ch : value) {
    if (ch == L'\\') {
      ++backslashes;
      continue;
    }
    if (ch == L'\"') {
      result.append(backslashes * 2 + 1, L'\\');
      result.push_back(L'\"');
      backslashes = 0;
      continue;
    }
    result.append(backslashes, L'\\');
    backslashes = 0;
    result.push_back(ch);
  }
  result.append(backslashes * 2, L'\\');
  result.push_back(L'\"');
  return result;
}

void grant_sid_access(const std::wstring& path, PSID sid, DWORD access, DWORD inheritance) {
  PACL old_acl = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  DWORD status = GetNamedSecurityInfoW(
      const_cast<LPWSTR>(path.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
      nullptr, nullptr, &old_acl, nullptr, &descriptor);
  if (status != ERROR_SUCCESS) {
    SetLastError(status);
    fail("GetNamedSecurityInfoW failed for " + narrow(path));
  }

  EXPLICIT_ACCESSW entry{};
  entry.grfAccessPermissions = access;
  entry.grfAccessMode = GRANT_ACCESS;
  entry.grfInheritance = inheritance;
  entry.Trustee.TrusteeForm = TRUSTEE_IS_SID;
  entry.Trustee.TrusteeType = TRUSTEE_IS_USER;
  entry.Trustee.ptstrName = static_cast<LPWSTR>(sid);

  PACL new_acl = nullptr;
  status = SetEntriesInAclW(1, &entry, old_acl, &new_acl);
  if (status != ERROR_SUCCESS) {
    LocalFree(descriptor);
    SetLastError(status);
    fail("SetEntriesInAclW failed for " + narrow(path));
  }
  status = SetNamedSecurityInfoW(
      const_cast<LPWSTR>(path.c_str()), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
      nullptr, nullptr, new_acl, nullptr);
  LocalFree(new_acl);
  LocalFree(descriptor);
  if (status != ERROR_SUCCESS) {
    SetLastError(status);
    fail("SetNamedSecurityInfoW failed for " + narrow(path));
  }
}

std::vector<wchar_t> build_environment(const std::wstring& work_directory, uint16_t port) {
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
}

std::string read_handle_text(HANDLE handle) {
  LARGE_INTEGER zero{};
  require(SetFilePointerEx(handle, zero, nullptr, FILE_BEGIN), "SetFilePointerEx failed");
  std::string result;
  char buffer[4096];
  for (;;) {
    DWORD read = 0;
    if (!ReadFile(handle, buffer, sizeof(buffer), &read, nullptr)) {
      if (GetLastError() == ERROR_BROKEN_PIPE) break;
      fail("ReadFile failed");
    }
    if (read == 0) break;
    result.append(buffer, buffer + read);
  }
  return result;
}

void write_text_file(const std::wstring& path, const std::string& content) {
  std::ofstream stream(std::filesystem::path(path), std::ios::binary | std::ios::trunc);
  if (!stream) throw std::runtime_error("unable to open receipt file");
  stream.write(content.data(), static_cast<std::streamsize>(content.size()));
  if (!stream) throw std::runtime_error("unable to write receipt file");
}

std::map<std::wstring, std::wstring> parse_args(int argc, wchar_t** argv) {
  std::map<std::wstring, std::wstring> result;
  for (int index = 1; index < argc; index += 2) {
    if (index + 1 >= argc) throw std::runtime_error("arguments must be key/value pairs");
    result.emplace(argv[index], argv[index + 1]);
  }
  return result;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  std::wstring profile_name;
  PSID app_container_sid = nullptr;
  bool profile_created = false;
  try {
    const auto args = parse_args(argc, argv);
    auto required = [&](const wchar_t* key) -> std::wstring {
      const auto found = args.find(key);
      if (found == args.end() || found->second.empty()) {
        throw std::runtime_error("missing required argument " + narrow(key));
      }
      return found->second;
    };

    profile_name = required(L"--profile");
    const std::wstring application = required(L"--application");
    const std::wstring script = required(L"--script");
    const std::wstring app_directory = required(L"--app-directory");
    const std::wstring work_directory = required(L"--work-directory");
    const std::wstring external_file = required(L"--external-file");
    const std::wstring receipt_path = required(L"--receipt");
    const std::wstring stdout_path = required(L"--stdout");
    const std::wstring stderr_path = required(L"--stderr");
    const uint64_t memory_limit = std::stoull(required(L"--memory-limit"));
    const DWORD timeout_ms = static_cast<DWORD>(std::stoul(required(L"--timeout-ms")));

    DeleteAppContainerProfile(profile_name.c_str());
    HRESULT result = CreateAppContainerProfile(
        profile_name.c_str(), L"AXM Windows Capability Probe",
        L"Disposable no-capability AppContainer probe", nullptr, 0, &app_container_sid);
    if (FAILED(result)) {
      std::ostringstream message;
      message << "CreateAppContainerProfile failed (HRESULT=0x" << std::hex << static_cast<uint32_t>(result) << ")";
      throw std::runtime_error(message.str());
    }
    profile_created = true;

    LPWSTR sid_text_raw = nullptr;
    require(ConvertSidToStringSidW(app_container_sid, &sid_text_raw), "ConvertSidToStringSidW failed");
    const std::wstring sid_text(sid_text_raw);
    LocalFree(sid_text_raw);

    grant_sid_access(app_directory, app_container_sid,
                     FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | FILE_TRAVERSE | SYNCHRONIZE,
                     NO_INHERITANCE);
    grant_sid_access(application, app_container_sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE, NO_INHERITANCE);
    grant_sid_access(script, app_container_sid, FILE_GENERIC_READ | FILE_GENERIC_EXECUTE, NO_INHERITANCE);
    grant_sid_access(work_directory, app_container_sid,
                     FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_GENERIC_EXECUTE,
                     SUB_CONTAINERS_AND_OBJECTS_INHERIT);

    WSADATA winsock{};
    require(WSAStartup(MAKEWORD(2, 2), &winsock) == 0, "WSAStartup failed");
    SocketHandle listener;
    listener.value = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listener.value == INVALID_SOCKET) fail("socket failed");
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = 0;
    require(bind(listener.value, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == 0, "bind failed");
    require(listen(listener.value, 1) == 0, "listen failed");
    int address_size = sizeof(address);
    require(getsockname(listener.value, reinterpret_cast<sockaddr*>(&address), &address_size) == 0, "getsockname failed");
    const uint16_t loopback_port = ntohs(address.sin_port);
    u_long nonblocking = 1;
    require(ioctlsocket(listener.value, FIONBIO, &nonblocking) == 0, "ioctlsocket failed");

    SECURITY_ATTRIBUTES security_attributes{};
    security_attributes.nLength = sizeof(security_attributes);
    security_attributes.bInheritHandle = TRUE;

    HANDLE stdin_read_raw = nullptr;
    HANDLE stdin_write_raw = nullptr;
    require(CreatePipe(&stdin_read_raw, &stdin_write_raw, &security_attributes, 0), "CreatePipe failed");
    Handle stdin_read(stdin_read_raw);
    Handle stdin_write(stdin_write_raw);
    require(SetHandleInformation(stdin_write.get(), HANDLE_FLAG_INHERIT, 0), "SetHandleInformation failed");

    Handle stdout_file(CreateFileW(
        stdout_path.c_str(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
        &security_attributes, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr));
    require(static_cast<bool>(stdout_file), "CreateFileW stdout failed");
    Handle stderr_file(CreateFileW(
        stderr_path.c_str(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
        &security_attributes, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr));
    require(static_cast<bool>(stderr_file), "CreateFileW stderr failed");

    STARTUPINFOEXW startup{};
    startup.StartupInfo.cb = sizeof(startup);
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = stdin_read.get();
    startup.StartupInfo.hStdOutput = stdout_file.get();
    startup.StartupInfo.hStdError = stderr_file.get();

    SIZE_T attribute_bytes = 0;
    InitializeProcThreadAttributeList(nullptr, 3, 0, &attribute_bytes);
    std::vector<unsigned char> attribute_storage(attribute_bytes);
    startup.lpAttributeList = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(attribute_storage.data());
    require(InitializeProcThreadAttributeList(startup.lpAttributeList, 3, 0, &attribute_bytes),
            "InitializeProcThreadAttributeList failed");

    SECURITY_CAPABILITIES security_capabilities{};
    security_capabilities.AppContainerSid = app_container_sid;
    security_capabilities.Capabilities = nullptr;
    security_capabilities.CapabilityCount = 0;
    security_capabilities.Reserved = 0;
    require(UpdateProcThreadAttribute(
                startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
                &security_capabilities, sizeof(security_capabilities), nullptr, nullptr),
            "security capabilities attribute failed");

    DWORD child_policy = PROCESS_CREATION_CHILD_PROCESS_RESTRICTED;
    require(UpdateProcThreadAttribute(
                startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_CHILD_PROCESS_POLICY,
                &child_policy, sizeof(child_policy), nullptr, nullptr),
            "child process policy attribute failed");

    HANDLE inherited_handles[] = {stdin_read.get(), stdout_file.get(), stderr_file.get()};
    require(UpdateProcThreadAttribute(
                startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                inherited_handles, sizeof(inherited_handles), nullptr, nullptr),
            "handle list attribute failed");

    std::wstring command_line = quote_argument(application) + L" " + quote_argument(script);
    std::vector<wchar_t> mutable_command(command_line.begin(), command_line.end());
    mutable_command.push_back(L'\0');
    auto environment = build_environment(work_directory, loopback_port);

    PROCESS_INFORMATION process{};
    const DWORD creation_flags = EXTENDED_STARTUPINFO_PRESENT | CREATE_SUSPENDED |
                                 CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW;
    require(CreateProcessW(
                application.c_str(), mutable_command.data(), nullptr, nullptr, TRUE,
                creation_flags, environment.data(), work_directory.c_str(),
                &startup.StartupInfo, &process),
            "CreateProcessW failed");
    Handle process_handle(process.hProcess);
    Handle thread_handle(process.hThread);
    DeleteProcThreadAttributeList(startup.lpAttributeList);
    startup.lpAttributeList = nullptr;
    stdin_read.reset();

    Handle job(CreateJobObjectW(nullptr, nullptr));
    require(static_cast<bool>(job), "CreateJobObjectW failed");
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION job_limits{};
    job_limits.BasicLimitInformation.LimitFlags =
        JOB_OBJECT_LIMIT_ACTIVE_PROCESS | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE |
        JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION | JOB_OBJECT_LIMIT_PROCESS_MEMORY;
    job_limits.BasicLimitInformation.ActiveProcessLimit = 1;
    job_limits.ProcessMemoryLimit = static_cast<SIZE_T>(memory_limit);
    require(SetInformationJobObject(
                job.get(), JobObjectExtendedLimitInformation,
                &job_limits, sizeof(job_limits)),
            "SetInformationJobObject failed");
    require(AssignProcessToJobObject(job.get(), process_handle.get()), "AssignProcessToJobObject failed");

    BOOL process_in_job = FALSE;
    require(IsProcessInJob(process_handle.get(), job.get(), &process_in_job), "IsProcessInJob failed");

    JOBOBJECT_EXTENDED_LIMIT_INFORMATION observed_limits{};
    require(QueryInformationJobObject(
                job.get(), JobObjectExtendedLimitInformation,
                &observed_limits, sizeof(observed_limits), nullptr),
            "QueryInformationJobObject failed");

    Handle token;
    HANDLE token_raw = nullptr;
    require(OpenProcessToken(process_handle.get(), TOKEN_QUERY, &token_raw), "OpenProcessToken failed");
    token.reset(token_raw);
    DWORD is_app_container = 0;
    DWORD returned = 0;
    require(GetTokenInformation(
                token.get(), TokenIsAppContainer, &is_app_container,
                sizeof(is_app_container), &returned),
            "TokenIsAppContainer failed");
    TOKEN_APPCONTAINER_INFORMATION app_container_info{};
    require(GetTokenInformation(
                token.get(), TokenAppContainerSid, &app_container_info,
                sizeof(app_container_info), &returned),
            "TokenAppContainerSid failed");
    const bool app_container_sid_exact =
        app_container_info.TokenAppContainer != nullptr &&
        EqualSid(app_container_info.TokenAppContainer, app_container_sid);

    PROCESS_MITIGATION_CHILD_PROCESS_POLICY observed_child_policy{};
    require(GetProcessMitigationPolicy(
                process_handle.get(), ProcessChildProcessPolicy,
                &observed_child_policy, sizeof(observed_child_policy)),
            "GetProcessMitigationPolicy failed");

    const bool active_process_limit_exact =
        (observed_limits.BasicLimitInformation.LimitFlags & JOB_OBJECT_LIMIT_ACTIVE_PROCESS) != 0 &&
        observed_limits.BasicLimitInformation.ActiveProcessLimit == 1;
    const bool kill_on_close =
        (observed_limits.BasicLimitInformation.LimitFlags & JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE) != 0;
    const bool memory_limit_exact =
        (observed_limits.BasicLimitInformation.LimitFlags & JOB_OBJECT_LIMIT_PROCESS_MEMORY) != 0 &&
        observed_limits.ProcessMemoryLimit == static_cast<SIZE_T>(memory_limit);
    const bool child_process_restricted = observed_child_policy.NoChildProcessCreation != 0;
    const bool kernel_attested =
        process_in_job == TRUE && is_app_container != 0 && app_container_sid_exact &&
        active_process_limit_exact && kill_on_close && memory_limit_exact && child_process_restricted;
    require(kernel_attested, "kernel attestation did not match requested Windows boundary");

    require(ResumeThread(thread_handle.get()) != static_cast<DWORD>(-1), "ResumeThread failed");
    const std::string input =
        "{\"message\":\"release-after-kernel-attestation\",\"workDirectory\":\"" +
        json_escape(narrow(work_directory)) + "\",\"externalFile\":\"" +
        json_escape(narrow(external_file)) + "\",\"loopbackPort\":" +
        std::to_string(loopback_port) + "}\n";
    DWORD written = 0;
    require(WriteFile(stdin_write.get(), input.data(), static_cast<DWORD>(input.size()), &written, nullptr),
            "WriteFile stdin failed");
    require(written == input.size(), "stdin write was partial");
    stdin_write.reset();

    const DWORD wait_result = WaitForSingleObject(process_handle.get(), timeout_ms);
    bool timed_out = wait_result == WAIT_TIMEOUT;
    if (timed_out) {
      TerminateJobObject(job.get(), 124);
      WaitForSingleObject(process_handle.get(), 5000);
    } else {
      require(wait_result == WAIT_OBJECT_0, "WaitForSingleObject failed");
    }

    DWORD exit_code = STILL_ACTIVE;
    require(GetExitCodeProcess(process_handle.get(), &exit_code), "GetExitCodeProcess failed");
    const std::string child_stdout = read_handle_text(stdout_file.get());
    const std::string child_stderr = read_handle_text(stderr_file.get());

    sockaddr_in peer{};
    int peer_size = sizeof(peer);
    SOCKET accepted_socket = accept(listener.value, reinterpret_cast<sockaddr*>(&peer), &peer_size);
    const bool network_connection_accepted = accepted_socket != INVALID_SOCKET;
    if (network_connection_accepted) closesocket(accepted_socket);

    std::ostringstream receipt;
    receipt << "{\n"
            << "  \"format\": \"axm-windows-capability-host-receipt/1\",\n"
            << "  \"profileCreated\": true,\n"
            << "  \"appContainerSid\": \"" << json_escape(narrow(sid_text)) << "\",\n"
            << "  \"processCreatedSuspended\": true,\n"
            << "  \"processInJob\": " << (process_in_job ? "true" : "false") << ",\n"
            << "  \"tokenIsAppContainer\": " << (is_app_container ? "true" : "false") << ",\n"
            << "  \"appContainerSidExact\": " << (app_container_sid_exact ? "true" : "false") << ",\n"
            << "  \"activeProcessLimitExact\": " << (active_process_limit_exact ? "true" : "false") << ",\n"
            << "  \"killOnJobClose\": " << (kill_on_close ? "true" : "false") << ",\n"
            << "  \"memoryLimitExact\": " << (memory_limit_exact ? "true" : "false") << ",\n"
            << "  \"memoryLimitBytes\": " << memory_limit << ",\n"
            << "  \"childProcessRestricted\": " << (child_process_restricted ? "true" : "false") << ",\n"
            << "  \"kernelAttestedBeforeInput\": " << (kernel_attested ? "true" : "false") << ",\n"
            << "  \"inputReleasedAfterAttestation\": " << (kernel_attested ? "true" : "false") << ",\n"
            << "  \"timedOut\": " << (timed_out ? "true" : "false") << ",\n"
            << "  \"processExitCode\": " << exit_code << ",\n"
            << "  \"networkConnectionAccepted\": " << (network_connection_accepted ? "true" : "false") << ",\n"
            << "  \"stdoutBytes\": " << child_stdout.size() << ",\n"
            << "  \"stderrBytes\": " << child_stderr.size() << ",\n"
            << "  \"rawTaskInputRetained\": false,\n"
            << "  \"rawTaskOutputRetained\": false,\n"
            << "  \"authority\": \"none\"\n"
            << "}\n";
    write_text_file(receipt_path, receipt.str());

    std::cout << child_stdout;
    if (!child_stderr.empty()) std::cerr << child_stderr;

    process_handle.reset();
    thread_handle.reset();
    token.reset();
    job.reset();
    stdout_file.reset();
    stderr_file.reset();
    listener.value = INVALID_SOCKET;
    WSACleanup();
    if (app_container_sid) {
      FreeSid(app_container_sid);
      app_container_sid = nullptr;
    }
    DeleteAppContainerProfile(profile_name.c_str());
    profile_created = false;

    return (exit_code == 0 && !timed_out && !network_connection_accepted) ? 0 : 2;
  } catch (const std::exception& error) {
    std::cerr << error.what() << "\n";
    if (app_container_sid) FreeSid(app_container_sid);
    if (profile_created && !profile_name.empty()) DeleteAppContainerProfile(profile_name.c_str());
    return 1;
  }
}
