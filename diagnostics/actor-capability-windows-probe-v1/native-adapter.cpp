#define UNICODE
#define _UNICODE
#define _WIN32_WINNT 0x0A00

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#pragma comment(lib, "Ws2_32.lib")

namespace {

std::wstring widen(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(
      CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
      static_cast<int>(value.size()), nullptr, 0);
  if (size <= 0) throw std::runtime_error("invalid UTF-8 input");
  std::wstring result(static_cast<size_t>(size), L'\0');
  if (MultiByteToWideChar(
          CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
          static_cast<int>(value.size()), result.data(), size) != size) {
    throw std::runtime_error("UTF-8 conversion failed");
  }
  return result;
}

std::string narrow(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
      static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) throw std::runtime_error("invalid UTF-16 input");
  std::string result(static_cast<size_t>(size), '\0');
  if (WideCharToMultiByte(
          CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
          static_cast<int>(value.size()), result.data(), size,
          nullptr, nullptr) != size) {
    throw std::runtime_error("UTF-16 conversion failed");
  }
  return result;
}

std::string json_escape(const std::string& value) {
  std::ostringstream output;
  for (const unsigned char character : value) {
    switch (character) {
      case '\\': output << "\\\\"; break;
      case '"': output << "\\\""; break;
      case '\b': output << "\\b"; break;
      case '\f': output << "\\f"; break;
      case '\n': output << "\\n"; break;
      case '\r': output << "\\r"; break;
      case '\t': output << "\\t"; break;
      default:
        if (character < 0x20) output << '?';
        else output << character;
    }
  }
  return output.str();
}

size_t find_value_start(const std::string& json, const std::string& key) {
  const std::string marker = "\"" + key + "\"";
  const size_t key_index = json.find(marker);
  if (key_index == std::string::npos) {
    throw std::runtime_error("missing JSON key: " + key);
  }
  const size_t colon = json.find(':', key_index + marker.size());
  if (colon == std::string::npos) {
    throw std::runtime_error("missing JSON colon: " + key);
  }
  size_t cursor = colon + 1;
  while (cursor < json.size() && std::isspace(
      static_cast<unsigned char>(json[cursor]))) {
    ++cursor;
  }
  if (cursor >= json.size()) {
    throw std::runtime_error("missing JSON value: " + key);
  }
  return cursor;
}

std::string json_string(const std::string& json, const std::string& key) {
  size_t cursor = find_value_start(json, key);
  if (json[cursor] != '"') {
    throw std::runtime_error("JSON value is not a string: " + key);
  }
  ++cursor;
  std::string result;
  while (cursor < json.size()) {
    const char character = json[cursor++];
    if (character == '"') return result;
    if (character != '\\') {
      result.push_back(character);
      continue;
    }
    if (cursor >= json.size()) {
      throw std::runtime_error("truncated JSON escape: " + key);
    }
    const char escaped = json[cursor++];
    switch (escaped) {
      case '"': result.push_back('"'); break;
      case '\\': result.push_back('\\'); break;
      case '/': result.push_back('/'); break;
      case 'b': result.push_back('\b'); break;
      case 'f': result.push_back('\f'); break;
      case 'n': result.push_back('\n'); break;
      case 'r': result.push_back('\r'); break;
      case 't': result.push_back('\t'); break;
      default: throw std::runtime_error("unsupported JSON escape: " + key);
    }
  }
  throw std::runtime_error("unterminated JSON string: " + key);
}

uint16_t json_port(const std::string& json, const std::string& key) {
  size_t cursor = find_value_start(json, key);
  uint32_t value = 0;
  bool found_digit = false;
  while (cursor < json.size() && std::isdigit(
      static_cast<unsigned char>(json[cursor]))) {
    found_digit = true;
    value = value * 10 + static_cast<uint32_t>(json[cursor] - '0');
    if (value > 65535) throw std::runtime_error("port out of range");
    ++cursor;
  }
  if (!found_digit || value == 0) {
    throw std::runtime_error("invalid JSON port: " + key);
  }
  return static_cast<uint16_t>(value);
}

