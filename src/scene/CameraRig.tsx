import { useEffect, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTrait, useWorld } from 'koota/react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { TANK_BOUNDS } from '../registry/decor';
import { pointerState } from '../ecs/pointerState';
import { dropFoodPellets, persistWorldState, spawnDecorEntity } from '../ecs/world';
import {
  IsDecor,
  IsFish,
  IsSnail,
  Position,
  TankEnvironment,
  type CameraViewMode,
} from '../ecs/traits';

const TANK_CENTER_Y = -0.05;
const SIDE_CAM_POS = new THREE.Vector3(0, TANK_CENTER_Y, 18);
const SIDE_TARGET = new THREE.Vector3(0, TANK_CENTER_Y, 0);
const TOP_CAM_POS = new THREE.Vector3(0, 18, 0.002);
const TOP_TARGET = new THREE.Vector3(0, TANK_CENTER_Y, 0);
const ISO_CAM_POS = new THREE.Vector3(14.5, 11, 14.5);
const ISO_TARGET = new THREE.Vector3(0, TANK_CENTER_Y, 0);

function computeFitZoom(width: number, height: number, mode: CameraViewMode): number {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  if (mode === 'top') {
    return Math.max(28, Math.min(safeW / 18.5, safeH / 10.1));
  }
  if (mode === 'free') {
    return Math.max(28, Math.min(safeW / 21.5, safeH / 12.2));
  }
  return Math.max(28, Math.min(safeW / 18.5, safeH / 8.6));
}

function updatePointerPresence(point: THREE.Vector3): void {
  const now = performance.now();
  const dt = Math.max(0.008, (now - pointerState.lastMoveAt) / 1000);
  const dist = pointerState.active
    ? Math.hypot(point.x - pointerState.x, point.y - pointerState.y, point.z - pointerState.z)
    : 0;
  pointerState.speed = Math.min(120, dist / dt);
  pointerState.x = point.x;
  pointerState.y = point.y;
  pointerState.z = point.z;
  pointerState.active = true;
  pointerState.lastMoveAt = now;
}

