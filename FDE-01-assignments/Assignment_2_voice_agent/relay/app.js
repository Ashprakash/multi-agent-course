if (new URLSearchParams(location.search).has('offline')) {
  document.querySelector('#pipeline').hidden = true;
  document.querySelector('.badge').textContent = 'Scripted rehearsal · browser voices';
  document.querySelector('#start').textContent = 'Start demo';
  document.querySelector('.people').insertAdjacentHTML('beforeend', '<article id="maya" class="person"><div class="avatar maya">M</div><div><h2>Maya</h2><p>Gemini · technical support</p></div><span class="state">On standby</span></article>');
  const script = document.createElement('script'); script.src = '/offline.js'; document.body.append(script);
} else { initLiveRoom(); }

async function initLiveRoom() {
  const $ = id => document.getElementById(id);
  const analytics = new PipelineAnalytics($('pipeline'));
  const names = {alex: 'Alex', maya: 'Maya', customer: 'You'};
  let session = crypto.randomUUID(), epoch = 0, started = false, ready = false;
  let controller, audio, audioResolve, playbackURL, liveMic, liveConfig;
  let candidate = false, candidateGate = null, releaseCandidate = null, busy = false, connectingMic = false;
  let language = 'en', invitePending = false;
  const members = {};
  const languages = {en: 'English', es: 'Spanish', hi: 'Hindi', ta: 'Tamil'};
  function entry(who, text) {
    const row = document.createElement('div'); row.className = 'turn';
    const avatar = document.createElement('div'); avatar.className = `avatar ${who === 'customer' ? 'human' : who}`; avatar.textContent = names[who][0];
    const body = document.createElement('div'); const name = document.createElement('strong'); name.textContent = names[who];
    const meta = document.createElement('small'); meta.textContent = who === 'alex' ? 'OpenAI · customer care' : who === 'maya' ? 'Gemini · technical support' : '';
    const p = document.createElement('p'); p.textContent = text; body.append(name, meta, p); row.append(avatar, body);
    $('transcript').append(row); $('transcript').scrollTop = $('transcript').scrollHeight;
  }
  function event(text) { const el = document.createElement('div'); el.className = 'event'; el.textContent = text; $('transcript').append(el); $('transcript').scrollTop = $('transcript').scrollHeight; }
  function states(who, state) {
    for (const key of Object.keys(names)) {
      if (!$(key)) continue;
      $(key).classList.toggle('speaking', key === who && state === 'Speaking');
      $(key).querySelector('.state').textContent = key === 'maya' && members.maya === 'connecting' ? 'Connecting…' : key === who ? (key === 'maya' && state === 'Speaking' ? 'Live · speaking' : state) : key === 'maya' ? ({connecting: 'Connecting…', connected: 'Connected', live: 'Live on call', failed: 'Connection failed'}[members.maya] || 'Connected') : started ? 'Listening' : 'Ready';
    }
  }
  async function post(path, body, signal) {
    const result = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({session, generation: epoch, ...body}), signal});
    if (!result.ok) { const data = await result.json(); throw new Error(data.error || `Request failed (${result.status})`); }
    return result;
  }
  function stop(notify = true) {
    analytics.cancel(epoch);
    epoch++; controller?.abort(); controller = null; busy = false;
    candidate = false; releaseCandidate?.(); releaseCandidate = null; candidateGate = null;
    audio?.pause(); audio = null; audioResolve?.(); audioResolve = null;
    if (playbackURL) URL.revokeObjectURL(playbackURL); playbackURL = null;
    states(null); $('status').textContent = 'Interrupted. Tell either agent what changed.';
    if (notify && started) post('/api/cancel', {}).catch(() => {});
  }
  async function prepareSpeech(turn, token, signal) {
    const row = turn.analytics;
    analytics.update(row, {ttsStart: performance.now(), voice: turn.who === 'alex' ? 'OpenAI / Cedar' : $('maya-voice').value === 'openai' ? 'OpenAI / Marin' : 'Gemini / Kore', status: 'Generating speech'});
    try {
      const response = await post('/api/audio', {who: turn.who, text: turn.text, language: turn.language, voiceProvider: $('maya-voice').value}, signal);
      const blob = await response.blob();
      const timing = /tts;dur=([\d.]+)/.exec(response.headers.get('Server-Timing') || '');
      analytics.update(row, {ttsEnd: performance.now(), ttsMs: timing ? Number(timing[1]) : null, status: 'Audio ready / queued'});
      return {blob};
    } catch (error) {
      analytics.finish(row, error.name === 'AbortError' ? 'Interrupted' : 'TTS failed');
      return {error};
    }
  }
  async function speak(turn, token, signal) {
    if (token !== epoch) return;
    const row = turn.analytics;
    states(turn.who, 'Preparing voice');
    const {blob, error} = await turn.prepared;
    if (error) { if (token === epoch && error.name !== 'AbortError') event(`${names[turn.who]} audio unavailable: ${error.message}`); return; }
    if (candidateGate) await candidateGate;
    if (token !== epoch) return;
    playbackURL = URL.createObjectURL(blob); audio = new Audio(playbackURL);
    audio.onplaying = () => { if (!row?.playing) analytics.update(row, {playing: performance.now(), status: 'Playing'}); if (turn.who === 'maya') { members.maya = 'live'; states('maya', 'Speaking'); } };
    states(turn.who, 'Speaking'); $('status').textContent = `${names[turn.who]} is speaking ${languages[turn.language]}. Interrupt or record to take the floor.`;
    await new Promise(resolve => { audioResolve = resolve; audio.onended = () => { analytics.finish(row, 'Complete'); resolve(); }; audio.onerror = () => { analytics.finish(row, 'Playback failed'); resolve(); };
      audio.play().catch(() => { analytics.finish(row, 'Playback blocked'); if (token === epoch) event('Audio playback was blocked. Interact with the page and try another turn.'); resolve(); }); });
    if (token === epoch) { audioResolve = null; audio = null; URL.revokeObjectURL(playbackURL); playbackURL = null; states(null); }
  }
  async function respond(text, showCustomer = true, input = null) {
    if (!text.trim() || !ready) return;
    stop(false); const token = epoch; const myController = new AbortController(); controller = myController;
    analytics.start(token, input);
    let responseRow;
    started = true; busy = true; $('start').disabled = true;
    if (showCustomer) entry('customer', text);
    $('status').textContent = 'The support team is reviewing your message…';
    let queue = Promise.resolve(), failed = false;
    try {
      const response = await post('/api/turn', {text}, myController.signal);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      const handle = item => {
        if (token !== epoch) return;
        if (item.type === 'invitation') invitePending = item.pending;
        if (item.type === 'participant') {
          members[item.who] = item.state;
          if (!$(item.who)) {
            const card = document.createElement('article'); card.id = item.who; card.className = 'person';
            const avatar = document.createElement('div'); avatar.className = `avatar ${item.who}`; avatar.textContent = item.name[0];
            const info = document.createElement('div'); const name = document.createElement('h2'); name.textContent = item.name;
            const role = document.createElement('p'); role.textContent = item.role; info.append(name, role);
            const status = document.createElement('span'); status.className = 'state'; status.setAttribute('role', 'status');
            card.append(avatar, info, status); document.querySelector('.people').append(card);
          }
          states(null); event(`${item.name} · ${item.state === 'failed' ? 'connection failed; ask Alex to retry' : item.state}`);
        }
        if (item.type === 'language') { language = item.language; $('language').value = language;
          if (item.changed) event(`Room language → ${languages[language]} · both agents keep the same case`); }
        if (item.type === 'thinking') { responseRow = analytics.thinking(token, item.who); if (!audio) states(item.who, 'Thinking'); }
        if (item.type === 'tool') { event(`${names[item.who]} → ${item.tool} · simulated`);
          const evidence = document.createElement('p'); evidence.textContent = `${item.result.source}: ${item.result.note || item.result.guidance}`; $('evidence').append(evidence); }
        if (item.type === 'handoff') event(`${names[item.from]} → ${names[item.to]} · ${item.reason === 'joining' ? 'joining the call' : 'specialist consultation'}`);
        if (item.type === 'speech') {
          item.analytics = responseRow;
          analytics.update(responseRow, {text: performance.now(), ...item.timing, status: 'Queued for speech'});
          if (!$('audio').checked) analytics.finish(responseRow, 'Audio off');
          entry(item.who, item.text); $('next').textContent = item.next || 'Continue the conversation.';
          [...$('steps').children].forEach((el, i) => { el.className = i < item.step ? 'done' : i === item.step ? 'active' : ''; });
          if ($('audio').checked) {
            item.prepared = prepareSpeech(item, token, myController.signal);
            queue = queue.then(() => token === epoch ? speak(item, token, myController.signal) : undefined);
          }
        }
        if (item.type === 'error') { analytics.finish(responseRow, 'Reasoning failed'); failed = true; event(item.error); }
      };
      while (true) { const {value, done} = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), {stream: !done});
        let newline; while ((newline = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1); if (line) handle(JSON.parse(line)); }
        if (done) break; }
      await queue;
      if (token === epoch) { busy = false; states(null); $('status').textContent = failed ? 'Provider error. Review the message above and try again.' : liveMic?.active ? 'Listening live. Speak naturally; you can interrupt either agent.' : 'Type a reply or start the live microphone.'; }
    } catch (error) { if (token === epoch && error.name !== 'AbortError') { analytics.finish(responseRow, 'Request failed'); event(error.message); $('status').textContent = 'Request failed. Speak again to retry.'; busy = false; states(null); } }
  }
  $('form').onsubmit = e => {e.preventDefault(); const text = $('message').value; $('message').value = ''; respond(text);};
  const acknowledgment = text => /^(uh huh|uh-huh|mm hmm|mm-hmm|mhm|hmm|aha|okay|ok|yeah|right|claro|vale)[.!?,\s]*$/iu.test(text.trim());
  function resumeCandidate() {
    candidate = false; releaseCandidate?.(); candidateGate = null; releaseCandidate = null;
    if (audio?.paused) audio.play().catch(() => {});
  }
  async function startLive() {
    if (!ready || !liveConfig?.available) { $('status').textContent = 'Live audio is unavailable. Start the server with its virtual environment.'; return; }
    if (liveMic?.active || connectingMic) return;
    connectingMic = true;
    $('status').textContent = 'Connecting the live microphone…';
    liveMic = new LiveMicrophone(liveConfig, {
      started() {
        if (candidate) return;
        candidate = true; candidateGate = new Promise(resolve => releaseCandidate = resolve);
        audio?.pause(); states('customer', 'Speaking');
        $('status').textContent = 'Listening…';
      },
      partial(text) {
        $('status').textContent = `Hearing: ${text}`;
        if (candidate && (/\b(stop|wait|don’t|don't|no|actually|espera|para)\b/i.test(text) || text.trim().split(/\s+/).length > 3)) {
          const interrupted = Boolean(audio || busy); stop(); if (interrupted) event('Customer takes the floor · pending agent speech cancelled');
        }
      },
      final(text, timing) {
        if (!text.trim() || (!invitePending && acknowledgment(text) && (audio || busy))) {
          resumeCandidate(); if (text.trim()) event(`Acknowledgment: “${text}” · agent continues`); return;
        }
        stop(); respond(text, true, timing);
      },
      error(message) {stop(); liveMic?.close(); $('mic').textContent = 'Connect mic'; $('end-call').disabled = true; $('start').disabled = !ready; $('status').textContent = message;}
    });
    try {
      await liveMic.open(); $('mic').textContent = 'Mute mic'; $('end-call').disabled = false;
      $('status').textContent = 'Listening live. Speak naturally.';
      if (!started) respond('Greet the customer briefly as Alex from customer care and ask what is wrong. You are the only agent on this call. No diagnostics yet.', false);
    } catch (error) { $('status').textContent = error.message; }
    finally { connectingMic = false; }
  }
  $('start').onclick = startLive;
  $('interrupt').onclick = () => stop();
  $('audio').onchange = () => { if (!$('audio').checked) stop(); };
  $('maya-voice').onchange = () => { stop(); event(`Maya speech → ${$('maya-voice').value === 'openai' ? 'OpenAI Marin' : 'Gemini Kore'} · reasoning stays with Gemini`); };
  $('language').onchange = () => respond(`Please speak ${languages[$('language').value]} from now on, preserving our troubleshooting context.`);
  $('mic').onclick = () => {
    if (!liveMic?.active) {startLive(); return;}
    const muted = liveMic.toggleMute(); resumeCandidate(); $('mic').textContent = muted ? 'Unmute mic' : 'Mute mic';
    $('status').textContent = muted ? 'Microphone muted.' : 'Listening live.';
  };
  $('end-call').onclick = () => {
    stop(); liveMic?.close(); liveMic = null; $('mic').textContent = 'Connect mic'; $('end-call').disabled = true;
    $('start').disabled = !ready; $('status').textContent = 'Call ended. Microphone released.';
  };
  $('reset').onclick = () => {
    const oldSession = session; stop(false); liveMic?.close(); liveMic = null; busy = false;
    fetch('/api/reset', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({session: oldSession})}).catch(() => {});
    analytics.reset();
    session = crypto.randomUUID(); invitePending = false; delete members.maya; $('maya')?.remove(); started = false; language = 'en'; $('language').value = 'en';
    $('transcript').replaceChildren(); $('evidence').textContent = 'No checks yet. Diagnostics are simulated.';
    $('next').textContent = 'Tell Alex what’s happening.'; [...$('steps').children].forEach(el => el.className = '');
    $('start').disabled = !ready; $('end-call').disabled = true; $('mic').textContent = 'Connect mic'; states(null); $('status').textContent = 'Ready for a new live call.';
  };
  addEventListener('beforeunload', () => {liveMic?.close(); audio?.pause();});
  try { const response = await fetch('/api/status'); const status = await response.json(); ready = status.ready; liveConfig = status.liveAudio;
    $('status').textContent = ready ? 'Keys configured. Start the conversation. Both voices are AI-generated.' : 'Waiting for private API-key configuration on the server. Live requests are disabled.';
    document.querySelector('.badge').textContent = ready ? 'OpenAI + Gemini · AI voices · simulated tools' : 'Live demo · API keys not configured';
  } catch { $('status').textContent = 'Start this portal using python3 server.py. The static preview cannot run live agents.'; }
  $('start').disabled = !ready; $('send').disabled = !ready; $('language').disabled = !ready;
  $('mic').disabled = !ready || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode;
}
