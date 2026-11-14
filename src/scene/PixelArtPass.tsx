import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface PixelArtPassProps {
  /** Whether the retro pixel-art post-process pass is active. */
  enabled: boolean;
  /** Target virtual height in pixels (width scales automatically by aspect ratio). */
  pixelHeight: number;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 uResolution;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uIsOrtho;
  uniform float uColorLevels;

  varying vec2 vUv;

  float readLinearDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).r;
    if (uIsOrtho > 0.5) {
      return mix(uCameraNear, uCameraFar, z);
    }
    float zNdc = z * 2.0 - 1.0;
    return (2.0 * uCameraNear * uCameraFar) /
      max(0.0001, uCameraFar + uCameraNear - zNdc * (uCameraFar - uCameraNear));
  }

  float bayer2(vec2 a) {
    a = floor(a);
    return fract(dot(a, vec2(0.5, a.y * 0.75)));
  }

  float bayer4(vec2 pos) {
    vec2 p = mod(floor(pos), 4.0);
    // Exact normalized 4x4 Bayer matrix in [0, 15/16], centered around 0
    return (bayer2(mod(p, 2.0)) + bayer2(floor(p * 0.5)) * 0.25) - 0.46875;
  }

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

  void main() {
    vec2 texel = 1.0 / uResolution;
    // Snap UV strictly to virtual pixel centers for razor-sharp pixel cells
    vec2 pixelCoord = floor(vUv * uResolution);
    vec2 uv = (pixelCoord + 0.5) / uResolution;

    vec4 base = texture2D(tDiffuse, uv);
    float dC = readLinearDepth(uv);
    float dL = readLinearDepth(uv - vec2(texel.x, 0.0));
    float dR = readLinearDepth(uv + vec2(texel.x, 0.0));
    float dU = readLinearDepth(uv + vec2(0.0, texel.y));
    float dD = readLinearDepth(uv - vec2(0.0, texel.y));

    // Silhouette ink outline only on strong foreground object boundaries (skip distant sky/void)
    float maxJump = max(max(dL - dC, dR - dC), max(dU - dC, dD - dC));
    float relJump = maxJump / max(dC, 1.0);
    float silhouette = smoothstep(0.14, 0.34, relJump) * step(dC, 18.0);

    // Subtle specular highlight along upper/outer ridges
    float maxDrop = max(max(dC - dL, dC - dR), max(dC - dU, dC - dD));
    float innerRim = smoothstep(0.12, 0.28, maxDrop / max(dC, 1.0)) * (1.0 - silhouette) * step(dC, 18.0);

    // Match Smooth 3D ACES Filmic brightness accurately
    vec3 col = acesToneMap(base.rgb, 1.08);
    col = mix(col, col * 0.44, silhouette * 0.62);
    col += vec3(0.03, 0.05, 0.07) * innerRim;

    // Convert linear -> perceptual sRGB for vibrant saturation boost, dithering & quantization
    vec3 srgb = linearToSrgb(col);
    float luma = dot(srgb, vec3(0.299, 0.587, 0.114));
    srgb = clamp(mix(vec3(luma), srgb, 1.14), 0.0, 1.0);

    float dither = bayer4(pixelCoord) * (0.55 / uColorLevels);
    srgb = clamp(floor((srgb + dither) * uColorLevels + 0.5) / uColorLevels, 0.0, 1.0);

    gl_FragColor = vec4(srgbToLinear(srgb), 1.0);
    #include <colorspace_fragment>
  }
`;

export function PixelArtPass({ enabled, pixelHeight }: PixelArtPassProps) {
  const { size } = useThree();

  const resources = useMemo(() => {
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
      depthTexture,
    });

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: renderTarget.texture },
        tDepth: { value: depthTexture },
        uResolution: { value: new THREE.Vector2(384, 216) },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 60 },
        uIsOrtho: { value: 0 },
        uColorLevels: { value: 24.0 },
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

    return { renderTarget, depthTexture, postScene, postCamera, quadGeo, postMat };
  }, []);

  useEffect(() => {
    const aspect = Math.max(0.2, size.width / Math.max(1, size.height));
    const targetH = Math.max(64, Math.round(pixelHeight));
    const targetW = Math.max(64, Math.round(targetH * aspect));
    resources.renderTarget.setSize(targetW, targetH);
    resources.postMat.uniforms.uResolution.value.set(targetW, targetH);
  }, [size.width, size.height, pixelHeight, resources]);

  useEffect(() => {
    return () => {
      resources.renderTarget.dispose();
      resources.depthTexture.dispose();
      resources.quadGeo.dispose();
      resources.postMat.dispose();
    };
  }, [resources]);

  useFrame(({ gl, scene, camera }) => {
    if (!enabled) {
      gl.render(scene, camera);
      return;
    }

    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(resources.renderTarget);
    gl.clear();
    gl.render(scene, camera);

    resources.postMat.uniforms.uCameraNear.value = camera.near;
    resources.postMat.uniforms.uCameraFar.value = camera.far;
    resources.postMat.uniforms.uIsOrtho.value = camera instanceof THREE.OrthographicCamera ? 1 : 0;

    gl.setRenderTarget(prevTarget);
    gl.render(resources.postScene, resources.postCamera);
  }, 1);

  return null;
}
