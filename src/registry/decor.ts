export type DecorKind =
  | 'cactus'
  | 'anubias'
  | 'java_fern'
  | 'marimo'
  | 'river_rock'
  | 'driftwood'
  | 'bubbler';

export interface TankDimensions {
  width: number;
  height: number;
  depth: number;
  halfW: number;
  halfD: number;
  floorY: number;
  surfaceY: number;
}

export const TANK_BOUNDS: TankDimensions = {
  width: 10,
  height: 5.2,
  depth: 6,
  halfW: 4.8,
  halfD: 2.8,
  floorY: -2.25,
  surfaceY: 2.15,
};

export interface DecorBlueprint {
  kind: DecorKind;
  label: string;
  category: 'plant' | 'hardscape' | 'novelty' | 'equipment';
  radius: number;
  height: number;
  oxygenBoost: number; // Daytime O2 contribution
  clarityBuffer: number; // Reduces waste/nitrate spike
  emitsBubbles: boolean;
  isSwaying: boolean;
  cost: number;
  description: string;
}

export const DECOR_CATALOG: Record<DecorKind, DecorBlueprint> = {
  anubias: {
    kind: 'anubias',
    label: 'Anubias barteri',
    category: 'plant',
    radius: 0.65,
    height: 1.15,
    oxygenBoost: 0.22,
    clarityBuffer: 0.12,
    emitsBubbles: false,
    isSwaying: true,
    cost: 12,
    description: 'Tough broad-leaf epiphyte anchored to stone. Serves as a Betta hammock and resists Goldfish nibbling.',
  },
  java_fern: {
    kind: 'java_fern',
    label: 'Java Fern',
    category: 'plant',
    radius: 0.72,
    height: 1.85,
    oxygenBoost: 0.3,
    clarityBuffer: 0.18,
    emitsBubbles: false,
    isSwaying: true,
    cost: 15,
    description: 'Flowing vertical lance fronds that sway smoothly in the water column and shield shy fish.',
  },
  marimo: {
    kind: 'marimo',
    label: 'Marimo Moss Ball',
    category: 'plant',
    radius: 0.36,
    height: 0.45,
    oxygenBoost: 0.12,
    clarityBuffer: 0.14,
    emitsBubbles: false,
    isSwaying: false,
    cost: 8,
    description: 'Velvety green algae sphere that absorbs nitrates and withstands playful Goldfish nudges.',
  },
  cactus: {
    kind: 'cactus',
    label: 'Underwater Cactus',
    category: 'novelty',
    radius: 0.58,
    height: 1.65,
    oxygenBoost: 0.04,
    clarityBuffer: 0,
    emitsBubbles: false,
    isSwaying: false,
    cost: 18,
    description: 'Whimsical ceramic-coated aquatic saguaro with a tiny blossom. Fish steer cleanly around its arms!',
  },
  river_rock: {
    kind: 'river_rock',
    label: 'River Stones',
    category: 'hardscape',
    radius: 0.72,
    height: 0.65,
    oxygenBoost: 0,
    clarityBuffer: 0,
    emitsBubbles: false,
    isSwaying: false,
    cost: 8,
    description: 'Smooth stacked river pebbles providing natural epiphyte anchors and snail grazing surfaces.',
  },
  driftwood: {
    kind: 'driftwood',
    label: 'Driftwood Branch',
    category: 'hardscape',
    radius: 0.85,
    height: 1.35,
    oxygenBoost: 0,
    clarityBuffer: 0.05,
    emitsBubbles: false,
    isSwaying: false,
    cost: 16,
    description: 'Sculpted submerged wood branch creating vertical swim-through structure.',
  },
  bubbler: {
    kind: 'bubbler',
    label: 'Aerator Bubbler',
    category: 'equipment',
    radius: 0.35,
    height: 0.35,
    oxygenBoost: 0.65,
    clarityBuffer: 0.08,
    emitsBubbles: true,
    isSwaying: false,
    cost: 20,
    description: 'Porous air stone emitting steady columns of rising bubbles to boost dissolved oxygen.',
  },
};