export function CameraRig() {
  const world = useWorld();
  const env = useTrait(world, TankEnvironment);
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const desiredPos = useRef(new THREE.Vector3().copy(SIDE_CAM_POS));
  const desiredTarget = useRef(new THREE.Vector3().copy(SIDE_TARGET));

  const initializedRef = useRef(false);
  const zoomAutoRef = useRef(true);
  const freePresetLerpRef = useRef(false);
  const prevModeRef = useRef<CameraViewMode | undefined>(undefined);
  const prevFollowRef = useRef<number | undefined>(undefined);
  const prevSizeRef = useRef({ w: 0, h: 0 });

  const cameraMode: CameraViewMode = env?.cameraMode ?? 'side';
  const followEntityId = env?.followEntityId ?? -1;
  const fitZoom = computeFitZoom(size.width, size.height, cameraMode);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = fitZoom;
        camera.updateProjectionMatrix();
      }
      if (cameraMode === 'free') {
        freePresetLerpRef.current = true;
      } else if (cameraMode === 'top') {
        camera.position.copy(TOP_CAM_POS);
        controlsRef.current?.target.copy(TOP_TARGET);
        controlsRef.current?.update();
      } else {
        camera.position.copy(SIDE_CAM_POS);
        controlsRef.current?.target.copy(SIDE_TARGET);
        controlsRef.current?.update();
      }
    } else {
      if (prevModeRef.current !== cameraMode) {
        zoomAutoRef.current = true;
        freePresetLerpRef.current = cameraMode === 'free';
      } else if (
        prevFollowRef.current !== followEntityId ||
        prevSizeRef.current.w !== size.width ||
        prevSizeRef.current.h !== size.height
      ) {
        zoomAutoRef.current = true;
      }
    }

    prevModeRef.current = cameraMode;
    prevFollowRef.current = followEntityId;
    prevSizeRef.current = { w: size.width, h: size.height };
  }, [camera, cameraMode, followEntityId, fitZoom, size.width, size.height]);

  useFrame((_, dt) => {
    const currentEnv = world.get(TankEnvironment);
    const controls = controlsRef.current;
    if (!currentEnv || !controls) return;

    // Smoothly decay pointer speed when mouse pauses inside the tank
    if (pointerState.active && performance.now() - pointerState.lastMoveAt > 120) {
      pointerState.speed *= Math.max(0, 1 - dt * 8);
    }

    const lerpFactor = Math.min(1, dt * 4.5);
    const activeFitZoom = computeFitZoom(size.width, size.height, currentEnv.cameraMode);

    if (currentEnv.followEntityId >= 0) {
      const targetEntity = [
        ...world.query(IsFish, Position),
        ...world.query(IsSnail, Position),
      ].find((e) => e.id() === currentEnv.followEntityId);

      if (targetEntity) {
        const pos = targetEntity.get(Position)!;
        desiredTarget.current.set(pos.x, pos.y, pos.z);
        if (currentEnv.cameraMode === 'top') {
          desiredPos.current.set(pos.x, 18, pos.z + 0.002);
        } else if (currentEnv.cameraMode === 'free') {
          desiredPos.current.set(pos.x + 12, pos.y + 9, pos.z + 12);
        } else {
          desiredPos.current.set(pos.x, pos.y, 18);
        }
        camera.position.lerp(desiredPos.current, lerpFactor);
        controls.target.lerp(desiredTarget.current, lerpFactor);
        if (zoomAutoRef.current && camera instanceof THREE.OrthographicCamera) {
          camera.zoom = THREE.MathUtils.lerp(camera.zoom, activeFitZoom * 2.4, lerpFactor);
          camera.updateProjectionMatrix();
        }
        controls.update();
        return;
      } else {
        world.set(TankEnvironment, { followEntityId: -1 });
      }
    }

    if (zoomAutoRef.current && camera instanceof THREE.OrthographicCamera) {
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, activeFitZoom, lerpFactor);
      camera.updateProjectionMatrix();
    }

    if (currentEnv.cameraMode === 'side') {
      camera.position.lerp(SIDE_CAM_POS, lerpFactor);
      controls.target.lerp(SIDE_TARGET, lerpFactor);
      controls.update();
    } else if (currentEnv.cameraMode === 'top') {
      camera.position.lerp(TOP_CAM_POS, lerpFactor);
      controls.target.lerp(TOP_TARGET, lerpFactor);
      controls.update();
    } else if (freePresetLerpRef.current) {
      camera.position.lerp(ISO_CAM_POS, lerpFactor);
      controls.target.lerp(ISO_TARGET, lerpFactor);
      if (
        camera.position.distanceTo(ISO_CAM_POS) < 0.02 &&
        controls.target.distanceTo(ISO_TARGET) < 0.02
      ) {
        camera.position.copy(ISO_CAM_POS);
        controls.target.copy(ISO_TARGET);
        freePresetLerpRef.current = false;
      }
      controls.update();
    }
  });

  const handleFloorClick = (e: ThreeEvent<MouseEvent>, zOverride?: number) => {
    if (e.delta > 4) return;
    const currentEnv = world.get(TankEnvironment);
    if (!currentEnv) return;

    const rawZ = zOverride ?? e.point.z;
    const clampedX = Math.max(-TANK_BOUNDS.halfW + 0.65, Math.min(TANK_BOUNDS.halfW - 0.65, e.point.x));
    const clampedZ = Math.max(-TANK_BOUNDS.halfD + 0.65, Math.min(TANK_BOUNDS.halfD - 0.65, rawZ));

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

    e.stopPropagation();
    pointerState.lastTapAt = performance.now();
    pointerState.tapX = clampedX;
    pointerState.tapY = TANK_BOUNDS.surfaceY;
    pointerState.tapZ = clampedZ;
    dropFoodPellets(world, clampedX, clampedZ, 4);
  };

  const isFree = env?.cameraMode === 'free';

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableRotate={isFree}
        enablePan={isFree}
        enableZoom
        minZoom={Math.max(16, fitZoom * 0.55)}
        maxZoom={fitZoom * 5.5}
        minPolarAngle={0.0001}
        maxPolarAngle={Math.PI * 0.58}
        onStart={() => {
          zoomAutoRef.current = false;
          freePresetLerpRef.current = false;
        }}
      />

      {/* Interactive vertical water plane behind all fish for Side View cursor presence & tap-to-feed */}
      {!env?.decorateMode && env?.cameraMode === 'side' && (
        <mesh
          position={[0, TANK_CENTER_Y, -TANK_BOUNDS.halfD + 0.05]}
          onPointerMove={(e) => updatePointerPresence(e.point)}
          onPointerOut={() => {
            pointerState.active = false;
            pointerState.speed = 0;
          }}
          onClick={(e) => {
            if (e.delta > 4) return;
            e.stopPropagation();
            const zRand = (Math.random() - 0.5) * 2.4;
            pointerState.lastTapAt = performance.now();
            pointerState.tapX = e.point.x;
            pointerState.tapY = TANK_BOUNDS.surfaceY;
            pointerState.tapZ = zRand;
            dropFoodPellets(world, e.point.x, zRand, 4);
          }}
          visible={false}
        >
          <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.height - 0.5]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Interactive vertical plane behind decor for placing/moving decor in straight-on orthographic Side View */}
      {env?.decorateMode && env?.cameraMode === 'side' && (
        <mesh
          position={[0, TANK_CENTER_Y, -TANK_BOUNDS.halfD + 0.05]}
          onClick={(e) => handleFloorClick(e, 0)}
          visible={false}
        >
          <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.height]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Interactive substrate plane (sits beneath all fish/snails/decor) for Top & 3D clicks + cursor presence */}
      <mesh
        position={[0, TANK_BOUNDS.floorY + 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => updatePointerPresence(e.point)}
        onPointerOut={() => {
          pointerState.active = false;
          pointerState.speed = 0;
        }}
        onClick={(e) => handleFloorClick(e)}
        visible={false}
      >
        <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.depth]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}
