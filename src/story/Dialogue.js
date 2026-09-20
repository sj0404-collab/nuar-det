import { DIALOGUE, ENDINGS } from './data.js';

export class Dialogue {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.node = null;
    this.active = false;
    this.onClose = hooks.onClose || (() => {});
  }

  start(id) {
    if (!DIALOGUE[id]) { this.close(); return; }
    this.node = DIALOGUE[id];
    this.active = true;
  }

  get speaker() { return this.node ? this.node.speaker : ''; }
  get text() { return this.node ? this.node.text : ''; }
  get choices() { return this.node ? this.node.choices || [] : []; }
  get isEndNode() {
    return this.node && this.node.choices && this.node.choices.every(c => c.next === 'end');
  }

  choose(i) {
    const choices = this.node.choices || [];
    const c = choices[i];
    if (!c) return;
    if (c.set) {
      for (const [k, v] of Object.entries(c.set)) {
        this.hooks.onFlag && this.hooks.onFlag(k, v);
      }
    }
    if (c.reward) {
      this.hooks.onReward && this.hooks.onReward(c.reward);
    }
    if (c.seed) {
      this.hooks.onFlag && this.hooks.onFlag('seed', c.seed);
    }
    if (c.next === 'end') {
      this.close();
    } else if (c.next) {
      this.node = DIALOGUE[c.next];
    }
  }

  advance() {
    // for non-choice nodes (auto-next) - our data always has choices, so unused
    if (this.node && this.node.auto) {
      this.node = DIALOGUE[this.node.auto];
    }
  }

  close() {
    this.active = false;
    this.node = null;
    this.onClose();
  }

  static endingFor(seed) {
    if (seed === 'ally') return ENDINGS.ally;
    if (seed === 'wrath') return ENDINGS.wrath;
    return ENDINGS.truth;
  }
}