import * as THREE from 'three';

export class Minimap {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('minimap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.size = 140;
    this.scale = 0.035; // world units per pixel (1 pixel = ~28.5 world units)
    this.lastPlayerPos = new THREE.Vector2();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const wrap = document.getElementById('minimap-wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    this.size = rect.width || 140;
    this.canvas.width = this.size * this.dpr;
    this.canvas.height = this.size * this.dpr;
    this.canvas.style.width = this.size + 'px';
    this.canvas.style.height = this.size + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  forceResize() {
    this.resize();
    this.render();
  }

  update(dt) {
    if (this.game.mode !== 'explore') return;
    const p = this.game.player;
    this.lastPlayerPos.set(p.pos.x, p.pos.z);
  }

  render() {
    if (this.game.mode !== 'explore') return;
    const ctx = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    const p = this.game.player;
    const camYaw = this.game.cameraYaw;
    const world = this.game.world;

    ctx.save();
    ctx.clearRect(0, 0, s, s);

    // background
    ctx.fillStyle = 'rgba(2,4,8,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fill();

    // grid lines (subtle)
    ctx.strokeStyle = 'rgba(90,140,160,0.06)';
    ctx.lineWidth = 1;
    const gridStep = 50; // world units
    const pixelStep = gridStep * this.scale;
    for (let x = -cx; x < cx; x += pixelStep) {
      ctx.beginPath(); ctx.moveTo(cx + x, 0); ctx.lineTo(cx + x, s); ctx.stroke();
    }
    for (let z = -cy; z < cy; z += pixelStep) {
      ctx.beginPath(); ctx.moveTo(0, cy + z); ctx.lineTo(s, cy + z); ctx.stroke();
    }

    // zone circles (bar, plaza, harbor, drain)
    const zones = [
      { x: 32, z: 3, r: 26, color: 'rgba(180,120,60,0.12)' },
      { x: 64, z: -33, r: 30, color: 'rgba(120,160,180,0.12)' },
      { x: 196, z: 122, r: 44, color: 'rgba(60,180,120,0.12)' },
      { x: 132, z: 12, r: 24, color: 'rgba(180,60,180,0.12)' },
    ];
    for (const z of zones) {
      const px = cx + (z.x - p.pos.x) * this.scale;
      const pz = cy + (p.pos.z - z.z) * this.scale;
      const pr = z.r * this.scale;
      if (pr > 1) {
        ctx.beginPath();
        ctx.arc(px, pz, pr, 0, Math.PI * 2);
        ctx.fillStyle = z.color;
        ctx.fill();
        ctx.strokeStyle = z.color.replace('0.12', '0.25');
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // world items
    ctx.fillStyle = '#f5d07a';
    for (const it of world.items) {
      if (it.taken) continue;
      const px = cx + (it.pos.x - p.pos.x) * this.scale;
      const pz = cy + (p.pos.z - it.pos.z) * this.scale;
      if (this.inCircle(px, pz)) {
        ctx.beginPath(); ctx.arc(px, pz, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // NPCs
    ctx.fillStyle = '#7ecce0';
    for (const n of world.npcs) {
      const px = cx + (n.pos.x - p.pos.x) * this.scale;
      const pz = cy + (p.pos.z - n.pos.z) * this.scale;
      if (this.inCircle(px, pz)) {
        ctx.beginPath(); ctx.arc(px, pz, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name[0], px, pz + 3);
        ctx.fillStyle = '#7ecce0';
      }
    }

    // wisps (enemy encounters)
    ctx.fillStyle = '#f0c14f';
    for (const w of this.game.wisps) {
      if (w.dead) continue;
      const px = cx + (w.mesh.position.x - p.pos.x) * this.scale;
      const pz = cy + (p.pos.z - w.mesh.position.z) * this.scale;
      if (this.inCircle(px, pz)) {
        ctx.beginPath(); ctx.arc(px, pz, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // vehicle
    if (this.game.mount && this.game.mount.veh) {
      const m = this.game.mount.veh.mesh.position;
      const px = cx + (m.x - p.pos.x) * this.scale;
      const pz = cy + (p.pos.z - m.z) * this.scale;
      if (this.inCircle(px, pz)) {
        ctx.fillStyle = '#88cc88';
        ctx.beginPath(); ctx.arc(px, pz, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // player
    ctx.save();
    ctx.translate(cx, cy);
    // rotate minimap to match camera yaw in orbit/fps modes
    const rotateMap = this.game.cameraMode !== 'top';
    if (rotateMap) ctx.rotate(-camYaw);
    // player triangle
    ctx.fillStyle = '#ffd666';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    // facing indicator
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10); ctx.stroke();
    ctx.restore();

    // compass ring (N/E/S/W)
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(212,165,89,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const compassR = cx - 10;
    const dirs = ['С', 'В', 'Ю', 'З'];
    for (let i = 0; i < 4; i++) {
      const angle = -camYaw + i * Math.PI / 2;
      const x = cx + Math.sin(angle) * compassR;
      const y = cy - Math.cos(angle) * compassR;
      ctx.fillText(dirs[i], x, y);
    }

    ctx.restore();
  }

  inCircle(x, y) {
    const cx = this.size / 2;
    const cy = this.size / 2;
    const r = cx - 4;
    return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
  }

  show() {
    document.getElementById('minimap-wrap').classList.remove('hidden');
    setTimeout(() => this.forceResize(), 0);
  }

  hide() {
    document.getElementById('minimap-wrap').classList.add('hidden');
  }
}