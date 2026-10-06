# Learner Progress

<!-- Claude reads this at the start of each session and updates it at the end.
     Learners: you don't need to touch this — Claude maintains it. -->

## Learner profile
- Name: [unset]
- Preferred learning style: [unset — set during /start: Socratic | Lecture+checkpoints | Build-along]
- Started: [date]
- Last session: 2026-10-02 — instructor planning and support-room experience prototype; learning style still pending.

## Module status

| Module | Status | Notes / weak spots |
|--------|--------|--------------------|
| 01 — Agent Foundations, Agent Harness & System Design | not started | |
| 02 — Skills & Subagents: Product Architecture & Coordination | not started | |
| 03 — Production Agentic RAG & AI Systems | not started | |
| 04 — Multi-Agent Systems & Orchestration | not started | |
| 05 — Real-Time Voice Agents & Conversational Systems | not started | |
| 06 — Leading AI Systems Across Teams | not started | |
| 07 — Demo Day (EPYHIA) | not started | |

Status values: not started · in progress · completed · needs review

## Weak spots to revisit
- [none yet]

## Next step
- Follow and rehearse the progressive 20-minute Relay build-along in `FDE-01-assignments/Assignment_2_voice_agent/relay/BUILD_ALONG_20_MIN.md`; the previous presenter walkthrough is an optional finished-product tour.
- Aurora Assignment 2 unchanged. Relay now has an OpenAI/Gemini backend, provider TTS, microphone STT, scoped simulated tools and persistent language state. Five offline tests passed. Keys loaded privately. OpenAI project denied gpt-4o-mini; configured accessible gpt-4.1-mini. Live reasoning from both providers, English and Spanish Gemini audio, OpenAI TTS and synthetic-input STT verified. Microphone and perceived voice quality still need learner rehearsal. Room-native streaming remains future work.
- Resume the requested 60-minute Module 5 session after selecting a learning style; no comprehension checkpoints completed yet.

## Latest implementation checkpoint
- 2026-10-02: Replaced Relay push-to-talk with continuous OpenAI transcription and server VAD; automatic playback pause/cancel with heuristic acknowledgment resume. Added bounded Alex → Maya → Alex consultations and a scoped simulated diagnostic tool. Live synthetic streaming and complete two-provider consultation verified. Real microphone, echo, interruption latency and backchannel reliability still need rehearsal. Responses retain buffered cloud TTS; native speech-to-speech remains future work.
- 2026-10-02: Fixed spoken Spanish selection when English is mentioned as not understood. Added server-enforced specialist invitation consent, dynamic Maya participant lifecycle, and acknowledgment handling for invitation replies. Eight regression tests passed; Aurora unchanged.
- Live browser verification: Alex requested specialist consent; Maya remained absent until approval, then appeared and responded in Spanish through Gemini with audio playback reaching “Live · speaking.” Real microphone interruption behavior still needs user rehearsal.
- 2026-10-02: Added expandable live voice-pipeline analytics for FDE class demonstrations: per-agent waterfall, request-to-text / first-audio latency, server LLM/tool/TTS timings, speech queue, playback, interruption/failure states, and optional microphone stop-to-transcript timing. Eight regression tests pass including timing headers. Real OpenAI browser test measured 916 ms to text and 2.14 s to first audio; microphone timing has not been acoustically rehearsed.
- 2026-10-02: Fixed exact “speak back in English” regression and direct “speak back to Alex” routing; normalized em dashes out of agent speech. Added selectable Maya OpenAI Marin TTS while retaining Gemini reasoning and optional Gemini Kore speech. Prefetches successive agent TTS concurrently with ordered playback; shorter responses and fewer repeated introductions prompted. Eight regression tests pass. Live Spanish Maya response reached audio at 3.23 s; single sample, full-buffer latency remains.
- 2026-10-02: Changed specialist entry to customer-led escalation. Alex stays with basic support; explicit “add Maya” / “speak to a technical specialist” requests initiate joining. Server blocks proactive handoffs. Nine regression tests passed.

- 2026-10-02: Relocated Relay into Assignment 2 under `relay/`, including private local configuration and virtual environment. Updated Aurora env-loader import and added local ignore rules.

- 2026-10-02: Prepared a 20-minute instructor walkthrough for Relay with customer-led Maya entry, Spanish and English switching, natural interruption, simulated diagnostics, pipeline timings, audience checks, and live fallback prompts. Local server readiness and microphone availability confirmed. No new learner comprehension checkpoint completed.

- 2026-10-02: Corrected the instructor format to a progressive live build, aligned with Aurora RUNBOOK.md. Added `workshop_build.py` with three small classroom edits (customer-led agent routing, shared language, spoken output), `workshop_solution.py`, and a 20-minute script. Verified the scaffold starts, the routing/language/speech adapter behavior under mocks, and all nine Relay server tests. No learner checkpoint completed.

- 2026-10-03: Fixed a real spoken request that the customer-led specialist matcher missed: “can I get some help, maybe a technical support who can help me out here?” The matcher now tolerates hedges between the request and the specialist title while retaining negative-request checks. Ten regression tests pass; a live request to the local server emitted Maya connecting, connected and speaking without provider errors.

- 2026-10-03: Made a customer-requested specialist join audible in the ongoing Relay call. Alex now speaks a short handoff to Maya in the current language before her connecting/connected events and Gemini response; both participant cards remain. Ten regression tests pass, and browser verification showed Alex speaking while Maya connected and prepared her reply.
