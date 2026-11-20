import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TANK_BOUNDS, type BiomeId } from '../registry/decor';
import type { LightingPreset } from '../ecs/traits';

type SideViewBackdropProps = {
  biome: BiomeId;
  phase: Exclude<LightingPreset, 'auto'>;
  visible: boolean;
};

type BackdropTheme = {
  biomeIndex: number;
  waterTop: string;
  waterDeep: string;
  ridgeColor: string;
  midColor: string;
  accentColor: string;
  ledStripColor: string;
  ledEmissive: string;
};

const BIOME_BACKDROP_THEMES: Record<BiomeId, BackdropTheme> = {
  marine_reef: {
    biomeIndex: 0,
    waterTop: '#164e63',
    waterDeep: '#071b29',
    ridgeColor: '#0e2d40',
    midColor: '#1a4a63',
    accentColor: '#38bdf8',
    ledStripColor: '#e0f2fe',
    ledEmissive: '#7dd3fc',
  },
  freshwater_tropical: {
    biomeIndex: 1,
    waterTop: '#16523b',
    waterDeep: '#071c14',
    ridgeColor: '#0e2b1d',
    midColor: '#1a4d32',
    accentColor: '#4ade80',
    ledStripColor: '#ecfdf5',
    ledEmissive: '#86efac',
  },
  freshwater_coldwater: {
    biomeIndex: 2,
    waterTop: '#1f3e52',
    waterDeep: '#091822',
    ridgeColor: '#122838',
    midColor: '#214259',
    accentColor: '#7dd3fc',
    ledStripColor: '#f0f9ff',
    ledEmissive: '#bae6fd',
  },
};

const PHASE_MODIFIERS: Record<
  Exclude<LightingPreset, 'auto'>,
  { brightness: number; tint: string; ledGlow: number }
> = {
  morning: { brightness: 0.92, tint: '#bae6fd', ledGlow: 0.72 },
  day: { brightness: 1.0, tint: '#ffffff', ledGlow: 0.85 },
  sunset: { brightness: 0.8, tint: '#fdba74', ledGlow: 0.68 },
  night: { brightness: 0.56, tint: '#38bdf8', ledGlow: 0.42 },
};

