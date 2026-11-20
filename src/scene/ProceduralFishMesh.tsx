import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import type { Entity } from 'koota';
import * as THREE from 'three';
import type { CreatureBlueprint, PatternStyle, TailStyle } from '../registry/species';
import { SPINE_JOINT_COUNT } from '../ecs/systems/movementSystem';
import {
  CreatureDna,
  CreatureMeta,
  CreatureVitals,
  SpineKinematics,
  TankEnvironment,
} from '../ecs/traits';

const RADIAL_SEGMENTS = 20;
const SPINE_RINGS = SPINE_JOINT_COUNT;
const TAIL_U_SEGS = 10;
const TAIL_V_SEGS = 24;

interface Props {
  entity: Entity;
  selected: boolean;
}

function bodyCrossSection(
  morphology: CreatureBlueprint['morphology'],
  u: number,
  gillFlare: number,
): { rx: number; ry: number } {
  // Anatomical fusiform / lateral-compressed / globiform taper with operculum gill flare at u=0.16
  const snout = Math.pow(Math.max(0.015, u), 0.56);
  const arch = Math.sin(snout * Math.PI);
  const pedunclePinch = 1 - Math.pow(u, 2.3) * 0.68;
  const envelope = Math.max(0.05, arch * pedunclePinch + (1 - u) * 0.06 * Math.sin(u * Math.PI));
  const operculum = Math.exp(-Math.pow((u - 0.16) / 0.06, 2)) * gillFlare;

  if (morphology === 'globiform') {
    const round = Math.sin(Math.pow(Math.max(0.02, u), 0.54) * Math.PI);
    return {
      rx: Math.max(0.07, round * 1.05 + operculum),
      ry: Math.max(0.07, round * 1.12),
    };
  }
  if (morphology === 'compressiform') {
    return {
      rx: envelope * 0.66 + operculum,
      ry: envelope * 1.16,
    };
  }
  return {
    rx: envelope * 0.9 + operculum,
    ry: envelope * 0.96,
  };
}

function samplePatternColor(
  pattern: PatternStyle,
  u: number,
  theta: number,
  cPrimary: THREE.Color,
  cSecondary: THREE.Color,
  cFin: THREE.Color,
): THREE.Color {
  const out = cPrimary.clone();
  const yNorm = Math.sin(theta);

  // Subtle biological countershading: dorsal back slightly deeper, ventral belly softer
  if (yNorm > 0.25) {
    out.multiplyScalar(0.86);
  } else if (yNorm < -0.35) {
    out.lerp(new THREE.Color('#e2e8f0'), 0.22);
  }

  if (pattern === 'solid') {
    return out;
  }
  if (pattern === 'bicolor') {
    const mix = THREE.MathUtils.smoothstep(yNorm, -0.35, 0.45);
    return out.lerp(cSecondary, mix * 0.85);
  }
  if (pattern === 'stripes') {
    // Crisp reef-style vertical bands (e.g. Ocellaris clownfish 3 white bars bordered by dark ink)
    const band1 = Math.abs(u - 0.22);
    const band2 = Math.abs(u - 0.52);
    const band3 = Math.abs(u - 0.82);
    const minBand = Math.min(band1, band2, band3);
    if (minBand < 0.065) return cSecondary.clone();
    if (minBand < 0.088) return cFin.clone();
    return out;
  }
  if (pattern === 'spotted') {
    const spot = Math.sin(u * 22) * Math.cos(theta * 3);
    if (spot > 0.48) return cSecondary.clone();
    return out;
  }
  if (pattern === 'koi') {
    const patch1 = Math.hypot((u - 0.24) * 3.1, Math.sin(theta - 0.5) * 1.3);
    const patch2 = Math.hypot((u - 0.56) * 2.8, Math.sin(theta + 0.4) * 1.2);
    const patch3 = Math.hypot((u - 0.82) * 3.8, Math.sin(theta) * 1.4);
    if (patch1 < 0.65 || patch2 < 0.72 || patch3 < 0.52) {
      return cSecondary.clone();
    }
    return out;
  }
  // marble / sanke
  const patchA = Math.hypot((u - 0.28) * 3.0, Math.sin(theta - 0.3) * 1.3);
  const patchB = Math.hypot((u - 0.62) * 2.9, Math.sin(theta + 0.5) * 1.2);
  const ink = Math.sin(u * 19 + Math.cos(theta * 2) * 1.8);
  if (ink > 0.76) return cFin.clone().lerp(new THREE.Color('#0f172a'), 0.7);
  if (patchA < 0.62 || patchB < 0.68) return cSecondary.clone();
  return out;
}

