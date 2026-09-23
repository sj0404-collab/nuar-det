import { CARDS, STARTER_DECK, ENEMIES } from './data.js';

export class Combat {
  constructor(state) {
    this.state = state;
    this.turn = 0;
    this.over = false;
    this.won = false;
    this.retreated = false;
  }

  startCombat(enemyId) {
    const def = ENEMIES[enemyId];
    this.enemyId = enemyId;
    this.enemy = {
      ...def,
      hp: def.hp,
      maxHp: def.hp,
      block: def.block > 0 ? def.block : 0,
      weak: 0,
      weakTurns: 0,
      stunTurns: 0,
      clues: 0,
      intent: this.pickIntent(def),
    };
    this.turn = 0;
    this.energy = 4;
    this.maxEnergy = 4;
    this.playerBlock = 0;
    this.deck = [...this.state.combatDeck];
    this.shuffle(this.deck);
    this.hand = [];
    this.discard = [];
    this.log = [];
    this.over = false;
    this.won = false;
    this.retreated = false;
    for (let i = 0; i < 5; i++) this.draw();
    this.logLine(`Туман сгущается. ${def.name} выходит на свет фонаря.`);
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  draw() {
    if (this.deck.length + this.discard.length === 0) return;
    if (this.deck.length === 0) {
      this.shuffle(this.discard);
      this.deck = this.discard;
      this.discard = [];
      this.logLine('Колода перетасована.');
    }
    const c = this.deck.pop();
    this.hand.push(c);
  }

  drawUntil(count) {
    while (this.hand.length < count && this.deck.length + this.discard.length > 0) this.draw();
  }

  logLine(msg) {
    this.log.unshift(msg);
    if (this.log.length > 4) this.log.pop();
  }

  canPlay(i) {
    if (this.over || this.turn === 'enemy') return false;
    const cardId = this.hand[i];
    if (cardId === undefined) return false;
    return this.energy >= CARDS[cardId].cost;
  }

  play(i) {
    if (!this.canPlay(i)) return null;
    const id = this.hand[i];
    const card = CARDS[id];
    this.hand.splice(i, 1);
    this.discard.push(id);
    this.energy -= card.cost;
    const fx = card.fx;
    const events = [];

    if (fx.type === 'atk') {
      let dmg = fx.val;
      if (this.enemy.stunTurns <= 0) {
        if (!fx.pierce && this.enemy.block > 0) {
          const absorbed = Math.min(this.enemy.block, dmg);
          this.enemy.block -= absorbed;
          dmg -= absorbed;
          events.push(`Защита врага поглотила ${absorbed}.`);
        }
        this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
        events.push(`${card.name}: −${dmg} ❤️ ${this.enemy.name}`);
        this.enemy.clues += fx.clue || 0;
        if (fx.draw) { this.draw(); events.push('+1 карта'); }
        if (fx.clue && this.enemy.clues >= 3) {
          this.enemy.stunTurns = Math.max(this.enemy.stunTurns, 1);
          events.push('Улик набралось — враг оглушён!');
          this.enemy.clues = 0;
        }
        if (this.enemy.hp <= 0) this.finishWin();
      } else {
        events.push('Враг оглушён и пропускает ход.');
      }
    } else if (fx.type === 'block') {
      this.playerBlock += fx.val;
      events.push(`${card.name}: +${fx.val} защиты`);
    } else if (fx.type === 'heal') {
      const healed = Math.min(this.state.maxHp - this.state.hp, fx.val);
      this.state.hp += healed;
      if (fx.draw) this.draw();
      events.push(`${card.name}: +${healed} ❤️`);
    } else if (fx.type === 'weak') {
      this.enemy.weak += fx.val;
      this.enemy.weakTurns = Math.max(this.enemy.weakTurns, fx.turns);
      events.push(`${card.name}: враг слабеет (−${fx.val} атаки)`);
    } else if (fx.type === 'stun') {
      this.enemy.stunTurns = Math.max(this.enemy.stunTurns, fx.val);
      events.push(`${card.name}: враг оглушён`);
    }

    for (const e of events) this.logLine(e);
    return { card, events };
  }

  pickIntent(def) {
    const a = def.attacks[Math.floor(Math.random() * def.attacks.length)];
    return { name: a.name, atk: a.atk };
  }

  endTurn() {
    // enemy turn
    if (this.enemy.stunTurns > 0) {
      this.enemy.stunTurns--;
      this.logLine(`${this.enemy.name} оглушён, качается в тумане.`);
    } else {
      let atk = this.enemy.intent.atk;
      if (this.enemy.weakTurns > 0 && this.enemy.weak > 0) {
        atk = Math.max(0, atk - this.enemy.weak);
        this.enemy.weakTurns--;
        if (this.enemy.weakTurns <= 0) this.enemy.weak = 0;
      }
      let dealt = atk;
      if (this.playerBlock > 0) {
        const absorbed = Math.min(this.playerBlock, dealt);
        this.playerBlock -= absorbed;
        dealt -= absorbed;
      }
      this.state.hp = Math.max(0, this.state.hp - dealt);
      this.logLine(`${this.enemy.name}: «${this.enemy.intent.name}» — ${dealt} урона.`);
      if (this.state.hp <= 0) { this.finishLose(); return; }
    }
    this.playerBlock = 0;
    this.turn++;
    this.energy = this.maxEnergy;
    this.drawUntil(5);
    this.enemy.intent = this.pickIntent(this.enemy);
  }

  retreat() {
    this.over = true;
    this.won = false;
    this.retreated = true;
    this.logLine('Вы выскользнули из тумана...');
  }

  restartEnemy() {
    this.startCombat(this.enemyId);
  }

  finishWin() {
    this.over = true;
    this.won = true;
    this.logLine(`${this.enemy.name} рассеивается, оставляя улику.`);
  }

  finishLose() {
    this.over = true;
    this.won = false;
    this.logLine('Туман смыкается над вами...');
  }
}