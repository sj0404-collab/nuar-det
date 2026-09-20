export class DialogueUI {
  constructor(hooks = {}) {
    this.box = document.getElementById('dialogue-box');
    this.speaker = document.getElementById('dialogue-speaker');
    this.text = document.getElementById('dialogue-text');
    this.choices = document.getElementById('dialogue-choices');
    this.nextHint = document.getElementById('dialogue-next');
    this.hooks = hooks;
    this.active = false;
  }

  open(d) {
    this.active = true;
    this.box.classList.remove('hidden');
    this.render(d);
  }

  render(d) {
    this.speaker.textContent = d.speaker;
    this.text.textContent = d.text;
    this.choices.innerHTML = '';
    const list = d.choices;
    if (!list || list.length === 0) {
      this.nextHint.classList.remove('hidden');
    } else {
      this.nextHint.classList.add('hidden');
      list.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'dlg-choice';
        btn.textContent = c.label;
        btn.addEventListener('click', () => {
          this.hooks.onChoose && this.hooks.onChoose(i);
          if (this.active) this.renderNow();
        });
        this.choices.appendChild(btn);
      });
    }
    if (this.hooks.onSound) this.hooks.onSound('dialogue');
  }

  renderNow() {
    if (this.refresh) this.render(this.refresh);
  }

  close() {
    this.active = false;
    this.box.classList.add('hidden');
    this.choices.innerHTML = '';
  }

  setRefresh(fn) { this.refresh = fn; }
}