function buildBodyGeometry(dna: CreatureBlueprint): {
  geo: THREE.BufferGeometry;
  baseColors: Float32Array;
} {
  const geo = new THREE.BufferGeometry();
  const ringVerts = RADIAL_SEGMENTS + 1;
  const totalVerts = SPINE_RINGS * ringVerts;
  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const indices: number[] = [];

  const cPrimary = new THREE.Color(dna.primaryColor);
  const cSecondary = new THREE.Color(dna.secondaryColor);
  const cFin = new THREE.Color(dna.finColor);

  for (let i = 0; i < SPINE_RINGS; i++) {
    const u = i / (SPINE_RINGS - 1);
    for (let j = 0; j < ringVerts; j++) {
      const theta = (j / RADIAL_SEGMENTS) * Math.PI * 2;
      const col = samplePatternColor(dna.pattern, u, theta, cPrimary, cSecondary, cFin);
      const idx = (i * ringVerts + j) * 3;
      colors[idx] = col.r;
      colors[idx + 1] = col.g;
      colors[idx + 2] = col.b;
    }
  }

  for (let i = 0; i < SPINE_RINGS - 1; i++) {
    for (let j = 0; j < RADIAL_SEGMENTS; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + j + 1;
      const d = i * ringVerts + j + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const baseColors = new Float32Array(colors);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return { geo, baseColors };
}

function buildFinGeometry(
  dna: CreatureBlueprint,
  rayCount: number,
): { geo: THREE.BufferGeometry; baseColors: Float32Array } {
  const geo = new THREE.BufferGeometry();
  const cols = TAIL_V_SEGS + 1;
  const rows = TAIL_U_SEGS + 1;
  const positions = new Float32Array(rows * cols * 3);
  const colors = new Float32Array(rows * cols * 3);
  const indices: number[] = [];

  const cPrimary = new THREE.Color(dna.primaryColor);
  const cSecondary = new THREE.Color(dna.secondaryColor);
  const cFin = new THREE.Color(dna.finColor);
  const cTip = new THREE.Color('#f8fafc');

  for (let r = 0; r <= TAIL_U_SEGS; r++) {
    const u = r / TAIL_U_SEGS;
    for (let c = 0; c <= TAIL_V_SEGS; c++) {
      const v = c / TAIL_V_SEGS;
      const col = cPrimary.clone().lerp(cFin, Math.pow(u, 0.52));
      const midBand = Math.sin(u * Math.PI) * 0.3;
      col.lerp(cSecondary, midBand);

      const ray = 0.5 + 0.5 * Math.cos(v * Math.PI * rayCount);
      col.multiplyScalar(0.76 + 0.34 * ray);
      col.lerp(cTip, ray * (0.16 + 0.18 * u));

      if (u > 0.78) {
        const tipMix = THREE.MathUtils.smoothstep(u, 0.78, 1.0);
        col.lerp(cTip, tipMix * 0.45);
      }

      const idx = (r * cols + c) * 3;
      colors[idx] = col.r;
      colors[idx + 1] = col.g;
      colors[idx + 2] = col.b;
    }
  }

  for (let r = 0; r < TAIL_U_SEGS; r++) {
    for (let c = 0; c < TAIL_V_SEGS; c++) {
      const a = r * cols + c;
      const b = (r + 1) * cols + c;
      const d = r * cols + c + 1;
      const e = (r + 1) * cols + c + 1;
      indices.push(a, b, d, b, e, d);
    }
  }

  const baseColors = new Float32Array(colors);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return { geo, baseColors };
}

/** Swept tapered teardrop pectoral fin geometry. */
function buildPectoralGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.11, 0.08, 0.24, 0.03);
  shape.quadraticCurveTo(0.28, -0.02, 0.19, -0.08);
  shape.quadraticCurveTo(0.08, -0.09, 0, 0);
  return new THREE.ShapeGeometry(shape, 8);
}

