"""Offline checks for role permissions, language state and secret-file isolation."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch
import server


class RoomTests(unittest.TestCase):
    def setUp(self):
        server.sessions.clear()

    def test_explicit_switch_and_persistence(self):
        self.assertEqual(server.requested_language('Maya, speak Spanish please', 'en'), 'es')
        self.assertEqual(server.requested_language('Thanks', 'es'), 'es')
        self.assertEqual(server.requested_language('¡Gracias!', 'en'), 'en')
        self.assertEqual(server.requested_language('Switch back to English', 'es'), 'en')
        self.assertEqual(server.requested_language('Do not switch to Spanish', 'en'), 'en')

    def test_spanish_regression(self):
        self.assertEqual(server.requested_language("I'm sorry, can you speak in Spanish, please? I do not understand English.", 'en'), 'es')
        self.assertEqual(server.requested_language("Don't speak English, speak Spanish", 'en'), 'es')
        self.assertEqual(server.requested_language('Are you there? Can you speak back in English, maybe?', 'es'), 'en')
        self.assertEqual(server.requested_language('Please go back to English', 'es'), 'en')
        self.assertEqual(server.requested_language('Do not speak back in English', 'es'), 'es')
        self.assertTrue(server.invitation_answer('Yes, speak Spanish. I do not understand English.'))
        self.assertFalse(server.invitation_answer('Yes, actually not yet'))
        self.assertIsNone(server.invitation_answer('What would she do?'))

    def test_invitation_gate(self):
        http = ThreadingHTTPServer(('localhost', 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True); thread.start()
        def turn(text, reply):
            payload = json.dumps({'session': 'invite-session', 'text': text}).encode()
            with patch.object(server, 'agent_reply', return_value=reply) as model:
                with urlopen(Request(f'http://localhost:{http.server_port}/api/turn', data=payload)) as response:
                    events = [json.loads(line) for line in response]
            return events, [call.args[0] for call in model.call_args_list]
        reply = {'text': 'Welcome Maya', 'handoff': 'maya', 'tool': None}
        try:
            events, calls = turn('My router is broken and has a red light', reply)
            self.assertEqual(calls, ['alex'])
            self.assertFalse(any(e['type'] == 'participant' for e in events))
            self.assertNotIn('Maya', next(e['text'] for e in events if e['type'] == 'speech'))
            self.assertFalse(server.get_session('invite-session')['invite_pending'])
            events, calls = turn('What will she do?', {'text': 'May I invite her?', 'handoff': None})
            self.assertEqual(calls, ['alex'])
            events, calls = turn('No, not yet', {'text': 'Of course.', 'handoff': None})
            self.assertEqual(calls, ['alex'])
            self.assertEqual(server.get_session('invite-session')['specialist'], 'absent')
            turn('I need technical help now', reply)
            events, calls = turn('Please add Maya, speak Spanish please. I do not understand English.', {'text': 'Hola, soy Maya.', 'handoff': None})
            self.assertEqual(calls, ['maya'])
            self.assertEqual(events[0]['language'], 'es')
            self.assertEqual([e['state'] for e in events if e['type'] == 'participant'], ['connecting', 'connected'])
        finally:
            http.shutdown(); http.server_close(); thread.join()

    def test_customer_led_specialist_requests(self):
        for text in ('Please add Maya', 'Can I speak to a technical specialist?', 'Bring Maya into the call', 'I need a technician', 'Quiero hablar con Maya'):
            self.assertTrue(server.customer_requests_specialist(text), text)
        for text in ('My router has a red light', 'I need technical help', 'Who is Maya?', "Don't add Maya", 'I do not want to speak to Maya'):
            self.assertFalse(server.customer_requests_specialist(text), text)

    def test_agents_cannot_use_each_others_tools(self):
        session = server.get_session('test-session')
        with self.assertRaises(ValueError): server.run_tool('maya', 'prepare_escalation', session)
        with self.assertRaises(ValueError): server.run_tool('alex', 'lookup_router_guide', session)
        result = server.run_tool('alex', 'prepare_escalation', session)
        self.assertFalse(result['ticket_created'])
        self.assertTrue(result['simulated'])

    def test_sessions_isolated(self):
        a = server.get_session('session-one'); b = server.get_session('session-two')
        a['language'] = 'es'; a['private']['maya'].append({'text': 'Private output'})
        self.assertEqual(b['language'], 'en'); self.assertEqual(b['private']['maya'], [])

    def test_optional_handoff_null_is_normalized(self):
        session = server.get_session('null-handoff-test')
        reply = {'text': 'Keep the active call connected—please.', 'handoff': 'null', 'tool': None, 'next': 'Review plan'}
        with patch.object(server, 'openai_headers', return_value={}), patch.object(server, 'request', return_value={'choices': [{'message': {'content': json.dumps(reply)}}]}):
            result = server.agent_reply('alex', session)
        self.assertIsNone(result['handoff'])
        self.assertNotIn('—', result['text'])

    def test_http_security_and_handoff(self):
        http = ThreadingHTTPServer(('localhost', 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True); thread.start()
        root = f'http://localhost:{http.server_port}'
        try:
            for path in ('/.env', '/server.py', '/README.md', '/../.env'):
                with self.assertRaises(HTTPError) as caught: urlopen(root + path)
                self.assertEqual(caught.exception.code, 404)
            payload = json.dumps({'session': 'http-test-session', 'text': 'Please speak Spanish'}).encode()
            req = Request(root + '/api/turn', data=payload, headers={'Content-Type': 'application/json'})
            server.get_session('http-test-session')['specialist'] = 'connected'
            replies = [{'text': 'Maya, ayúdanos.', 'handoff': 'maya', 'tool': None, 'next': 'Diagnosticar'},
                       {'text': 'Alex, no reinicies durante la llamada.', 'handoff': 'alex', 'tool': None, 'next': 'Acordar plan'},
                       {'text': 'Mantendremos la conexión actual.', 'handoff': None, 'tool': None, 'next': 'Confirmar plan'}]
            with patch.object(server, 'agent_reply', side_effect=replies) as model:
                with urlopen(req) as response: events = [json.loads(line) for line in response]
            self.assertEqual([e['who'] for e in events if e['type'] == 'speech'], ['alex', 'maya', 'alex'])
            self.assertEqual([call.args[0] for call in model.call_args_list], ['alex', 'maya', 'alex'])
            self.assertEqual(events[0]['language'], 'es')
            self.assertEqual(events[-1]['type'], 'done')
            for event in events:
                if event['type'] == 'speech':
                    self.assertEqual(event['timing']['calls'], 1)
                    self.assertGreaterEqual(event['timing']['llmMs'], 0)
                    self.assertEqual(event['timing']['toolMs'], 0)
            audio_payload = json.dumps({'session': 'http-test-session', 'who': 'alex', 'text': 'Hola', 'language': 'es'}).encode()
            with patch.object(server, 'synthesize', return_value=b'fake-wav'):
                with urlopen(Request(root + '/api/audio', data=audio_payload)) as response:
                    self.assertRegex(response.headers['Server-Timing'], r'^tts;dur=\d+\.\d+$')
                    self.assertEqual(response.read(), b'fake-wav')
            direct = json.dumps({'session': 'http-test-session', 'text': 'Can I speak back to Alex again?'}).encode()
            server.get_session('http-test-session')['speaker'] = 'maya'
            with patch.object(server, 'agent_reply', return_value={'text': 'How can I help?', 'handoff': None}) as direct_model:
                with urlopen(Request(root + '/api/turn', data=direct)) as response:
                    direct_events = [json.loads(line) for line in response]
                self.assertEqual(direct_model.call_args.args[0], 'alex')
                self.assertEqual([e['who'] for e in direct_events if e['type'] == 'speech'], ['alex'])
            bad = Request(root + '/api/cancel', data=payload, headers={'Origin': 'https://untrusted.example'})
            with self.assertRaises(HTTPError) as caught: urlopen(bad)
            self.assertEqual(caught.exception.code, 403)
        finally:
            http.shutdown(); http.server_close(); thread.join()

    def test_cancel_prevents_second_agent(self):
        session = server.get_session('cancel-session')
        http = ThreadingHTTPServer(('localhost', 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True); thread.start()
        def cancelled_reply(who, state):
            state['version'] += 1
            return {'text': 'Cancelled', 'handoff': 'maya', 'tool': None}
        try:
            payload = json.dumps({'session': 'cancel-session', 'text': 'Help'}).encode()
            with patch.object(server, 'agent_reply', side_effect=cancelled_reply) as model:
                with urlopen(Request(f'http://localhost:{http.server_port}/api/turn', data=payload)) as response:
                    events = [json.loads(line) for line in response]
            self.assertEqual(model.call_count, 1)
            self.assertFalse(any(e['type'] == 'speech' for e in events))
        finally:
            http.shutdown(); http.server_close(); thread.join()


if __name__ == '__main__': unittest.main()
