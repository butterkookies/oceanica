import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import * as THREE from 'three';
import { TANK_BOUNDS, type DecorKind } from '../registry/decor';
import { DecorItem, Position, TankEnvironment } from '../ecs/traits';

interface Props {
  entity: Entity;
  selected: boolean;
}

function CactusModel() {
  return (
    <group>
      {/* Ceramic pot / anchor base */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.28, 12]} />
        <meshStandardMaterial color="#b45309" roughness={0.7} />
      </mesh>
      {/* Main ribbed saguaro trunk */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.95, 8, 12]} />
        <meshStandardMaterial color="#22c55e" roughness={0.55} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.24, 0.72, 0]} rotation={[0, 0, Math.PI * 0.45]} castShadow>
        <capsuleGeometry args={[0.11, 0.22, 6, 10]} />
        <meshStandardMaterial color="#16a34a" roughness={0.55} />
      </mesh>
      <mesh position={[-0.36, 0.92, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.26, 6, 10]} />
        <meshStandardMaterial color="#22c55e" roughness={0.55} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.23, 0.56, 0.04]} rotation={[0, 0, -Math.PI * 0.45]} castShadow>
        <capsuleGeometry args={[0.1, 0.2, 6, 10]} />
        <meshStandardMaterial color="#16a34a" roughness={0.55} />
      </mesh>
      <mesh position={[0.34, 0.76, 0.04]} castShadow>
        <capsuleGeometry args={[0.1, 0.24, 6, 10]} />
        <meshStandardMaterial color="#22c55e" roughness={0.55} />
      </mesh>
      {/* Little coral desert flower on top */}
      <mesh position={[0, 1.54, 0]}>
        <dodecahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial color="#fb7185" roughness={0.4} />
      </mesh>
    </group>
  );
}