function applyColorVibrancy(
  geo: THREE.BufferGeometry,
  baseColors: Float32Array,
  vibrancy: number,
): void {
  const attr = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!attr) return;
  const arr = attr.array as Float32Array;
  const v = THREE.MathUtils.clamp(vibrancy, 0.25, 1.0);
  for (let i = 0; i < arr.length; i += 3) {
    const r = baseColors[i];
    const g = baseColors[i + 1];
    const b = baseColors[i + 2];
    const pale = r * 0.299 + g * 0.587 + b * 0.114;
    const grey = pale * 0.78 + 0.16;
    arr[i] = grey + (r - grey) * v;
    arr[i + 1] = grey + (g - grey) * v;
    arr[i + 2] = grey + (b - grey) * v;
  }
  attr.needsUpdate = true;
}

function tailShapeProfile(style: TailStyle, vNorm: number): { length: number; spread: number } {
  const absV = Math.abs(vNorm);
  if (style === 'halfmoon') {
    const scallop = 0.94 + 0.06 * Math.abs(Math.sin(vNorm * Math.PI * 6.0));
    const arc = Math.sqrt(Math.max(0.05, 1 - absV * absV * 0.65));
    return { length: 0.94 * arc * scallop, spread: 0.86 };
  }
  if (style === 'crowntail') {
    const spikes = 0.72 + 0.28 * Math.abs(Math.sin(vNorm * Math.PI * 4.5));
    return { length: 0.88 * spikes, spread: 0.72 };
  }
  if (style === 'veil') {
    const scallop = 0.93 + 0.07 * Math.abs(Math.sin(vNorm * Math.PI * 5.0));
    const droop = 1 - absV * 0.22;
    return { length: 1.06 * droop * scallop, spread: 0.56 };
  }
  if (style === 'double') {
    const scallop = 0.94 + 0.06 * Math.abs(Math.sin(vNorm * Math.PI * 5.0));
    const twinLobe = 0.62 + 0.38 * Math.pow(absV, 0.7);
    const notch = absV < 0.2 ? 0.55 + absV * 2 : 1;
    return { length: 0.78 * twinLobe * notch * scallop, spread: 0.65 };
  }
  if (style === 'fan') {
    const scallop = 0.95 + 0.05 * Math.abs(Math.sin(vNorm * Math.PI * 5.0));
    return { length: 0.54 * scallop, spread: 0.48 };
  }
  const scallop = 0.96 + 0.04 * Math.abs(Math.sin(vNorm * Math.PI * 4.0));
  const fork = 0.52 + 0.48 * Math.pow(absV, 1.35);
  return { length: 0.68 * fork * scallop, spread: 0.54 };
}

