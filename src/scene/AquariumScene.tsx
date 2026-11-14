import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useQuery, useTrait, useWorld } from 'koota/react';
import { runEcosystemSystem } from '../ecs/systems/ecosystemSystem';
import { runFoodAndRippleSystem } from '../ecs/systems/foodSystem';
import { runMovementSystem } from '../ecs/systems/movementSystem';
import { runSnailSystem } from '../ecs/systems/snailSystem';
import { persistWorldState } from '../ecs/world';
import {
  IsDecor,
  IsFish,
  IsFood,
  IsRipple,
  IsSnail,
  TankEnvironment,
} from '../ecs/traits';
import { CameraRig } from './CameraRig';
import { DecorMesh } from './DecorMesh';
import { FoodMesh, RippleMesh } from './FoodAndRipples';
import { PixelArtPass } from './PixelArtPass';
import { ProceduralFishMesh } from './ProceduralFishMesh';
import { SnailMesh } from './SnailMesh';
import { TankEnvironmentScene } from './TankEnvironment';

function SimulationLoop() {
  const world = useWorld();
  const ecoTimer = useRef(0);
  const saveTimer = useRef(0);

  useFrame((_, dt) => {
    runMovementSystem(world, dt);
    runSnailSystem(world, dt);
    runFoodAndRippleSystem(world, dt);

    ecoTimer.current += dt;
    if (ecoTimer.current >= 0.5) {
      runEcosystemSystem(world, ecoTimer.current);
      ecoTimer.current = 0;
    }

    saveTimer.current += dt;
    if (saveTimer.current >= 8) {
      persistWorldState(world);
      saveTimer.current = 0;
    }
  });

  return null;
}

function SceneEntities() {
  const world = useWorld();
  const env = useTrait(world, TankEnvironment);
  const fish = useQuery(IsFish);
  const snails = useQuery(IsSnail);
  const decor = useQuery(IsDecor);
  const foods = useQuery(IsFood);
  const ripples = useQuery(IsRipple);

  const selectedId = env?.selectedEntityId ?? -1;
  const pixelArt = env?.pixelArt ?? true;
  const pixelHeight = env?.pixelScale === 'chunky' ? 148 : 216;

  return (
    <>
      <SimulationLoop />
      <CameraRig />
      <TankEnvironmentScene />
      <PixelArtPass enabled={pixelArt} pixelHeight={pixelHeight} />

      {fish.map((entity) => (
        <ProceduralFishMesh key={entity} entity={entity} selected={entity.id() === selectedId} />
      ))}

      {snails.map((entity) => (
        <SnailMesh key={entity} entity={entity} selected={entity.id() === selectedId} />
      ))}

      {decor.map((entity) => (
        <DecorMesh key={entity} entity={entity} selected={entity.id() === selectedId} />
      ))}

      {foods.map((entity) => (
        <FoodMesh key={entity} entity={entity} />
      ))}

      {ripples.map((entity) => (
        <RippleMesh key={entity} entity={entity} />
      ))}
    </>
  );
}

export function AquariumScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.35, 11.4], fov: 42, near: 0.1, far: 60 }}
      >
        <SceneEntities />
      </Canvas>
    </div>
  );
}
