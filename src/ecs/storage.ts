import type { CreatureBlueprint, CreatureKind } from '../registry/species';
import type { DecorKind } from '../registry/decor';
import type { CameraViewMode, LightingPreset, SimulationMode } from './traits';

const STORAGE_KEY = 'oceanica_aquarium_v1';

export interface SavedCreature {
  name: string;
  speciesId: string;
  kind: CreatureKind;
  blueprint: CreatureBlueprint;
  position: { x: number; y: number; z: number };
  growth: number;
  ageMinutes: number;
  fullness: number;
  health: number;
  energy: number;
  alive: boolean;
}

export interface SavedDecor {
  kind: DecorKind;
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: number;
  flipped: boolean;
}

export interface SavedAquariumState {
  version: 1;
  savedAt: number;
  env: {
    mode: SimulationMode;
    cameraMode: CameraViewMode;
    oxygen: number;
    cleanliness: number;
    temperature: number;
    algaeLevel: number;
    carePoints: number;
    lightingPhase: LightingPreset;
    pixelArt?: boolean;
    pixelScale?: 'chunky' | 'crisp';
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
    if (parsed?.version !== 1 || !Array.isArray(parsed.creatures) || !Array.isArray(parsed.decor)) {
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
