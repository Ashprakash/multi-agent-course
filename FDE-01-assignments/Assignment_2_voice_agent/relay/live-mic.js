class LiveMicrophone {
  constructor(config, callbacks) {this.config = config; this.callbacks = callbacks; this.muted = false; this.active = false; this.partials = new Map(); this.latest = null;}
  async open() {
    if (this.active) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}});
      this.context = new AudioContext({sampleRate: 24000}); await this.context.resume();
      if (this.context.sampleRate !== 24000) throw new Error('This browser cannot capture at 24 kHz. Please use Chrome.');
      await this.context.audioWorklet.addModule('/mic-worklet.js');
      this.socket = new WebSocket(`ws://${location.hostname}:${this.config.port}`);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Live connection timed out.')), 25000);
        this.socket.onopen = () => this.socket.send(JSON.stringify({token: this.config.token}));
        this.socket.onerror = () => {clearTimeout(timeout); reject(new Error('Live microphone connection failed.'));};
        this.socket.onmessage = e => {
          const data = JSON.parse(e.data);
          if (data.type === 'ready') {clearTimeout(timeout); this.active = true; resolve(); return;}
          if (data.type === 'error') {clearTimeout(timeout); reject(new Error(data.message)); this.callbacks.error(data.message); return;}
          if (this.muted) return;
          if (data.type === 'speech_started') {this.latest = data.id; this.partials.set(data.id, ''); this.stoppedAt = null; this.callbacks.started();}
          if (data.type === 'speech_stopped' && data.id === this.latest) this.stoppedAt = performance.now();
          if (data.type === 'partial' && data.id === this.latest) {const text = (this.partials.get(data.id) || '') + data.text; this.partials.set(data.id, text); this.callbacks.partial(text);}
          if (data.type === 'transcript') {this.partials.delete(data.id); if (data.id === this.latest) this.callbacks.final(data.text, {voice: true, sttMs: this.stoppedAt == null ? null : performance.now() - this.stoppedAt});}
        };
        this.socket.onclose = () => {clearTimeout(timeout); if (this.active) this.callbacks.error('Live microphone disconnected. End the call and reconnect.'); this.active = false; reject(new Error('Live microphone disconnected.'));};
      });
      this.source = this.context.createMediaStreamSource(this.stream);
      this.processor = new AudioWorkletNode(this.context, 'microphone-pcm');
      this.silence = this.context.createGain(); this.silence.gain.value = 0;
      this.source.connect(this.processor); this.processor.connect(this.silence); this.silence.connect(this.context.destination);
      this.processor.port.onmessage = e => {
        if (!this.muted && this.socket.readyState === WebSocket.OPEN) {
          if (this.socket.bufferedAmount > 480000) {this.callbacks.error('Audio connection is too slow. Reconnect.'); this.close(); return;}
          this.socket.send(e.data);
        }
      };
    } catch (error) {this.close(); throw error;}
  }
  toggleMute() {
    this.muted = !this.muted; this.stream?.getAudioTracks().forEach(t => t.enabled = !this.muted);
    this.latest = null; this.partials.clear();
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({type: 'clear'}));
    return this.muted;
  }
  close() {
    this.active = false;
    if (this.socket) {this.socket.onclose = null; this.socket.close();}
    this.source?.disconnect(); this.processor?.disconnect(); this.silence?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop()); this.context?.close();
  }
}
