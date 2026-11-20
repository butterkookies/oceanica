import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useTrait, useWorld } from 'koota/react';
import type { Entity } from 'koota';
import * as THREE from 'three';
import { TANK_BOUNDS, type DecorKind } from '../registry/decor';
import { DecorItem, IsPlant, PlantBiology, Position, TankEnvironment } from '../ecs/traits';

interface Props {
  entity: Entity;
  selected: boolean;
}

function computeBotanicalColor(baseHex: string, chlorophyll: number, health: number): string {
  const c = new THREE.Color(baseHex);
  const chlorosis = new THREE.Color('#a3a635');
  const necrotic = new THREE.Color('#57432f');

  const chloroMix = THREE.MathUtils.clamp((100 - chlorophyll) / 70, 0, 1);
  c.lerp(chlorosis, chloroMix * 0.72);
  if (health < 40) {
    const rotMix = THREE.MathUtils.clamp((40 - health) / 38, 0, 1);
    c.lerp(necrotic, rotMix * 0.85);
  }
  return `#${c.getHexString()}`;
}

/** Tapered leaf/frond curved ribbon blade geometry. */
function buildBladeGeometry(width: number, height: number, curveOffset: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 2, 7);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + height * 0.5;
    const t = THREE.MathUtils.clamp(y / Math.max(0.01, height), 0, 1);
    const taper = Math.sin(Math.pow(t, 0.72) * Math.PI) * 1.08 + (1 - t) * 0.16;
    const waveX = Math.sin(t * Math.PI * 1.8) * width * 0.18;
    const archZ = Math.pow(t, 1.55) * curveOffset;
    pos.setXYZ(i, x * taper + waveX, y, archZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function CaulerpaModel({
  swayRef,
  color,
  emissive,
}: {
  swayRef: React.RefObject<THREE.Group | null>;
  color: string;
  emissive: string;
}) {
  const bladeGeo = useMemo(() => buildBladeGeometry(0.36, 2.05, 0.28), []);
  const stolonGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.98, 0.05, 0.09),
      new THREE.Vector3(-0.34, 0.07, -0.06),
      new THREE.Vector3(0.34, 0.06, 0.07),
      new THREE.Vector3(0.98, 0.05, -0.07),
    ]);
    return new THREE.TubeGeometry(curve, 16, 0.036, 6, false);
  }, []);

  useEffect(() => {
    return () => {
      bladeGeo.dispose();
      stolonGeo.dispose();
    };
  }, [bladeGeo, stolonGeo]);

  const fronds = useMemo(
    () => [
      { pos: [-0.82, 0.06, 0.06] as const, rot: [0.09, 0.2, 0.22] as const, s: 0.78 },
      { pos: [-0.56, 0.06, -0.03] as const, rot: [-0.07, 0.9, 0.14] as const, s: 0.95 },
      { pos: [-0.3, 0.07, 0.05] as const, rot: [0.06, 1.8, 0.07] as const, s: 1.08 },
      { pos: [-0.04, 0.07, -0.04] as const, rot: [-0.05, 2.7, -0.02] as const, s: 1.18 },
      { pos: [0.22, 0.07, 0.04] as const, rot: [0.06, 3.6, -0.08] as const, s: 1.1 },
      { pos: [0.48, 0.06, -0.02] as const, rot: [-0.08, 4.5, -0.14] as const, s: 0.96 },
      { pos: [0.72, 0.05, 0.05] as const, rot: [0.07, 5.3, -0.2] as const, s: 0.85 },
      { pos: [0.9, 0.05, -0.06] as const, rot: [-0.06, 5.9, -0.25] as const, s: 0.74 },
    ],
    [],
  );

  return (
    <group>
      <mesh geometry={stolonGeo} castShadow>
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.14} roughness={0.55} />
      </mesh>
      <group ref={swayRef}>
        {fronds.map((f, i) => (
          <mesh key={i} position={f.pos} rotation={f.rot} scale={f.s} geometry={bladeGeo} castShadow>
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.22}
              roughness={0.42}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SeagrassModel({
  swayRef,
  color,
  emissive,
}: {
  swayRef: React.RefObject<THREE.Group | null>;
  color: string;
  emissive: string;
}) {
  const ribbonGeo = useMemo(() => buildBladeGeometry(0.18, 2.7, 0.42), []);
  useEffect(() => () => ribbonGeo.dispose(), [ribbonGeo]);

  const blades = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: ((i % 4) - 1.5) * 0.24,
        z: (Math.floor(i / 4) - 1.5) * 0.22,
        rotY: i * 0.48,
        tilt: 0.07 + (i % 4) * 0.045,
        s: 0.76 + (i % 5) * 0.11,
      })),
    [],
  );

  return (
    <group ref={swayRef}>
      {blades.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, 0.02, b.z]}
          rotation={[b.tilt, b.rotY, 0]}
          scale={b.s}
          geometry={ribbonGeo}
          castShadow
        >
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.2}
            roughness={0.44}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function KelpModel({
  swayRef,
  color,
  emissive,
}: {
  swayRef: React.RefObject<THREE.Group | null>;
  color: string;
  emissive: string;
}) {
  const stipeGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.06, 0),
      new THREE.Vector3(0.14, 1.15, 0.08),
      new THREE.Vector3(-0.12, 2.35, -0.07),
      new THREE.Vector3(0.16, 3.55, 0.07),
      new THREE.Vector3(-0.06, 4.6, 0),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.04, 7, false);
  }, []);
  const leafGeo = useMemo(() => buildBladeGeometry(0.42, 1.38, 0.36), []);

  useEffect(() => {
    return () => {
      stipeGeo.dispose();
      leafGeo.dispose();
    };
  }, [stipeGeo, leafGeo]);

  const nodes = useMemo(
    () => [
      { y: 0.7, rotY: 0.2, s: 0.88 },
      { y: 1.25, rotY: 1.25, s: 0.96 },
      { y: 1.8, rotY: 2.35, s: 1.06 },
      { y: 2.35, rotY: 3.4, s: 1.1 },
      { y: 2.9, rotY: 4.45, s: 1.04 },
      { y: 3.4, rotY: 5.5, s: 0.96 },
      { y: 3.85, rotY: 0.85, s: 0.88 },
      { y: 4.2, rotY: 2.1, s: 0.78 },
    ],
    [],
  );

  return (
    <group>
      <mesh position={[0, 0.08, 0]} scale={[1.1, 0.55, 1.0]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color="#475569" roughness={0.88} />
      </mesh>
      <group ref={swayRef}>
        <mesh geometry={stipeGeo} castShadow>
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.18} roughness={0.5} />
        </mesh>
        {nodes.map((n, i) => (
          <group key={i} position={[0, n.y, 0]} rotation={[0.4, n.rotY, 0.65]} scale={n.s}>
            <mesh position={[0, 0.04, 0]}>
              <sphereGeometry args={[0.052, 8, 8]} />
              <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.24} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.06, 0]} geometry={leafGeo} castShadow>
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={0.22}
                roughness={0.42}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function AnemoneModel({
  swayRef,
  health,
  chlorophyll,
}: {
  swayRef: React.RefObject<THREE.Group | null>;
  health: number;
  chlorophyll: number;
}) {
  const tentacleGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 0.32, 0.04),
      new THREE.Vector3(0.24, 0.66, -0.03),
      new THREE.Vector3(0.32, 0.92, 0.02),
    ]);
    return new THREE.TubeGeometry(curve, 12, 0.038, 7, false);
  }, []);

  useEffect(() => () => tentacleGeo.dispose(), [tentacleGeo]);

  const stemColor = computeBotanicalColor('#e11d48', chlorophyll, health);
  const tipColor = computeBotanicalColor('#fda4af', chlorophyll, health);

  const tentacles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const isOuter = i < 14;
        const ring = isOuter ? 1 : 0.65;
        return {
          rotY: (i / (isOuter ? 14 : 8)) * Math.PI * 2 + (isOuter ? 0 : 0.32),
          tilt: isOuter ? 0.28 : -0.1,
          s: (0.85 + (i % 4) * 0.1) * ring,
        };
      }),
    [],
  );

  return (
    <group>
      {/* Fleshy oral disc base */}
      <mesh position={[0, 0.14, 0]} scale={[1.2, 0.65, 1.15]} castShadow>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color="#881337" emissive="#4c0519" emissiveIntensity={0.2} roughness={0.65} />
      </mesh>
      <group ref={swayRef} position={[0, 0.24, 0]}>
        {tentacles.map((t, i) => (
          <group key={i} rotation={[t.tilt, t.rotY, 0]} scale={t.s}>
            <mesh geometry={tentacleGeo} castShadow>
              <meshStandardMaterial
                color={stemColor}
                emissive={stemColor}
                emissiveIntensity={0.22}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0.32, 0.92, 0.02]}>
              <sphereGeometry args={[0.062, 8, 8]} />
              <meshStandardMaterial
                color={tipColor}
                emissive={tipColor}
                emissiveIntensity={0.34}
                roughness={0.25}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function AnubiasModel({
  swayRef,
  color,
  emissive,
}: {
  swayRef: React.RefObject<THREE.Group | null>;
  color: string;
  emissive: string;
}) {
  const leafGeo = useMemo(() => buildBladeGeometry(0.46, 0.68, 0.22), []);
  useEffect(() => () => leafGeo.dispose(), [leafGeo]);

  const leaves = useMemo(
    () => [
      { pos: [0, 0.3, 0] as const, rot: [0.45, 0, 0.12] as const, s: 1.08 },
      { pos: [-0.24, 0.34, 0.12] as const, rot: [0.38, 1.1, 0.32] as const, s: 0.96 },
      { pos: [0.26, 0.38, -0.08] as const, rot: [0.32, -1.2, -0.28] as const, s: 1.1 },
      { pos: [0.06, 0.44, 0.18] as const, rot: [0.28, 2.3, 0.2] as const, s: 0.92 },
      { pos: [-0.14, 0.4, -0.2] as const, rot: [0.4, -2.5, 0.3] as const, s: 0.9 },
      { pos: [0.18, 0.32, 0.22] as const, rot: [0.48, 0.5, -0.25] as const, s: 0.86 },
      { pos: [-0.32, 0.28, -0.06] as const, rot: [0.42, 2.9, 0.38] as const, s: 0.84 },
      { pos: [0.32, 0.3, 0.08] as const, rot: [0.36, -0.7, -0.34] as const, s: 0.88 },
    ],
    [],
  );

  return (
    <group>
      <mesh position={[0, 0.14, 0]} scale={[1.35, 0.72, 1.1]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color="#475569" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[0, 0.4, Math.PI * 0.45]}>
        <capsuleGeometry args={[0.045, 0.34, 4, 8]} />
        <meshStandardMaterial color="#14532d" roughness={0.7} />
      </mesh>
      <group ref={swayRef}>
        {leaves.map((l, i) => (
          <mesh key={i} position={l.pos} rotation={l.rot} scale={l.s} geometry={leafGeo} castShadow>
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.2}
              roughness={0.34}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function JavaFernModel({
  swayRef,
  color,
  emissive,
}: {
  swayRef: React.RefObject<THREE.Group | null>;
  color: string;
  emissive: string;
}) {
  const frondGeo = useMemo(() => buildBladeGeometry(0.28, 1.85, 0.34), []);
  useEffect(() => () => frondGeo.dispose(), [frondGeo]);

  const fronds = useMemo(
    () => [
      { rotY: 0, tilt: 0.16, s: 1.06 },
      { rotY: 0.65, tilt: 0.24, s: 0.94 },
      { rotY: 1.3, tilt: 0.2, s: 1.12 },
      { rotY: 1.95, tilt: 0.28, s: 0.88 },
      { rotY: 2.6, tilt: 0.18, s: 1.02 },
      { rotY: 3.25, tilt: 0.25, s: 0.9 },
      { rotY: 3.9, tilt: 0.22, s: 0.98 },
      { rotY: 4.55, tilt: 0.26, s: 0.92 },
      { rotY: 5.2, tilt: 0.19, s: 1.04 },
      { rotY: 5.85, tilt: 0.23, s: 0.86 },
    ],
    [],
  );

  return (
    <group>
      <mesh position={[0, 0.11, 0]} scale={[1.25, 0.65, 1.1]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color="#44403c" roughness={0.85} />
      </mesh>
      <group ref={swayRef}>
        {fronds.map((f, i) => (
          <mesh
            key={i}
            position={[0, 0.2, 0]}
            rotation={[f.tilt, f.rotY, 0]}
            scale={f.s}
            geometry={frondGeo}
            castShadow
          >
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.2}
              roughness={0.44}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function VallisneriaModel({
  swayRef,
  color,
  emissive,
}: {
  swayRef: React.RefObject<THREE.Group | null>;
  color: string;
  emissive: string;
}) {
  const ribbonGeo = useMemo(() => buildBladeGeometry(0.18, 3.9, 0.62), []);
  useEffect(() => () => ribbonGeo.dispose(), [ribbonGeo]);

  const ribbons = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: ((i % 4) - 1.5) * 0.22,
        z: (Math.floor(i / 4) - 1.5) * 0.18,
        rotY: i * 0.52,
        tilt: 0.06 + (i % 3) * 0.045,
        s: 0.8 + (i % 5) * 0.09,
      })),
    [],
  );

  return (
    <group ref={swayRef}>
      {ribbons.map((r, i) => (
        <mesh
          key={i}
          position={[r.x, 0.02, r.z]}
          rotation={[r.tilt, r.rotY, 0]}
          scale={r.s}
          geometry={ribbonGeo}
          castShadow
        >
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.2}
            roughness={0.42}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function LiveRockModel() {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} scale={[1.6, 0.95, 1.2]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.58, 1]} />
        <meshStandardMaterial color="#64748b" roughness={0.9} />
      </mesh>
      <mesh position={[-0.55, 0.28, 0.24]} scale={[1.15, 0.72, 1.0]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial color="#7c6f7e" roughness={0.86} />
      </mesh>
      <mesh position={[0.48, 0.72, -0.18]} scale={[1.1, 0.78, 0.9]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.38, 1]} />
        <meshStandardMaterial color="#57534e" roughness={0.88} />
      </mesh>
      <mesh position={[0.15, 1.15, 0.12]} scale={[0.95, 0.62, 0.85]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.32, 1]} />
        <meshStandardMaterial color="#78716c" roughness={0.84} />
      </mesh>
    </group>
  );
}

function RiverRockModel() {
  return (
    <group>
      <mesh position={[0, 0.26, 0]} scale={[1.65, 0.72, 1.25]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.48, 1]} />
        <meshStandardMaterial color="#64748b" roughness={0.88} />
      </mesh>
      <mesh position={[-0.45, 0.18, 0.22]} scale={[1.15, 0.68, 0.95]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.32, 1]} />
        <meshStandardMaterial color="#78716c" roughness={0.85} />
      </mesh>
      <mesh position={[0.38, 0.42, -0.12]} scale={[1.05, 0.7, 0.9]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color="#475569" roughness={0.82} />
      </mesh>
    </group>
  );
}

function DriftwoodModel() {
  const { trunkGeo, branchAGeo, branchBGeo } = useMemo(() => {
    const cTrunk = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.65, 0.05, 0.15),
      new THREE.Vector3(-0.1, 0.55, 0),
      new THREE.Vector3(0.45, 1.35, -0.15),
      new THREE.Vector3(0.92, 1.95, -0.25),
    ]);
    const cA = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 0.52, 0),
      new THREE.Vector3(-0.48, 1.15, 0.22),
      new THREE.Vector3(-0.78, 1.65, 0.38),
    ]);
    const cB = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.22, 0.92, -0.08),
      new THREE.Vector3(0.65, 1.05, 0.32),
      new THREE.Vector3(0.98, 1.25, 0.55),
    ]);
    return {
      trunkGeo: new THREE.TubeGeometry(cTrunk, 16, 0.13, 8, false),
      branchAGeo: new THREE.TubeGeometry(cA, 12, 0.068, 7, false),
      branchBGeo: new THREE.TubeGeometry(cB, 12, 0.055, 7, false),
    };
  }, []);

  useEffect(() => {
    return () => {
      trunkGeo.dispose();
      branchAGeo.dispose();
      branchBGeo.dispose();
    };
  }, [trunkGeo, branchAGeo, branchBGeo]);

  return (
    <group>
      <mesh geometry={trunkGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh geometry={branchAGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#92400e" roughness={0.9} />
      </mesh>
      <mesh geometry={branchBGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#713f12" roughness={0.9} />
      </mesh>
    </group>
  );
}

function MarimoModel({ color, emissive }: { color: string; emissive: string }) {
  return (
    <mesh position={[0, 0.26, 0]} scale={[1.15, 0.85, 1.1]} castShadow receiveShadow>
      <icosahedronGeometry args={[0.32, 2]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.18} roughness={0.95} />
    </mesh>
  );
}

function BubblerModel({ parentScale }: { parentScale: number }) {
  const bubblesRef = useRef<THREE.Group>(null);
  const maxRise = Math.max(
    0.5,
    (TANK_BOUNDS.surfaceY - TANK_BOUNDS.floorY - 0.45) / Math.max(0.5, parentScale),
  );
  const seeds = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        y: 0.22 + (i / 18) * Math.max(0.3, maxRise - 0.22),
        speed: 0.85 + (i % 4) * 0.22,
        ox: Math.sin(i * 2.1) * 0.12,
        oz: Math.cos(i * 1.7) * 0.12,
        r: 0.032 + (i % 3) * 0.015,
      })),
    [maxRise],
  );

  useFrame(({ clock }, dt) => {
    if (!bubblesRef.current) return;
    const t = clock.getElapsedTime();
    bubblesRef.current.children.forEach((child, idx) => {
      const s = seeds[idx];
      s.y += s.speed * Math.min(dt, 0.05);
      if (s.y > maxRise) s.y = 0.22;
      child.position.set(
        s.ox + Math.sin(t * 3 + idx) * 0.07,
        0.2 + s.y,
        s.oz + Math.cos(t * 2.5 + idx) * 0.07,
      );
    });
  });

  return (
    <group>
      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.25, 0.18, 12]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.15, 0.17, 0.06, 12]} />
        <meshStandardMaterial color="#bae6fd" roughness={0.3} />
      </mesh>
      <group ref={bubblesRef}>
        {seeds.map((s, idx) => (
          <mesh key={idx} position={[s.ox, 0.2 + s.y, s.oz]} raycast={() => null}>
            <sphereGeometry args={[s.r, 8, 8]} />
            <meshStandardMaterial
              color="#e0f2fe"
              emissive="#bae6fd"
              emissiveIntensity={0.65}
              transparent
              opacity={0.85}
              roughness={0.1}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function renderDecorByKind(
  kind: DecorKind,
  swayRef: React.RefObject<THREE.Group | null>,
  plantHealth: number,
  plantChlorophyll: number,
  parentScale: number,
) {
  switch (kind) {
    case 'caulerpa':
      return (
        <CaulerpaModel
          swayRef={swayRef}
          color={computeBotanicalColor('#16a34a', plantChlorophyll, plantHealth)}
          emissive="#064e3b"
        />
      );
    case 'seagrass':
      return (
        <SeagrassModel
          swayRef={swayRef}
          color={computeBotanicalColor('#15803d', plantChlorophyll, plantHealth)}
          emissive="#065f46"
        />
      );
    case 'kelp':
      return (
        <KelpModel
          swayRef={swayRef}
          color={computeBotanicalColor('#4d7c0f', plantChlorophyll, plantHealth)}
          emissive="#365314"
        />
      );
    case 'anemone':
      return <AnemoneModel swayRef={swayRef} health={plantHealth} chlorophyll={plantChlorophyll} />;
    case 'live_rock':
      return <LiveRockModel />;
    case 'anubias':
      return (
        <AnubiasModel
          swayRef={swayRef}
          color={computeBotanicalColor('#16a34a', plantChlorophyll, plantHealth)}
          emissive="#064e3b"
        />
      );
    case 'java_fern':
      return (
        <JavaFernModel
          swayRef={swayRef}
          color={computeBotanicalColor('#22c55e', plantChlorophyll, plantHealth)}
          emissive="#065f46"
        />
      );
    case 'vallisneria':
      return (
        <VallisneriaModel
          swayRef={swayRef}
          color={computeBotanicalColor('#16a34a', plantChlorophyll, plantHealth)}
          emissive="#065f46"
        />
      );
    case 'marimo':
      return (
        <MarimoModel
          color={computeBotanicalColor('#15803d', plantChlorophyll, plantHealth)}
          emissive="#064e3b"
        />
      );
    case 'river_rock':
      return <RiverRockModel />;
    case 'driftwood':
      return <DriftwoodModel />;
    case 'bubbler':
      return <BubblerModel parentScale={parentScale} />;
  }
}

export function DecorMesh({ entity, selected }: Props) {
  const world = useWorld();
  const pos = useTrait(entity, Position);
  const item = useTrait(entity, DecorItem);
  const plant = useTrait(entity, PlantBiology);
  const env = useTrait(world, TankEnvironment);
  const swayRef = useRef<THREE.Group>(null);
  const pearlRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const droop = plant?.droop ?? 0;
    const flow = 0.65 + (world.get(TankEnvironment)?.currentStrength ?? 0.45) * 0.7;

    if (swayRef.current) {
      swayRef.current.rotation.z = Math.sin(t * 1.3 * flow + entity.id()) * 0.08 - droop * 0.38;
      swayRef.current.rotation.x = Math.cos(t * 1.0 * flow + entity.id()) * 0.05 + droop * 0.25;
    }

    if (pearlRef.current) {
      const pearling = Boolean(
        plant && plant.health > 75 && env?.lightingPhase !== 'night',
      );
      pearlRef.current.visible = pearling;
      if (pearling) {
        pearlRef.current.children.forEach((child, i) => {
          const cycle = (t * 0.55 + i * 0.37) % 1;
          child.position.y = 0.35 + cycle * 1.25;
          child.scale.setScalar(0.6 + Math.sin(cycle * Math.PI) * 0.6);
        });
      }
    }
  });

  if (!pos || !item) return null;

  const isPlant = entity.has(IsPlant) && Boolean(plant);
  const growthScale = isPlant && plant ? 0.38 + plant.growth * 0.82 : 1;
  const totalScale = item.scale * growthScale;
  const plantHealth = plant?.health ?? 100;
  const plantChloro = plant?.chlorophyll ?? 100;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const currentEnv = world.get(TankEnvironment);
    if (!currentEnv) return;
    if (currentEnv.decorateMode || isPlant) {
      e.stopPropagation();
      world.set(TankEnvironment, { selectedEntityId: entity.id() });
    }
  };

  return (
    <group
      position={[pos.x, pos.y, pos.z]}
      rotation={[0, item.rotationY, 0]}
      scale={[item.flipped ? -totalScale : totalScale, totalScale, totalScale]}
      onClick={handleClick}
      onPointerDown={(e) => {
        if (!world.get(TankEnvironment)?.decorateMode && isPlant) {
          e.stopPropagation();
        }
      }}
    >
      {renderDecorByKind(item.kind, swayRef, plantHealth, plantChloro, item.scale)}

      {/* Subtle daytime O2 pearling bubbles on healthy living flora */}
      {isPlant && (
        <group ref={pearlRef} visible={false}>
          {[0, 1, 2].map((idx) => (
            <mesh
              key={idx}
              position={[(idx - 1) * 0.16, 0.5, (idx % 2) * 0.1]}
              raycast={() => null}
            >
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshBasicMaterial color="#e0f2fe" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      )}

      {selected && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.78, 28]} />
          <meshBasicMaterial color="#34d399" side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
