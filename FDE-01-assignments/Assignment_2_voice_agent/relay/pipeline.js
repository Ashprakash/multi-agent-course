// Browser timestamps share one monotonic clock. Provider timings stay separate.
class PipelineAnalytics {
  constructor(root) {
    this.root = root; this.rows = []; this.turns = new Map(); this.count = 0;
    this.summary = root.querySelector('[data-pipeline-summary]');
    this.body = root.querySelector('[data-pipeline-rows]');
    root.addEventListener('toggle', () => this.render());
    this.timer = setInterval(() => { if (this.rows.some(r => !r.finished)) this.render(); }, 250);
    this.render();
  }
  start(token, input) {
    this.turns.set(token, {start: performance.now(), number: ++this.count, input});
    if (this.turns.size > 30) this.turns.delete(this.turns.keys().next().value);
  }
  thinking(token, who) {
    const turn = this.turns.get(token); if (!turn) return;
    const row = {token, who, turn, thinking: performance.now(), status: 'Reasoning'};
    this.rows.unshift(row); this.rows.length = Math.min(30, this.rows.length); this.render();
    return row;
  }
  update(row, fields) { if (!row || row.finished) return; Object.assign(row, fields); this.render(); }
  finish(row, status) { this.update(row, {status, finished: performance.now()}); }
  cancel(token) { this.rows.filter(r => r.token === token && !r.finished).forEach(r => this.finish(r, 'Interrupted')); }
  reset() { this.rows = []; this.turns.clear(); this.count = 0; this.render(); }
  render() {
    const now = performance.now(), latest = this.rows[0];
    const duration = ms => ms == null ? 'N/A' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
    this.summary.textContent = latest ? `${latest.who === 'alex' ? 'Alex' : 'Maya'} · ${latest.status} · ${latest.playing ? duration(latest.playing - latest.turn.start) + ' to first audio' : duration((latest.finished || now) - latest.turn.start) + ' elapsed'}` : 'Waiting for a response';
    if (!this.root.open) return;
    this.body.replaceChildren();
    if (!latest) { const empty = document.createElement('p'); empty.textContent = 'Start a call or send a message. Actual timings will appear here for each agent response.'; this.body.append(empty); return; }
    for (const r of this.rows) {
      const card = document.createElement('article'); card.className = 'pipeline-response';
      const title = document.createElement('h3'); title.textContent = `Turn ${r.turn.number} · ${r.who === 'alex' ? 'Alex / OpenAI' : 'Maya / Gemini'} · ${r.status}`; card.append(title);
      const end = r.finished || now;
      const phases = [
        ['Response preparation', r.thinking, r.text, 'reason'],
        ['Speech queue', r.text, r.ttsStart, 'queue'],
        ['TTS + transfer', r.ttsStart, r.ttsEnd, 'tts'],
        ['Audio queue / playback gate', r.ttsEnd, r.playing, 'gate'],
        ['Audio playback', r.playing, r.finished, 'play']
      ];
      const scale = Math.max(1, end - r.turn.start);
      const timeline = document.createElement('div'); timeline.className = 'pipeline-timeline';
      for (const [label, start, stop, color] of phases) {
        if (start == null || (r.status === 'Audio off' && label !== 'Response preparation')) continue;
        const finish = stop ?? end;
        const line = document.createElement('div'); line.className = 'pipeline-phase';
        const name = document.createElement('span'); name.textContent = label;
        const track = document.createElement('div'); track.className = 'pipeline-track';
        const bar = document.createElement('i'); bar.className = color;
        bar.style.marginLeft = `${Math.max(0, (start - r.turn.start) / scale * 100)}%`;
        bar.style.width = `${Math.max(.3, (finish - start) / scale * 100)}%`;
        track.append(bar);
        const value = document.createElement('span'); value.textContent = duration(finish - start) + (stop == null && !r.finished ? '…' : '');
        line.append(name, track, value); timeline.append(line);
      }
      card.append(timeline);
      const stats = document.createElement('dl'); stats.className = 'pipeline-stats';
      const metric = (label, value) => { const box = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); dd.textContent = value; box.append(dt, dd); stats.append(box); };
      metric('Request → text visible', r.text == null ? 'Pending' : duration(r.text - r.turn.start));
      metric('Request → first audio', r.playing == null ? (r.finished ? 'Not played' : 'Pending') : duration(r.playing - r.turn.start));
      metric('LLM calls · server', r.llmMs == null ? 'Pending' : `${duration(r.llmMs)} · ${r.calls} call(s)`);
      metric('Tool execution · server', r.toolMs == null ? 'Pending' : duration(r.toolMs));
      metric('Speech voice', r.voice || 'Audio off / pending');
      metric('TTS generation · server', r.ttsMs == null ? 'N/A' : duration(r.ttsMs));
      metric('Speech-stop event → transcript', r.turn.input?.sttMs == null ? (r.turn.input?.voice ? 'Unavailable' : 'Typed / system input') : duration(r.turn.input.sttMs));
      card.append(stats); this.body.append(card);
    }
  }
}
