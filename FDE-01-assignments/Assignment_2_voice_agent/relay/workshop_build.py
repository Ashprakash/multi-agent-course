"""Small Relay build-along. Fill the three TODOs during the classroom demo."""
from pathlib import Path
import uuid

import server


def choose_agent(text, case):
    # TODO 1: Let the customer request Maya. Keep Alex as the default.
    return 'alex'


def choose_language(text, current):
    # TODO 2: Preserve a requested language in shared session state.
    return current


def play_voice(agent, words, language):
    # TODO 3: Generate and play one agent's spoken answer.
    pass


def answer(text, case):
    case['language'] = choose_language(text, case['language'])
    case['history'].append({'speaker': 'customer', 'text': text})
    who = choose_agent(text, case)
    case['consultation_remaining'] = 0
    # Reuse the production provider adapters and scoped demo tools.
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
