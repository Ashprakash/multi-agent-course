"""Completed version of the three TODOs in workshop_build.py."""
from pathlib import Path
import re
import subprocess
import tempfile
import uuid

import server


def choose_agent(text, case):
    if server.customer_requests_specialist(text):
        case['specialist'] = 'connected'
        case['speaker'] = 'maya'
        print('  Maya joined at the customer’s request.')
    if case['specialist'] == 'connected' and re.search(r'\b(?:alex|customer care)\b', text, re.I):
        case['speaker'] = 'alex'
    if case['specialist'] == 'connected' and re.search(r'\bmaya\b', text, re.I):
        case['speaker'] = 'maya'
    return case['speaker']


def choose_language(text, current):
    return server.requested_language(text, current)


def play_voice(agent, words, language):
    audio = server.synthesize(agent, words, language, 'openai')
    with tempfile.TemporaryDirectory(prefix='relay-workshop-') as folder:
        path = Path(folder) / 'answer.wav'
        path.write_bytes(audio)
        subprocess.run(['afplay', str(path)], check=False)


def answer(text, case):
    case['language'] = choose_language(text, case['language'])
    case['history'].append({'speaker': 'customer', 'text': text})
    who = choose_agent(text, case)
    case['consultation_remaining'] = 0
    for _ in range(3):
        result = server.agent_reply(who, case)
        if not result.get('tool'):
            break
        if result['tool'] == 'request_specialist' and case['specialist'] != 'connected':
            result = server.basic_support_reply(case['language'])
            break
        evidence = server.run_tool(who, result['tool'], case)
        print(f"  simulated tool: {result['tool']} -> {evidence['source']}")
    else:
        raise RuntimeError('The agent exceeded the tool budget.')
    if who == 'alex' and case['specialist'] != 'connected' and result.get('handoff') == 'maya':
        result = server.basic_support_reply(case['language'])
    words = result.get('text', '').strip()
    if not words:
        raise RuntimeError('The agent did not return a spoken answer.')
    case['speaker'] = who
    case['history'].append({'speaker': who, 'text': words})
    case['history'] = case['history'][-30:]
    case['private'][who].append(result)
    print(f'{who.title()} [{case["language"]}]: {words}')
    play_voice(who, words, case['language'])


def main():
    server.load_keys(Path(__file__).with_name('.env'))
    case = server.get_session('workshop-' + uuid.uuid4().hex)
    print('Relay build-along. Type /quit to stop; /reset for a fresh case.')
    while True:
        try:
            text = input('You> ').strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if text == '/quit':
            break
        if text == '/reset':
            case = server.get_session('workshop-' + uuid.uuid4().hex)
            print('New case.')
            continue
        if not text:
            continue
        try:
            answer(text, case)
        except (server.ProviderError, RuntimeError, ValueError) as exc:
            print(f'Could not finish this turn: {exc}')


if __name__ == '__main__':
    main()
