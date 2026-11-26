/**
 * Unit tests for the 16-member Human Trainer NPC cast and 4-directional
 * cardinal sprite cell slicer (`src/canvas/humanNpcAnimator.ts`).
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_HUMAN_NPCS,
  CLERK_NPC,
  HUMAN_SHOPPER_NPCS_BY_ARCHETYPE,
} from '../../src/data/npcs';
import {
  computeHumanNpcCell,
  vectorToCardinalDirection,
} from '../../src/canvas/humanNpcAnimator';

describe('Human Trainer Cast & 4-Directional Animator', () => {
  it('bundles Clerk Leo and 15 distinct Human Trainer shoppers across all 6 archetypes', () => {
    expect(CLERK_NPC.id).toBe('mart_employee');
    expect(ALL_HUMAN_NPCS.length).toBeGreaterThanOrEqual(12);
    expect(ALL_HUMAN_NPCS.map((n) => n.id)).toContain('mart_employee');
    expect(ALL_HUMAN_NPCS.map((n) => n.id)).toContain('steven');
    expect(HUMAN_SHOPPER_NPCS_BY_ARCHETYPE.normal.length).toBeGreaterThanOrEqual(4);
  });

  it('maps 2D movement vectors cleanly to 4 cardinal facing rows', () => {
    expect(vectorToCardinalDirection(0, 5)).toBe('down');
    expect(vectorToCardinalDirection(0, -5)).toBe('up');
    expect(vectorToCardinalDirection(-5, 0)).toBe('left');
    expect(vectorToCardinalDirection(5, 0)).toBe('right');
    expect(vectorToCardinalDirection(0.01, 0.01, 'left')).toBe('left');
  });

  it('returns standing column 0 when idle and steps smoothly through columns 0..3 when walking', () => {
    expect(computeHumanNpcCell('down', false, 99)).toEqual({ col: 0, row: 0 });
    expect(computeHumanNpcCell('up', false, 48)).toEqual({ col: 0, row: 1 });
    expect(computeHumanNpcCell('left', true, 0)).toEqual({ col: 0, row: 2 });
    expect(computeHumanNpcCell('left', true, 12)).toEqual({ col: 1, row: 2 });
    expect(computeHumanNpcCell('right', true, 24)).toEqual({ col: 2, row: 3 });
    expect(computeHumanNpcCell('right', true, 36)).toEqual({ col: 3, row: 3 });
    expect(computeHumanNpcCell('down', true, 48)).toEqual({ col: 0, row: 0 });
  });
});
