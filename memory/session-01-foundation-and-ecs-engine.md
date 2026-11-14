# Session 01 — Discovery, Biological Research & Core 3D/ECS Scaffold

- **Date:** 2026-11-13 (`20:29 – 21:08 UTC+8` / `12:29 – 13:08 UTC`)
- **Conversation ID:** `348c473b-e7d8-4119-bd32-b6a5bd489bf6`

## Objectives
1. Design a soothing, customizable virtual aquarium featuring Koi, Betta fish, Goldfish, freshwater snails, aquatic plants, and novelty decor (such as an underwater cactus).
2. Gather accurate biological profiles (coloration, dimensions, unique abilities, swimming gaits, lifespan, dietary/water needs) for each species and plant.
3. Architect a modular Entity Component System (ECS) + 3D viewport supporting both Side and Top views without stiff rigid-body fish rotation.
4. Initialize and scaffold the Oceanica web application in `c:\Users\user\Documents\ANDREI_FILES\DEVFILES\PROJECTS\oceanica`.

## Key Outcomes & Implemented Structure
- **Species Registry (`src/registry/species.ts`):** Defined `SPECIES_CATALOG` and modular `createCustomFishBlueprint` covering 8 preset varieties (`koi_kohaku`, `koi_sanke`, `betta_halfmoon`, `betta_plakat`, `goldfish_oranda`, `goldfish_comet`, `snail_mystery`, `snail_nerite`), preferred depths, temperature tolerances, morphologies (`fusiform`, `compressiform`, `globiform`, `snail`), and movement bounds.
- **Decor & Tank Bounds Registry (`src/registry/decor.ts`):** Defined `TANK_BOUNDS` (`10 × 5.2 × 6`) and `DECOR_CATALOG` spanning epiphytes (`anubias`, `java_fern`), `marimo`, hardscape (`river_rock`, `driftwood`), equipment (`bubbler`), and novelty `cactus`, with oxygen boost, clarity buffer, obstacle radius/height, and sway metadata.
- **Dual-Mode Koota ECS (`src/ecs/`):**
  - `src/ecs/traits.ts`: World singletons (`TankEnvironment`, `TankAlerts`) and entity traits (`Position`, `Velocity`, `CreatureMeta`, `CreatureDna`, `CreatureVitals`, `SpineKinematics`, `SnailLocomotion`, `DecorItem`, `FoodPellet`, `WaterRipple`).
  - `src/ecs/systems/`: `movementSystem.ts` (constrained 12-joint `SPINE_JOINT_COUNT` vertebrae chain with travelling sinusoidal propulsion), `snailSystem.ts` (floor/wall gliding + parasnailing within bounds), `foodSystem.ts` (pellet sinking & ripple ring lifecycle), and `ecosystemSystem.ts` (evaluates thermal/bioload/oxygen health warnings in `realistic` mode while keeping `sandbox` stress-free).
  - `src/ecs/world.ts` & `src/ecs/storage.ts`: Starter tank population (`populateStarterTank`), `spawnCreatureEntity`, `dropFoodPellets`, `serializeWorldState`, and `localStorage` auto-save under `oceanica_aquarium_v1`.
- **UI & 3D Scene (`src/App.tsx`, `src/scene/`, `src/ui/`):** Wired `AquariumScene`, `CameraRig` (`side` / `top` / `free` camera modes), `ProceduralFishMesh`, `SnailMesh`, `DecorMesh`, `FoodAndRipples`, `TankEnvironmentScene`, `TopBar`, `VitalsPanel`, `CreatureInspector`, `DecorDock`, `CreatorModal`, and `ambientAudio.ts`.
- **Simulation Tests (`src/ecs/__tests__/simulation.test.ts`):** Added Vitest coverage for starter population, constrained 3D spine spacing + feeding, snail floor bounds, and Sandbox vs. Realistic mode rules.
