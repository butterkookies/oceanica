import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ASCII_ATLAS_COLS,
  ASCII_ATLAS_ROWS,
  computeAsciiGridSize,
  createAsciiGlyphAtlasTexture,
} from './asciiGlyphAtlas';

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tDepth;
  uniform sampler2D uGlyphAtlas;
  uniform vec2 uGridSize;
  uniform vec2 uAtlasGrid;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uTime;
  uniform vec3 uVoidColor;

  varying vec2 vUv;

  vec3 linearToSrgb(vec3 c) {
    vec3 clamped = max(c, vec3(0.0));
    return mix(
      clamped * 12.92,
      1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055,
      step(vec3(0.0031308), clamped)
    );
  }

  vec3 srgbToLinear(vec3 c) {
    vec3 clamped = clamp(c, 0.0, 1.0);
    return mix(
      clamped / 12.92,
      pow((clamped + 0.055) / 1.055, vec3(2.4)),
      step(vec3(0.04045), clamped)
    );
  }

  vec3 acesToneMap(vec3 color, float exposure) {
    const mat3 ACESInputMat = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777)
    );
    const mat3 ACESOutputMat = mat3(
      vec3(1.60475, -0.10208, -0.00327),
      vec3(-0.53108, 1.10813, -0.07276),
      vec3(-0.07367, -0.00605, 1.07602)
    );
    color *= exposure / 0.6;
    color = ACESInputMat * color;
    vec3 a = color * (color + 0.0245786) - 0.000090537;
    vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
    color = a / b;
    return clamp(ACESOutputMat * color, 0.0, 1.0);
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec2 subCenterUv(vec2 subCoord) {
    vec2 subRes = uGridSize * 2.0;
    return clamp((subCoord + 0.5) / subRes, vec2(0.0), vec2(1.0));
  }

  void sampleCellInfo(vec2 cell, out vec3 outSrgb, out float outLuma, out float outMinDepth) {
    vec2 clampedCell = clamp(cell, vec2(0.0), uGridSize - 1.0);
    vec2 base = clampedCell * 2.0;

    vec2 uv0 = subCenterUv(base + vec2(0.0, 0.0));
    vec2 uv1 = subCenterUv(base + vec2(1.0, 0.0));
    vec2 uv2 = subCenterUv(base + vec2(0.0, 1.0));
    vec2 uv3 = subCenterUv(base + vec2(1.0, 1.0));

    vec3 c0 = texture2D(tScene, uv0).rgb;
    vec3 c1 = texture2D(tScene, uv1).rgb;
    vec3 c2 = texture2D(tScene, uv2).rgb;
    vec3 c3 = texture2D(tScene, uv3).rgb;

    float z0 = texture2D(tDepth, uv0).r;
    float z1 = texture2D(tDepth, uv1).r;
    float z2 = texture2D(tDepth, uv2).r;
    float z3 = texture2D(tDepth, uv3).r;
    outMinDepth = mix(uCameraNear, uCameraFar, min(min(z0, z1), min(z2, z3)));

    vec3 avgLin = (c0 + c1 + c2 + c3) * 0.25;
    vec3 peakLin = max(max(c0, c1), max(c2, c3));

    float avgPeak = max(avgLin.r, max(avgLin.g, avgLin.b));
    float hiPeak = max(peakLin.r, max(peakLin.g, peakLin.b));
    vec3 sampleLin = (hiPeak > avgPeak * 1.9 && hiPeak > 0.08)
      ? mix(avgLin, peakLin, 0.62)
      : avgLin;

    vec3 mapped = acesToneMap(sampleLin, 1.24);
    vec3 srgb = linearToSrgb(mapped);
    float rawLuma = dot(srgb, vec3(0.299, 0.587, 0.114));
    srgb = clamp(mix(vec3(rawLuma), srgb, 1.22), 0.0, 1.0);

    outSrgb = srgb;
    outLuma = pow(clamp(dot(srgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 0.88);
  }

  float sampleGlyphAlpha(int glyphIdx, vec2 localUv) {
    float fIdx = float(glyphIdx);
    float gCol = mod(fIdx, uAtlasGrid.x);
    float gRow = floor(fIdx / uAtlasGrid.x);
    float texRow = (uAtlasGrid.y - 1.0) - gRow;

    vec2 base = mix(vec2(0.05), vec2(0.95), clamp(localUv, 0.0, 1.0));
    vec2 p0 = clamp(base + vec2(-0.045, -0.045), vec2(0.04), vec2(0.96));
    vec2 p1 = clamp(base + vec2( 0.045, -0.045), vec2(0.04), vec2(0.96));
    vec2 p2 = clamp(base + vec2(-0.045,  0.045), vec2(0.04), vec2(0.96));
    vec2 p3 = clamp(base + vec2( 0.045,  0.045), vec2(0.04), vec2(0.96));

    float a0 = texture2D(uGlyphAtlas, vec2((gCol + p0.x) / uAtlasGrid.x, (texRow + p0.y) / uAtlasGrid.y)).a;
    float a1 = texture2D(uGlyphAtlas, vec2((gCol + p1.x) / uAtlasGrid.x, (texRow + p1.y) / uAtlasGrid.y)).a;
    float a2 = texture2D(uGlyphAtlas, vec2((gCol + p2.x) / uAtlasGrid.x, (texRow + p2.y) / uAtlasGrid.y)).a;
    float a3 = texture2D(uGlyphAtlas, vec2((gCol + p3.x) / uAtlasGrid.x, (texRow + p3.y) / uAtlasGrid.y)).a;

    float avg = (a0 + a1 + a2 + a3) * 0.25;
    return smoothstep(0.06, 0.68, avg);
  }

  int selectSparkGlyph(vec2 cell) {
    float phase = hash21(cell) * 6.2831 + uTime * 3.5;
    float s = fract(sin(phase) * 43758.5453);
    if (s < 0.16) return 26; // '*'
    if (s < 0.30) return 25; // '+'
    if (s < 0.46) return 34; // 'o'
    if (s < 0.60) return 56; // 'O'
    if (s < 0.74) return 57; // '0'
    if (s < 0.88) return 7;  // '-'
    return 1;                // '.'
  }

  int selectFoliageGlyph(vec2 cell, float gx, float gy, float luma) {
    float sway = sin(uTime * 1.8 + cell.x * 0.22 + cell.y * 0.14) * 0.35;
    float tilt = gx + sway;
    if (luma < 0.14) {
      return (hash21(cell) > 0.5) ? 2 : 4; // ',' or '\''
    }
    if (tilt > 0.24) return 69; // '/'
    if (tilt < -0.24) return 70; // '\\'
    if (abs(gy) < 0.12 && luma > 0.34) {
      float h = hash21(cell + 17.0);
      if (h < 0.34) return 12; // 'i'
      if (h < 0.68) return 13; // 'l'
      return 71;               // '|'
    }
    float h = hash21(cell + 5.0);
    if (h < 0.25) return 15; // 't'
    if (h < 0.50) return 28; // 'v'
    if (h < 0.75) return 6;  // ';'
    return 71;               // '|'
  }

  int mapDensityRamp(float t) {
    // 1..68 covers '.' through '@' across 68 dense perceptual ink steps
    float bucket = 1.0 + floor(clamp(t, 0.0, 0.999) * 68.0);
    return int(clamp(bucket, 1.0, 68.0));
  }

  void main() {
    vec2 gridPos = vUv * uGridSize;
    vec2 cell = floor(gridPos);
    vec2 localUv = fract(gridPos);

    vec3 srgb;
    float luma;
    float dC;
    sampleCellInfo(cell, srgb, luma, dC);

    vec3 voidSrgb = linearToSrgb(uVoidColor);
    float maxComp = max(srgb.r, max(srgb.g, srgb.b));

    if ((dC >= uCameraFar - 0.5 && luma < 0.045) || (luma < 0.042 && maxComp < 0.065)) {
      gl_FragColor = vec4(srgbToLinear(voidSrgb), 1.0);
      #include <colorspace_fragment>
      return;
    }

    vec3 sL; float lL; float dL;
    vec3 sR; float lR; float dR;
    vec3 sU; float lU; float dU;
    vec3 sD; float lD; float dD;
    sampleCellInfo(cell + vec2(-1.0, 0.0), sL, lL, dL);
    sampleCellInfo(cell + vec2(1.0, 0.0), sR, lR, dR);
    sampleCellInfo(cell + vec2(0.0, 1.0), sU, lU, dU);
    sampleCellInfo(cell + vec2(0.0, -1.0), sD, lD, dD);

    float neighborMaxLuma = max(max(lL, lR), max(lU, lD));
    float gradX = lR - lL;
    float gradY = lU - lD;
    float gradMag = length(vec2(gradX, gradY));

    bool isIsolatedSpark = luma > 0.28 && neighborMaxLuma < 0.14;
    bool isFoliage = srgb.g > srgb.r * 1.18 && srgb.g > srgb.b * 1.12 && luma < 0.56;

    int glyphIdx;
    if (isIsolatedSpark) {
      glyphIdx = selectSparkGlyph(cell);
    } else if (isFoliage) {
      glyphIdx = selectFoliageGlyph(cell, gradX, gradY, luma);
    } else if (gradMag > 0.25 && luma > 0.12) {
      float absGx = abs(gradX);
      float absGy = abs(gradY);
      if (absGx > absGy * 1.8) {
        glyphIdx = 71; // '|'
      } else if (absGy > absGx * 1.8) {
        glyphIdx = (mod(cell.x, 2.0) < 1.0 && luma < 0.58) ? 8 : 7; // '~' or '-'
      } else if (gradX * gradY > 0.0) {
        glyphIdx = 70; // '\\'
      } else {
        glyphIdx = 69; // '/'
      }
    } else {
      float jitter = (hash21(cell) - 0.5) * 0.065;
      float normLuma = clamp((luma - 0.04) / 0.96 + jitter, 0.0, 1.0);
      glyphIdx = mapDensityRamp(normLuma);
    }

    float glyphAlpha = sampleGlyphAlpha(glyphIdx, localUv);
    vec3 charSrgb = srgb;
    vec3 glowSrgb = charSrgb * (0.13 * luma);
    vec3 finalSrgb = clamp(mix(voidSrgb + glowSrgb, charSrgb, glyphAlpha), 0.0, 1.0);

    gl_FragColor = vec4(srgbToLinear(finalSrgb), 1.0);
    #include <colorspace_fragment>
  }
`;

export function SceneAsciiPass() {
  const { size, gl } = useThree();

  const resources = useMemo(() => {
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
      depthTexture,
    });

    const glyphAtlas = createAsciiGlyphAtlasTexture();
    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const postMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: sceneTarget.texture },
        tDepth: { value: depthTexture },
        uGlyphAtlas: { value: glyphAtlas },
        uGridSize: { value: new THREE.Vector2(240, 150) },
        uAtlasGrid: { value: new THREE.Vector2(ASCII_ATLAS_COLS, ASCII_ATLAS_ROWS) },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 60 },
        uTime: { value: 0 },
        uVoidColor: { value: new THREE.Color('#02060d') },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const quad = new THREE.Mesh(quadGeo, postMat);
    quad.frustumCulled = false;
    postScene.add(quad);

    return {
      sceneTarget,
      depthTexture,
      glyphAtlas,
      postScene,
      postCamera,
      quadGeo,
      postMat,
    };
  }, []);

  useEffect(() => {
    const { cols, rows } = computeAsciiGridSize(size.width, size.height, gl.getPixelRatio());
    resources.sceneTarget.setSize(cols * 2, rows * 2);
    resources.postMat.uniforms.uGridSize.value.set(cols, rows);
  }, [size.width, size.height, gl, resources]);

  useEffect(() => {
    return () => {
      resources.sceneTarget.dispose();
      resources.depthTexture.dispose();
      resources.glyphAtlas.dispose();
      resources.quadGeo.dispose();
      resources.postMat.dispose();
    };
  }, [resources]);

  useFrame(({ gl, scene, camera, clock }) => {
    const prevTarget = gl.getRenderTarget();

    resources.postMat.uniforms.uCameraNear.value = camera.near;
    resources.postMat.uniforms.uCameraFar.value = camera.far;
    resources.postMat.uniforms.uTime.value = clock.getElapsedTime();
    if (scene.background instanceof THREE.Color) {
      resources.postMat.uniforms.uVoidColor.value.copy(scene.background);
    }

    gl.setRenderTarget(resources.sceneTarget);
    gl.clear(true, true, false);
    gl.render(scene, camera);

    gl.setRenderTarget(prevTarget);
    gl.render(resources.postScene, resources.postCamera);
  }, 1);

  return null;
}
