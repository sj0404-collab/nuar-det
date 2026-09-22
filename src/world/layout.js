import { COLORS, PALETTES } from './World.js';
import { pave, windowWall, building, stall, crates, pillar, neon } from './helpers.js';
import { buildWest } from './layout2.js';

export function buildLayoutFrom(world) {
  const rooms = [];
  const mk = (id, label, palName) => {
    const r = world.addRoom(id, label, PALETTES[palName], 0, 0);
    rooms.push(r);
    world.roomInfo[id] = { label };
    return r;
  };

  buildHub(mk, world);
  buildMarket(mk, world);
  buildCistern(mk, world);
  buildWest(mk, world);
  return rooms;
}

// ================= HUB: Влодя-переулок =================
function buildHub(mk, world) {
  const r = mk('hub', 'Влодя-переулок', 'street');
  const pal = r.pal;

  // main street (runs along +z/-z, centered x=0)
  pave(r, pal, -9, 9, -70, 70);
  r.region(-70, 70, -20, 55, -80, 80);

  // east-side buildings
  building(r, pal, 24, -52, 11, 9, 9, { windows: true, roofSolid: true });
  building(r, pal, 42, -36, 12, 9, 6, { windows: true });
  building(r, pal, 38, -18, 9, 7, 12, { windows: true });
  building(r, pal, 32, 0, 10, 8, 7, { windows: true, roofSolid: true });
  building(r, pal, 40, 18, 11, 9, 11, { windows: true });
  building(r, pal, 34, 38, 9, 9, 6, { windows: true });
  building(r, pal, 44, 54, 12, 9, 9, { windows: true });
  // west-side buildings
  building(r, pal, -24, -52, 11, 9, 10, { windows: true, roofSolid: true });
  building(r, pal, -42, -36, 12, 9, 7, { windows: true });
  building(r, pal, -38, -18, 9, 7, 12, { windows: true, roofSolid: true });
  building(r, pal, -32, 0, 10, 8, 6, { windows: true });
  building(r, pal, -40, 18, 11, 9, 12, { windows: true });
  building(r, pal, -34, 38, 9, 9, 7, { windows: true, roofSolid: true });
  building(r, pal, -44, 54, 12, 9, 9, { windows: true });

  // northern short street to clocktower
  pave(r, pal, -6, 6, -70, -96);
  // east alley to market
  pave(r, pal, 9, 50, -7, 7);
  // west alley to rookery
  pave(r, pal, -96, -9, 9, 14);

  // early climb training
  pillar(r, pal.wall, 0, -56, 1.4, 0, 0.9);
  crates(r, -3, -58, 2);
  r.oneWay(14, 2.6, -44, 4, 2, COLORS.goldDark);
  r.oneWay(-14, 5, -44, 4, 2, COLORS.goldDark);
  r.oneWay(-10, 2.6, 30, 5, 2, COLORS.goldDark);
  r.oneWay(12, 5, 44, 4, 2, COLORS.goldDark);
  r.oneWay(0, 8, -62, 3, 3, COLORS.goldDark);

  r.lamp(-6, -42); r.lamp(7, -20); r.lamp(-8, 2); r.lamp(8, 26); r.lamp(-6, 48);
  crates(r, -7, 10, 3);
  crates(r, 4, -12, 2);

  // neon shop signs to make the street read as alive
  neon(r, 24, 2.6, -47.2, 6, 1, 0xff5a4a);   // east, facing +z
  neon(r, -24, 2.6, -47.2, 6, 1, 0x3fc0e8);  // west
  neon(r, 42, 2.6, -32.8, 5, 1, 0xe8c23f);
  neon(r, -42, 2.6, -32.2, 5, 1, 0xb06ae0);
  neon(r, 40, 2.6, 23.2, 5, 1, 0x5ae08a);
  neon(r, -34, 2.6, 41.2, 5, 1, 0xff8a5a);

  // NPCs
  world.npcs.push({ id: 'rook', name: 'Констебль Грач', face: '🦅', pos: { x: -4, y: 1, z: 14 }, dialogueId: 'rook_intro', room: 'hub' });
  world.npcs.push({ id: 'shade', name: 'Тень на мосту', face: '👤', pos: { x: 4, y: 1, z: -10 }, dialogueId: 'shade_hub', room: 'hub' });

  // starter chest
  world.chests.push({
    id: 'hub_chest', label: 'Сундук констебля', pos: { x: 2, y: 1, z: 18 }, room: 'hub',
    contents: [{ kind: 'card', id: 'duma' }, { kind: 'card', id: 'ura' }],
  });

  // transitions (physical world is fully connected; elevator to cistern only)
  world.transitions.push({
    room: 'drain', toRoom: 'cistern', toX: 138, toZ: 32, toY: -41.5,
    minX: 133.5, maxX: 142.5, minZ: 6.5, maxZ: 13.5, minY: -1, maxY: 3, take: 'down',
  });

  // north mist gate (needs dash)
  world.gates.push({
    id: 'hub_north_gate', room: 'hub', pos: { x: 0, z: -88 }, size: { w: 12, h: 9 },
    needs: 'dash', label: 'Туманная завеса (нужен Рывок)',
  });
}