export function ProceduralFishMesh({ entity, selected }: Props) {
  const world = useWorld();
  const dna = entity.get(CreatureDna)!;

  const bodyData = useMemo(() => buildBodyGeometry(dna), [dna]);
  const tailData = useMemo(() => buildFinGeometry(dna, dna.kind === 'betta' ? 14 : 10), [dna]);
  const dorsalData = useMemo(() => buildFinGeometry(dna, dna.kind === 'betta' ? 11 : 8), [dna]);
  const analData = useMemo(() => buildFinGeometry(dna, dna.kind === 'betta' ? 12 : 7), [dna]);
  const pectoralGeo = useMemo(() => buildPectoralGeometry(), []);

  const bodyGeo = bodyData.geo;
  const tailGeo = tailData.geo;
  const dorsalGeo = dorsalData.geo;
  const analGeo = analData.geo;

  const bodyRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const dorsalRef = useRef<THREE.Mesh>(null);
  const analRef = useRef<THREE.Mesh>(null);
  const leftPecRef = useRef<THREE.Mesh>(null);
  const rightPecRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const barbelLeftRef = useRef<THREE.Mesh>(null);
  const barbelRightRef = useRef<THREE.Mesh>(null);
  const selectRingRef = useRef<THREE.Mesh>(null);
  const debugGroupRef = useRef<THREE.Group>(null);
  const lastVibrancyRef = useRef(1.0);

  const wavedSpine = useMemo(
    () => Array.from({ length: SPINE_RINGS }, () => new THREE.Vector3()),
    [],
  );

  useEffect(() => {
    lastVibrancyRef.current = 1.0;
    return () => {
      bodyGeo.dispose();
      tailGeo.dispose();
      dorsalGeo.dispose();
      analGeo.dispose();
      pectoralGeo.dispose();
    };
  }, [bodyGeo, tailGeo, dorsalGeo, analGeo, pectoralGeo]);

  useFrame(() => {
    const meta = entity.get(CreatureMeta);
    const vitals = entity.get(CreatureVitals);
    const spine = entity.get(SpineKinematics);
    const env = world.get(TankEnvironment);
    if (!meta || !vitals || !spine || spine.joints.length < SPINE_RINGS) return;

    const scale = dna.baseScale + (dna.maxScale - dna.baseScale) * meta.growth;
    const isAlive = vitals.alive;
    const rollAngle = (isAlive ? 0 : Math.PI * 0.45) + spine.bank;
    const flareFactor = spine.isFlaring ? 1.28 : 1;
    const clampFactor = 1 - (vitals.stress / 100) * 0.35;
    const integrity = vitals.finIntegrity;
    const gillFlare = isAlive
      ? (0.04 + 0.045 * Math.sin(spine.gillPhase)) * Math.min(2.2, vitals.gillRate)
      : 0;

    // Update stress paling / color vibrancy when changed noticeably
    if (Math.abs(vitals.colorVibrancy - lastVibrancyRef.current) > 0.03) {
      lastVibrancyRef.current = vitals.colorVibrancy;
      applyColorVibrancy(bodyGeo, bodyData.baseColors, vitals.colorVibrancy);
      applyColorVibrancy(tailGeo, tailData.baseColors, vitals.colorVibrancy);
      applyColorVibrancy(dorsalGeo, dorsalData.baseColors, vitals.colorVibrancy);
      applyColorVibrancy(analGeo, analData.baseColors, vitals.colorVibrancy);
    }

    // 1. Compute waved 3D spine positions along horizontal perpendicular
    const headJ = spine.joints[0];
    const neckJ = spine.joints[1];
    const headSpeedFactor = isAlive ? 1 : 0.05;

    for (let i = 0; i < SPINE_RINGS; i++) {
      const t = i / (SPINE_RINGS - 1);
      const curr = spine.joints[i];
      const prev = i === 0 ? neckJ : spine.joints[i - 1];
      let tx = i === 0 ? prev.x - curr.x : curr.x - prev.x;
      let tz = i === 0 ? prev.z - curr.z : curr.z - prev.z;
      const len = Math.hypot(tx, tz) || 1e-4;
      tx /= len;
      tz /= len;

      const nx = -tz;
      const nz = tx;
      const wave =
        Math.sin(spine.phase - t * 4.4) * dna.waveAmp * scale * Math.pow(t, 1.45) * headSpeedFactor;

      wavedSpine[i].set(curr.x + nx * wave, curr.y, curr.z + nz * wave);
    }

    // 2. Deform 3D anatomical body along curved spine with gill breathing & bank
    const posAttr = bodyGeo.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const ringVerts = RADIAL_SEGMENTS + 1;

    const tangent = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < SPINE_RINGS; i++) {
      const u = i / (SPINE_RINGS - 1);
      const center = wavedSpine[i];

      if (i < SPINE_RINGS - 1) {
        tangent.subVectors(wavedSpine[i + 1], center);
      } else {
        tangent.subVectors(center, wavedSpine[i - 1]);
      }
      if (tangent.lengthSq() < 1e-6) tangent.set(-1, 0, 0);
      tangent.normalize();

      right.crossVectors(worldUp, tangent);
      if (right.lengthSq() < 1e-6) right.set(0, 0, 1);
      right.normalize();
      up.crossVectors(tangent, right).normalize();

      if (rollAngle !== 0) {
        right.applyAxisAngle(tangent, rollAngle);
        up.applyAxisAngle(tangent, rollAngle);
      }

      const cs = bodyCrossSection(dna.morphology, u, gillFlare);
      const rx = cs.rx * dna.widthFactor * scale;
      const ry = cs.ry * dna.heightFactor * scale;

      for (let j = 0; j < ringVerts; j++) {
        const theta = (j / RADIAL_SEGMENTS) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const idx = (i * ringVerts + j) * 3;
        arr[idx] = center.x + right.x * cosT * rx + up.x * sinT * ry;
        arr[idx + 1] = center.y + right.y * cosT * rx + up.y * sinT * ry;
        arr[idx + 2] = center.z + right.z * cosT * rx + up.z * sinT * ry;
      }
    }
    posAttr.needsUpdate = true;
    bodyGeo.computeVertexNormals();
    bodyGeo.computeBoundingSphere();

    // 3. Position proportional eyes, barbels, and swept teardrop pectoral fins
    const eyeJoint = wavedSpine[1];
    const pecJoint = wavedSpine[2];
    const headTangent = new THREE.Vector3().subVectors(wavedSpine[2], wavedSpine[0]).normalize();
    const headRight = new THREE.Vector3().crossVectors(worldUp, headTangent).normalize();
    const headUp = new THREE.Vector3().crossVectors(headTangent, headRight).normalize();
    if (rollAngle !== 0) {
      headRight.applyAxisAngle(headTangent, rollAngle);
      headUp.applyAxisAngle(headTangent, rollAngle);
    }

    const eyeSpan = dna.widthFactor * scale * 0.58;
    const eyeUp = dna.heightFactor * scale * 0.24;
    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.position
        .copy(eyeJoint)
        .addScaledVector(headRight, eyeSpan)
        .addScaledVector(headUp, eyeUp);
      rightEyeRef.current.position
        .copy(eyeJoint)
        .addScaledVector(headRight, -eyeSpan)
        .addScaledVector(headUp, eyeUp);
      const eScale = scale * (dna.morphology === 'globiform' ? 0.044 : 0.034);
      leftEyeRef.current.scale.setScalar(eScale);
      rightEyeRef.current.scale.setScalar(eScale);
    }

    if (barbelLeftRef.current && barbelRightRef.current && dna.hasBarbels) {
      const nose = wavedSpine[0];
      barbelLeftRef.current.position
        .copy(nose)
        .addScaledVector(headRight, 0.08 * scale)
        .addScaledVector(headUp, -0.05 * scale);
      barbelRightRef.current.position
        .copy(nose)
        .addScaledVector(headRight, -0.08 * scale)
        .addScaledVector(headUp, -0.05 * scale);
    }

    if (leftPecRef.current && rightPecRef.current) {
      const pecSpan = dna.widthFactor * scale * 0.82;
      const pecDown = -dna.heightFactor * scale * 0.24;
      const rowAmp = dna.swimStyle === 'labriform_waddle' ? 0.45 : 0.28;
      const flap = Math.sin(spine.pectoralPhase) * rowAmp;
      const heading = Math.atan2(-headTangent.z, -headTangent.x);
      const pScale = scale * clampFactor * (0.85 + 0.15 * integrity);

      leftPecRef.current.position
        .copy(pecJoint)
        .addScaledVector(headRight, pecSpan)
        .addScaledVector(headUp, pecDown);
      leftPecRef.current.rotation.set(spine.pitch * 0.5, -heading + 0.85 + flap, 0.2);
      leftPecRef.current.scale.setScalar(pScale);

      rightPecRef.current.position
        .copy(pecJoint)
        .addScaledVector(headRight, -pecSpan)
        .addScaledVector(headUp, pecDown);
      rightPecRef.current.rotation.set(-spine.pitch * 0.5, -heading - 0.85 - flap, -0.2);
      rightPecRef.current.scale.setScalar(pScale);
    }

    // 4. Update procedural flowing Tail Fin with clamping & fin integrity erosion
    const tailBase = wavedSpine[SPINE_RINGS - 1];
    const tailPrev = wavedSpine[SPINE_RINGS - 2];
    const tailDir = new THREE.Vector3().subVectors(tailBase, tailPrev).normalize();
    const tailRight = new THREE.Vector3().crossVectors(worldUp, tailDir).normalize();
    const tailUp = new THREE.Vector3().crossVectors(tailDir, tailRight).normalize();
    if (rollAngle !== 0) {
      tailRight.applyAxisAngle(tailDir, rollAngle);
      tailUp.applyAxisAngle(tailDir, rollAngle);
    }

    const tailAttr = tailGeo.getAttribute('position') as THREE.BufferAttribute;
    const tArr = tailAttr.array as Float32Array;
    const cols = TAIL_V_SEGS + 1;

    for (let r = 0; r <= TAIL_U_SEGS; r++) {
      const u = r / TAIL_U_SEGS;
      for (let c = 0; c <= TAIL_V_SEGS; c++) {
        const vNorm = (c / TAIL_V_SEGS) * 2 - 1;
        const prof = tailShapeProfile(dna.tailStyle, vNorm);
        const rotTatter =
          integrity < 0.88 && u > 0.5
            ? 1 - (1 - integrity) * (0.42 + 0.58 * Math.abs(Math.sin(c * 2.9))) * u
            : 1;
        const reach = prof.length * scale * (0.9 + 0.1 * flareFactor) * rotTatter * u;
        const vertical =
          vNorm *
          prof.spread *
          scale *
          flareFactor *
          clampFactor *
          (0.22 + 0.78 * Math.pow(u, 0.72));
        const lateralRipple =
          Math.sin(spine.phase - 4.4 - u * 2.6 + vNorm * 1.1) *
          (0.14 + dna.finDrag * 0.18) *
          scale *
          u *
          headSpeedFactor;
        const veilDroop = dna.tailStyle === 'veil' ? -0.18 * u * u * scale : 0;

        const idx = (r * cols + c) * 3;
        tArr[idx] = tailBase.x + tailDir.x * reach + tailUp.x * (vertical + veilDroop) + tailRight.x * lateralRipple;
        tArr[idx + 1] = tailBase.y + tailDir.y * reach + tailUp.y * (vertical + veilDroop) + tailRight.y * lateralRipple;
        tArr[idx + 2] = tailBase.z + tailDir.z * reach + tailUp.z * (vertical + veilDroop) + tailRight.z * lateralRipple;
      }
    }
    tailAttr.needsUpdate = true;
    tailGeo.computeVertexNormals();
    tailGeo.computeBoundingSphere();

    // 5. Update Dorsal Sail Fin along mid-spine (joints 3..8)
    const dAttr = dorsalGeo.getAttribute('position') as THREE.BufferAttribute;
    const dArr = dAttr.array as Float32Array;
    const isBetta = dna.kind === 'betta';
    const dHeight = (isBetta ? 0.42 : 0.25) * scale * flareFactor * clampFactor;

    for (let r = 0; r <= TAIL_U_SEGS; r++) {
      const hFrac = r / TAIL_U_SEGS;
      for (let c = 0; c <= TAIL_V_SEGS; c++) {
        const spanFrac = c / TAIL_V_SEGS;
        const spineIdx = 3 + spanFrac * 5;
        const lo = Math.floor(spineIdx);
        const hi = Math.min(SPINE_RINGS - 1, lo + 1);
        const frac = spineIdx - lo;
        const p = new THREE.Vector3().lerpVectors(wavedSpine[lo], wavedSpine[hi], frac);
        const bodyH =
          bodyCrossSection(dna.morphology, spineIdx / (SPINE_RINGS - 1), 0).ry *
          dna.heightFactor *
          scale;
        const rotTatter =
          integrity < 0.88 && hFrac > 0.5
            ? 1 - (1 - integrity) * (0.4 + 0.6 * Math.abs(Math.cos(c * 2.5))) * hFrac
            : 1;
        const arch = Math.sin(spanFrac * Math.PI) * (isBetta ? 1.1 : 0.92);
        const sway = Math.sin(spine.phase - spineIdx * 0.4) * 0.08 * hFrac * scale;

        const idx = (r * cols + c) * 3;
        dArr[idx] = p.x + headRight.x * sway;
        dArr[idx + 1] = p.y + bodyH * 0.82 + dHeight * hFrac * arch * rotTatter;
        dArr[idx + 2] = p.z + headRight.z * sway;
      }
    }
    dAttr.needsUpdate = true;
    dorsalGeo.computeVertexNormals();
    dorsalGeo.computeBoundingSphere();

    // 5b. Update Ventral / Anal Belly Sail Fin along joints 4..9
    const aAttr = analGeo.getAttribute('position') as THREE.BufferAttribute;
    const aArr = aAttr.array as Float32Array;
    const aHeight =
      (isBetta ? 0.36 : dna.kind === 'goldfish' ? 0.22 : 0.13) *
      scale *
      flareFactor *
      clampFactor;

    for (let r = 0; r <= TAIL_U_SEGS; r++) {
      const hFrac = r / TAIL_U_SEGS;
      for (let c = 0; c <= TAIL_V_SEGS; c++) {
        const spanFrac = c / TAIL_V_SEGS;
        const spineIdx = 4 + spanFrac * 5;
        const lo = Math.floor(spineIdx);
        const hi = Math.min(SPINE_RINGS - 1, lo + 1);
        const frac = spineIdx - lo;
        const p = new THREE.Vector3().lerpVectors(wavedSpine[lo], wavedSpine[hi], frac);
        const bodyH =
          bodyCrossSection(dna.morphology, spineIdx / (SPINE_RINGS - 1), 0).ry *
          dna.heightFactor *
          scale;
        const arch = Math.sin(spanFrac * Math.PI) * (isBetta ? 1.08 : 0.9);
        const sway = Math.sin(spine.phase - spineIdx * 0.45 - 0.6) * 0.08 * hFrac * scale;

        const idx = (r * cols + c) * 3;
        aArr[idx] = p.x + headRight.x * sway;
        aArr[idx + 1] = p.y - bodyH * 0.78 - aHeight * hFrac * arch;
        aArr[idx + 2] = p.z + headRight.z * sway;
      }
    }
    aAttr.needsUpdate = true;
    analGeo.computeVertexNormals();
    analGeo.computeBoundingSphere();

    // 6. Selection ring & debug spine dots
    if (selectRingRef.current) {
      selectRingRef.current.visible = selected;
      selectRingRef.current.position.set(headJ.x, headJ.y, headJ.z);
    }

    if (debugGroupRef.current) {
      debugGroupRef.current.visible = Boolean(env?.showSpineDebug);
      if (env?.showSpineDebug) {
        debugGroupRef.current.children.forEach((child, idx) => {
          if (wavedSpine[idx]) {
            child.position.copy(wavedSpine[idx]);
          }
        });
      }
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const env = world.get(TankEnvironment);
    if (env?.decorateMode) return;
    e.stopPropagation();
    world.set(TankEnvironment, { selectedEntityId: entity.id() });
  };

  return (
    <group
      onClick={handleClick}
      onPointerDown={(e) => {
        if (!world.get(TankEnvironment)?.decorateMode) e.stopPropagation();
      }}
    >
      {/* Anatomical curved 3D body */}
      <mesh ref={bodyRef} geometry={bodyGeo} frustumCulled={false} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.28}
          metalness={0.18}
          emissive={dna.primaryColor}
          emissiveIntensity={0.16}
        />
      </mesh>

      {/* Flowing rayed caudal tail fin */}
      <mesh ref={tailRef} geometry={tailGeo} frustumCulled={false}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={dna.kind === 'betta' ? 0.86 : 0.9}
          side={THREE.DoubleSide}
          roughness={0.28}
          metalness={0.14}
          emissive={dna.finColor}
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Swaying dorsal sail fin */}
      <mesh ref={dorsalRef} geometry={dorsalGeo} frustumCulled={false}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={dna.kind === 'betta' ? 0.86 : 0.9}
          side={THREE.DoubleSide}
          roughness={0.28}
          metalness={0.14}
          emissive={dna.finColor}
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Flowing ventral / anal belly sail fin */}
      <mesh ref={analRef} geometry={analGeo} frustumCulled={false}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={dna.kind === 'betta' ? 0.86 : 0.9}
          side={THREE.DoubleSide}
          roughness={0.28}
          metalness={0.14}
          emissive={dna.finColor}
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Swept tapered teardrop pectoral fins */}
      <mesh ref={leftPecRef} geometry={pectoralGeo}>
        <meshStandardMaterial
          color={dna.finColor}
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
          roughness={0.28}
          metalness={0.14}
          emissive={dna.finColor}
          emissiveIntensity={0.16}
        />
      </mesh>
      <mesh ref={rightPecRef} geometry={pectoralGeo}>
        <meshStandardMaterial
          color={dna.finColor}
          transparent
          opacity={0.82}
          side={THREE.DoubleSide}
          roughness={0.28}
          metalness={0.14}
          emissive={dna.finColor}
          emissiveIntensity={0.16}
        />
      </mesh>

      {/* Proportional dark-iris eyes with subtle specular ring */}
      <mesh ref={leftEyeRef}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial
          color="#cbd5e1"
          emissive="#94a3b8"
          emissiveIntensity={0.28}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      <mesh ref={rightEyeRef}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial
          color="#cbd5e1"
          emissive="#94a3b8"
          emissiveIntensity={0.28}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>

      {/* Koi sensory barbels */}
      {dna.hasBarbels && (
        <>
          <mesh ref={barbelLeftRef} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.008, 0.003, 0.08, 5]} />
            <meshStandardMaterial
              color={dna.secondaryColor}
              emissive={dna.secondaryColor}
              emissiveIntensity={0.14}
            />
          </mesh>
          <mesh ref={barbelRightRef} rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.008, 0.003, 0.08, 5]} />
            <meshStandardMaterial
              color={dna.secondaryColor}
              emissive={dna.secondaryColor}
              emissiveIntensity={0.14}
            />
          </mesh>
        </>
      )}

      {/* Selection ring */}
      <mesh ref={selectRingRef} rotation={[-Math.PI / 2, 0, 0]} visible={selected}>
        <ringGeometry args={[0.38, 0.45, 24]} />
        <meshBasicMaterial
          color="#38bdf8"
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>

      {/* Spine debug joints */}
      <group ref={debugGroupRef} visible={false}>
        {Array.from({ length: SPINE_RINGS }).map((_, idx) => (
          <mesh key={idx}>
            <sphereGeometry args={[idx === 0 ? 0.05 : 0.028, 6, 6]} />
            <meshBasicMaterial color={idx === 0 ? '#f43f5e' : '#22d3ee'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
