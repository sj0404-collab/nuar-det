import * as THREE from 'three';

export class SkyDome {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.SphereGeometry(900, 32, 20);
    const uniforms = {
      uTop: { value: new THREE.Color(0x0a1220) },
      uMid: { value: new THREE.Color(0x24344a) },
      uHor: { value: new THREE.Color(0x5b3a33) },
      uGlowY: { value: new THREE.Color(0xd4a559).multiplyScalar(1.4) },
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
        void main() {
          vec3 p = normalize(vPos);
          float h = clamp(p.y, -1.0, 1.0);
          vec3 col;
          if (h > 0.15) {
            float t = (h - 0.15) / 0.85;
            col = mix(uHor, uTop, smoothstep(0.0, 1.0, t));
          } else {
            float t = (h + 1.0) / 1.15;
            col = mix(uHor, uMid, smoothstep(0.0, 1.0, t));
            col = mix(col, uHor, smoothstep(0.0, 1.0, t) * 0.4);
          }
          // low moon glow
          vec3 sp = normalize(vec3(p.x, p.y - 0.02, p.z));
          col += uGlowY * 0.35 * exp(-12.0 * max(length(sp.xz), 0.0) * 0.1 * 0.5);
          // stars in upper sky
          float stars = 0.0;
          if (h > 0.35) {
            vec2 cell = floor(p.xz * 90.0);
            float rnd = fract(sin(dot(cell, vec2(12.9898,78.233))) * 43758.5453);
            float px = fract(p.x * 90.0) - 0.5;
            float pz = fract(p.z * 90.0) - 0.5;
            if (rnd > 0.985) {
              float d = smoothstep(0.22, 0.0, length(vec2(px, pz)));
              stars = d * (0.4 + rnd);
            }
          }
          col += vec3(0.9, 0.95, 1.0) * stars * (0.4 + h);
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
  }

  update(time) {
    // mist shift
    this.uniforms.uHor.value.r = 0.363 + Math.sin(time * 0.05) * 0.02;
    this.uniforms.uHor.value.g = 0.228 + Math.cos(time * 0.04) * 0.01;
  }
}