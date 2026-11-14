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
  const dna = entity.get(CreatureDna)!;

  useFrame(() => {
    const pos = entity.get(Position);
    const loco = entity.get(SnailLocomotion);
    const meta = entity.get(CreatureMeta);
    if (!pos || !loco || !meta || !groupRef.current) return;

    const scale = dna.baseScale + (dna.maxScale - dna.baseScale) * meta.growth;
    groupRef.current.position.set(pos.x, pos.y, pos.z);
    groupRef.current.scale.setScalar(scale);

    // Orient along surface (floor vs back glass wall)
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
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const env = world.get(TankEnvironment);
    if (env?.decorateMode) return;
    e.stopPropagation();
    world.set(TankEnvironment, { selectedEntityId: entity.id() });
  };

  return (
    <group ref={groupRef} onClick={handleClick}>
      {/* Muscular gliding foot */}
      <mesh position={[0.04, -0.04, 0]} scale={[1.35, 0.42, 0.85]} castShadow>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial color={dna.finColor} roughness={0.65} />
      </mesh>

      {/* Main spherical shell */}
      <mesh position={[-0.04, 0.11, 0]} castShadow>
        <sphereGeometry args={[0.19, 14, 14]} />
        <meshStandardMaterial color={dna.primaryColor} roughness={0.28} metalness={0.08} />
      </mesh>

      {/* Shell whorl / Zebra stripe band */}
      <mesh position={[-0.08, 0.11, 0.08]} rotation={[0.4, 0.3, 0]}>
        <torusGeometry args={[0.13, 0.045, 8, 18]} />
        <meshStandardMaterial color={dna.secondaryColor} roughness={0.32} />
      </mesh>
      <mesh position={[-0.1, 0.12, -0.07]} rotation={[-0.3, 0.2, 0]}>
        <torusGeometry args={[0.09, 0.032, 8, 16]} />
        <meshStandardMaterial color={dna.secondaryColor} roughness={0.32} />
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
          <ringGeometry args={[0.3, 0.36, 20]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
