# Build the Match Review log: merge the scanner's calls, rally structure,
# hit events (the near-player joins ARE shots), transcript, spoken verdicts,
# and score announcements into one timeline; upload log + video to the relay
# bucket for /app/lab/review.
# stdin: {"report": path, "voice": path, "dets": path, "calib": path,
#         "review_id": "match1", "video_720": "/tmp/review1.mp4", "title": "..."}
import sys, json, re, os, time, urllib.request
import numpy as np

def main():
    req = json.load(sys.stdin)
    report = json.load(open(req['report']))
    voice = json.load(open(req['voice']))
    entries = []

    # rallies from the scanner
    for k, (t0, t1, nb) in enumerate(report.get('rally_spans', [])):
        entries.append({'t': t0, 'kind': 'rally',
                        'text': f'Rally {k+1} — {t1-t0:.0f}s, {nb} bounce{"s" if nb != 1 else ""}'})
    # line calls
    for c in report.get('calls', []):
        v = c['verdict']
        kind = 'out' if v.startswith('OUT') else 'in' if v.startswith('IN') else 'call'
        entries.append({'t': c['t'], 'kind': kind,
                        'text': f"{v} @ court ({c['court_ft'][0]:.1f}, {c['court_ft'][1]:.1f})ft"})
    # hit events: near-player-vetoed joins are paddle contacts — count per
    # minute as shot activity notes rather than spamming every hit
    hits = []
    if os.path.exists(req.get('dets', '')):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from match_scan import link_all, find_bounces, graphics_mask
        d = json.load(open(req['dets']))
        calib = json.load(open(req['calib']))
        tracks = link_all(d['dets'])
        _, vetoed = find_bounces(tracks, d.get('movers', {}), calib,
                                 graphics_mask(d['dets'], d['n_frames']), d['dets'])
        fps = d.get('fps', 30)
        hits = sorted(v['frame'] / fps for v in vetoed if v['why'] == 'near-player')
    # per-rally shot counts folded into the rally entries
    if hits:
        for e in entries:
            if e['kind'] != 'rally': continue
            m = re.match(r'Rally (\d+)', e['text'])
            if not m: continue
            k = int(m.group(1)) - 1
            t0, t1, _ = report['rally_spans'][k]
            n = sum(1 for h in hits if t0 - 2 <= h <= t1 + 2)
            if n: e['text'] += f', ~{n} hits'
    # transcript + spoken verdicts + score announcements
    score_pat = re.compile(r'\b(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven)[\s,-]+(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven)([\s,-]+(1|2|one|two))?\b')
    voice_call_ts = {round(v['t'], 1) for v in voice.get('voice_calls', [])}
    for u in voice.get('transcript', []):
        txt = u['text']
        low = txt.lower()
        if round(u['t0'], 1) in voice_call_ts:
            continue  # rendered as their own entries below
        if score_pat.search(low) and len(txt) < 40:
            entries.append({'t': u['t0'], 'kind': 'score', 'text': f'“{txt}”'})
        else:
            entries.append({'t': u['t0'], 'kind': 'voice', 'text': txt})
    for v in voice.get('voice_calls', []):
        entries.append({'t': v['t'], 'kind': 'note',
                        'text': f'🎤 YOU called {v["verdict"]}: “{v["said"]}”'})
    # machine-vs-voice scorecard notes at each comparison
    for r in voice.get('compare', []):
        if r.get('agree') is True:
            entries.append({'t': r['voice_t'], 'kind': 'note',
                            'text': f'✅ We AGREE: you said {r["voice"]}, I called {r["algo"]}'})
        elif r.get('agree') is False:
            entries.append({'t': r['voice_t'], 'kind': 'note',
                            'text': f'⚠️ DISAGREE — you said {r["voice"]}, I called {r["algo"]} → worth a look'})
        else:
            entries.append({'t': r['voice_t'], 'kind': 'note',
                            'text': f'🤐 You called {r["voice"]} but I saw no bounce to rule on'})
    entries.sort(key=lambda e: e['t'])
    n_out = sum(1 for e in entries if e['kind'] == 'out')
    n_in = sum(1 for e in entries if e['kind'] == 'in')
    log = {'title': req.get('title', 'Match Review'),
           'built': time.strftime('%Y-%m-%d %H:%M'),
           'summary': {'rallies': report.get('rallies'), 'bounces': report.get('bounces'),
                       'in': n_in, 'out': n_out, 'hits': len(hits),
                       'utterances': voice.get('utterances'),
                       'agree': voice.get('agree'), 'disagree': voice.get('disagree')},
           'entries': entries}
    # upload to the relay bucket
    env = {}
    for line in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local')):
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
    KEY = env['SUPABASE_SERVICE_ROLE_KEY']; BASE = env['NEXT_PUBLIC_SUPABASE_URL']
    def put(path, data, ctype):
        r = urllib.request.Request(f'{BASE}/storage/v1/object/lab-live/{path}', method='POST', data=data,
            headers={'Authorization': f'Bearer {KEY}', 'apikey': KEY, 'Content-Type': ctype,
                     'x-upsert': 'true', 'cache-control': 'no-store'})
        urllib.request.urlopen(r, timeout=600).read()
    rid = req.get('review_id', 'match1')
    put(f'{rid}_log.json', json.dumps(log).encode(), 'application/json')
    print(f'log uploaded: {len(entries)} entries', flush=True)
    v720 = req.get('video_720')
    if v720 and os.path.exists(v720):
        sz = os.path.getsize(v720)
        print(f'uploading review video ({sz/1e6:.0f}MB)…', flush=True)
        put(f'{rid}_review.mp4', open(v720, 'rb').read(), 'video/mp4')
        print('video uploaded', flush=True)
    json.dump(log, open(f'/tmp/{rid}_log.json', 'w'), indent=1)
    print(json.dumps(log['summary']))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback; traceback.print_exc()
        print(json.dumps({'error': str(e)}))
