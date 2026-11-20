import type { CreatureBlueprint, CreatureKind } from '../registry/species';
import type { BiomeId, DecorKind } from '../registry/decor';
import type {
  CameraViewMode,
  CreatureMood,
  LifeStage,
  LightingPreset,
  PlantStage,
  SimulationMode,
} from './traits';

const STORAGE_KEY = 'oceanica_aquarium_v2';

export interface SavedCreature {
  name: string;
  speciesId: string;
  kind: CreatureKind;
  blueprint: CreatureBlueprint;
  position: { x: number; y: number; z: number };
  growth: number;
  ageMinutes: number;
  lifeStage?: LifeStage;
  generation?: number;
  breedCooldown?: number;
  fullness: number;
  health: number;
  energy: number;
  stress?: number;
  alive: boolean;
  gillRate?: number;
  finIntegrity?: number;
  colorVibrancy?: number;
  mind?: {
    mood: CreatureMood;
    thought: string;
    trust: number;
    curiosity: number;
    security: number;
    social: number;
  };
}

export interface SavedPlantSnapshot {
  health: number;
  growth: number;
  nutrients: number;
  chlorophyll: number;
  droop: number;
  ageMinutes: number;
  stage: PlantStage;
  generation: number;
  propagateCooldown: number;
  oxygenOutput: number;
}

export interface SavedDecor {
  kind: DecorKind;
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: number;
  flipped: boolean;
  plant?: SavedPlantSnapshot;
}

export interface SavedAquariumState {
  version: 2;
  savedAt: number;
  env: {
    mode: SimulationMode;
    biome: BiomeId;
    cameraMode: CameraViewMode;
    salinity: number;
    ph: number;
    co2: number;
    ammonia: number;
    nitrite: number;
    nitrate: number;
    biofilterMaturity: number;
    currentStrength: number;
    oxygen: number;
    cleanliness: number;
    temperature: number;
    algaeLevel: number;
    carePoints: number;
    lightingPhase: LightingPreset;
  };
  creatures: SavedCreature[];
  decor: SavedDecor[];
}

export function loadAquariumState(): SavedAquariumState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedAquariumState;
    if (parsed?.version !== 2 || !Array.isArray(parsed.creatures) || !Array.isArray(parsed.decor)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAquariumState(state: SavedAquariumState): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully.
  }
}

export function clearAquariumState(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors gracefully.
  }
}
