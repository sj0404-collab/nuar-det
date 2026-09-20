import * as THREE from 'three';

function buildPainterlyShader() {
  return {
    uniforms: {
      uColor: { value: new THREE.Color(0x8a8f98) },
      uEmission: { value: new THREE.Color(0x000000) },
      uEmissiveBias: { value: 0.0 },
      uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.35).normalize() },
      uLightColor: { value: new THREE.Color(0xffe6c0) },
      uAmbient: { value: new THREE.Color(0x141b28) },
      uRimColor: { value: new THREE.Color(0x4a86b8) },
      uRimPower: { value: 2.2 },
      uRimStrength: { value: 0.5 },
      uTint: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uEmission;
      uniform float uEmissiveBias;
      uniform vec3 uLightDir;
      uniform vec3 uLightColor;
      uniform vec3 uAmbient;
      uniform vec3 uRimColor;
      uniform float uRimPower;
      uniform float uRimStrength;
      uniform vec3 uTint;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;

      float stepify(float v, float a, float b) {
        return smoothstep(a, b, v);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        vec3 V = normalize(vView);
        float diff = dot(N, L);
        // painterly stepped lighting
        float s = stepify(diff, 0.32, 0.5) * 0.55
                + stepify(diff, 0.55, 0.8) * 0.35
                + stepify(diff, 0.85, 1.0) * 0.18;
        s = clamp(s, 0.0, 1.0) * 0.9 + 0.1;
        vec3 base = uColor * uTint;
        vec3 col = base * (uLightColor * s + uAmbient);
        // soft toon band artifact break
        col = mix(col, base, 0.08);
        // rim
        float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
        col += uRimColor * rim * uRimStrength;
        col += uEmission * uEmissiveBias;
        // fog
        float fogF = smoothstep(fogNear, fogFar, length(vWorld - cameraPosition));
        col = mix(col, fogColor, fogF);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  };
}

const painterlyShader = buildPainterlyShader();

export function makePainterlyMaterial(color, opts = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(painterlyShader.uniforms),
    vertexShader: painterlyShader.vertexShader,
    fragmentShader: painterlyShader.fragmentShader,
    fog: true,
  });
  mat.uniforms.uColor.value.set(color);
  if (opts.emission) mat.uniforms.uEmission.value.set(opts.emission);
  if (opts.rimStrength !== undefined) mat.uniforms.uRimStrength.value = opts.rimStrength;
  if (opts.rimColor) mat.uniforms.uRimColor.value.set(opts.rimColor);
  if (opts.tint) mat.uniforms.uTint.value.set(opts.tint);
  // fog uniforms matching the scene Fog(0x0b1424, 24, 240)
  mat.uniforms.fogColor = { value: new THREE.Color(0x0b1424) };
  mat.uniforms.fogNear = { value: 24 };
  mat.uniforms.fogFar = { value: 240 };
  return mat;
}

export function makeStandardMaterial(color, opts = {}) {
  const mat = new THREE.MeshToonMaterial({ color, gradientMap: null });
  mat.color.set(color);
  return mat;
}

export function gear(euler, THREE_) { return new THREE_.Euler(euler.x, euler.y, euler.z); }