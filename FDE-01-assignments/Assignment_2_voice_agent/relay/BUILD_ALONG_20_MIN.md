# Relay Voice Agent 20 Minute Build Along

Build one router support story in public, the way the Aurora runbook grows one agent through successive capabilities. You will type three small functions in `workshop_build.py`, restarting the same program after each change. Its provider adapters and simulated tools are prepared in `server.py`; the final browser room is also prepared. Say this explicitly to the class so nobody mistakes a 20-minute wiring exercise for building an entire production voice stack from scratch.

## Before class

From the repository root, open `FDE-01-assignments/Assignment_2_voice_agent/relay/` in your editor and terminal. Keep `.env` private. The existing virtual environment and API keys should already be configured. Test once:

```bash
.venv/bin/python -m unittest -q test_server.py
.venv/bin/python workshop_build.py
```

Type `/quit` after a short test. Separately, keep the Relay web server running with `.venv/bin/python server.py` and open [the browser room](http://localhost:5180/). In the browser, check **Agent audio**, leave **Maya voice** on **OpenAI · Marin**, and click **New session**. Use headphones if possible. Installation, keys, microphone permission and audio routing belong in preflight, outside the 20-minute clock. Have [workshop_solution.py](workshop_solution.py) available if typing or Wi-Fi consumes the schedule.

## Minute 0 to 2: Show the architecture

Draw or say: `customer text → agent → answer`, then `customer audio → transcription → agent → speech`. Explain that you will first get the agent decision right in text and add audio only after that. The story stays the same throughout: a router has a red light, the laptop cannot connect, and another person is on a work call. No one should restart the router.

Open `workshop_build.py`. Point to `answer()`: it stores the customer turn, calls one provider, permits scoped simulated tools, and stores the response. Ask the class: “What is missing before this is a voice agent?” Take one answer, then continue.

## Minute 2 to 5: Run Alex as a text agent

Run:

```bash
.venv/bin/python workshop_build.py
```

At `You>`, type:

```text
My router has a red internet light and my laptop cannot connect. Someone is on a work call, so please do not restart it.
```

Watch Alex answer in text. The first version of `choose_agent()` always returns `alex`; `play_voice()` does nothing. Point to any simulated tool line if one appears. Do not claim a real ISP check occurred. If Alex suggests Maya at this stage, point out that the coordinator still does not let Maya join. That is the boundary you will wire next.

## Minute 5 to 9: Add the customer-controlled specialist

Stop the script with `/quit`. Replace the body of `choose_agent()` with this code:

```python
if server.customer_requests_specialist(text):
    case['specialist'] = 'connected'
    case['speaker'] = 'maya'
    print('  Maya joined at the customer’s request.')
if case['specialist'] == 'connected' and 'alex' in text.lower():
    case['speaker'] = 'alex'
if case['specialist'] == 'connected' and 'maya' in text.lower():
    case['speaker'] = 'maya'
return case['speaker']
```

Restart the script. First type the router problem again; Alex should remain the agent. Then type:

```text
Please add Maya to this call.
```

Maya now answers through Gemini reasoning. The router symptom alone did not switch agents; your explicit request did. Point to the `case['speaker']` state, then ask: “Where should the specialist request be enforced, in the model prompt or in the coordinator?” Explain that Relay's server enforces it so a model handoff cannot summon Maya on its own. This small script sets her state directly; the browser implementation also shows joining status.

## Minute 9 to 12: Preserve the language across turns

Stop with `/quit`. Change `choose_language()` to:

```python
return server.requested_language(text, current)
```

Restart, type “Please add Maya to this call,” then:

```text
Maya, please speak Spanish from now on. My router's internet light is red.
Can you speak back in English, maybe?
```

Read the `[es]` and `[en]` labels beside the replies. The same `case` holds the language, customer history and active agent. Point to the assignment in `answer()`: `case['language'] = choose_language(...)`. A message that merely mentions English should not switch languages; the request to speak English does.

## Minute 12 to 15: Add spoken output

Stop with `/quit`. Add these imports near the top of `workshop_build.py`:

```python
import subprocess
import tempfile
```

Replace `play_voice()` with:

```python
audio = server.synthesize(agent, words, language, 'openai')
with tempfile.TemporaryDirectory(prefix='relay-workshop-') as folder:
    path = Path(folder) / 'answer.wav'
    path.write_bytes(audio)
    subprocess.run(['afplay', str(path)], check=False)
```

Restart and type the router problem. Alex now speaks. Ask to add Maya and she speaks too. Alex uses OpenAI Cedar; Maya's reasoning still comes from Gemini while OpenAI Marin voices her answer. That separation between reasoning provider and speech provider is intentional. The program waits for the complete audio file before `afplay`, so there will be a noticeable pause. Ask the class where that delay enters the cascade.

## Minute 15 to 18: Move from terminal audio to a live call

Open the prepared browser room, click **New session**, then **Start live call**. Allow the microphone. Say the same router problem aloud, then say “Please add Maya to this call.” Hear Alex bring Maya in, then point out her **Connecting**, **Connected** and **Live on call** states. Say “Maya, please speak Spanish” and then “Can you speak back in English?”

While an agent is audibly responding, interrupt with “Wait, do not restart the router. Someone is on a work call.” The browser adds live transcription and interruption handling around the agent and TTS functions you just wired. If acoustic interruption fails, use **Interrupt agents** and type the correction. Say clearly that the browser room is a prepared shell, not code typed during these 20 minutes.

## Minute 18 to 20: Read the pipeline and leave a challenge

Expand **Live voice pipeline**. Pick one completed turn and point to **Request → text visible**, **TTS generation · server** and **Request → first audio**. Use the actual numbers that appear. The browser buffers full speech before playback, so this is a cascade with observable stages, not native speech-to-speech. Ask: “Which measured stage would you optimize first, and what would you give up by fusing stages into one live model?”

End the call to release the microphone. Challenge students to replace the terminal's buffered TTS with streaming audio, while preserving explicit specialist entry and cancellation on interruption.

## Recovery during the build

- If a live provider fails, show the completed function and run `workshop_solution.py` after class. Do not expose keys or spend the clock debugging billing.
- If the terminal audio command is unavailable, keep the text stages and demonstrate speech in the browser. `afplay` is the macOS playback command used by this build-along.
- If you are behind schedule, skip the second language switch in the terminal. Keep the customer request for Maya, one language switch, live microphone interruption and the latency panel.
- If you need to jump to a working implementation, `workshop_solution.py` contains the completed three functions. It uses slightly more precise name matching than the short code typed live.
