import * as THREE from 'three';

function buildPainterlyShader() {
  return {
    uniforms: {
      uColor: { value: new THREE.Color(0x8a8f98) },
      uEmission: { value: new THREE.Color(0x000000) },
      uEmissiveBias: { value: 0.0 },
      uLightDir: { value: new THREE.Vector3(0.42, 0.82, 0.32).normalize() },
      uLightColor: { value: new THREE.Color(0xffe6c0) },
      uAmbient: { value: new THREE.Color(0x18223a) },
      uFill: { value: new THREE.Color(0x354a6e) },
      uRimColor: { value: new THREE.Color(0x4a86b8) },
      uRimPower: { value: 2.4 },
      uRimStrength: { value: 0.5 },
      uSpecular: { value: new THREE.Color(0xfff2d8) },
      uTint: { value: new THREE.Color(0xffffff) },
      uGrain: { value: 0.035 },
      uToon: { value: 0.0 },
      uToonShadow: { value: 0.06 },
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
      uniform vec3 uFill;
      uniform vec3 uRimColor;
      uniform float uRimPower;
      uniform float uRimStrength;
      uniform vec3 uSpecular;
      uniform vec3 uTint;
      uniform float uGrain;
      uniform float uToon;
      uniform float uToonShadow;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;

      float stepify(float v, float a, float b) {
        return smoothstep(a, b, v);
      }

      // anime cel-shading: hard light/dark split with a warm mid band
      float celStep(float d, float shadowStart, float shadowEnd, float midStart, float midEnd) {
        float light = stepify(d, midEnd, midStart + 0.42);
        float mid = stepify(d, shadowStart, shadowEnd) - stepify(d, midEnd, midStart + 0.42);
        return light + mid * 0.66;
      }

      // cheap stylised noise, stable per fragment
      float grainNoise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        vec3 V = normalize(vView);
        vec3 H = normalize(L + V);

        float d = dot(N, L);

        // three distinct abraded-paint bands + a soft mid-tone fill
        float band = 0.0;
        float s;
        if (uToon > 0.5) {
          // anime-style cel shading: hard shadow line, crisp mid, bright top
          band += stepify(d, 0.14, 0.22) * 0.32;
          s = uToonShadow + band + stepify(d, 0.34, 0.5) * 0.58;
        } else {
          band += stepify(d, 0.14, 0.30) * 0.32;
          band += stepify(d, 0.33, 0.54) * 0.34;
          band += stepify(d, 0.57, 0.80) * 0.30;
          s = 0.10 + band;
        }

        vec3 base = uColor * uTint;
        vec3 col = base * (uLightColor * s + uAmbient);

        // painterly: pull light back toward the local pigment so bands stay readable
        col = mix(col, base * (uAmbient * 2.2), 0.06);

        // cool secondary fill from below (night city bounce light)
        col += base * uFill * (1.0 - clamp(d, -0.3, 0.6)) * 0.22;

        // soft specular lick
        float spec = pow(max(dot(N, H), 0.0), 28.0) * stepify(d, 0.1, 0.25);
        col += uSpecular * spec * 0.28;

        // rim halo
        float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
        col += uRimColor * rim * uRimStrength;

        // emissive glow (fixed: bias defaults on when emission supplied)
        col += uEmission * uEmissiveBias;

        // paint grain: keeps large merged surfaces from looking plastic
        col += (grainNoise(gl_FragCoord.xy) - 0.5) * uGrain * (1.0 - uEmissiveBias);

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
  if (opts.emission) {
    mat.uniforms.uEmission.value.set(opts.emission);
    mat.uniforms.uEmissiveBias.value = opts.emissionBias !== undefined ? opts.emissionBias : 1.0;
  }
  if (opts.emissionBias !== undefined && !opts.emission) {
    mat.uniforms.uEmissiveBias.value = opts.emissionBias;
  }
  if (opts.rimStrength !== undefined) mat.uniforms.uRimStrength.value = opts.rimStrength;
  if (opts.rimColor) mat.uniforms.uRimColor.value.set(opts.rimColor);
  if (opts.rimPower !== undefined) mat.uniforms.uRimPower.value = opts.rimPower;
  if (opts.fill) mat.uniforms.uFill.value.set(opts.fill);
  if (opts.tint) mat.uniforms.uTint.value.set(opts.tint);
  if (opts.toon) mat.uniforms.uToon.value = 1.0;
  if (opts.toonShadow !== undefined) mat.uniforms.uToonShadow.value = opts.toonShadow;
  mat.uniforms.fogColor = { value: new THREE.Color(0x0f1a2c) };
  mat.uniforms.fogNear = { value: 24 };
  mat.uniforms.fogFar = { value: 240 };
  return mat;
}

// Convert a smooth (indexed) geometry to a faceted one: duplicate face
// vertices and bake per-face normals so every triangle reads as a polygon.
export function flatGeometry(geo) {
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

// Painterly "ink" outline: an inverted-hull shell that hugs the mesh. Use on
// characters and interactive props to give them a storybook edge.
// opts: { color, thickness, opacity }
export function addInkOutline(mesh, opts = {}) {
  const color = opts.color || 0x0a0a0f;
  const thickness = opts.thickness || 0.012;
  const opacity = opts.opacity !== undefined ? opts.opacity : 1.0;

  const geo = mesh.geometry.clone();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const verts = pos.array;
  const norms = nor.array;
  for (let i = 0; i < verts.length; i += 3) {
    verts[i] += norms[i] * thickness;
    verts[i + 1] += norms[i + 1] * thickness;
    verts[i + 2] += norms[i + 2] * thickness;
  }
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1, opacity, side: THREE.BackSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geo, mat);
  shell.renderOrder = -1;
  // share parent transforms
  mesh.add(shell);
  shell.position.set(0, 0, 0);
  return shell;
}