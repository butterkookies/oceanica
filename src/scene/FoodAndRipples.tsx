import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Entity } from 'koota';
import * as THREE from 'three';
import { Position, WaterRipple } from '../ecs/traits';

export function FoodMesh({ entity }: { entity: Entity }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const pos = entity.get(Position);
    if (!pos || !meshRef.current) return;
    meshRef.current.position.set(pos.x, pos.y, pos.z);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.048, 8, 8]} />
      <meshStandardMaterial color="#d97706" roughness={0.6} />
    </mesh>
  );
}

export function RippleMesh({ entity }: { entity: Entity }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const pos = entity.get(Position);
    const ripple = entity.get(WaterRipple);
    if (!pos || !ripple || !meshRef.current || !matRef.current) return;
    meshRef.current.position.set(pos.x, pos.y, pos.z);
    meshRef.current.scale.setScalar(ripple.radius);
    matRef.current.opacity = ripple.alpha;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.85, 1.0, 28]} />
      <meshBasicMaterial
        ref={matRef}
        color="#bae6fd"
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
