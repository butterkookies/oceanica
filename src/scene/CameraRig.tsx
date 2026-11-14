import { useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTrait, useWorld } from 'koota/react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { TANK_BOUNDS } from '../registry/decor';
import { dropFoodPellets, persistWorldState, spawnDecorEntity } from '../ecs/world';
import {
  IsDecor,
  IsFish,
  IsSnail,
  Position,
  TankEnvironment,
} from '../ecs/traits';

const SIDE_CAM_POS = new THREE.Vector3(0, 0.35, 11.4);
const SIDE_TARGET = new THREE.Vector3(0, -0.1, 0);
const TOP_CAM_POS = new THREE.Vector3(0, 10.6, 0.01);
const TOP_TARGET = new THREE.Vector3(0, -0.4, 0);

export function CameraRig() {
  const world = useWorld();
  const env = useTrait(world, TankEnvironment);
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const desiredPos = useRef(new THREE.Vector3().copy(SIDE_CAM_POS));
  const desiredTarget = useRef(new THREE.Vector3().copy(SIDE_TARGET));

  useFrame((_, dt) => {
    const currentEnv = world.get(TankEnvironment);
    const controls = controlsRef.current;
    if (!currentEnv || !controls) return;

    const lerpFactor = Math.min(1, dt * 4.5);

    // Follow-Cam overrides preset viewpoints when locked onto a creature
    if (currentEnv.followEntityId >= 0) {
      const targetEntity = [
        ...world.query(IsFish, Position),
        ...world.query(IsSnail, Position),
      ].find((e) => e.id() === currentEnv.followEntityId);

      if (targetEntity) {
        const pos = targetEntity.get(Position)!;
        desiredTarget.current.set(pos.x, pos.y, pos.z);
        if (currentEnv.cameraMode === 'top') {
          desiredPos.current.set(pos.x, pos.y + 4.4, pos.z + 0.01);
        } else {
          desiredPos.current.set(pos.x + 0.6, pos.y + 0.45, Math.min(TANK_BOUNDS.halfD + 3.2, pos.z + 3.4));
        }
        camera.position.lerp(desiredPos.current, lerpFactor);
        controls.target.lerp(desiredTarget.current, lerpFactor);
        controls.update();
        return;
      } else {
        world.set(TankEnvironment, { followEntityId: -1 });
      }
    }

    if (currentEnv.cameraMode === 'side') {
      camera.position.lerp(SIDE_CAM_POS, lerpFactor);
      controls.target.lerp(SIDE_TARGET, lerpFactor);
      controls.update();
    } else if (currentEnv.cameraMode === 'top') {
      camera.position.lerp(TOP_CAM_POS, lerpFactor);
      controls.target.lerp(TOP_TARGET, lerpFactor);
      controls.update();
    }
  });

  const handleFloorPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const currentEnv = world.get(TankEnvironment);
    if (!currentEnv) return;

    const clampedX = Math.max(-TANK_BOUNDS.halfW + 0.55, Math.min(TANK_BOUNDS.halfW - 0.55, e.point.x));
    const clampedZ = Math.max(-TANK_BOUNDS.halfD + 0.55, Math.min(TANK_BOUNDS.halfD - 0.55, e.point.z));

    if (currentEnv.decorateMode) {
      e.stopPropagation();
      if (currentEnv.placingDecorKind) {
        const created = spawnDecorEntity(world, currentEnv.placingDecorKind, { x: clampedX, z: clampedZ });
        world.set(TankEnvironment, {
          placingDecorKind: '',
          selectedEntityId: created.id(),
        });
        persistWorldState(world);
        return;
      }

      if (currentEnv.selectedEntityId >= 0) {
        const selectedDecor = world
          .query(IsDecor, Position)
          .find((entity) => entity.id() === currentEnv.selectedEntityId);
        if (selectedDecor) {
          selectedDecor.set(Position, { x: clampedX, y: TANK_BOUNDS.floorY, z: clampedZ });
          persistWorldState(world);
        }
      }
      return;
    }

    // Live Mode: Tap water / tank to drop food pellets right at (x, z)
    e.stopPropagation();
    dropFoodPellets(world, clampedX, clampedZ, 4);
  };

  const isFreeOrTop = env?.cameraMode === 'free';

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableRotate={isFreeOrTop}
        enablePan={isFreeOrTop}
        enableZoom
        minDistance={3.2}
        maxDistance={17}
        maxPolarAngle={Math.PI * 0.58}
        minPolarAngle={0.05}
      />

      {/* Interactive surface plane for tap-to-feed */}
      {!env?.decorateMode && (
        <mesh
          position={[0, TANK_BOUNDS.surfaceY - 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={handleFloorPointerDown}
          visible={false}
        >
          <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.depth]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {/* Interactive vertical water plane so tapping anywhere in Side View drops food */}
      {!env?.decorateMode && env?.cameraMode === 'side' && (
        <mesh
          position={[0, 0, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            dropFoodPellets(world, e.point.x, (Math.random() - 0.5) * 1.8, 4);
          }}
          visible={false}
        >
          <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.height - 0.5]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Interactive substrate plane for placing/moving decor and feeding from side view */}
      <mesh
        position={[0, TANK_BOUNDS.floorY + 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleFloorPointerDown}
        visible={false}
      >
        <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.depth]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}