std::wstring quote_argument(const std::wstring& value) {
  std::wstring result = L"\"";
  size_t backslashes = 0;
  for (const wchar_t character : value) {
    if (character == L'\\') {
      ++backslashes;
      continue;
    }
    if (character == L'\"') {
      result.append(backslashes * 2 + 1, L'\\');
      result.push_back(L'\"');
      backslashes = 0;
      continue;
    }
    result.append(backslashes, L'\\');
    backslashes = 0;
    result.push_back(character);
  }
  result.append(backslashes * 2, L'\\');
  result.push_back(L'\"');
  return result;
}

std::vector<std::string> environment_keys() {
  LPWCH block = GetEnvironmentStringsW();
  if (!block) throw std::runtime_error("GetEnvironmentStringsW failed");
  std::vector<std::string> keys;
  for (const wchar_t* entry = block; *entry != L'\0';) {
    const std::wstring value(entry);
    entry += value.size() + 1;
    if (value.empty() || value[0] == L'=') continue;
    const size_t separator = value.find(L'=');
    if (separator == std::wstring::npos) continue;
    keys.push_back(narrow(value.substr(0, separator)));
  }
  FreeEnvironmentStringsW(block);
  std::sort(keys.begin(), keys.end());
  return keys;
}

bool environment_contains(const wchar_t* key) {
  SetLastError(ERROR_SUCCESS);
  const DWORD required = GetEnvironmentVariableW(key, nullptr, 0);
  return required > 0 || GetLastError() != ERROR_ENVVAR_NOT_FOUND;
}

