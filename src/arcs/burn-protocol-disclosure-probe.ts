import { compileCommonShipPocket } from "../common-ship/compiler.js";
import { BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE } from "../common-ship/burn-protocol-disclosure-probe.js";

export const BURN_PROTOCOL_DISCLOSURE_PROBE = compileCommonShipPocket(
  BURN_PROTOCOL_DISCLOSURE_PROBE_SOURCE,
);
