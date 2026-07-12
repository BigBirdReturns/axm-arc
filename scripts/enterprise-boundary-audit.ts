import fs from "node:fs";
import path from "node:path";
import { generateBoundaryAudit, renderBoundaryAudit } from "../src/audit/boundary-audit.js";

const audit = generateBoundaryAudit();
const docs = path.resolve("docs", "enterprise");
fs.mkdirSync(docs, { recursive: true });
fs.writeFileSync(path.join(docs, "boundary-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
fs.writeFileSync(path.join(docs, "BOUNDARY_AUDIT.md"), renderBoundaryAudit(audit));
process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);

if (audit.completeness.unclassifiedModules.length || audit.completeness.unclassifiedCycleStages.length) {
  process.exitCode = 1;
}