std::string read_stdin() {
  std::ostringstream stream;
  stream << std::cin.rdbuf();
  return stream.str();
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  if (argc > 1 && std::wstring(argv[1]) == L"--child") return 0;

  try {
    const std::string input = read_stdin();
    const bool input_received =
        json_string(input, "message") == "release-after-kernel-attestation";
    const std::wstring work_directory = widen(json_string(input, "workDirectory"));
    const std::wstring external_file = widen(json_string(input, "externalFile"));
    const uint16_t loopback_port = json_port(input, "loopbackPort");

    bool allowed_write = false;
    bool allowed_read_back = false;
    const std::filesystem::path allowed_path =
        std::filesystem::path(work_directory) / L"allowed.txt";
    {
      std::ofstream output(allowed_path, std::ios::binary | std::ios::trunc);
      if (output) {
        output << "allowed";
        output.close();
        allowed_write = static_cast<bool>(output);
      }
    }
    if (allowed_write) {
      std::ifstream source(allowed_path, std::ios::binary);
      std::string value;
      source >> value;
      allowed_read_back = source.good() || source.eof();
      allowed_read_back = allowed_read_back && value == "allowed";
    }

    SetLastError(ERROR_SUCCESS);
    HANDLE external_read = CreateFileW(
        external_file.c_str(), GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    const bool external_read_denied = external_read == INVALID_HANDLE_VALUE;
    const DWORD external_read_error = external_read_denied ? GetLastError() : ERROR_SUCCESS;
    if (external_read != INVALID_HANDLE_VALUE) CloseHandle(external_read);

    SetLastError(ERROR_SUCCESS);
    HANDLE external_write = CreateFileW(
        external_file.c_str(), GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    const bool external_write_denied = external_write == INVALID_HANDLE_VALUE;
    const DWORD external_write_error = external_write_denied ? GetLastError() : ERROR_SUCCESS;
    if (external_write != INVALID_HANDLE_VALUE) CloseHandle(external_write);

    WSADATA winsock{};
    const int startup_status = WSAStartup(MAKEWORD(2, 2), &winsock);
    bool network_denied = startup_status != 0;
    bool network_connected = false;
    int network_error = startup_status;
    if (startup_status == 0) {
      SOCKET socket_handle = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
      if (socket_handle == INVALID_SOCKET) {
        network_denied = true;
        network_error = WSAGetLastError();
      } else {
        sockaddr_in address{};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        address.sin_port = htons(loopback_port);
        const int connect_status = connect(
            socket_handle, reinterpret_cast<sockaddr*>(&address), sizeof(address));
        network_connected = connect_status == 0;
        network_denied = !network_connected;
        network_error = network_connected ? 0 : WSAGetLastError();
        closesocket(socket_handle);
      }
      WSACleanup();
    }

    wchar_t module_path[MAX_PATH]{};
    const DWORD module_path_length = GetModuleFileNameW(
        nullptr, module_path, static_cast<DWORD>(std::size(module_path)));
    if (module_path_length == 0 || module_path_length >= std::size(module_path)) {
      throw std::runtime_error("GetModuleFileNameW failed");
    }
    std::wstring child_command = quote_argument(module_path) + L" --child";
    std::vector<wchar_t> child_command_buffer(
        child_command.begin(), child_command.end());
    child_command_buffer.push_back(L'\0');
    STARTUPINFOW child_startup{};
    child_startup.cb = sizeof(child_startup);
    PROCESS_INFORMATION child_process{};
    SetLastError(ERROR_SUCCESS);
    const BOOL child_created = CreateProcessW(
        module_path, child_command_buffer.data(), nullptr, nullptr, FALSE,
        CREATE_NO_WINDOW, nullptr, nullptr, &child_startup, &child_process);
    const DWORD child_process_error = child_created ? ERROR_SUCCESS : GetLastError();
    const bool child_process_denied = child_created == FALSE;
    if (child_created) {
      TerminateProcess(child_process.hProcess, 125);
      WaitForSingleObject(child_process.hProcess, 5000);
      CloseHandle(child_process.hThread);
      CloseHandle(child_process.hProcess);
    }

    std::atomic<int> worker_value{0};
    std::thread worker([&worker_value]() { worker_value.store(42); });
    worker.join();
    const bool worker_thread_succeeded = worker_value.load() == 42;

    const bool secret_present = environment_contains(L"AXM_WINDOWS_PROBE_SECRET");
    const std::vector<std::string> keys = environment_keys();

    std::ostringstream output;
    output << "{"
           << "\"format\":\"axm-windows-capability-probe-result/2\","
           << "\"adapterKind\":\"native-static-threaded\","
           << "\"inputReceived\":" << (input_received ? "true" : "false") << ','
           << "\"allowedWrite\":" << (allowed_write ? "true" : "false") << ','
           << "\"allowedReadBack\":" << (allowed_read_back ? "true" : "false") << ','
           << "\"externalReadDenied\":" << (external_read_denied ? "true" : "false") << ','
           << "\"externalReadError\":" << external_read_error << ','
           << "\"externalWriteDenied\":" << (external_write_denied ? "true" : "false") << ','
           << "\"externalWriteError\":" << external_write_error << ','
           << "\"networkDenied\":" << (network_denied ? "true" : "false") << ','
           << "\"networkConnected\":" << (network_connected ? "true" : "false") << ','
           << "\"networkError\":" << network_error << ','
           << "\"childProcessDenied\":" << (child_process_denied ? "true" : "false") << ','
           << "\"childProcessError\":" << child_process_error << ','
           << "\"workerThreadSucceeded\":" << (worker_thread_succeeded ? "true" : "false") << ','
           << "\"workerValue\":" << worker_value.load() << ','
           << "\"secretPresent\":" << (secret_present ? "true" : "false") << ','
           << "\"environmentKeys\":[";
    for (size_t index = 0; index < keys.size(); ++index) {
      if (index > 0) output << ',';
      output << '"' << json_escape(keys[index]) << '"';
    }
    output << "]}\n";
    std::cout << output.str();
    return 0;
  } catch (const std::exception& error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}
