# Relay: two-provider voice support room

Relay lives in `FDE-01-assignments/Assignment_2_voice_agent/relay/`, alongside the existing Aurora implementations. Alex uses OpenAI reasoning and TTS; Maya uses Gemini reasoning with selectable OpenAI Marin or Gemini Kore speech. OpenAI transcribes the live microphone stream. Both agents keep the selected room language across handoffs and subsequent turns.

## Run

Put these entries in the Git-ignored `.env` file, or use a private file elsewhere:

```dotenv
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key
```

From this directory:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
# Or: .venv/bin/python server.py --env /absolute/path/to/private.env
```

Open http://localhost:5180. Restart the server after editing the key file. `.env.example` lists configurable models and voices. Defaults need access and billing/quota on your accounts; live access has not been verified until real keys are configured. The isolated environment includes the WebSocket transport dependency. HTTP uses port 5180 and the authenticated audio proxy uses 5181.

Use **Start live call**, allow microphone access, and speak naturally. Capture continues while agents speak. **Mute mic** pauses capture; **End call** releases the microphone. Typed input remains available. Audio and conversation content are sent to the named providers and incur API usage. Both voices are AI-generated. Diagnostics, service status and escalations remain simulated. Real customer data is unnecessary for rehearsal.

## Demo

1. “My router isn’t working. I have a meeting in ten minutes.”
2. Alex helps with basic support. Ask “Please add Maya” when you want a specialist.
3. “Maya, speak Spanish please.” Both agents preserve this language until an explicit switch.
4. “La luz de internet está roja.” Maya reasons using device observations and her separate guide.
5. “Alex, switch back to English.” Customer care receives the shared case without starting over.

English, Spanish, Hindi and Tamil are selectable; language/audio quality must be tested acoustically with the configured models. “¡Gracias!” alone does not switch language.

## Boundaries

This is a hands-free, continuous audio-input web room: OpenAI Realtime transcription with server VAD → two-agent reasoning → cloud TTS. Speech starts automatically pause playback. Confirmed interruptions cancel queued speech and supersede pending model results. Brief acknowledgments resume playback using a small phrase heuristic, not an acoustic backchannel model. It is not a LiveKit room-native worker or two simultaneous realtime audio sessions. Agents have separate role instructions, private recent outputs, shared conversation evidence and enforced tool scopes. The coordinator allows at most three spoken agent exchanges per customer utterance (Alex → Maya → Alex conclusion), preventing autonomous loops. It cancels queued playback and discards superseded model results; already-running provider requests may still finish and incur usage.

Only allowlisted web assets are served. Keys stay server-side, are not returned by the status endpoint, and are not logged. Session context stays in server memory and resets with New session or server restart. This localhost server is a demo, not an authenticated production deployment. Do not run Python's generic static server in the directory containing `.env`.

Scripted offline rehearsal remains at http://localhost:5180/?offline=1. It uses browser voices and does not call either model.

## Verification

```sh
.venv/bin/python -m unittest -v test_server.py
```

Offline tests cover language persistence, role/tool scopes, session isolation, handoffs, cancellation and private-file blocking. Live model behavior, audio quality and microphone capture require key-backed rehearsal.

API references: [OpenAI speech](https://developers.openai.com/api/docs/guides/text-to-speech), [Gemini speech](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation).

## Coordinating under pressure

Say: “Alex, work with Maya and come to a conclusion. Broadband is intermittent, I have a meeting in ten minutes and someone is already on a work call. Use the simulated diagnostic tools. Do not restart the router.”

Alex requests an assessment, Maya uses her scoped diagnostic tool and reports evidence, and Alex produces the customer recommendation. Interrupt with “Wait, speak Spanish” or change a constraint. The specialist exchange is via attributed conversation messages and tool results; each agent speaks its own contribution. It does not transcribe one agent's synthesized audio into the other.

Live verification: a paced synthetic 24 kHz PCM stream through the local proxy produced speech-start, speech-stop, incremental and final transcript events automatically. Both providers completed a three-exchange consultation using simulated evidence. Acoustic interruption latency, echo rejection and acknowledgment heuristics still require a real microphone/speaker rehearsal. Headphones help isolate echo during that rehearsal. Provider TTS currently buffers complete audio, so generation pauses remain; this is not native speech-to-speech.

### Specialist entry

Live sessions begin with Alex and the customer only. Alex provides basic support until the customer explicitly asks to add Maya or speak to a technical specialist. The server prevents model-initiated entry before that request. After the customer's request, Alex speaks a brief handoff to Maya in the current language. Maya's card is created on `connecting`; a successful Gemini response marks `connected`, and actual audio playback marks `live`. Failures show a retryable connection failure. These are application/provider lifecycle states, not a WebRTC room connection. The offline scripted rehearsal retains its original fixed cast.

Spanish requests are matched to the requested language rather than unrelated language mentions (including “speak in Spanish, please; I do not understand English”). Both agents retain the selected language and case context.

### Live class latency panel

Expand **Live voice pipeline** above the conversation. Each agent response has a live waterfall and measured request-to-text / request-to-first-audio milestones. The panel keeps the last 30 responses, including interruptions, disabled audio and failures. A new session clears it. LLM and simulated-tool execution times are measured server-side with a monotonic clock; TTS generation duration is returned in `Server-Timing`. Browser timings include queueing, full audio download and the playback gate. These nested durations should not be added together. This is buffered TTS, so “first audio” is the browser playback event after the entire audio response arrives, not provider time to first byte. Microphone speech-stop-to-transcript measures only receipt of the stop event through receipt of the final transcript, excluding upstream endpoint detection. Timings stay in page memory, with no analytics service or stored transcript added.

### Voice and latency revision

Maya still reasons with Gemini. The live UI now defaults her speech to OpenAI `gpt-4o-mini-tts` with Marin; select Gemini Kore for the previous speech provider. Alex retains Cedar. The audio endpoint accepts `voiceProvider`; direct callers default to Gemini for backward compatibility. API-key secrets are unchanged.

Speech requests now begin as soon as each agent's text arrives, overlapping earlier audio playback. Playback remains ordered and interruption aborts pending requests. Analytics separates TTS time from the subsequent audio queue. Explicit “speak back to Alex” requests route directly to Alex, avoiding an unnecessary spoken handoff. Responses are prompted to be shorter and skip repeated introductions. This still buffers full audio; it does not promise subsecond speech-to-speech latency.

### Customer-led escalation

A router fault or generic request for technical help alone does not invite Maya. The customer can say “Please add Maya,” “Can I speak to a technical specialist?” or “Can I get some help from technical support?” Once she joins, the agents can consult each other within the coordinator's exchange limit.

For the progressive classroom build, follow the [20-minute build-along](BUILD_ALONG_20_MIN.md). The [finished-product walkthrough](DEMO_20_MIN.md) is available separately.
