import { CARDS } from '../cards/data.js';

export class CombatUI {
  constructor(hooks = {}) {
    this.screen = document.getElementById('combat-screen');
    this.enemyCard = document.getElementById('enemy-card');
    this.enemyName = document.getElementById('enemy-name');
    this.battleLog = document.getElementById('battle-log');
    this.playerStats = document.getElementById('player-stats');
    this.hand = document.getElementById('hand');
    this.turnIndicator = document.getElementById('turn-indicator');
    this.hooks = hooks;
    this.active = false;
    this.cardEls = [];

    document.getElementById('btn-end-turn').addEventListener('click', () => {
      this.hooks.onEndTurn && this.hooks.onEndTurn();
    });
  }

  open(combat, state) {
    this.active = true;
    this.screen.classList.remove('hidden');
    this.combat = combat;
    this.state = state;
    this.render(combat, state);
  }

  close() {
    this.active = false;
    this.screen.classList.add('hidden');
    this.hand.innerHTML = '';
    this.cardEls = [];
  }

  render(combat, state) {
    const e = combat.enemy;
    const pct = Math.max(0, Math.round(e.hp / e.maxHp * 100));
    this.enemyCard.innerHTML =
      `<div class="enemy-face">${e.face}</div>` +
      `<div class="enemy-hp">${e.hp} / ${e.maxHp} <span class="hp-bar"><span class="hp-fill" style="width:${pct}%; background:#b0342e;"></span></span></div>` +
      `<div class="enemy-mood">${e.moods[(combat.turn) % e.moods.length] || ''}${e.block > 0 ? ` · блок ${e.block}` : ''}${e.weakTurns > 0 ? ` · слаб −${e.weak}` : ''}${e.stunTurns > 0 ? ' · оглушён' : ''}</div>` +
      `<div class="enemy-mood">след.: «${e.intent.name}» (${e.intent.atk})</div>`;
    this.enemyName.textContent = e.name;

    const p = state;
    const hpPct = Math.max(0, Math.round(p.hp / p.maxHp * 100));
    this.playerStats.innerHTML =
      `❤️ ${p.hp}/${p.maxHp} <span class="hp-bar"><span class="hp-fill" style="width:${hpPct}%;"></span></span><br>` +
      `🛡 Защита: ${combat.playerBlock}<br>` +
      `⚡ Энергия: ${'◆'.repeat(combat.energy)}${'◇'.repeat(Math.max(0, combat.maxEnergy - combat.energy))}`;

    this.battleLog.textContent = combat.log[0] || '';
    this.turnIndicator.textContent = combat.over
      ? (combat.won ? 'Победа' : 'Поражение')
      : `Ход ${combat.turn + 1}`;

    this.renderHand(combat);
    this.renderEndTurn(combat);
  }

  renderHand(combat) {
    this.hand.innerHTML = '';
    this.cardEls = [];
    combat.hand.forEach((id, i) => {
      const def = CARDS[id];
      const div = document.createElement('div');
      div.className = `card kind-${def.kind}`;
      div.innerHTML =
        `<div class="c-cost">${def.cost}</div>` +
        `<div class="c-title">${def.name}</div>` +
        `<div class="c-art">${def.art}</div>` +
        `<div class="c-desc">${def.desc}</div>`;
      const playable = combat.canPlay(i);
      if (!playable) div.classList.add('disabled');
      else div.classList.add('playable');
      div.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.hooks.onPlay && this.hooks.onPlay(i);
      });
      // tilt fan
      const mid = (combat.hand.length - 1) / 2;
      const rot = (i - mid) * 4.5;
      div.style.transform = `translateY(${Math.abs(i - mid) * 6}px) rotate(${rot}deg)`;
      div.setAttribute('data-i', i);
      this.hand.appendChild(div);
      this.cardEls.push(div);
    });
  }

  renderEndTurn(combat) {
    const btn = document.getElementById('btn-end-turn');
    btn.disabled = combat.over || combat.playerBlock;
    btn.textContent = combat.over ? '' : 'Завершить ход »';
  }
}