/*
 * 背景音乐
 * ------------------------------------------------------------------
 * 两种来源，自动择优：
 *   1) 若存在 assets/bgm.mp3（你自己放的、有版权的音乐），优先播放它（循环）。
 *   2) 否则用 Web Audio 实时合成一段欢快的芯片音乐循环（无版权、离线可用）。
 *
 * 浏览器要求「用户手势后」才能出声，所以由点击音乐按钮触发。
 */
class Music {
  constructor(fileUrl = 'assets/bgm.mp3') {
    this.playing = false;
    this.ctx = null;
    this._timer = null;
    this._step = 0;

    // 尝试加载可选的自备音乐文件
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.volume = 0.5;
    this.fileReady = false;
    this.audio.addEventListener('canplaythrough', () => { this.fileReady = true; });
    this.audio.addEventListener('error', () => { this.fileReady = false; });
    this.audio.src = fileUrl; // 文件不存在会触发 error，静默回退到合成音乐
  }

  /** 切换播放/停止，返回当前是否在播放 */
  toggle() {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }

  start() {
    this.playing = true;
    if (this.fileReady) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => this._startSynth());
    } else {
      this._startSynth();
    }
  }

  stop() {
    this.playing = false;
    this.audio.pause();
    if (this._timer) clearTimeout(this._timer);
  }

  // —— 合成音乐 ——
  _startSynth() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const tempo = 126;
    const stepDur = 60 / tempo / 2; // 八分音符
    // 小调五声，轻快
    const melody = [0, 3, 5, 7, 10, 7, 5, 3, 0, 3, 7, 10, 12, 10, 7, 3];
    const bass = [0, 0, -5, -5, 3, 3, -2, -2];
    const base = 261.63; // C4

    const loop = () => {
      if (!this.playing || this.fileReady) return;
      const t = this.ctx.currentTime + 0.02;
      const m = melody[this._step % melody.length];
      const b = bass[this._step % bass.length];
      this._note(base * Math.pow(2, m / 12), 'square', t, stepDur * 0.9, 0.05);
      this._note(base / 2 * Math.pow(2, b / 12), 'triangle', t, stepDur * 0.95, 0.09);
      this._step++;
      this._timer = setTimeout(loop, stepDur * 1000);
    };
    loop();
  }

  _note(freq, type, t, dur, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

window.Music = Music;