// ================= MARKET: Рынок Горекс =================
function buildMarket(mk, world) {
  const r = mk('market', 'Рынок Горекс', 'market');
  const pal = r.pal;

  pave(r, pal, 50, 108, -7, 7);        // alley in
  // drain shaft (to cistern) — carved plaza slabs + steel rails around
  const drainCx = 138, drainCz = 10;
  pave(r, pal, 108, 132, -36, 40);
  pave(r, pal, 144, 172, -36, 40);
  pave(r, pal, 132, 144, -36, 6.5);
  pave(r, pal, 132, 144, 13.5, 40);
  r.box(pal.wall, drainCx, 0.9, 6.9, 7, 1.8, 0.7);       // N rail
  r.box(pal.wall, drainCx, 0.9, 13.1, 7, 1.8, 0.7);      // S rail
  r.box(pal.wall, 132.4, 0.9, drainCz, 0.7, 1.8, 6);     // W rail
  r.box(pal.wall, 143.6, 0.9, drainCz, 0.7, 1.8, 6);     // E rail
  r.region(70, 200, -30, 40, -70, 80);

  stall(r, pal, 120, -18, 5, 4);
  stall(r, pal, 132, 4, 5, 4, { awning: COLORS.teal });
  stall(r, pal, 148, -22, 5, 4, { awning: COLORS.gold });
  stall(r, pal, 114, 18, 5, 4, { awning: COLORS.brickDark });
  stall(r, pal, 146, 14, 5, 4);

  building(r, pal, 112, -48, 32, 10, 10, { windows: true });
  building(r, pal, 160, -48, 24, 10, 14, { windows: true, roofSolid: true });
  building(r, pal, 106, 52, 28, 10, 12, { windows: true });
  building(r, pal, 166, 52, 22, 10, 8, { windows: true, roofSolid: true });

  crates(r, 110, 6, 3);
  crates(r, 140, -30, 4);
  crates(r, 152, 22, 2);
  crates(r, 126, -2, 2);
  r.oneWay(120, 4.5, -26, 8, 2, COLORS.redTrim);
  r.oneWay(124, 7, 26, 8, 2, COLORS.goldDark);
  r.oneWay(112, 2.8, -40, 6, 2, COLORS.goldDark);

  r.lamp(112, -38); r.lamp(162, -42); r.lamp(112, 40); r.lamp(160, 40);
  neon(r, 112, 3.0, -43.2, 8, 1.2, 0x7ee0c8);   // market hall facing alley
  neon(r, 160, 3.0, -40.8, 6, 1, 0xffc86a);
  neon(r, 106, 2.2, 46.2, 6, 1, 0x5ae08a);

  world.npcs.push({ id: 'tinker', name: 'Жестянщик Грип', face: '🔧', pos: { x: 120, y: 1, z: -6 }, dialogueId: 'tinker_market', room: 'market' });
  world.npcs.push({ id: 'madame', name: 'Госпожа Корвида', face: '🕶', pos: { x: 150, y: 1, z: 10 }, dialogueId: 'madame_first', room: 'market' });

  world.chests.push({
    id: 'market_roof', label: 'Сундук кровельщика', pos: { x: 124, y: 6.6, z: 26 }, room: 'market',
    contents: [{ kind: 'card', id: 'klyuv' }],
  });

  world.gates.push({
    id: 'drain_gate', room: 'market', pos: { x: drainCx, z: drainCz }, size: { w: 7, h: 7 },
    needs: 'dash', label: 'Дренажная решётка (нужен Рывок)', openOnce: true, flat: true,
  });

  // harbor road (south)
  pave(r, pal, 172, 200, 40, 84);
  world.gates.push({
    id: 'harbor_gate', room: 'market', pos: { x: 194, z: 66 }, size: { w: 14, h: 9 },
    needs: ['slea', 'pero'], label: 'Ворота тумана (Слеза + Перо)',
  });

  crates(r, 154, -36, 3);
  r.oneWay(116, 7, -44, 6, 2, COLORS.goldDark);
}

