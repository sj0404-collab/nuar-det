import { COLORS } from './World.js';
import { pave, building, stall, crates, pillar } from './helpers.js';

// ================= CLOCKTOWER: Часовая башня =================
function buildClocktower(mk, world) {
  const r = mk('clocktower', 'Часовая башня', 'tower');
  const pal = r.pal;

  // road in from hub
  pave(r, pal, -6, 6, -96, -126);
  pave(r, pal, -30, 30, -126, -156);   // plaza around tower
  r.region(-50, 50, -30, 60, -180, -90);

  // tower core (hollow shaft, open at the front/south)
  const twX = 0, twZ = -140, tW = 10, tD = 10, tH = 48;
  r.box(pal.wall, twX - tW / 2 - 0.6, tH / 2 - 2, twZ, 1.2, tH, tD);      // left wall
  r.box(pal.wall, twX + tW / 2 + 0.6, tH / 2 - 2, twZ, 1.2, tH, tD);      // right wall
  r.box(pal.wall, twX, tH / 2 - 2, twZ - tD / 2 - 0.6, tW + 2.4, tH, 1.2); // back wall
  // front wall lower part (blocks entry until gate) put as part of gate
  r.oneWay(twX, tH - 2, twZ, tW * 0.8, tD * 0.8, COLORS.goldDark);  // top room
  // entrance pad
  pave(r, pal, -6, 6, -126, -116, 0);
  r.oneWay(twX, 1.6, twZ, 8, 8, COLORS.goldDark); // ground floor plate (from plaza)

  // spiraling interior ledges up the shaft (wall-jump friendly)
  const ledge = (y, dz) => {
    const side = dz < 0 ? 3.4 : -3.4;
    r.oneWay(twX + side, y, twZ + dz, 2.6, 2.6, COLORS.redTrim);
    r.oneWay(twX - side, y + 2, twZ - dz, 2.6, 2.6, COLORS.redTrim);
  };
  ledge(5, -2); ledge(9, 2); ledge(13, -2); ledge(17, 2); ledge(21, -2);
  ledge(25, 2); ledge(29, -2); ledge(33, 2); ledge(37, 0);

  // clock face (front, south-facing)
  r.decoBox(COLORS.gold, twX, 22, twZ + tD / 2 - 0.4, 5, 5, 0.5);
  r.decoBox(COLORS.goldDark, twX + 1.6, 24.4, twZ + tD / 2 - 0.2, 0.5, 0.6, 0.6);
  r.decoBox(COLORS.goldDark, twX, 21.2, twZ + tD / 2 - 0.2, 0.5, 1.8, 0.6);
  r.decoBox(COLORS.goldDark, twX, 23, twZ + tD / 2 - 0.2, 1.8, 0.5, 0.6);

  // surrounding houses
  building(r, pal, 22, -120, 16, 11, 12, { windows: true });
  building(r, pal, -26, -130, 16, 12, 16, { windows: true, roofSolid: true });
  building(r, pal, 20, -152, 14, 11, 9, { windows: true });
  building(r, pal, -22, -126, 14, 10, 6, { windows: true });
  crates(r, 26, -128, 3);
  crates(r, -20, -138, 2);
  r.oneWay(24, 4.5, -118, 6, 2, COLORS.goldDark);
  r.oneWay(-24, 7, -132, 6, 2, COLORS.goldDark);

  r.lamp(-5, -118); r.lamp(6, -136); r.lamp(-7, -150);

  // interior step so player can hop onto the shaft floor plate
  r.box(pal.wall, twX, 0.45, twZ, tW - 1, 0.9, tD - 1);

  // inner shaft gate (needs wall-jump skill)
  world.gates.push({
    id: 'tower_inner', room: 'clocktower', pos: { x: twX, z: twZ - 2 }, size: { w: tW, h: 11 },
    needs: 'wall', label: 'Разлом щита (нужен Свод теней)',
  });
  // roof relic
  world.items.push({
    id: 'relic_zvonok', kind: 'key', key: 'zvonok', label: 'Звонок башни', icon: '🔔',
    pos: { x: twX, y: tH - 1.2, z: twZ }, room: 'clocktower', color: COLORS.gold,
  });
  // bell keeper NPC
  world.npcs.push({ id: 'bellsong', name: 'Караульщик часов', face: '⏳', pos: { x: 24, y: 1, z: -122 }, dialogueId: 'bellsong_tower', room: 'clocktower' });
}

