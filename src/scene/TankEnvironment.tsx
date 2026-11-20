import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTrait, useWorld } from 'koota/react';
import * as THREE from 'three';
import { BIOME_PRESETS, TANK_BOUNDS } from '../registry/decor';
import { TankEnvironment as TankEnvTrait, type LightingPreset } from '../ecs/traits';
import { SideViewBackdrop } from './SideViewBackdrop';

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
    bg: '#030812',
    sun: '#fef08a',
    sunIntensity: 2.1,
    ambient: '#bae6fd',
    ambientIntensity: 0.45,
    water: '#38bdf8',
  },
  day: {
    bg: '#02060d',
    sun: '#e0f2fe',
    sunIntensity: 2.35,
    ambient: '#7dd3fc',
    ambientIntensity: 0.42,
    water: '#0ea5e9',
  },
  sunset: {
    bg: '#0a0612',
    sun: '#fdba74',
    sunIntensity: 2.0,
    ambient: '#f9a8d4',
    ambientIntensity: 0.42,
    water: '#6366f1',
  },
  night: {
    bg: '#010308',
    sun: '#93c5fd',
    sunIntensity: 1.45,
    ambient: '#1e3a8a',
    ambientIntensity: 0.35,
    water: '#0369a1',
  },
};

export function TankEnvironmentScene() {
  const world = useWorld();
  const env = useTrait(world, TankEnvTrait);
  const waterSurfaceRef = useRef<THREE.Mesh>(null);
  const causticMatRef = useRef<THREE.ShaderMaterial>(null);
  const algaeMatRef = useRef<THREE.ShaderMaterial>(null);
  const glintsRef = useRef<THREE.Group>(null);

  const phase = resolveLightingPhase(env?.lightingPhase ?? 'day');
  const palette = LIGHTING_PALETTES[phase];
  const biomePreset = BIOME_PRESETS[env?.biome ?? 'marine_reef'];

  const substrateColor = useMemo(() => {
    const c = new THREE.Color(biomePreset.substrateColor);
    if (phase === 'night') c.multiplyScalar(0.55);
    return `#${c.getHexString()}`;
  }, [biomePreset.substrateColor, phase]);

  // Sculpted sand floor geometry with natural reef dunes across panoramic tank
  const sandGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TANK_BOUNDS.width - 0.16, TANK_BOUNDS.depth - 0.16, 72, 36);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = Math.sin(x * 0.55) * 0.18 + Math.cos(z * 0.85) * 0.12;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Animated water surface geometry
  const surfaceGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TANK_BOUNDS.width - 0.08, TANK_BOUNDS.depth - 0.08, 48, 28);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const causticUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: phase === 'night' ? 0.32 : 0.68 },
    }),
    [],
  );

  const algaeUniforms = useMemo(() => ({ uAlpha: { value: 0 } }), []);

  const glintSeeds = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => {
        const s1 = Math.sin(i * 12.9898) * 43758.5453;
        const s2 = Math.sin(i * 78.233 + 1.3) * 28461.231;
        const s3 = Math.sin(i * 39.425 + 2.7) * 19534.819;
        const fx = s1 - Math.floor(s1);
        const fy = s2 - Math.floor(s2);
        const fz = s3 - Math.floor(s3);
        return {
          x: (fx - 0.5) * (TANK_BOUNDS.width - 1.4),
          y: TANK_BOUNDS.floorY + 0.5 + fy * (TANK_BOUNDS.surfaceY - TANK_BOUNDS.floorY - 1.0),
          z: (fz - 0.5) * (TANK_BOUNDS.depth - 1.2),
          speed: 1.4 + (i % 5) * 0.45,
          phase: i * 1.17,
          drift: 0.08 + (i % 4) * 0.04,
        };
      }),
    [],
  );

  const sunbeamUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(palette.sun) },
      uIntensity: { value: phase === 'night' ? 0 : 0.035 },
    }),
    [],
  );

  useEffect(() => {
    sunbeamUniforms.uColor.value.set(palette.sun);
    sunbeamUniforms.uIntensity.value = phase === 'night' ? 0 : 0.035;
  }, [palette.sun, phase, sunbeamUniforms]);

  const wireframeBoxGeo = useMemo(
    () => new THREE.BoxGeometry(TANK_BOUNDS.width, TANK_BOUNDS.height - 0.6, TANK_BOUNDS.depth),
    [],
  );

  useEffect(() => {
    return () => {
      sandGeo.dispose();
      surfaceGeo.dispose();
      wireframeBoxGeo.dispose();
    };
  }, [sandGeo, surfaceGeo, wireframeBoxGeo]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (causticMatRef.current) {
      causticMatRef.current.uniforms.uTime.value = t;
      causticMatRef.current.uniforms.uIntensity.value = phase === 'night' ? 0.32 : 0.68;
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
        pos.setY(i, Math.sin(x * 0.9 + t * 1.6) * 0.05 + Math.cos(z * 1.1 + t * 1.3) * 0.038);
      }
      pos.needsUpdate = true;
    }

    if (glintsRef.current) {
      const flow = 0.5 + (env?.currentStrength ?? 0.45) * 0.8;
      glintsRef.current.children.forEach((child, idx) => {
        const g = glintSeeds[idx];
        const pulse = Math.max(0, Math.sin(t * g.speed + g.phase));
        child.position.set(
          g.x + Math.sin(t * 0.42 * flow + g.phase) * 0.22,
          g.y + Math.sin(t * g.drift + g.phase) * 0.14,
          g.z,
        );
        child.scale.setScalar(0.25 + pulse * 0.95);
      });
    }
  });

  const clarityFactor = (env?.cleanliness ?? 100) / 100;
  const algaeLevel = env?.algaeLevel ?? 0;
  const algaeAlpha = algaeLevel > 22 ? Math.min(0.28, ((algaeLevel - 22) / 78) * 0.28) : 0;

  return (
    <group>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 38, 84 + clarityFactor * 16]} />

      {/* Lighting */}
      <ambientLight color={palette.ambient} intensity={palette.ambientIntensity} />
      <directionalLight
        position={[5, 14, 7]}
        color={palette.sun}
        intensity={palette.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
      />
      <pointLight position={[-7, 5, 5]} color={palette.water} intensity={1.0} />

      {/* Sand / Aragonite substrate bed */}
      <mesh position={[0, TANK_BOUNDS.floorY, 0]} geometry={sandGeo} receiveShadow>
        <meshStandardMaterial color={substrateColor} roughness={0.92} />
      </mesh>

      {/* Procedural sunlight caustic overlay on the substrate */}
      <mesh position={[0, TANK_BOUNDS.floorY + 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TANK_BOUNDS.width - 0.3, TANK_BOUNDS.depth - 0.3]} />
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
              vec2 p = vUv * 10.5;
              float w1 = sin(p.x + uTime * 0.9 + sin(p.y * 1.3 + uTime * 0.7));
              float w2 = cos(p.y * 1.1 - uTime * 0.8 + cos(p.x * 1.4 - uTime * 0.6));
              float net = pow(max(0.0, 1.0 - abs(w1 + w2) * 0.65), 3.0);
              gl_FragColor = vec4(0.75, 0.94, 1.0, net * uIntensity);
            }
          `}
        />
      </mesh>

      {/* Tank base rim sits cleanly beneath the sand dunes */}
      <mesh position={[0, TANK_BOUNDS.floorY - 0.24, 0]}>
        <boxGeometry args={[TANK_BOUNDS.width + 0.18, 0.24, TANK_BOUNDS.depth + 0.18]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Translucent glass walls */}
      <mesh position={[0, -0.05, -TANK_BOUNDS.depth / 2]}>
        <planeGeometry args={[TANK_BOUNDS.width, TANK_BOUNDS.height - 0.6]} />
        <meshStandardMaterial
          color={palette.water}
          transparent
          opacity={0.03 + (1 - clarityFactor) * 0.16}
          roughness={0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-TANK_BOUNDS.width / 2, -0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[TANK_BOUNDS.depth, TANK_BOUNDS.height - 0.6]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.025} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[TANK_BOUNDS.width / 2, -0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[TANK_BOUNDS.depth, TANK_BOUNDS.height - 0.6]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.025} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Soft bottom/corner algae patina on back glass when algae rises */}
      {algaeAlpha > 0.02 && (
        <mesh position={[0, -0.05, -TANK_BOUNDS.depth / 2 + 0.02]}>
          <planeGeometry args={[TANK_BOUNDS.width - 0.16, TANK_BOUNDS.height - 0.64]} />
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

      {/* Symmetrical glass wireframe rim */}
      <lineSegments position={[0, -0.05, 0]}>
        <edgesGeometry args={[wireframeBoxGeo]} />
        <lineBasicMaterial color="#64748b" transparent opacity={0.65} />
      </lineSegments>

      {/* Ambient twinkling micro-plankton & underwater glint motes */}
      <group ref={glintsRef}>
        {glintSeeds.map((g, idx) => (
          <mesh key={idx} position={[g.x, g.y, g.z]} raycast={() => null}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshBasicMaterial color="#bae6fd" transparent opacity={0.78} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* Subtle overhead sunbeam shimmer shafts during daylight */}
      {phase !== 'night' &&
        [-4.2, 0.6, 5.1].map((bx, idx) => (
          <mesh
            key={idx}
            position={[bx, 0.1, -1.6 - idx * 0.25]}
            rotation={[0, 0, -0.22]}
            raycast={() => null}
          >
            <planeGeometry args={[1.45 + idx * 0.15, 6.8]} />
            <shaderMaterial
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              uniforms={sunbeamUniforms}
              vertexShader={`
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
              fragmentShader={`
                uniform vec3 uColor;
                uniform float uIntensity;
                varying vec2 vUv;
                void main() {
                  float horiz = sin(vUv.x * 3.14159);
                  float vert = pow(vUv.y, 1.6);
                  gl_FragColor = vec4(uColor, horiz * vert * uIntensity);
                }
              `}
            />
          </mesh>
        ))}

      {/* Animated translucent water surface */}
      <mesh ref={waterSurfaceRef} position={[0, TANK_BOUNDS.surfaceY, 0]} geometry={surfaceGeo}>
        <meshStandardMaterial
          color={palette.water}
          emissive={palette.water}
          emissiveIntensity={env?.cameraMode === 'side' ? 0.25 : 0}
          transparent
          opacity={env?.cameraMode === 'side' ? 0.16 : 0.035}
          roughness={0.15}
          metalness={0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <SideViewBackdrop
        biome={env?.biome ?? 'marine_reef'}
        phase={phase}
        visible={(env?.cameraMode ?? 'side') === 'side'}
      />
    </group>
  );
}
