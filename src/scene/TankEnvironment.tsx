import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTrait, useWorld } from 'koota/react';
import * as THREE from 'three';
import { TANK_BOUNDS } from '../registry/decor';
import { TankEnvironment as TankEnvTrait, type LightingPreset } from '../ecs/traits';

function resolveLightingPhase(preset: LightingPreset): Exclude<LightingPreset, 'auto'> {
  if (preset !== 'auto') return preset;
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
}

const LIGHTING_PALETTES: Record<
  Exclude<LightingPreset, 'auto'>,
  { bg: string; sun: string; sunIntensity: number; ambient: string; ambientIntensity: number; water: string }
> = {
  morning: {
    bg: '#082032',
    sun: '#fef08a',
    sunIntensity: 1.65,
    ambient: '#bae6fd',
    ambientIntensity: 0.9,
    water: '#38bdf8',
  },
  day: {
    bg: '#061a2e',
    sun: '#e0f2fe',
    sunIntensity: 1.9,
    ambient: '#7dd3fc',
    ambientIntensity: 1.0,
    water: '#0ea5e9',
  },
  sunset: {
    bg: '#1c152d',
    sun: '#fdba74',
    sunIntensity: 1.4,
    ambient: '#f9a8d4',
    ambientIntensity: 0.75,
    water: '#6366f1',
  },
  night: {
    bg: '#020917',
    sun: '#93c5fd',
    sunIntensity: 0.75,
    ambient: '#1e3a8a',
    ambientIntensity: 0.55,
    water: '#0369a1',
  },
};