function AnubiasModel({ swayRef }: { swayRef: React.RefObject<THREE.Group | null> }) {
  const leaves = useMemo(
    () => [
      { pos: [0, 0.34, 0] as const, rot: [0.35, 0, 0.15] as const, s: 1.0 },
      { pos: [-0.2, 0.42, 0.1] as const, rot: [0.28, 1.1, 0.45] as const, s: 0.92 },
      { pos: [0.22, 0.48, -0.06] as const, rot: [0.22, -1.2, -0.35] as const, s: 1.05 },
      { pos: [0.04, 0.62, 0.14] as const, rot: [0.18, 2.3, 0.25] as const, s: 0.88 },
      { pos: [-0.12, 0.56, -0.18] as const, rot: [0.3, -2.5, 0.35] as const, s: 0.85 },
    ],
    [],
  );

  return (
    <group>
      {/* Anchor stone & rhizome */}
      <mesh position={[0, 0.12, 0]} scale={[1.3, 0.7, 1.1]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color="#57534e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[0, 0.4, Math.PI * 0.45]}>
        <capsuleGeometry args={[0.045, 0.28, 4, 8]} />
        <meshStandardMaterial color="#166534" roughness={0.7} />
      </mesh>
      {/* Broad leathery leaves */}
      <group ref={swayRef}>
        {leaves.map((l, i) => (
          <group key={i} position={l.pos} rotation={l.rot} scale={l.s}>
            <mesh position={[0, 0.18, 0]} rotation={[0.45, 0, 0]} scale={[0.7, 1.25, 0.12]} castShadow>
              <sphereGeometry args={[0.24, 10, 8]} />
              <meshStandardMaterial color="#15803d" roughness={0.32} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function JavaFernModel({ swayRef }: { swayRef: React.RefObject<THREE.Group | null> }) {
  const fronds = useMemo(
    () => [
      { rotY: 0, tilt: 0.18, h: 1.45 },
      { rotY: 1.1, tilt: 0.24, h: 1.3 },
      { rotY: 2.3, tilt: 0.22, h: 1.55 },
      { rotY: 3.4, tilt: 0.28, h: 1.2 },
      { rotY: 4.5, tilt: 0.2, h: 1.4 },
      { rotY: 5.4, tilt: 0.26, h: 1.15 },
    ],
    [],
  );

  return (
    <group>
      <mesh position={[0, 0.1, 0]} scale={[1.2, 0.65, 1.1]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.26, 1]} />
        <meshStandardMaterial color="#44403c" roughness={0.85} />
      </mesh>
      <group ref={swayRef}>
        {fronds.map((f, i) => (
          <group key={i} position={[0, 0.22, 0]} rotation={[0, f.rotY, f.tilt]}>
            <mesh position={[0, f.h * 0.45, 0]} scale={[0.42, f.h, 0.1]} castShadow>
              <sphereGeometry args={[0.35, 10, 8]} />
              <meshStandardMaterial color="#22c55e" roughness={0.48} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function RiverRockModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]} scale={[1.45, 0.75, 1.15]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial color="#64748b" roughness={0.88} />
      </mesh>
      <mesh position={[-0.28, 0.12, 0.16]} scale={[1.0, 0.7, 0.9]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color="#78716c" roughness={0.85} />
      </mesh>
      <mesh position={[0.24, 0.28, -0.08]} scale={[0.9, 0.72, 0.85]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color="#475569" roughness={0.82} />
      </mesh>
    </group>
  );
}

function DriftwoodModel() {
  return (
    <group>
      <mesh position={[0, 0.35, 0]} rotation={[0.15, 0, -0.52]} castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.17, 1.2, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[0.22, 0.72, 0.08]} rotation={[-0.25, 0, 0.45]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.09, 0.85, 7]} />
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
      <mesh position={[-0.25, 0.45, -0.05]} rotation={[0.2, 0, 0.85]} castShadow receiveShadow>
        <cylinderGeometry args={[0.035, 0.075, 0.65, 7]} />
        <meshStandardMaterial color="#713f12" roughness={0.9} />
      </mesh>
    </group>
  );
}

function MarimoModel() {
  return (
    <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
      <icosahedronGeometry args={[0.26, 2]} />
      <meshStandardMaterial color="#15803d" roughness={0.95} />
    </mesh>
  );
}

function BubblerModel() {
  const bubblesRef = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        y: (i / 14) * 4.2,
        speed: 0.75 + (i % 4) * 0.18,
        ox: Math.sin(i * 2.1) * 0.08,
        oz: Math.cos(i * 1.7) * 0.08,
        r: 0.025 + (i % 3) * 0.014,
      })),
    [],
  );

  useFrame(({ clock }, dt) => {
    if (!bubblesRef.current) return;
    const t = clock.getElapsedTime();
    const maxRise = TANK_BOUNDS.surfaceY - TANK_BOUNDS.floorY - 0.25;
    bubblesRef.current.children.forEach((child, idx) => {
      const s = seeds[idx];
      s.y += s.speed * Math.min(dt, 0.05);
      if (s.y > maxRise) s.y = 0.2;
      child.position.set(
        s.ox + Math.sin(t * 3 + idx) * 0.05,
        0.18 + s.y,
        s.oz + Math.cos(t * 2.5 + idx) * 0.05,
      );
    });
  });

  return (
    <group>
      {/* Ceramic air stone */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.16, 12]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.06, 12]} />
        <meshStandardMaterial color="#bae6fd" roughness={0.3} />
      </mesh>
      {/* Rising bubble stream */}
      <group ref={bubblesRef}>
        {seeds.map((s, idx) => (
          <mesh key={idx} position={[s.ox, 0.2 + s.y, s.oz]}>
            <sphereGeometry args={[s.r, 8, 8]} />
            <meshStandardMaterial color="#e0f2fe" transparent opacity={0.65} roughness={0.1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function renderDecorByKind(kind: DecorKind, swayRef: React.RefObject<THREE.Group | null>) {
  switch (kind) {
    case 'cactus':
      return <CactusModel />;
    case 'anubias':
      return <AnubiasModel swayRef={swayRef} />;
    case 'java_fern':
      return <JavaFernModel swayRef={swayRef} />;
    case 'marimo':
      return <MarimoModel />;
    case 'river_rock':
      return <RiverRockModel />;
    case 'driftwood':
      return <DriftwoodModel />;
    case 'bubbler':
      return <BubblerModel />;
  }
}

export function DecorMesh({ entity, selected }: Props) {
  const world = useWorld();
  const pos = useTrait(entity, Position);
  const item = useTrait(entity, DecorItem);
  const swayRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!swayRef.current) return;
    const t = clock.getElapsedTime();
    swayRef.current.rotation.z = Math.sin(t * 1.4 + entity.id()) * 0.06;
    swayRef.current.rotation.x = Math.cos(t * 1.1 + entity.id()) * 0.04;
  });

  if (!pos || !item) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const env = world.get(TankEnvironment);
    if (!env?.decorateMode) return;
    e.stopPropagation();
    world.set(TankEnvironment, { selectedEntityId: entity.id() });
  };

  return (
    <group
      position={[pos.x, pos.y, pos.z]}
      rotation={[0, item.rotationY, 0]}
      scale={[item.flipped ? -item.scale : item.scale, item.scale, item.scale]}
      onClick={handleClick}
    >
      {renderDecorByKind(item.kind, swayRef)}

      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.65, 28]} />
          <meshBasicMaterial color="#34d399" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
