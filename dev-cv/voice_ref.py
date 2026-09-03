# Voice referee: Tim called shots out loud while recording — his voice is the
# ground truth track. Extract audio -> whisper transcription with timestamps ->
# find verdict utterances ("out", "in", "wide", "long", ...) -> match each to
# the scanner's bounce calls by time -> agreement report.
# stdin: {"video": path, "report": "<out_prefix>_report.json" (from match_scan),
#         "out": "/tmp/voice_compare.json"}
import sys, json, re, subprocess, os, tempfile

VERDICT_PATTERNS = [
    # Tim's field protocol: "camera out"/"camera in" = deliberate calls for the log
    (r"\bcamera[,!\s]+(is |was |says )?out\b", 'OUT'),
    (r"\bcamera[,!\s]+(is |was |says )?in\b", 'IN'),
    (r"\b(that('| i)s |it('| i)s )?(way |just |barely )?out\b", 'OUT'),
    (r"\b(that('| i)s |it('| i)s )?(way |just |barely )?(in|good)\b", 'IN'),
    (r"\bwide\b", 'OUT'),
    (r"\blong\b", 'OUT'),
    (r"\bno\b.{0,8}\b(good|in)\b", 'OUT'),
    (r"\bpaint(ed)?\b|\bon the line\b|\bcaught the line\b", 'IN'),
]

def main():
    req = json.load(sys.stdin)
    video = req['video']
    wav = os.path.join(tempfile.gettempdir(), 'voice_ref.wav')
    subprocess.run(['ffmpeg', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', wav],
                   capture_output=True, timeout=1800, check=True)
    import whisper
    print('transcribing (base.en)…', flush=True)
    model = whisper.load_model('base.en')
    result = model.transcribe(wav, language='en', word_timestamps=False, verbose=False)
    utterances = [{'t0': round(s['start'], 1), 't1': round(s['end'], 1), 'text': s['text'].strip()}
                  for s in result['segments']]
    print(f'{len(utterances)} utterances', flush=True)
    # verdict extraction
    voice_calls = []
    for u in utterances:
        low = u['text'].lower()
        for pat, v in VERDICT_PATTERNS:
            if re.search(pat, low):
                voice_calls.append({'t': u['t0'], 'verdict': v, 'said': u['text']})
                break
    print(f'{len(voice_calls)} spoken verdicts found', flush=True)
    # match to the scanner's calls: nearest bounce within 12s BEFORE the words
    # (you speak after the ball lands)
    algo = []
    if req.get('report') and os.path.exists(req['report']):
        algo = json.load(open(req['report'])).get('calls', [])
    rows = []
    for vc in voice_calls:
        best = None
        for c in algo:
            dt = vc['t'] - c['t']
            if -2 <= dt <= 12 and (best is None or abs(dt) < abs(vc['t'] - best['t'])):
                best = c
        av = (best.get('verdict') or '')[:3].strip() if best else None
        rows.append({'voice_t': vc['t'], 'voice': vc['verdict'], 'said': vc['said'],
                     'algo_t': best['t'] if best else None,
                     'algo': best['verdict'] if best else 'NO CALL',
                     'agree': (av == vc['verdict'][:3]) if best else None})
    agree = sum(1 for r in rows if r['agree'] is True)
    disagree = sum(1 for r in rows if r['agree'] is False)
    missed = sum(1 for r in rows if r['agree'] is None)
    out = {'utterances': len(utterances), 'voice_calls': voice_calls, 'compare': rows,
           'agree': agree, 'disagree': disagree, 'algo_no_call': missed,
           'transcript': utterances}
    json.dump(out, open(req['out'], 'w'), indent=1)
    print(f'AGREE {agree} / DISAGREE {disagree} / algo silent {missed} -> {req["out"]}', flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback; traceback.print_exc()
        print(json.dumps({'error': str(e)}))