export function TankEnvironmentScene() {
  const world = useWorld();
  const env = useTrait(world, TankEnvTrait);
  const waterSurfaceRef = useRef<THREE.Mesh>(null);
  const causticMatRef = useRef<THREE.ShaderMaterial>(null);
  const algaeMatRef = useRef<THREE.ShaderMaterial>(null);

  const phase = resolveLightingPhase(env?.lightingPhase ?? 'day');
  const palette = LIGHTING_PALETTES[phase];

  // Sculpted sand floor geometry with subtle dunes
  const sandGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TANK_BOUNDS.width - 0.16, TANK_BOUNDS.depth - 0.16, 40, 24);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x * 0.75) * 0.06 + Math.cos(z * 1.1) * 0.04;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Animated water surface geometry
  const surfaceGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TANK_BOUNDS.width - 0.08, TANK_BOUNDS.depth - 0.08, 32, 20);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const causticUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: phase === 'night' ? 0.18 : 0.42 },
    }),
    [],
  );

  const algaeUniforms = useMemo(() => ({ uAlpha: { value: 0 } }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (causticMatRef.current) {
      causticMatRef.current.uniforms.uTime.value = t;
      causticMatRef.current.uniforms.uIntensity.value = phase === 'night' ? 0.16 : 0.4;
    }
    if (algaeMatRef.current) {
      const lvl = env?.algaeLevel ?? 0;
      const targetAlpha = lvl > 22 ? Math.min(0.28, ((lvl - 22) / 78) * 0.28) : 0;
      algaeMatRef.current.uniforms.uAlpha.value = targetAlpha * 0.45;
    }

    if (waterSurfaceRef.current) {
      const pos = waterSurfaceRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, Math.sin(x * 1.2 + t * 1.8) * 0.024 + Math.cos(z * 1.4 + t * 1.4) * 0.02);
      }
      pos.needsUpdate = true;
    }
  });

  const clarityFactor = (env?.cleanliness ?? 100) / 100;
  const algaeLevel = env?.algaeLevel ?? 0;
  const algaeAlpha = algaeLevel > 22 ? Math.min(0.28, ((algaeLevel - 22) / 78) * 0.28) : 0;

  return (
    <group>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 14, 24 + clarityFactor * 14]} />

      {/* Lighting */}
      <ambientLight color={palette.ambient} intensity={palette.ambientIntensity} />
      <directionalLight
        position={[3, 9, 4]}
        color={palette.sun}
        intensity={palette.sunIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-4, 3, 3]} color={palette.water} intensity={0.85} />

      {/* Sand substrate bed */}
      <mesh position={[0, TANK_BOUNDS.floorY, 0]} geometry={sandGeo} receiveShadow>
        <meshStandardMaterial color={phase === 'night' ? '#8c7d65' : '#e6d3ad'} roughness={0.92} />
      </mesh>

      {/* Procedural sunlight caustic overlay on the substrate */}
      <mesh position={[0, TANK_BOUNDS.floorY + 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TANK_BOUNDS.width - 0.25, TANK_BOUNDS.depth - 0.25]} />
        <shaderMaterial
          ref={causticMatRef}
          transparent
          depthWrite={false}
          uniforms={causticUniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uIntensity;
            varying vec2 vUv;
            void main() {
              vec2 p = vUv * 7.5;
              float w1 = sin(p.x + uTime * 0.9 + sin(p.y * 1.3 + uTime * 0.7));
              float w2 = cos(p.y * 1.1 - uTime * 0.8 + cos(p.x * 1.4 - uTime * 0.6));
              float net = pow(max(0.0, 1.0 - abs(w1 + w2) * 0.65), 3.0);
              gl_FragColor = vec4(0.75, 0.94, 1.0, net * uIntensity);
            }
          `}
        />
      </mesh>

      {/* Tank base rim sits cleanly beneath the sand dunes */}
      <mesh position={[0, TANK_BOUNDS.floorY - 0.22, 0]}>
        <boxGeometry args={[TANK_BOUNDS.width + 0.14, 0.22, TANK_BOUNDS.depth + 0.14]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Translucent glass walls (subtle back & side depth cues) */}
      <mesh position={[0, -0.02, -TANK_BOUNDS.depth / 2]}>
        <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.height - 0.4]} />
        <meshStandardMaterial
          color={palette.water}
          transparent
          opacity={0.14 + (1 - clarityFactor) * 0.14}
          roughness={0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-TANK_BOUNDS.width / 2, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[TANK_BOUNDS.depth, TANK_BOUNDS.height - 0.4]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[TANK_BOUNDS.width / 2, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[TANK_BOUNDS.depth, TANK_BOUNDS.height - 0.4]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Soft bottom/corner algae patina on back glass when algae rises */}
      {algaeAlpha > 0.02 && (
        <mesh position={[0, -0.02, -TANK_BOUNDS.depth / 2 + 0.02]}>
          <planeGeometry args={[TANK_BOUNDS.width - 0.12, TANK_BOUNDS.height - 0.44]} />
          <shaderMaterial
            ref={algaeMatRef}
            transparent
            depthWrite={false}
            uniforms={algaeUniforms}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform float uAlpha;
              varying vec2 vUv;
              void main() {
                float edge = max(1.0 - smoothstep(0.0, 0.45, vUv.y), max(1.0 - smoothstep(0.0, 0.25, vUv.x), 1.0 - smoothstep(0.0, 0.25, 1.0 - vUv.x)));
                gl_FragColor = vec4(0.28, 0.48, 0.08, uAlpha * edge);
              }
            `}
          />
        </mesh>
      )}

      {/* Minimalist glass wireframe rim for spatial clarity in all camera views */}
      <lineSegments position={[0, -0.02, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(TANK_BOUNDS.width, TANK_BOUNDS.height - 0.4, TANK_BOUNDS.depth)]} />
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.35} />
      </lineSegments>

      {/* Animated translucent water surface */}
      <mesh ref={waterSurfaceRef} position={[0, TANK_BOUNDS.surfaceY, 0]} geometry={surfaceGeo}>
        <meshStandardMaterial
          color={palette.water}
          transparent
          opacity={env?.cameraMode === 'top' ? 0.16 : 0.28}
          roughness={0.15}
          metalness={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