// ================= CISTERN: Цистерна =================
function buildCistern(mk, world) {
  const r = mk('cistern', 'Цистерна', 'cistern');
  const pal = r.pal;
  const cy = -42;

  // shaft pillars down from the drain (visual)
  const sx = 138, sz = 10;
  for (const [ox, oz] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) {
    pillar(r, pal.wall, sx + ox, sz + oz, 46, -34, 0.55);
  }
  // collider column where the drain floor drops: we let player fall through the "drain" hole
  // (open center between pillars)

  pave(r, pal, 96, 180, -84, 4, cy);      // chamber floor (south part z<4)
  pave(r, pal, 128, 148, 4, 20, cy);      // landing pad under the drain shaft
  pave(r, pal, 110, 166, -28, 96, cy);    // wide ledge north
  r.region(90, 186, -120, 20, -120, 60);

  // water glow (emissive so it reads in the dark)
  r.decoBox(0x1f8f94, 138, cy + 0.6, -44, 66, 0.1, 74, { emission: 0x0e5a5c, emissionBias: 0.8 });
  r.decoBox(0x2ea8a0, 138, cy + 0.9, -44, 60, 0.1, 68, { emission: 0x1e7e78, emissionBias: 0.9 });
  r.decoBox(0x7ef0e0, 138, cy + 1.1, -44, 24, 0.05, 28, { emission: 0x9ffcee, emissionBias: 0.85 });

  // walls
  r.box(pal.wall, 96, cy + 8, -44, 3, 18, 92);
  r.box(pal.wall, 180, cy + 8, -44, 3, 18, 92);
  r.box(pal.wall, 138, cy + 8, -87, 88, 18, 3);
  r.box(pal.wall, 138, cy + 8, 2, 88, 18, 3);

  // ceiling for the "basin" feel (adds depth later, skip colliders above chamber)

  // pillars + caps
  for (const [px, pz] of [[110, -66], [166, -66], [110, -20], [166, -20], [138, -44]]) {
    pillar(r, COLORS.tealDark, px, pz, 9, cy, 1.0, { cap: pal.trim });
    r.oneWay(px, cy + 10.2, pz, 2.2, 2.2, COLORS.tealDark);
  }

  // platform climb toward inner sanctum (wall-jump friendly)
  r.oneWay(138, cy + 3, -68, 6, 2, COLORS.tealDark);
  r.oneWay(124, cy + 6, -64, 4, 2, COLORS.tealDark);
  r.oneWay(154, cy + 9, -60, 4, 2, COLORS.tealDark);
  r.oneWay(138, cy + 12.5, -56, 6, 2, COLORS.tealDark);
  r.oneWay(126, cy + 15, -74, 4, 2, COLORS.tealDark);
  r.oneWay(158, cy + 17.5, -72, 5, 3, COLORS.goldDark);
  r.oneWay(142, cy + 21, -76, 4, 2, COLORS.tealDark);
  // Sanctum: single-jump reachable chain (dash entry unlocks this), double-jump only later
  r.oneWay(110, cy + 4, -30, 5, 2, COLORS.tealDark);
  r.oneWay(120, cy + 7.5, -18, 4, 2, COLORS.tealDark);
  r.oneWay(132, cy + 11, 6, 5, 2, COLORS.tealDark);
  r.oneWay(144, cy + 14, 22, 5, 2, COLORS.tealDark);
  r.oneWay(152, cy + 15.4, 34, 5, 2, COLORS.goldDark);

  // chests!
  world.chests.push({ id: 'cistern_wall', label: 'Гномон-святой', pos: { x: 158, y: cy + 18.4, z: -72 }, room: 'cistern', contents: [{ kind: 'tome', id: 't_wall', label: 'Свод теней' }] });
  world.chests.push({ id: 'cistern_double', label: 'Сокровищница морока', pos: { x: 152, y: cy + 16, z: 34 }, room: 'cistern', contents: [{ kind: 'tome', id: 't_jump', label: 'Двоение тени' }] });
  world.chests.push({ id: 'cistern_deep', label: 'Клад глубоких вод', pos: { x: 126, y: cy + 1.4, z: -12 }, room: 'cistern', contents: [{ kind: 'key', id: 'slea', label: 'Слеза тумана' }] });

  world.npcs.push({ id: 'echowisp', name: 'Призрак-эхо', face: '🌫', pos: { x: 138, y: cy + 13, z: -56 }, dialogueId: 'echo_cistern', room: 'cistern' });

  // elevator back up to market drain (transition triggered in the shaft landing)
  world.transitions.push({
    room: 'cistern', toRoom: 'market', toX: 138, toZ: 2, toY: 1,
    minX: 132, maxX: 144, minZ: 4, maxZ: 18, minY: -45, maxY: -30, take: 'up',
  });
}