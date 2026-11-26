/**
 * Unit tests for relaxed live-tick clock progression, pause/resume, 1x/2x speed,
 * early shift closing, and next-shift transitions.
 */
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../src/engine/rng';
import {
  advanceShiftTick,
  closeShiftEarly,
  createInitialGameState,
  setShiftSpeed,
  startNextShift,
  toggleShiftRunning,
} from '../../src/engine/simulation';

describe('Shift Clock & Live-Tick Progression', () => {
  it('pauses and resumes cleanly and toggles 1x/2x speed', () => {
    let state = createInitialGameState('p1', 'Cozy Host');
    expect(state.shiftRunning).toBe(false);
    expect(state.shiftSpeed).toBe(1);

    // Ticking while paused is a complete no-op
    const pausedTick = advanceShiftTick(state);
    expect(pausedTick.state.shiftTick).toBe(0);

    const openRes = toggleShiftRunning(state);
    expect(openRes.ok).toBe(true);
    expect(openRes.sfx).toBe('bell');
    state = setShiftSpeed(openRes.state, 2);
    expect(state.shiftRunning).toBe(true);
    expect(state.shiftSpeed).toBe(2);

    const ticked = advanceShiftTick(state, createSeededRng(42));
    expect(ticked.state.shiftTick).toBe(1);

    const pausedAgain = toggleShiftRunning(ticked.state);
    expect(pausedAgain.state.shiftRunning).toBe(false);
  });

  it('auto-closes smoothly at closing time and resets cleanly on startNextShift', () => {
    let state = createInitialGameState('p1', 'Cozy Host');
    state = toggleShiftRunning(state).state;
    state = {
      ...state,
      shiftTick: state.shiftDurationTicks - 1,
      recentSpeciesSales: { 133: 3, 79: 1 },
    };

    const closingTick = advanceShiftTick(state, createSeededRng(7));
    expect(closingTick.state.shiftTick).toBe(state.shiftDurationTicks);
    expect(closingTick.state.shiftRunning).toBe(false);
    expect(closingTick.state.lastShiftSummary).not.toBeNull();
    expect(closingTick.state.lastShiftSummary?.closedEarly).toBe(false);

    // Cannot resume shift while Shift Summary is pending
    const blockedResume = toggleShiftRunning(closingTick.state);
    expect(blockedResume.ok).toBe(false);

    const nextShift = startNextShift(closingTick.state, createSeededRng(99));
    expect(nextShift.shiftNumber).toBe(2);
    expect(nextShift.shiftTick).toBe(0);
    expect(nextShift.lastShiftSummary).toBeNull();
    expect(nextShift.recentSpeciesSales[133]).toBe(2);
    expect(nextShift.recentSpeciesSales[79]).toBeUndefined();
    expect(nextShift.wholesaleCatalog.length).toBe(5);
  });

  it('supports manual closeShiftEarly with closedEarly flag', () => {
    let state = toggleShiftRunning(createInitialGameState('p1', 'Cozy Host')).state;
    state = advanceShiftTick(state, createSeededRng(12)).state;
    const closed = closeShiftEarly(state);

    expect(closed.shiftRunning).toBe(false);
    expect(closed.customers).toHaveLength(0);
    expect(closed.lastShiftSummary?.closedEarly).toBe(true);
    expect(closed.lastShiftSummary?.shiftNumber).toBe(1);
  });
});