const BACKDROP_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BACKDROP_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uBiome;
  uniform float uBrightness;
  uniform vec3 uWaterTop;
  uniform vec3 uWaterDeep;
  uniform vec3 uRidgeColor;
  uniform vec3 uMidColor;
  uniform vec3 uAccentColor;

  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float hillWave(float x, float amp, float freq, float phase) {
    return amp * (0.5 + 0.5 * sin(x * freq + phase));
  }

  void main() {
    float x = vUv.x;
    float y = vUv.y;

    // 1. Pelagic vertical water gradient (subtle base keeps foreground creatures crisp)
    vec3 col = mix(uWaterDeep * 0.34, uWaterTop * 0.40, smoothstep(0.0, 0.96, y));

    // 2. Animated underwater caustic curtains in upper tank strata (y > 0.52)
    float rayA = pow(0.5 + 0.5 * sin(x * 18.0 - y * 4.5 - uTime * 0.55), 2.4);
    float rayB = pow(0.5 + 0.5 * sin(x * 29.0 + y * 6.0 + uTime * 0.40 + 1.1), 2.2);
    float rays = (rayA * 0.65 + rayB * 0.55) * smoothstep(0.42, 0.98, y) * smoothstep(1.0, 0.88, y);
    float meniscus = smoothstep(0.93, 0.995, y) * (0.55 + 0.45 * sin(x * 36.0 + uTime * 1.4));
    col += uAccentColor * (rays * 0.048 + meniscus * 0.036);

    // 3. Biome-specific layered far & mid-ground underwater horizon silhouettes
    if (uBiome < 0.5) {
      // Marine Reef: volcanic drop-off walls framing a pelagic lagoon + distant coral/kelp silhouettes
      float leftWall = 0.44 * exp(-pow((x - 0.14) * 3.8, 2.0));
      float rightWall = 0.48 * exp(-pow((x - 0.86) * 3.5, 2.0));
      float centerShelf = 0.16 + 0.045 * sin(x * 16.0 + 0.4) + 0.025 * cos(x * 39.0);
      float farReefH = max(centerShelf, 0.15 + leftWall + rightWall + hillWave(x, 0.04, 24.0, 1.2));
      float farMask = smoothstep(farReefH + 0.018, farReefH - 0.015, y);
      col = mix(col, uRidgeColor * 0.38, farMask * 0.85);

      // Midground brain coral domes & stepped reef shelf
      float brainL = 0.24 * exp(-pow((x - 0.25) * 6.2, 2.0));
      float brainR = 0.27 * exp(-pow((x - 0.73) * 5.6, 2.0));
      float shelfMid = 0.11 + brainL + brainR + 0.028 * max(0.0, sin(x * 46.0));
      float midMask = smoothstep(shelfMid + 0.012, shelfMid - 0.012, y);
      col = mix(col, uMidColor * 0.34, midMask * 0.82);

      // Swaying distant kelp & gorgonian sea-fan silhouettes on flanks
      float sway = sin(uTime * 0.9 + y * 7.5 + x * 12.0) * 0.010 * y;
      float stalkPattern = pow(0.5 + 0.5 * sin((x + sway) * 78.0), 4.0);
      float flankZone = smoothstep(0.32, 0.05, x) + smoothstep(0.68, 0.95, x);
      float frondHeight = 0.18 + 0.36 * flankZone * (0.65 + 0.35 * sin(x * 19.0));
      float frondMask = stalkPattern * flankZone * smoothstep(frondHeight + 0.02, frondHeight - 0.08, y) * smoothstep(0.06, 0.18, y);
      col = mix(col, uMidColor * 0.42 + uAccentColor * 0.02, frondMask * 0.72);
    } else if (uBiome < 1.5) {
      // Freshwater Tropical: terraced mudbanks, curved submerged roots, swaying river grass
      float bankH = 0.15 + 0.22 * pow(abs(x - 0.50) * 1.75, 1.35) + 0.03 * sin(x * 15.0 + 0.8);
      float bankMask = smoothstep(bankH + 0.02, bankH - 0.015, y);
      col = mix(col, uRidgeColor * 0.38, bankMask * 0.88);

      // Curved river root arches descending from upper left & right corners
      float leftRootCurve = 0.76 - 0.56 * smoothstep(0.0, 0.38, x) + 0.04 * sin(x * 26.0);
      float leftRootBand = exp(-pow((y - leftRootCurve) * 18.0, 2.0)) * smoothstep(0.42, 0.02, x);
      float rightRootCurve = 0.80 - 0.58 * smoothstep(1.0, 0.60, x) + 0.035 * cos(x * 24.0);
      float rightRootBand = exp(-pow((y - rightRootCurve) * 18.0, 2.0)) * smoothstep(0.58, 0.98, x);
      // Fine vertical curtain air-roots beneath arches
      float rootCurtain = pow(0.5 + 0.5 * sin(x * 92.0), 5.0) * smoothstep(0.52, 0.92, y) * (smoothstep(0.34, 0.02, x) + smoothstep(0.66, 0.98, x));
      float rootMask = clamp(leftRootBand + rightRootBand + rootCurtain * 0.55, 0.0, 1.0);
      col = mix(col, uMidColor * 0.30, rootMask * 0.75);

      // Swaying distant Vallisneria river grass along banks
      float drift = sin(uTime * 1.1 + y * 6.5 - x * 8.0) * 0.012 * y;
      float blades = pow(0.5 + 0.5 * sin((x + drift) * 105.0), 4.5);
      float grassHeight = 0.16 + 0.34 * (smoothstep(0.42, 0.04, x) + smoothstep(0.58, 0.96, x));
      float grassMask = blades * smoothstep(grassHeight + 0.02, grassHeight - 0.08, y) * smoothstep(0.05, 0.16, y);
      col = mix(col, uMidColor * 0.44 + uAccentColor * 0.024, grassMask * 0.75);
    } else {
      // Freshwater Coldwater: stacked river boulder terraces & overhanging willow-root shadows
      float terraceFar = 0.18 + 0.16 * exp(-pow((x - 0.18) * 4.5, 2.0))
        + 0.20 * exp(-pow((x - 0.80) * 4.0, 2.0))
        + 0.06 * exp(-pow((x - 0.48) * 5.0, 2.0));
      float terraceMask = smoothstep(terraceFar + 0.016, terraceFar - 0.014, y);
      col = mix(col, uRidgeColor * 0.40, terraceMask * 0.88);

      // Rounded river boulder domes stacked in midground
      float b1 = 0.21 * exp(-pow((x - 0.12) * 8.5, 2.0));
      float b2 = 0.17 * exp(-pow((x - 0.26) * 9.5, 2.0));
      float b3 = 0.19 * exp(-pow((x - 0.72) * 8.8, 2.0));
      float b4 = 0.23 * exp(-pow((x - 0.88) * 7.8, 2.0));
      float boulderH = 0.09 + max(max(b1, b2), max(b3, b4));
      float boulderMask = smoothstep(boulderH + 0.012, boulderH - 0.012, y);
      col = mix(col, uMidColor * 0.36, boulderMask * 0.82);

      // Subtle boulder rim highlight from surface light
      float boulderRim = exp(-pow((y - boulderH) * 52.0, 2.0)) * smoothstep(0.10, 0.28, boulderH);
      col += uAccentColor * boulderRim * 0.032;

      // Overhanging willow-root shadow tendrils from upper stream banks
      float swayW = sin(uTime * 1.25 - y * 8.0) * 0.008 * (1.0 - y);
      float strands = pow(0.5 + 0.5 * sin((x + swayW) * 88.0), 4.0);
      float edgeMask = smoothstep(0.32, 0.03, x) + smoothstep(0.68, 0.97, x);
      float willowMask = strands * edgeMask * smoothstep(0.62, 0.96, y);
      col = mix(col, uRidgeColor * 0.26, willowMask * 0.62);
    }

    // 4. Subtle suspended plankton / river silt shimmer
    vec2 moteCell = floor(vec2(x * 64.0 + sin(uTime * 0.18 + y * 5.0) * 1.5, y * 28.0 - uTime * 0.12));
    float moteRand = hash12(moteCell);
    if (moteRand > 0.985 && y > 0.12 && y < 0.92) {
      col += uAccentColor * 0.022;
    }

    // 5. Symmetrical edge vignette & bottom substrate integration
    float edgeFade = smoothstep(0.0, 0.045, x) * smoothstep(1.0, 0.955, x);
    col *= mix(0.62, 1.0, edgeFade);
    col *= smoothstep(-0.02, 0.08, y) * 0.45 + 0.55;

    // 6. Apply phase brightness with safe floor above SceneAsciiPass void cutoff & hard ceiling so foreground pops
    col *= mix(0.45, 1.0, uBrightness);
    col = clamp(col, vec3(0.0065), vec3(0.050));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SideViewBackdrop({ biome, phase, visible }: SideViewBackdropProps) {
  const theme = BIOME_BACKDROP_THEMES[biome];
  const mod = PHASE_MODIFIERS[phase];

  const backdropGeo = useMemo(
    () => new THREE.PlaneGeometry(TANK_BOUNDS.width - 0.14, TANK_BOUNDS.height - 0.64),
    [],
  );

  const backdropMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BACKDROP_VERTEX_SHADER,
        fragmentShader: BACKDROP_FRAGMENT_SHADER,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uBiome: { value: theme.biomeIndex },
          uBrightness: { value: mod.brightness },
          uWaterTop: { value: new THREE.Color(theme.waterTop) },
          uWaterDeep: { value: new THREE.Color(theme.waterDeep) },
          uRidgeColor: { value: new THREE.Color(theme.ridgeColor) },
          uMidColor: { value: new THREE.Color(theme.midColor) },
          uAccentColor: { value: new THREE.Color(theme.accentColor) },
        },
      }),
    [],
  );

  useEffect(() => {
    const tint = new THREE.Color(mod.tint);
    backdropMat.uniforms.uBiome.value = theme.biomeIndex;
    backdropMat.uniforms.uBrightness.value = mod.brightness;
    (backdropMat.uniforms.uWaterTop.value as THREE.Color).set(theme.waterTop).lerp(tint, 0.16);
    (backdropMat.uniforms.uWaterDeep.value as THREE.Color).set(theme.waterDeep);
    (backdropMat.uniforms.uRidgeColor.value as THREE.Color).set(theme.ridgeColor);
    (backdropMat.uniforms.uMidColor.value as THREE.Color).set(theme.midColor);
    (backdropMat.uniforms.uAccentColor.value as THREE.Color).set(theme.accentColor).lerp(tint, 0.35);
  }, [backdropMat, theme, mod]);

  useEffect(() => {
    return () => {
      backdropGeo.dispose();
      backdropMat.dispose();
    };
  }, [backdropGeo, backdropMat]);

  useFrame(({ clock }) => {
    if (!visible) return;
    backdropMat.uniforms.uTime.value = clock.getElapsedTime();
  });

  if (!visible) return null;

  const frontZ = TANK_BOUNDS.depth / 2;
  const plinthY = TANK_BOUNDS.floorY - 0.94;
  const plinthWidth = TANK_BOUNDS.width + 0.18;
  const lightBarY = TANK_BOUNDS.surfaceY + 0.62;

  return (
    <group>
      {/* Back-glass procedural aquarium horizon & caustic backdrop */}
      <mesh
        position={[0, -0.05, -TANK_BOUNDS.depth / 2 - 0.08]}
        geometry={backdropGeo}
        material={backdropMat}
        raycast={() => null}
      />

      {/* Symmetrical gallery cabinet plinth beneath the substrate base rim */}
      <group>
        {/* Dark shadow reveal groove directly below base rim */}
        <mesh position={[0, TANK_BOUNDS.floorY - 0.39, 0]} raycast={() => null}>
          <boxGeometry args={[TANK_BOUNDS.width + 0.04, 0.08, TANK_BOUNDS.depth + 0.04]} />
          <meshStandardMaterial color="#090e1a" roughness={0.95} />
        </mesh>

        {/* Main cabinet stand body (emissive floor keeps dark slate above ASCII void cutoff) */}
        <mesh position={[0, plinthY, 0]} raycast={() => null}>
          <boxGeometry args={[plinthWidth, 1.06, TANK_BOUNDS.depth + 0.16]} />
          <meshStandardMaterial
            color="#334155"
            emissive="#1e293b"
            emissiveIntensity={0.46}
            roughness={0.82}
            metalness={0.22}
          />
        </mesh>

        {/* Brushed aluminum trim line along top edge of cabinet front */}
        <mesh
          position={[0, TANK_BOUNDS.floorY - 0.45, frontZ + 0.09]}
          raycast={() => null}
        >
          <boxGeometry args={[plinthWidth - 0.06, 0.075, 0.04]} />
          <meshStandardMaterial
            color="#64748b"
            emissive="#475569"
            emissiveIntensity={0.48}
            roughness={0.45}
            metalness={0.45}
          />
        </mesh>

        {/* Symmetrical 3-bay cabinet door reveal seams */}
        {[-3.05, 3.05].map((seamX) => (
          <mesh
            key={seamX}
            position={[seamX, plinthY - 0.05, frontZ + 0.098]}
            raycast={() => null}
          >
            <boxGeometry args={[0.11, 0.88, 0.03]} />
            <meshStandardMaterial color="#070b14" roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Symmetrical rimless suspended LED light fixture above tank rim */}
      <group>
        {/* Anodized aluminum housing */}
        <mesh position={[0, lightBarY, 0]} raycast={() => null}>
          <boxGeometry args={[14.2, 0.22, 0.65]} />
          <meshStandardMaterial
            color="#475569"
            emissive="#334155"
            emissiveIntensity={0.55}
            roughness={0.38}
            metalness={0.62}
          />
        </mesh>

        {/* Glowing LED underside diffuser strip */}
        <mesh position={[0, lightBarY - 0.125, 0]} raycast={() => null}>
          <boxGeometry args={[13.6, 0.095, 0.42]} />
          <meshStandardMaterial
            color={theme.ledStripColor}
            emissive={theme.ledEmissive}
            emissiveIntensity={mod.ledGlow * 1.45}
            roughness={0.2}
          />
        </mesh>

        {/* Symmetrical stainless suspension cables & mounting ferrules */}
        {[-5.8, 5.8].map((wireX) => (
          <group key={wireX}>
            <mesh position={[wireX, lightBarY + 0.15, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.095, 0.095, 0.12, 8]} />
              <meshStandardMaterial
                color="#64748b"
                emissive="#475569"
                emissiveIntensity={0.5}
                roughness={0.35}
                metalness={0.75}
              />
            </mesh>
            <mesh position={[wireX, lightBarY + 1.08, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.038, 0.038, 1.9, 8]} />
              <meshStandardMaterial
                color="#64748b"
                emissive="#475569"
                emissiveIntensity={0.48}
                roughness={0.35}
                metalness={0.8}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
