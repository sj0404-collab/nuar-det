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
      uTime: { value: 0.0 },
      uDusk: { value: 0.0 },
      uWeather: { value: new THREE.Vector4(0, 0.08, 0.08, 0.08) },
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
        uniform float uDusk;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform float uStarFade;
        uniform float uMistShift;
        uniform vec4 uWeather;
        float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        float noised(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
                     mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
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
          // dusk: warm band on the horizon + violet wash toward zenith
          float horz = pow(clamp(1.0 - abs(h), 0.0, 1.0), 3.0);
          col += vec3(0.95, 0.42, 0.22) * horz * uDusk * 0.55;
          col += vec3(0.45, 0.16, 0.52) * clamp(1.0 - h * h, 0.0, 1.0) * uDusk * 0.4;
          // moon: wide halo + distance-shrunk disc with crater mottling + terminator
          float moonNight = 1.0 - uDayFactor;
          float md = max(dot(p, normalize(uMoonDir)), 0.0);
          col += vec3(0.7, 0.8, 0.95) * pow(md, 26.0) * 0.3 * moonNight;
          float disc = pow(md, 950.0);
          float crater = 0.5 + 0.5 * noised(p.xz * 10.0 + vec2(0.31, 0.77));
          vec3 moonColor = mix(vec3(0.66, 0.7, 0.78), vec3(0.92, 0.94, 0.99), crater);
          col += moonColor * disc * moonNight * 0.95;
          col += moonColor * disc * (0.1 + 0.12 * clamp(dot(p, normalize(uSunDir)), -0.6, 0.0)) * moonNight;
          // moon glow (stronger at night)
          vec3 mps = normalize(vec3(p.x, p.y - 0.02, p.z));
          float mg = exp(-14.0 * length(mps.xz - uMoonDir.xz * 0.55) * 0.22);
          col += uGlowY * mg * moonNight * 0.6;
          // sun disc & horizon haze at day dusk
          float sd = max(dot(p, normalize(uSunDir)), 0.0);
          col += vec3(1.0, 0.84, 0.55) * pow(sd, 260.0) * uDayFactor * 1.4;
          col += vec3(1.0, 0.66, 0.4) * pow(sd, 8.0) * uDayFactor * 0.5;
          // stars, twinkling
          float stars = 0.0;
          if (h > 0.35) {
            vec2 cell = floor(p.xz * 90.0);
            float rnd = hash12(cell);
            float px = fract(p.x * 90.0) - 0.5;
            float pz = fract(p.z * 90.0) - 0.5;
            float d = smoothstep(0.2, 0.04, length(vec2(px, pz)));
            float tw = 0.62 + 0.38 * sin(uTime * (1.4 + rnd * 4.0) + rnd * 47.0);
            stars = d * (0.2 + rnd * 0.6) * tw * step(0.985, rnd);
          }
          col += vec3(0.75, 0.85, 1.0) * stars * uStarFade;
          col += vec3(0.9, 0.95, 1.0) * stars * uStarFade * 0.3;
          // faint patchy milky way band at night
          float band = exp(-pow(dot(p, normalize(vec3(0.42, 0.12, -0.9))), 2.0) * 26.0);
          band *= 0.5 + 0.5 * noised(vec2(atan(p.x, p.z) * 6.0, p.y * 9.0) + vec2(0.9, 0.3));
          col += vec3(0.55, 0.6, 0.75) * band * 0.18 * moonNight * smoothstep(0.3, 0.6, h);
          // twilight ribbon
          col += vec3(0.98, 0.6, 0.35) * horz * uMistShift * 0.35;
          float storm = max(uWeather.x, uWeather.z);
          col = mix(col, vec3(0.18, 0.23, 0.29), uWeather.w * 0.58);
          col = mix(col, vec3(0.52, 0.59, 0.64), uWeather.y * 0.42);
          col *= 1.0 - storm * 0.12;
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

  update(time, dayFactor = 0, weather = null) {
    this.uniforms.uDayFactor.value = dayFactor;
    this.uniforms.uTime.value = time;
    if (weather) {
      this.uniforms.uWeather.value.set(weather.rain || 0, weather.fog || 0, weather.wind || 0, weather.cloud || 0);
    }
    // dusk flash when the sun sits near the horizon (mid-transition)
    this.uniforms.uDusk.value = Math.exp(-Math.pow((dayFactor - 0.3) / 0.1, 2));
    // stars fade out during day
    this.uniforms.uStarFade.value = (1.0 - dayFactor * 0.85) * (1.0 - (weather ? weather.cloud || 0 : 0) * 0.9);
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
