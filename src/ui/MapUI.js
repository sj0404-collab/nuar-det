export class MapUI {
  constructor(canvas, legendEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.legendEl = legendEl;
    // world bounds for projection
    this.bounds = { minX: -220, maxX: 300, minZ: -320, maxZ: 200 };
    this.zoneColors = {
      hub: '#7aa2b8', market: '#b08a5a', cistern: '#5ac8b0', clocktower: '#c89060',
      rookery: '#8aa2c8', harbor: '#6a9bb8', mausoleum: '#9a7ab8',
    };
  }

  project(x, z) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const b = this.bounds;
    const px = (x - b.minX) / (b.maxX - b.minX) * (w - 20) + 10;
    const pz = (z - b.minZ) / (b.maxZ - b.minZ) * (h - 20) + 10;
    return [px, pz];
  }

  draw(world, player, flags = {}) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#05080d';
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = 'rgba(212,165,89,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy <= H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // visited zones
    for (const z of world.zones) {
      if (!z.visited) continue;
      const [x1, y1] = this.project(z.minX, z.minZ);
      const [x2, y2] = this.project(z.maxX, z.maxZ);
      const color = this.zoneColors[z.room] || '#5f6f7f';
      ctx.fillStyle = color + '33';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = color + '88';
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      // label
      ctx.fillStyle = '#e9dcc0';
      ctx.font = '13px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(z.label, (x1 + x2) / 2, (y1 + y2) / 2);
    }

    // key items
    ctx.font = '16px sans-serif';
    for (const it of world.items) {
      if (it.taken) continue;
      const [ix, iy] = this.project(it.pos.x, it.pos.z - 40);
      ctx.fillText(it.icon || '★', ix, iy);
    }

    // player
    const [px, py] = this.project(player.x, player.z);
    ctx.fillStyle = '#d4a559';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    this.legendEl.innerHTML =
      '● — вы &nbsp;★ — реликвия &nbsp;■ — посещённый район';
  }
}