// ================= ROOKERY: Воронья слобода =================
function buildRookery(mk, world) {
  const r = mk('rookery', 'Воронья слобода', 'rookery');
  const pal = r.pal;

  // alley in from hub (continuous street)
  pave(r, pal, -138, -90, 8, 18);
  r.region(-200, -70, -20, 70, -20, 90);

  // double-jump fence at the alley end
  world.gates.push({
    id: 'rook_gate', room: 'rookery', pos: { x: -120, z: 20 }, size: { w: 14, h: 8 },
    needs: 'jump', label: 'Ветреная лестница (нужен двойной прыжок)',
  });

  // big terraced rooftop (climb the steps)
  const bx = -126, bz = 36, bw = 30, bd = 26;
  r.box(pal.wall, bx, 9, bz, bw, 18, bd);                 // solid block, top y=18
  r.oneWay(bx - 6, 4.4, bz - 9, 7, 4, pal.roof);          // L1
  r.oneWay(bx + 4, 7.4, bz - 7, 7, 4, pal.roof);          // L2
  r.oneWay(bx - 5, 10.2, bz - 3, 7, 4, pal.roof);         // L3
  r.oneWay(bx + 4, 13.2, bz, 7, 4, pal.roof);             // L4 (double jump from L3)
  r.oneWay(bx - 6, 15.4, bz + 6, 7, 4, pal.roof);         // L5
  r.oneWay(bx - 1, 17.0, bz + 13, 8, 4, COLORS.goldDark); // L6 -> block top

  building(r, pal, -152, 26, 14, 12, 8, { windows: true });
  building(r, pal, -136, 56, 12, 12, 6, { windows: true });
  building(r, pal, -102, 62, 16, 12, 12, { windows: true, roofSolid: true });
  building(r, pal, -168, 50, 10, 12, 10, { windows: true });

  for (const [px, pz] of [[-126, 30], [-116, 44], [-132, 48]]) {
    r.decoBox(0x2a323c, px, 6 + 1.2, pz, 0.8, 2.4, 0.8);
    r.decoBox(0x5c4a3a, px, 8.4, pz, 1.1, 0.5, 1.1);
  }
  r.lamp(-126, 14); r.lamp(-106, 24);
  crates(r, -118, 12, 3);
  crates(r, -130, 22, 2);
  r.oneWay(bx - 8, 1.6, 22, 8, 2, COLORS.goldDark);

  world.items.push({
    id: 'relic_pero', kind: 'key', key: 'pero', label: 'Перо вороны', icon: '🪶',
    pos: { x: bx - 1, y: 18.3, z: bz + 13 }, room: 'rookery', color: COLORS.fog,
  });
  world.chests.push({
    id: 'rook_chest', label: 'Гнездо воронов', pos: { x: bx + 4, y: 13.9, z: bz }, room: 'rookery',
    contents: [{ kind: 'card', id: 'kope' }, { kind: 'card', id: 'alter' }],
  });

  world.npcs.push({ id: 'lamplighter', name: 'Смотритель огней', face: '🕯', pos: { x: -136, y: 1, z: 62 }, dialogueId: 'lamplighter_first', room: 'rookery' });
}

// ================= HARBOR: Туманная гавань =================
function buildHarbor(mk, world) {
  const r = mk('harbor', 'Туманная гавань', 'harbor');
  const pal = r.pal;

  pave(r, pal, 200, 240, 84, 130);   // main dock
  pave(r, pal, 200, 240, -20, 84);   // road patch (x into water? keep land)
  r.region(180, 300, -30, 30, 70, 200);

  // boardwalk
  r.box(COLORS.tealDark, 220, 0.3, 150, 30, 0.6, 46);
  r.oneWay(220, 0.9, 150, 28, 44, COLORS.tealDark);
  for (let i = -3; i <= 3; i++) pillar(r, 0x1d2b30, 214 + i * 4.4, 130, 3, -1.8, 0.35);
  for (let i = -3; i <= 3; i++) pillar(r, 0x1d2b30, 214 + i * 4.4, 170, 3, -1.8, 0.35);

  // ship silhouettes
  r.box(0x203038, 244, 3.2, 116, 9, 4.4, 11);
  r.box(0x203038, 244, 4.6, 116, 1.2, 1.2, 9);
  r.box(0x222b33, 232, 3.6, 188, 11, 5, 12);
  r.box(0x222b33, 232, 5.2, 188, 1.2, 1.4, 10);

  // masts + rigging + stern lantern
  r.decoBox(0x1d1f24, 226, 9, 118, 0.3, 15, 0.3);
  r.decoBox(0x1d1f24, 214, 10, 126, 0.3, 17, 0.3);
  r.decoBox(0xdfe6ec, 214, 10, 126, 0.05, 17, 0.05);
  r.decoBox(0xffcf8a, 226, 16.5, 118, 0.5, 0.5, 0.5, { emission: 0xffb54a, emissionBias: 1.1 });

  // warehouses + tavern
  building(r, pal, 208, 70, 22, 13, 9, { windows: true });
  building(r, pal, 232, 108, 18, 13, 13, { windows: true, roofSolid: true });
  building(r, pal, 230, 60, 16, 12, 6, { windows: true });
  stall(r, pal, 216, 94, 5, 4, { awning: COLORS.brickDark });

  crates(r, 210, 76, 3);
  crates(r, 234, 112, 4);
  crates(r, 224, 80, 2);
  r.oneWay(220, 5.5, 116, 5, 2, COLORS.redTrim);
  r.oneWay(226, 8, 124, 5, 2, COLORS.goldDark);
  r.oneWay(208, 3, 84, 6, 2, COLORS.goldDark);

  r.lamp(210, 80); r.lamp(236, 110); r.lamp(218, 132);

  world.chests.push({
    id: 'harbor_chest', label: 'Сундук шкипера', pos: { x: 226, y: 8.8, z: 124 }, room: 'harbor',
    contents: [{ kind: 'tome', id: 't_lens', label: 'Зрение личины' }, { kind: 'card', id: 'ded' }],
  });

  world.npcs.push({ id: 'harbormaster', name: 'Хозяйка гавани', face: '⚓', pos: { x: 234, y: 1, z: 112 }, dialogueId: 'harbormaster_first', room: 'harbor' });

}

