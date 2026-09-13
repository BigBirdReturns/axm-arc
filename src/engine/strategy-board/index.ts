// Strategy Board Runtime — schema, structural preview, and bounded executor.
export * from "./types";
export * from './executor';
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
