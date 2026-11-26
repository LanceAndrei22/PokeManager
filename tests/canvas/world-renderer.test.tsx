/**
 * Unit and component tests for the indoor world state machine, 2D indoor pixel renderer,
 * queued counter shoppers with sweat-drop particles, interactive hit-testing, and ShopCanvas.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIndoorScene } from '../../src/canvas/indoorRenderer';
import { computeIndoorLayout, computeShopLayout } from '../../src/canvas/layout';
import { spawnCoin, spawnSweatDrop } from '../../src/canvas/particles';
import { renderScene } from '../../src/canvas/renderer';
import { ShopCanvas } from '../../src/canvas/ShopCanvas';
import type { SpriteEntityAdapter } from '../../src/canvas/types';
import {
  WALK_DURATION,
  buildFloorSnapshot,
  createWorld,
  hitTestIndoorScene,
  hitTestPokemon,
  relayoutWorld,
  stepWorld,
  syncWorld,
} from '../../src/canvas/world';
import type { CounterOffer, PokemonInstance, ShopCustomer } from '../../src/data/types';
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
  npcSpeciesId: 279,
  npcPaddedId: '0279',
  name: 'Cheryl (Pelipper)',
  targetPenIndex: 0,
  statusText: 'Admiring Eevee...',
  ticksRemaining: 3,
  ...overrides,
});

const makeCounterOffer = (overrides: Partial<CounterOffer> = {}): CounterOffer => ({
  uid: 'offer-1',
  customerUid: 'cust-q-1',
  archetypeId: 'cozy-collector',
  npcSpeciesId: 40,
  npcPaddedId: '0040',
  customerName: 'Mina (Wigglytuff)',
  pokemonUid: 'mon-1',
  speciesId: 133,
  isShiny: false,
  penIndex: 0,
  fairValue: 1100,
  initialOffer: 1100,
  currentOffer: 1100,
  haggleAttempts: 0,
  maxHaggleAttempts: 2,
  patience: 2,
  maxPatience: 10,
  trendMatched: true,
  archetypeMatched: true,
  isVip: false,
  ...overrides,
});

function createMockContext(): CanvasRenderingContext2D {
  const mockGradient = { addColorStop: vi.fn() };
  return {
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
    strokeRect: vi.fn(),
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
}

describe('Shop World State Machine', () => {
  it('diffs snapshots for silent init, adoption sales, heals, evolutions, hatches, and queued counter shoppers', () => {
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

    const firstSnap = buildFloorSnapshot('p1', 1800, 1, [eevee, stray], [customer]);
    const firstEvents = syncWorld(world, firstSnap, layout, rng);
    expect(firstEvents).toEqual({ sales: 0, heals: 0, evolutions: 0, hatches: 0 });
    expect(world.pokemon.size).toBe(2);
    expect(world.walkers.size).toBe(1);
    expect(world.particles).toHaveLength(0);

    for (let i = 0; i < 60; i += 1) {
      stepWorld(world, 0.05, layout, rng);
    }
    expect(world.walkers.get('c-1')?.state).toBe('browsing');

    // Evolve Eevee -> Vaporeon, heal Psyduck, hatch a Togepi, and spawn queued offer with low patience
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
    const lowPatienceOffer = makeCounterOffer({ uid: 'offer-low', patience: 2, maxPatience: 10 });

    const secondSnap = buildFloorSnapshot(
      'p1',
      1800,
      1,
      [vaporeon, healedPsyduck, hatchedTogepi],
      [customer],
      [lowPatienceOffer],
    );
    const secondEvents = syncWorld(world, secondSnap, layout, rng);
    expect(secondEvents.evolutions).toBe(1);
    expect(secondEvents.heals).toBe(1);
    expect(secondEvents.hatches).toBe(1);
    expect(world.queuedShoppers.size).toBe(1);

    // Low patience shopper spawns sweat-drop particles on stepWorld
    stepWorld(world, 0.5, layout, rng);
    expect(world.particles.some((p) => p.kind === 'sweat')).toBe(true);

    // Hit-test queued shopper and stations
    const qEnt = world.queuedShoppers.get('offer-low')!;
    const hitOffer = hitTestIndoorScene(world, layout, qEnt.x, qEnt.y - 4);
    expect(hitOffer?.kind).toBe('counter-offer');

    const hitPc = hitTestIndoorScene(
      world,
      layout,
      layout.pcStation.x + 8,
      layout.pcStation.y + 8,
    );
    expect(hitPc).toEqual(expect.objectContaining({ kind: 'station', station: 'wholesale' }));

    // Sell Vaporeon and resolve queue -> coin particle spawns
    const saleSnap = buildFloorSnapshot('p1', 2950, 1, [healedPsyduck, hatchedTogepi], [], []);
    const saleEvents = syncWorld(world, saleSnap, layout, rng);
    expect(saleEvents.sales).toBe(1);
    expect(world.particles.some((p) => p.kind === 'coin' && p.label === '+₽1,150')).toBe(true);
    expect(world.queuedShoppers.size).toBe(0);
    expect(world.walkers.get('c-1')?.state).toBe('leaving');

    for (let i = 0; i < Math.ceil((WALK_DURATION + 0.5) / 0.05); i += 1) {
      stepWorld(world, 0.05, layout, rng);
    }
    expect(world.walkers.size).toBe(0);
  });

  it('honors motionPaused, reducedMotion, relayoutWorld, and hitTestPokemon', () => {
    const rng = createSeededRng(22);
    const layout = computeIndoorLayout(1280, 800, 3, 2, 1);
    const world = createWorld();
    const shinyMon = makePokemon({ uid: 'shinx', speciesId: 403, isShiny: true, penIndex: 0 });

    syncWorld(world, buildFloorSnapshot('p1', 1000, 1, [shinyMon], []), layout, rng);
    const ent = world.pokemon.get('shinx')!;

    expect(hitTestPokemon(world, layout, ent.x, ent.y - layout.spriteSize * 0.4)).toBe('shinx');
    expect(hitTestPokemon(world, layout, 0, 0)).toBeNull();
    expect(
      hitTestIndoorScene(world, layout, layout.pens[2].x + 12, layout.pens[2].y + 12),
    ).toEqual(expect.objectContaining({ kind: 'empty-pen', penIndex: 2 }));

    world.motionPaused = true;
    const prevTime = world.time;
    stepWorld(world, 0.05, layout, rng);
    expect(world.time).toBe(prevTime);

    world.motionPaused = false;
    world.reducedMotion = true;
    stepWorld(world, 5.0, layout, rng);
    expect(ent.state).toBe('idle');

    const mobileLayout = computeIndoorLayout(390, 844, 3, 2, 2);
    relayoutWorld(world, mobileLayout, rng);
    expect(hitTestPokemon(world, mobileLayout, ent.x, ent.y - mobileLayout.spriteSize * 0.3)).toBe(
      'shinx',
    );
  });
});

describe('2D Canvas Indoor Pixel Renderer & ShopCanvas UI', () => {
  it('enforces imageSmoothingEnabled = false and draws Kecleon, queued shoppers, stations, and sprites', () => {
    const layout = computeIndoorLayout(1024, 768, 3, 2, 1);
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
    const offer = makeCounterOffer({ uid: 'offer-q1', patience: 3, maxPatience: 10 });
    syncWorld(
      world,
      buildFloorSnapshot('p1', 1800, 1, [penMon, napMon], [customer], [offer]),
      layout,
      rng,
    );
    world.pokemon.get('eevee')!.facing = -1;
    world.particles.push(spawnCoin(200, 150, layout.unit, '+₽800'));
    world.particles.push(spawnSweatDrop(210, 160, layout.unit, rng));

    const ctx = createMockContext();
    const fakeImage = {} as CanvasImageSource;
    const getFrame = vi.fn(() => ({
      image: fakeImage,
      sx: 0,
      sy: 0,
      sw: 32,
      sh: 32,
      usesDirectionRow: true,
      facesLeft: true,
    }));
    const adapter: SpriteEntityAdapter = { getFrame };

    renderIndoorScene(ctx, layout, world, null, adapter, {
      shiftRunning: true,
      hoverTarget: { kind: 'station', station: 'wholesale', label: 'Wholesale PC Terminal' },
    });

    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.drawImage).toHaveBeenCalled();
    // Verifies Kecleon (#352 South=0), browsing shopper (#279), and queued counter shopper (#40 North=4)
    expect(getFrame).toHaveBeenCalledWith(352, false, 'idle', expect.any(Number), 0);
    expect(getFrame).toHaveBeenCalledWith(279, false, 'walk', expect.any(Number), expect.any(Number));
    expect(getFrame).toHaveBeenCalledWith(40, false, 'idle', expect.any(Number), 4);

    // Also confirm legacy renderer still honors reducedMotion static scale
    world.reducedMotion = true;
    const staticCtx = createMockContext();
    renderScene(staticCtx, layout, world, null, {
      getFrame: () => ({
        image: fakeImage,
        sx: 0,
        sy: 0,
        sw: 80,
        sh: 80,
        usesDirectionRow: false,
        facesLeft: true,
      }),
    }, { shiftRunning: false, hoverUid: null });
    expect(staticCtx.scale).toHaveBeenCalledWith(-1, 1);
  });

  it('renders full-viewport ShopCanvas with pixel-art class and click target callbacks', () => {
    const onSelectTarget = vi.fn();

    render(
      <ShopCanvas
        profileId="p1"
        cash={1800}
        shiftSpeed={1}
        shiftRunning={true}
        pokemon={[makePokemon()]}
        customers={[makeCustomer()]}
        counterQueue={[]}
        eggs={[]}
        wholesaleCatalog={[]}
        penCapacity={3}
        napBedCapacity={2}
        motionPaused={false}
        onSelectTarget={onSelectTarget}
      />,
    );

    const canvas = screen.getByTestId('shop-floor-canvas') as HTMLCanvasElement;
    expect(canvas).toHaveClass('pixel-art');
    expect(canvas).toHaveAttribute('role', 'img');

    // Match jsdom default viewport dimensions (window.innerWidth × window.innerHeight)
    const cssW = window.innerWidth || 1024;
    const cssH = window.innerHeight || 768;
    const indoorLayout = computeIndoorLayout(cssW, cssH, 3, 2, 1);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: cssW,
      height: cssH,
      right: cssW,
      bottom: cssH,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(canvas, {
      clientX: indoorLayout.pcStation.x / indoorLayout.dpr + 20,
      clientY: indoorLayout.pcStation.y / indoorLayout.dpr + 20,
    });
    expect(onSelectTarget).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'station', station: 'wholesale' }),
    );
  });
});
