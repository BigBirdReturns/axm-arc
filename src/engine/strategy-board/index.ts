// Strategy Board Runtime — public surface (scaffold only).
// Types + schema validation + the mini reference fixture. No behavior yet.
export * from "./types";
export { StrategyBoardSchema, validateStrategyBoard } from "./schema";
export { PROGRAM_OF_RECORD_MINI, loadProgramOfRecordMini } from "./program-of-record-mini";
export {
  PHASE_ORDER,
  CHOICE_PHASES,
  initialStrategyState,
  listLegalActions,
  isActionLegal,
  type SeatState,
  type TurnState,
  type LegalAction,
  type LegalActionKind,
} from "./turn";
