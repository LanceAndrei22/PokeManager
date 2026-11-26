/**
 * Unit and component tests for the canvas world state machine, 2D pixel renderer,
 * and React ShopFloorPreview integration (reduced motion, pause toggle, inspect).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { computeShopLayout } from '../../src/canvas/layout';
import { spawnCoin } from '../../src/canvas/particles';
import { renderScene } from '../../src/canvas/renderer';
import type { SpriteEntityAdapter } from '../../src/canvas/types';
import {
  WALK_DURATION,
  buildFloorSnapshot,
  createWorld,
  hitTestPokemon,
  relayoutWorld,
  stepWorld,
  syncWorld,
} from '../../src/canvas/world';
import { ShopFloorPreview } from '../../src/components/ShopFloorPreview';
import type { PokemonInstance, ShopCustomer } from '../../src/data/types';
import { createSeededRng } from '../../src/engine/rng';

const makePokemon = (overrides: Partial<PokemonInstance> = {}): PokemonInstance => ({
  uid: 'mon-1',
  speciesId: 133,
  isShiny: false,
  trait: 'Cozy',
  stats: { cute: 90, comfort: 82, rarity: 62 },
  location: 'pen',
  penIndex: 0,
  healingProgress: 100,
  needsRecovery: false,
  acquiredAtShift: 1,
  origin: 'starter',
  ...overrides,
});

const makeCustomer = (overrides: Partial<ShopCustomer> = {}): ShopCustomer => ({
  uid: 'cust-1',
  archetypeId: 'trend-fan',
  name: 'Cheryl',
  targetPenIndex: 0,
  statusText: 'Admiring Eevee...',
  ticksRemaining: 3,
  ...overrides,
});

describe('Shop World State Machine', () => {
  it('diffs snapshots for silent init, adoption sales, heals, evolutions, hatches, and shoppers', () => {
    const rng = createSeededRng(101);
    const layout = computeShopLayout(800, 3, 2, 1);
    const world = createWorld();

    const eevee = makePokemon({ uid: 'eevee', speciesId: 133, penIndex: 0 });
    const stray = makePokemon({
      uid: 'psyduck',
      speciesId: 54,
      location: 'healing',
      penIndex: null,
      healingProgress: 40,
      needsRecovery: true,
    });
    const customer = makeCustomer({ uid: 'c-1', targetPenIndex: 0 });

    // Initial sync is silent (no celebration particles for pre-existing state)
    const firstSnap = buildFloorSnapshot('p1', 1800, 1, [eevee, stray], [customer]);
    const firstEvents = syncWorld(world, firstSnap, layout, rng);
    expect(firstEvents).toEqual({ sales: 0, heals: 0, evolutions: 0, hatches: 0 });
    expect(world.pokemon.size).toBe(2);
    expect(world.walkers.size).toBe(1);
    expect(world.particles).toHaveLength(0);

    // Step enough time for shopper to reach pen and Pokémon to hop
    for (let i = 0; i < 60; i += 1) {
      stepWorld(world, 0.05, layout, rng);
    }
    expect(world.walkers.get('c-1')?.state).toBe('browsing');

    // Evolve Eevee -> Vaporeon, heal Psyduck, hatch a Togepi, and spawn shopper #2
    const vaporeon = makePokemon({ uid: 'eevee', speciesId: 134, penIndex: 0, origin: 'evolved' });
    const healedPsyduck = makePokemon({
      uid: 'psyduck',
      speciesId: 54,
      location: 'pen',
      penIndex: 1,
      healingProgress: 100,
      needsRecovery: false,
    });
    const hatchedTogepi = makePokemon({
      uid: 'togepi',
      speciesId: 175,
      location: 'pen',
      penIndex: 2,
      origin: 'hatched',
    });

    const secondSnap = buildFloorSnapshot(
      'p1',
      1800,
      1,
      [vaporeon, healedPsyduck, hatchedTogepi],
      [customer],
    );
    const secondEvents = syncWorld(world, secondSnap, layout, rng);
    expect(secondEvents.evolutions).toBe(1);
    expect(secondEvents.heals).toBe(1);
    expect(secondEvents.hatches).toBe(1);
    expect(world.particles.length).toBeGreaterThan(5);

    // Sell Vaporeon (removed from pokemon list + cash increased) & remove customer
    const saleSnap = buildFloorSnapshot('p1', 2950, 1, [healedPsyduck, hatchedTogepi], []);
    const saleEvents = syncWorld(world, saleSnap, layout, rng);
    expect(saleEvents.sales).toBe(1);
    expect(world.particles.some((p) => p.kind === 'coin' && p.label === '+₽1,150')).toBe(true);
    expect(world.walkers.get('c-1')?.state).toBe('leaving');
    expect(world.walkers.get('c-1')?.happy).toBe(true);

    // Step until leaving shopper exits through the door
    for (let i = 0; i < Math.ceil((WALK_DURATION + 0.5) / 0.05); i += 1) {
      stepWorld(world, 0.05, layout, rng);
    }
    expect(world.walkers.size).toBe(0);
  });

  it('honors motionPaused, reducedMotion, relayoutWorld, and hitTestPokemon', () => {
    const rng = createSeededRng(22);
    const layout = computeShopLayout(800, 3, 2, 1);
    const world = createWorld();
    const shinyMon = makePokemon({ uid: 'shinx', speciesId: 403, isShiny: true, penIndex: 0 });

    syncWorld(world, buildFloorSnapshot('p1', 1000, 1, [shinyMon], []), layout, rng);
    const ent = world.pokemon.get('shinx')!;

    // Hit-test succeeds on sprite center and returns null far away
    expect(hitTestPokemon(world, layout, ent.x, ent.y - layout.spriteSize * 0.4)).toBe('shinx');
    expect(hitTestPokemon(world, layout, 0, 0)).toBeNull();

    // motionPaused freezes world.time and particles
    world.motionPaused = true;
    const prevTime = world.time;
    stepWorld(world, 0.05, layout, rng);
    expect(world.time).toBe(prevTime);

    // reducedMotion keeps Pokémon in idle state without ambient sparkles
    world.motionPaused = false;
    world.reducedMotion = true;
    stepWorld(world, 5.0, layout, rng);
    expect(ent.state).toBe('idle');

    // relayoutWorld re-anchors cleanly on mobile resize
    const mobileLayout = computeShopLayout(390, 3, 2, 2);
    relayoutWorld(world, mobileLayout, rng);
    expect(hitTestPokemon(world, mobileLayout, ent.x, ent.y - mobileLayout.spriteSize * 0.3)).toBe(
      'shinx',
    );
  });
});

describe('2D Canvas Pixel Renderer & ShopFloorPreview UI', () => {
  it('enforces imageSmoothingEnabled = false and draws sprites, flips, walkers, and lighting', () => {
    const layout = computeShopLayout(720, 3, 2, 1);
    const world = createWorld();
    const rng = createSeededRng(88);

    const penMon = makePokemon({ uid: 'eevee', speciesId: 133, penIndex: 0 });
    const napMon = makePokemon({
      uid: 'psyduck',
      speciesId: 54,
      location: 'healing',
      penIndex: null,
      needsRecovery: true,
    });
    const customer = makeCustomer({ uid: 'c-1', targetPenIndex: 0 });
    syncWorld(world, buildFloorSnapshot('p1', 1800, 1, [penMon, napMon], [customer]), layout, rng);
    world.pokemon.get('eevee')!.facing = -1; // Verify horizontal mirror branch
    world.particles.push(spawnCoin(200, 150, layout.unit, '+₽800'));

    const mockGradient = { addColorStop: vi.fn() };
    const ctx = {
      imageSmoothingEnabled: true,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#000',
      strokeStyle: '#000',
      font: '',
      textBaseline: 'alphabetic',
      textAlign: 'start',
      lineWidth: 1,
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      measureText: vi.fn(() => ({ width: 32 })),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      createRadialGradient: vi.fn(() => mockGradient),
    } as unknown as CanvasRenderingContext2D;

    const fakeImage = {} as CanvasImageSource;
    const adapter: SpriteEntityAdapter = {
      getFrame: () => ({ image: fakeImage, sx: 0, sy: 0, sw: 80, sh: 80, facesLeft: true }),
    };

    renderScene(ctx, layout, world, null, adapter, { shiftRunning: false, hoverUid: 'eevee' });

    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.drawImage).toHaveBeenCalled();
    const scaleCalls = (ctx.scale as ReturnType<typeof vi.fn>).mock.calls;
    expect(scaleCalls.some(([sx, sy]) => sx < 0 && sy > 0)).toBe(true);

    // Reduced-motion frame freezes breathing/squish at exact (-1, 1) flip
    world.reducedMotion = true;
    (ctx.scale as ReturnType<typeof vi.fn>).mockClear();
    renderScene(ctx, layout, world, null, adapter, { shiftRunning: true, hoverUid: null });
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  });

  it('renders ShopFloorCanvas with pixel-art class, pause toggle, and inspect callback', async () => {
    const user = userEvent.setup();
    const onInspect = vi.fn();

    render(
      <ShopFloorPreview
        profileId="p1"
        cash={1800}
        shiftSpeed={1}
        penCapacity={3}
        napBedCapacity={2}
        pokemon={[makePokemon()]}
        customers={[makeCustomer()]}
        shiftRunning={true}
        cafeDecorLevel={1}
        onInspectPokemon={onInspect}
      />,
    );

    const canvas = screen.getByTestId('shop-floor-canvas');
    expect(canvas).toHaveClass('pixel-art');
    expect(canvas).toHaveAttribute('role', 'img');

    const pauseBtn = screen.getByRole('button', { name: 'Pause animation' });
    await user.click(pauseBtn);
    expect(screen.getByRole('button', { name: 'Play animation' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pen 1: Eevee/i }));
    expect(onInspect).toHaveBeenCalledWith('mon-1');
  });
});
