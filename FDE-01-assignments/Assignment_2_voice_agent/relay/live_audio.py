"""Continuous microphone transcription proxy; provider key never reaches browser."""
import asyncio
import base64
import json
import os
import secrets
import threading
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

TOKEN = secrets.token_urlsafe(32)
AVAILABLE = False
PORT = 5181


def transcription_config():
    return {'type': 'session.update', 'session': {'type': 'transcription', 'audio': {'input': {
        'format': {'type': 'audio/pcm', 'rate': 24000},
        'transcription': {'model': os.getenv('OPENAI_STT_MODEL', 'gpt-4o-mini-transcribe')},
        'turn_detection': {'type': 'server_vad', 'threshold': 0.5,
                           'prefix_padding_ms': 300, 'silence_duration_ms': 650},
        'noise_reduction': {'type': 'near_field'}}}}}


async def relay(client):
    try:
        hello = json.loads(await asyncio.wait_for(client.recv(), 5))
        if not secrets.compare_digest(str(hello.get('token', '')), TOKEN):
            await client.close(1008, 'Invalid session'); return
        async with connect('wss://api.openai.com/v1/realtime?intent=transcription',
                           additional_headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']},
                           open_timeout=20, max_size=2_000_000) as provider:
            await provider.recv()
            await provider.send(json.dumps(transcription_config()))
            configured = json.loads(await asyncio.wait_for(provider.recv(), 20))
            if configured.get('type') != 'session.updated':
                await client.send(json.dumps({'type': 'error', 'message': 'Live transcription configuration failed.'})); return
            await client.send(json.dumps({'type': 'ready'}))

            async def microphone():
                async for message in client:
                    if isinstance(message, bytes) and 0 < len(message) <= 48000 and len(message) % 2 == 0:
                        await provider.send(json.dumps({'type': 'input_audio_buffer.append',
                            'audio': base64.b64encode(message).decode()}))
                    elif isinstance(message, str):
                        data = json.loads(message)
                        if data.get('type') == 'clear':
                            await provider.send(json.dumps({'type': 'input_audio_buffer.clear'}))

            async def transcripts():
                async for message in provider:
                    data = json.loads(message); kind = data.get('type', '')
                    if kind == 'input_audio_buffer.speech_started':
                        await client.send(json.dumps({'type': 'speech_started', 'id': data.get('item_id')}))
                    elif kind == 'input_audio_buffer.speech_stopped':
                        await client.send(json.dumps({'type': 'speech_stopped', 'id': data.get('item_id')}))
                    elif kind == 'conversation.item.input_audio_transcription.delta':
                        await client.send(json.dumps({'type': 'partial', 'id': data.get('item_id'), 'text': data.get('delta', '')}))
                    elif kind == 'conversation.item.input_audio_transcription.completed':
                        await client.send(json.dumps({'type': 'transcript', 'id': data.get('item_id'), 'text': data.get('transcript', '')}))
                    elif kind.endswith('failed') or kind == 'error':
                        await client.send(json.dumps({'type': 'error', 'message': 'Live transcription failed. Check API access or reconnect.'}))
            tasks = [asyncio.create_task(microphone()), asyncio.create_task(transcripts())]
            try:
                await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            finally:
                for task in tasks: task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
    except ConnectionClosed:
        pass
    except Exception:
        try: await client.send(json.dumps({'type': 'error', 'message': 'Live microphone connection failed. Reconnect to try again.'}))
        except ConnectionClosed: pass


def start(http_port):
    global PORT
    PORT = http_port + 1
    async def run():
        global AVAILABLE
        async with serve(relay, 'localhost', PORT, origins=[f'http://localhost:{http_port}', f'http://127.0.0.1:{http_port}'], max_size=100000):
            AVAILABLE = True
            await asyncio.Future()
    def worker():
        try: asyncio.run(run())
        except OSError: pass
    threading.Thread(target=worker, daemon=True).start()