// ================= MAUSOLEUM: Мавзолей =================
function buildMausoleum(mk, world) {
  const r = mk('mausoleum', 'Мавзолей', 'mausoleum');
  const pal = r.pal;

  pave(r, pal, -46, 26, -156, -252);
  r.region(-80, 80, -40, 20, -280, -150);

  // tomb structure
  r.box(pal.wall, -10, 7, -216, 46, 14, 34);
  r.decoBox(pal.trim, -10, 14.4, -216, 24, 1, 20);
  r.oneWay(-10, 5.5, -210, 24, 18, COLORS.goldDark);   // altar ledge
  pillar(r, pal.wall, -34, -202, 12, 0, 1.5, { cap: COLORS.gold });
  pillar(r, pal.wall, 14, -202, 12, 0, 1.5, { cap: COLORS.gold });
  // battle arena ring + summoning runes (emissive so the arena reads)
  r.decoBox(0x4d1a2a, -10, 0.35, -216, 34, 0.16, 28, { emission: 0x5a1f30, emissionBias: 0.9 });
  r.decoBox(0x8f4b3f, -10, 0.15, -216, 8, 0.1, 8, { emission: 0x8f3f33, emissionBias: 1.0 });
  r.decoBox(0x9a4a3a, -34, 0.16, -202, 2.4, 0.12, 0.9, { emission: 0x9a4a3a, emissionBias: 0.85 });
  r.decoBox(0x9a4a3a, 16, 0.16, -202, 2.4, 0.12, 0.9, { emission: 0x9a4a3a, emissionBias: 0.85 });
  r.oneWay(-10, 5, -216, 34, 26, COLORS.goldDark);
  // sarcophagus + ritual circle
  r.decoBox(0x3a3238, -10, 1, -228, 3.2, 1.5, 1.9);
  r.decoBox(0x6d5438, -10, 1.15, -228, 1.6, 0.55, 1.3);
  r.decoBox(0x8f4b3f, -10, 0.15, -216, 8, 0.1, 8);
  // gargoyle lamps
  for (const [lx, lz] of [[-30, -206], [-2, -206]]) {
    r.box(0x2a2530, lx, 3.2, lz, 0.9, 5.6, 0.9);
    r.decoBox(0x241f2b, lx, 3.9, lz + 0.5, 0.7, 1.2, 0.3);
    r.decoBox(0xffb45a, lx, 6.2, lz, 0.7, 0.55, 0.7, { emission: 0xff8a2a, emissionBias: 1.0 });
  }

  // side rooms/corridors with loot
  r.box(pal.wall, 22, 3, -236, 12, 6, 22);
  r.oneWay(22, 3.6, -236, 9, 18, COLORS.goldDark);
  crates(r, 18, -238, 3);
  crates(r, 26, -226, 2);
  r.oneWay(22, 5.5, -236, 8, 14, COLORS.goldDark);
  r.oneWay(-42, 4, -230, 8, 12, COLORS.goldDark);

  // side chest with boss-help card (tricky double jump acces)
  world.chests.push({
    id: 'mausoleum_prep', label: 'Жертвенный ларец', pos: { x: -42, y: 4.7, z: -230 }, room: 'mausoleum',
    contents: [{ kind: 'card', id: 'vex' }],
  });

  r.lamp(-30, -210); r.lamp(4, -210);

  // mausoleum entrance gate (needs bell)
  world.gates.push({
    id: 'mausoleum_gate', room: 'mausoleum', pos: { x: 0, z: -158 }, size: { w: 20, h: 10 },
    needs: 'zvonok', label: 'Каменные врата (нужен Звонок башни)',
  });

  // boss here handled by Game when entering tomb
}
export function buildWest(mk, world) {
  buildClocktower(mk, world);
  buildRookery(mk, world);
  buildHarbor(mk, world);
  buildMausoleum(mk, world);
}
