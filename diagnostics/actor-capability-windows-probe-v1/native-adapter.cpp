#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#define _WIN32_WINNT 0x0A00

#include <windows.h>

#pragma comment(lib, "kernel32.lib")
#pragma comment(linker, "/ENTRY:AxmEntry")
#pragma comment(linker, "/SUBSYSTEM:CONSOLE,6.02")

extern "C" __declspec(noreturn) void WINAPI AxmEntry() {
  static const char payload[] =
      "{\"format\":\"axm-windows-appcontainer-entry-control/1\","
      "\"entryReached\":true}\n";
  DWORD written = 0;
  const HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  const BOOL write_ok =
      output != nullptr && output != INVALID_HANDLE_VALUE &&
      WriteFile(output, payload, static_cast<DWORD>(sizeof(payload) - 1),
                &written, nullptr);
  ExitProcess(write_ok && written == sizeof(payload) - 1 ? 0 : 1);
}
