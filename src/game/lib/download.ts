import type { RecoveryArtifact } from "./persistence.js";

/** Browser-only delivery for a recovery artifact prepared by a pure API. */
export function downloadJsonArtifact(artifact: RecoveryArtifact): void {
  const blob = new Blob([artifact.json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
