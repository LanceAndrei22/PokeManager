/**
 * Shared leaf types and deterministic state helpers for the PokéMart simulation engine.
 *
 * Leaf module imported by `shopperSimulation.ts`, `careSimulation.ts`,
 * `shiftSettlement.ts`, and `simulation.ts` so dependency flow remains strictly one-way
 * with zero import cycles.
 */
import type { ActivityEntry, GameState } from '../data/types';
import { createSeededRng, type RngFn } from './rng';

/** Sound effect cues emitted by simulation actions and live ticks. */
export type SfxCue =
  | 'bell'
  | 'sale'
  | 'evolve'
  | 'hatch'
  | 'heal'
  | 'click'
  | 'shiny'
  | 'walkout';

/** Standard result payload returned by player-triggered simulation actions. */
export interface ActionResult {
  state: GameState;
  ok: boolean;
  message: string;
  sfx?: SfxCue;
}

/** Result payload returned by `advanceShiftTick`. */
export interface TickResult {
  state: GameState;
  sfxCues: SfxCue[];
}

/** Prepends an activity log entry while keeping the rolling history bounded to 32 entries. */
export function appendLog(
  log: ActivityEntry[],
  shift: number,
  text: string,
  tone: ActivityEntry['tone'],
  idSuffix: string,
): ActivityEntry[] {
  const entry: ActivityEntry = {
    id: `log-${shift}-${idSuffix}`,
    shift,
    text,
    tone,
  };
  return [entry, ...log].slice(0, 32);
}

/** Advances the profile seed counter and returns a deterministic PRNG (or caller override). */
export function nextRng(state: GameState, providedRng?: RngFn): { rng: RngFn; nextSeed: number } {
  const nextSeed = (state.seedCounter + 1) >>> 0;
  return {
    rng: providedRng ?? createSeededRng(0x504f4b45 ^ nextSeed ^ (state.shiftNumber * 997)),
    nextSeed,
  };
}
