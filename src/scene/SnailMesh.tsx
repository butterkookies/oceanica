import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import type { Entity } from 'koota';
import * as THREE from 'three';
import {
  CreatureDna,
  CreatureMeta,
  Position,
  SnailLocomotion,
  TankEnvironment,
} from '../ecs/traits';

interface Props {
  entity: Entity;
  selected: boolean;
}

export function SnailMesh({ entity, selected }: Props) {
  const world = useWorld();
  const groupRef = useRef<THREE.Group>(null);
  const tentacleLeftRef = useRef<THREE.Mesh>(null);
  const tentacleRightRef = useRef<THREE.Mesh>(null);
  const siphonRef = useRef<THREE.Mesh>(null);
  const shellMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const dna = entity.get(CreatureDna)!;

  useFrame(() => {
    const pos = entity.get(Position);
    const loco = entity.get(SnailLocomotion);
    const meta = entity.get(CreatureMeta);
    const env = world.get(TankEnvironment);
    if (!pos || !loco || !meta || !groupRef.current) return;

    const scale = dna.baseScale + (dna.maxScale - dna.baseScale) * meta.growth;
    groupRef.current.position.set(pos.x, pos.y, pos.z);
    groupRef.current.scale.setScalar(scale);

    const yaw = Math.atan2(-loco.vz, loco.vx);
    if (loco.surface === 'backWall') {
      groupRef.current.rotation.set(Math.PI * 0.5, 0, yaw);
    } else {
      groupRef.current.rotation.set(0, yaw, 0);
    }

    if (tentacleLeftRef.current && tentacleRightRef.current) {
      tentacleLeftRef.current.rotation.z = -0.35 + Math.sin(loco.t * 3.5) * 0.14;
      tentacleRightRef.current.rotation.z = -0.35 + Math.cos(loco.t * 3.2) * 0.14;
    }

    if (siphonRef.current) {
      siphonRef.current.visible = dna.hasLabyrinth && loco.siphonExtend > 0.05;
      siphonRef.current.scale.y = 0.4 + loco.siphonExtend * 1.1;
    }

    // Acidic water causes subtle shell calcium erosion / paling
    if (shellMatRef.current && env) {
      const c = new THREE.Color(dna.primaryColor);
      if (env.ph < 6.8) {
        const acidMix = Math.min(0.65, (6.8 - env.ph) * 0.65);
        c.lerp(new THREE.Color('#cbd5e1'), acidMix);
      }
      shellMatRef.current.color.copy(c);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const env = world.get(TankEnvironment);
    if (env?.decorateMode) return;
    e.stopPropagation();
    world.set(TankEnvironment, { selectedEntityId: entity.id() });
  };

  const isTurbo = dna.speciesId === 'snail_turbo';

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerDown={(e) => {
        if (!world.get(TankEnvironment)?.decorateMode) e.stopPropagation();
      }}
    >
      {/* Muscular gliding foot */}
      <mesh position={[0.04, -0.04, 0]} scale={[1.38, 0.4, 0.85]} castShadow>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial color={dna.finColor} roughness={0.65} />
      </mesh>

      {/* Main shell (conical turban for marine Turbo vs smooth spherical for Mystery/Nerite) */}
      {isTurbo ? (
        <mesh position={[-0.04, 0.15, 0]} rotation={[0.15, 0, 0.25]} castShadow>
          <coneGeometry args={[0.21, 0.34, 12]} />
          <meshStandardMaterial
            ref={shellMatRef}
            color={dna.primaryColor}
            roughness={0.42}
            metalness={0.08}
          />
        </mesh>
      ) : (
        <mesh position={[-0.04, 0.11, 0]} castShadow>
          <sphereGeometry args={[0.19, 14, 14]} />
          <meshStandardMaterial
            ref={shellMatRef}
            color={dna.primaryColor}
            roughness={0.28}
            metalness={0.08}
          />
        </mesh>
      )}

      {/* Shell whorl / band ridges */}
      <mesh position={[-0.08, 0.11, 0.08]} rotation={[0.4, 0.3, 0]}>
        <torusGeometry args={[0.13, 0.042, 8, 18]} />
        <meshStandardMaterial color={dna.secondaryColor} roughness={0.35} />
      </mesh>
      <mesh position={[-0.1, 0.13, -0.07]} rotation={[-0.3, 0.2, 0]}>
        <torusGeometry args={[0.09, 0.03, 8, 16]} />
        <meshStandardMaterial color={dna.secondaryColor} roughness={0.35} />
      </mesh>

      {/* Twin feeler tentacles */}
      <mesh ref={tentacleLeftRef} position={[0.25, 0.02, 0.06]}>
        <cylinderGeometry args={[0.008, 0.015, 0.18, 6]} />
        <meshStandardMaterial color={dna.finColor} />
      </mesh>
      <mesh ref={tentacleRightRef} position={[0.25, 0.02, -0.06]}>
        <cylinderGeometry args={[0.008, 0.015, 0.18, 6]} />
        <meshStandardMaterial color={dna.finColor} />
      </mesh>

      {/* Mystery snail extendable breathing siphon */}
      <mesh ref={siphonRef} position={[0.14, 0.2, 0.08]} visible={false}>
        <cylinderGeometry args={[0.014, 0.02, 0.28, 8]} />
        <meshStandardMaterial color={dna.finColor} />
      </mesh>

      {selected && (
        <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.41, 20]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
