/**
 * Unit tests for PMD `AnimData.xml` parsing, `CopyOf` inheritance, 8-directional
 * vector mapping, 60 fps frame-duration slicing, 1-row Sleep clamping, and loader gating.
 */
import { describe, expect, it } from 'vitest';
import {
  computePmdFrameIndexFromMs,
  computePmdFrameRect,
  parseAnimDataXml,
  vectorToPmdDirection,
} from '../../src/canvas/pmdAnimator';
import {
  SPRITECOLLAB_RAW_BASE,
  getPmdAnimXmlUrl,
  getPmdPortraitUrl,
  getPmdSheetUrl,
  resolvePmdSheetSpec,
} from '../../src/canvas/pmdLoader';

const SAMPLE_XML = `<?xml version="1.0"?>
<AnimData>
  <ShadowSize>2</ShadowSize>
  <Anims>
    <Anim>
      <Name>Walk</Name>
      <FrameWidth>32</FrameWidth>
      <FrameHeight>40</FrameHeight>
      <Durations>
        <Duration>6</Duration>
        <Duration>12</Duration>
      </Durations>
    </Anim>
    <Anim>
      <Name>Idle</Name>
      <CopyOf>Walk</CopyOf>
    </Anim>
    <Anim>
      <Name>Sleep</Name>
      <FrameWidth>32</FrameWidth>
      <FrameHeight>24</FrameHeight>
      <Durations>
        <Duration>30</Duration>
        <Duration>30</Duration>
      </Durations>
    </Anim>
  </Anims>
</AnimData>`;

describe('PMD AnimData.xml Parser & Frame Slicer', () => {
  it('parses frame geometry, durations, ShadowSize, and CopyOf chains cleanly', () => {
    const parsed = parseAnimDataXml(SAMPLE_XML);
    expect(parsed.shadowSize).toBe(2);
    expect(parsed.anims.Walk.frameWidth).toBe(32);
    expect(parsed.anims.Walk.frameHeight).toBe(40);
    expect(parsed.anims.Walk.totalTicks).toBe(18);

    // CopyOf inherits Walk dimensions, durations, and source sheet
    expect(parsed.anims.Idle.sourceAnim).toBe('Walk');
    expect(parsed.anims.Idle.frameWidth).toBe(32);
    expect(parsed.anims.Idle.durations).toEqual([6, 12]);
  });

  it('maps 2D movement vectors to all 8 PMD direction rows (0=S..7=SW)', () => {
    expect(vectorToPmdDirection(0, 5)).toBe(0); // South (+Y)
    expect(vectorToPmdDirection(5, 5)).toBe(1); // SE
    expect(vectorToPmdDirection(5, 0)).toBe(2); // East (+X)
    expect(vectorToPmdDirection(5, -5)).toBe(3); // NE
    expect(vectorToPmdDirection(0, -5)).toBe(4); // North (-Y)
    expect(vectorToPmdDirection(-5, -5)).toBe(5); // NW
    expect(vectorToPmdDirection(-5, 0)).toBe(6); // West (-X)
    expect(vectorToPmdDirection(-5, 5)).toBe(7); // SW
    expect(vectorToPmdDirection(0.05, 0.05, 4)).toBe(4); // Preserves fallback below threshold
  });

  it('advances frames strictly by 60 fps ticks and clamps 1-row Sleep sheets to row 0', () => {
    const parsed = parseAnimDataXml(SAMPLE_XML);

    // At 0.05s = 3 ticks -> still in Walk frame 0 (Duration 6), East row = 2
    const f0 = computePmdFrameRect(parsed.anims.Walk, 64, 320, 2, 0.05);
    expect(f0.frameIndex).toBe(0);
    expect(f0.rowIndex).toBe(2);
    expect(f0.sx).toBe(0);
    expect(f0.sy).toBe(80);

    // At 0.15s = 9 ticks -> in Walk frame 1 (6..18)
    const f1 = computePmdFrameRect(parsed.anims.Walk, 64, 320, 2, 0.15);
    expect(f1.frameIndex).toBe(1);
    expect(f1.sx).toBe(32);

    // Sleep is a 1-row sheet (height 24 = 1 row) -> clamps direction 6 cleanly to row 0
    const sleepSlice = computePmdFrameRect(parsed.anims.Sleep, 64, 24, 6, 0.6);
    expect(sleepSlice.rowIndex).toBe(0);
    expect(sleepSlice.frameIndex).toBe(1);

    // Millisecond conversion matches PMD 60 fps ticks (6 + 12 = 18 ticks = 300ms loop)
    expect(computePmdFrameIndexFromMs(parsed.anims.Walk, 0, 2)).toBe(0);
    expect(computePmdFrameIndexFromMs(parsed.anims.Walk, 50, 2)).toBe(0);
    expect(computePmdFrameIndexFromMs(parsed.anims.Walk, 150, 2)).toBe(1);
    expect(computePmdFrameIndexFromMs(parsed.anims.Walk, 350, 2)).toBe(0);
  });
});

describe('Hybrid PMD SpriteCollab Loader & Zero-404 URLs', () => {
  it('resolves bundled local core assets for Kecleon/Eevee and remote URLs for other species', () => {
    expect(getPmdPortraitUrl(352, false)).toBe('./assets/pmd/0352/Normal.png');
    expect(getPmdPortraitUrl(133, false)).toBe('./assets/pmd/0133/Normal.png');
    expect(getPmdAnimXmlUrl(352)).toBe('./assets/pmd/0352/AnimData.xml');
    expect(getPmdSheetUrl(133, 'Walk', false)).toBe('./assets/pmd/0133/Walk-Anim.png');

    // Non-core species (#493 Arceus) and shiny portraits load via SpriteCollab GitHub Raw
    expect(getPmdPortraitUrl(493, false)).toBe(
      `${SPRITECOLLAB_RAW_BASE}/portrait/0493/Normal.png`,
    );
    expect(getPmdPortraitUrl(133, true)).toBe(
      `${SPRITECOLLAB_RAW_BASE}/portrait/0133/0000/0001/Normal.png`,
    );
    expect(getPmdAnimXmlUrl(493)).toBe(`${SPRITECOLLAB_RAW_BASE}/sprite/0493/AnimData.xml`);

    const spec = resolvePmdSheetSpec(493, true, 'hop');
    expect(spec.useShinyFolder).toBe(true);
    expect(spec.animKey).toBe('Hop');
  });
});
