# Relay Voice Agent 20 Minute Live Demo

This is a presenter script for showing Assignment 2's Relay support room to the FDE class. The story is a customer with a failing router who chooses when to bring in a technical specialist. The teaching points are turn-taking, agent coordination, language state, and the latency of a speech-to-text, reasoning, and text-to-speech cascade. Keep the prompts below handy; model replies will vary.

## Before the 20 minute clock

1. In a terminal, run:

   ```bash
   cd FDE-01-assignments/Assignment_2_voice_agent/relay
   .venv/bin/python server.py
   ```

   If the server is already running, use that instance. Open [the local support room](http://localhost:5180/), refresh, then click **New session**. The status should say **Keys configured**.

2. Put on headphones if available. Leave **Agent audio** checked and **Maya voice** on **OpenAI · Marin**. Expand **Live voice pipeline** so the class can see it update. Keep the private `.env` file off screen.
3. Check the microphone before people arrive: click **Start live call** once, allow microphone access, say a short test phrase, then click **End call** and **New session**. The call should start fresh with only **You** and **Alex** visible.

## Minute 0 to 2: Set the scene

**Say to the class:** “You are watching a customer support call about a home router. Alex handles customer care. Maya is a technical specialist who joins only when I ask for her. We will inspect what the system heard, which agent responded, and how long voice generation took.”

Point to the two participant cards. State that the service checks and connection diagnostics are simulated. No real router or ISP account is connected. Ask the class: “What should Alex establish before any troubleshooting step?” Take one quick answer.

## Minute 2 to 5: Start with Alex alone

Click **Start live call**. Let Alex greet you, then say:

> “My router has a red internet light, and my laptop cannot get online. Someone else is on a work call, so please do not restart anything.”

Wait for Alex to answer. Point out that Maya is still absent. If Alex asks a clarifying question, answer it briefly using the facts you already gave. If the room hears a transcription mistake, point to the transcript and correct it in your next utterance. That is a useful illustration of speech recognition uncertainty.

**Say to the class:** “The system retains the no-restart constraint as conversation context. Customer care can clarify the problem, but it should not invent a technical diagnosis from a red light alone.”

## Minute 5 to 7: Bring in the specialist on your request

Say exactly:

> “Please add Maya to this call.”

Hear Alex invite Maya into the conversation. Watch her card appear as **Connecting**, then **Connected**, then **Live on call** when her audio plays. Maya replies after Alex finishes speaking. Her reasoning comes from Gemini; with the default voice setting, OpenAI Marin generates her speech. Ask the class: “Which event authorized the second agent to enter?” The answer is your explicit request.

If Maya asks about router make, model, or lights, give what you know. Do not invent a model number. “I do not know the exact model, but the internet light is red” is a good answer.

## Minute 7 to 10: Let the agents coordinate under pressure

Address Alex to trigger a joint assessment:

> “Alex, please ask Maya to run the simulated connection diagnostics, then tell me the safest next step. My meeting starts in ten minutes, and someone else is on a work call. Do not restart the router.”

Watch for a **simulated** tool event in the transcript and the **Diagnostic evidence** panel. Let Maya report a finding and Alex respond. If the model does not call the tool, ask Maya directly: “Maya, please run the simulated connection diagnostics before recommending a step.” Do not describe diagnostic evidence as fact unless it appears on screen.

**Say to the class:** “The agents have different roles and tool permissions. A coordinator passes shared case context between them and limits how many times they can hand off after one customer turn.”

## Minute 10 to 12: Switch languages without losing the case

Say:

> “Maya, please speak Spanish from now on. Explain the safest next step.”

Wait for the **Room language → Spanish** event and listen to her answer. Then say:

> “Can you speak back in English, maybe?”

Wait for the language event to return to English. Point out that the router symptoms and no-restart constraint stayed in the same case. The transcript confirms the selected language even if the generated wording varies. Ask the class: “Where should the language choice live so it survives an agent handoff?” Take one answer: shared session state.

## Minute 12 to 14: Interrupt naturally

If an agent is already speaking, start talking over the audio. Otherwise, ask Maya to “walk me through the checks one at a time,” wait for her voice to start, then interrupt with:

> “Wait, do not restart the router. The work call must stay connected.”

Watch for the interruption event and the previous response marked **Interrupted** in the pipeline panel. Let the new answer finish. If microphone detection misses the interruption, click **Interrupt agents**, then speak or type the new constraint. Explain that this demo uses speech detection and a small acknowledgment heuristic; it is not native speech-to-speech turn-taking.

## Minute 14 to 17: Read the latency waterfall

Keep **Live voice pipeline** expanded. Choose one recent Alex or Maya response and point to three numbers: **Request → text visible**, **TTS generation · server**, and **Request → first audio**. Ask: “Where did most of the wait occur on this turn?” Use the actual numbers on screen; do not quote a fixed latency.

Explain in one sentence: “This cascade transcribes speech, calls the agent, generates the complete audio, then plays it; the visible text can arrive before the voice.” Show **Speech-stop event → transcript** for a spoken turn. That number starts when the browser receives the stop event; it is not the full speech recognition time. Server durations sit inside browser durations, so they should not be added together. When two agents speak in one turn, preparation for the next voice can overlap earlier playback; the speech queue shows that wait.

## Minute 17 to 19: Show the product boundary

Point to **Diagnostic evidence** and the participant cards. Say: “The tool data is simulated, the agent roles are enforced, and the customer controls specialist entry. This is a useful industry pattern for a supervised support workflow.”

Then state the limit clearly: “This browser demo uses live transcription plus text reasoning and buffered cloud TTS. The cards show application agent state. This is not two native audio agents in a shared LiveKit or WebRTC room, and it has not inspected my actual router.”

Connect it to Module 5: the cascade exposes each stage for inspection and control; a speech-to-speech design can reduce conversational delay, but changes where checks can run. Relay demonstrates the cascade side of that trade-off.

## Minute 19 to 20: Close with a design question

Ask the class: “If you had to make this feel more like a human support call, what would you improve first: endpointing, the agent response length, TTS streaming, or the specialist handoff? Which metric on this screen would show whether it helped?” Take two answers. End the call with **End call** so the microphone is released.

## If the live call misbehaves

- **Microphone permission or capture fails:** Use the **Your message** field with the same prompts. The agent, handoff, language, and pipeline stages still work. Use **Interrupt agents** to demonstrate cancellation, while explaining that acoustic interruption is unavailable in this fallback.
- **A provider errors or sounds odd:** Keep the transcript visible, retry once, and use the **Maya voice** selector to compare Marin with Gemini Kore if time allows. Changing that selector interrupts current playback, so do it between turns.
- **The agent skips a desired handoff or tool:** Use the direct prompt in that step. Model behavior varies; only point to tool results that actually appear.
- **You run short on time:** Keep the sequence of Alex alone, explicit request for Maya, language switch, one interruption, and the latency panel. Skip the voice comparison and extra diagnostics.
