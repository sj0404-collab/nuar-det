import * as THREE from 'three';

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
  g.addColorStop(0, 'rgba(255,206,138,0.95)');
  g.addColorStop(0.35, 'rgba(255,170,90,0.45)');
  g.addColorStop(0.7, 'rgba(255,150,70,0.12)');
  g.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  return new THREE.CanvasTexture(c);
}

// Warm halos over every lamp post, gently breathing like candlelight.
export class GlowSprites {
  constructor(scene) {
    this.scene = scene;
    this.sprites = [];
    this.material = new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    });
  }

  build(world) {
    for (const lamp of world.lamps) {
      const s = new THREE.Sprite(this.material.createMultiMaterial ? this.material : this.material.clone());
      const scale = 3.2 + Math.random() * 1.2;
      s.scale.set(scale, scale, 1);
      s.position.set(lamp.x, lamp.y, lamp.z);
      // horizontal lensing
      s.material.rotation = Math.random() * Math.PI;
      this.scene.add(s);
      // ground pool of light
      const ground = new THREE.Sprite(this.material.clone());
      ground.scale.set(2.6, 1.8, 1);
      ground.position.set(lamp.x, 0.15, lamp.z);
      ground.material.opacity = 0.35;
      this.scene.add(ground);
      this.sprites.push({ halo: s, ground, phase: Math.random() * Math.PI * 2, base: scale, speed: 0.7 + Math.random() * 0.9 });
    }
  }

  update(t, dayFactor = 0) {
    const night = 1 - dayFactor; // 1 at night, 0 at noon
    for (const g of this.sprites) {
      const flicker = 0.5 + 0.5 * Math.sin(t * g.speed + g.phase);
      const gust = Math.sin(t * g.speed * 0.37 + g.phase * 1.7);
      g.halo.material.opacity = (0.55 + flicker * 0.22 + gust * 0.1) * (0.15 + night * 0.85);
      const s = g.base * (1 + flicker * 0.12);
      g.halo.scale.set(s, s, 1);
      g.ground.material.opacity = (0.22 + flicker * 0.16) * (0.2 + night * 0.8);
    }
  }
}