import * as THREE from 'three';

export class SkyDome {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.SphereGeometry(900, 32, 20);
    const uniforms = {
      uTop: { value: new THREE.Color(0x0a1220) },
      uMid: { value: new THREE.Color(0x2c4056) },
      uHor: { value: new THREE.Color(0x70463a) },
      uGlowY: { value: new THREE.Color(0xd4a559).multiplyScalar(1.4) },
      // day/night interpolation
      uDayFactor: { value: 0.0 },
      uDayTop: { value: new THREE.Color(0x3f6a9e) },
      uDayMid: { value: new THREE.Color(0x8fb3cc) },
      uDayHor: { value: new THREE.Color(0xf0d9a0) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.9, 0.25) },
      uMoonDir: { value: new THREE.Vector3(-0.55, 0.35, 0.75) },
      uStarFade: { value: 1.0 },
      uMistShift: { value: 0.0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uGlowY;
        uniform vec3 uDayTop; uniform vec3 uDayMid; uniform vec3 uDayHor;
        uniform float uDayFactor;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform float uStarFade;
        uniform float uMistShift;
        float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        void main() {
          vec3 p = normalize(vPos);
          float h = clamp(p.y, -1.0, 1.0);
          // interp palettes day<->night
          vec3 top = mix(uTop, uDayTop, uDayFactor);
          vec3 mid = mix(uMid, uDayMid, uDayFactor);
          vec3 hor = mix(uHor, uDayHor, uDayFactor);
          vec3 col;
          if (h > 0.15) {
            float t = (h - 0.15) / 0.85;
            col = mix(hor, top, smoothstep(0.0, 1.0, t));
          } else {
            float t = (h + 1.0) / 1.15;
            col = mix(hor, mid, smoothstep(0.0, 1.0, t));
            col = mix(col, hor, smoothstep(0.0, 1.0, t) * 0.4);
          }
          // moon glow (stronger at night)
          vec3 mps = normalize(vec3(p.x, p.y - 0.02, p.z));
          float mg = exp(-14.0 * length(mps.xz - uMoonDir.xz * 0.55) * 0.22);
          col += uGlowY * mg * (1.0 - uDayFactor) * 0.6;
          // sun disc & horizon haze at day dusk
          float sd = max(dot(p, normalize(uSunDir)), 0.0);
          col += vec3(1.0, 0.84, 0.55) * pow(sd, 260.0) * uDayFactor * 1.4;
          col += vec3(1.0, 0.66, 0.4) * pow(sd, 8.0) * uDayFactor * 0.5;
          // stars
          float stars = 0.0;
          if (h > 0.35) {
            vec2 cell = floor(p.xz * 90.0);
            float rnd = hash12(cell);
            float px = fract(p.x * 90.0) - 0.5;
            float pz = fract(p.z * 90.0) - 0.5;
            if (rnd > 0.985) {
              float d = smoothstep(0.2, 0.04, length(vec2(px, pz)));
              stars = d * (0.2 + rnd * 0.6);
            }
          }
          col += vec3(0.75, 0.85, 1.0) * stars * uStarFade;
          col += vec3(0.9, 0.95, 1.0) * stars * uStarFade * 0.3;
          // twilight ribbon
          col += vec3(0.98, 0.6, 0.35) * pow(clamp(1.0 - abs(p.y), 0.0, 1.0), 3.0) * uMistShift * 0.35;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    scene.add(dome);
    this.dome = dome;
    this.uniforms = uniforms;
    this.lastDay = 0;
  }

  update(time, dayFactor = 0) {
    this.uniforms.uDayFactor.value = dayFactor;
    // stars fade out during day
    this.uniforms.uStarFade.value = 1.0 - dayFactor * 0.85;
    // mist-shift in the haze band; stronger at dusk/night
    this.uniforms.uMistShift.value = Math.sin(time * 0.1) * 0.5 + 0.5;
    // subtle breathing of the glow color
    const g = this.uniforms.uGlowY.value;
    g.g = 0.647 + Math.sin(time * 0.05) * 0.02;
    // gentle hue drift of the night palette
    const shift = Math.sin(time * 0.04) * 0.015;
    this.uniforms.uHor.value.b = 0.227 + Math.cos(time * 0.03) * 0.012;
    this.uniforms.uMid.value.b = 0.337 + shift;
    this.lastDay = dayFactor;
  }
}
