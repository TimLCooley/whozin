# Round-4 referee: score Tim's corrections vs Claude's placements against the
# white-line mask for every court where we disagreed (agreement < 100).
import json, re, cv2
from verify import score

WT = '/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef'
tim = json.load(open(WT + '/.dev-sim/corrections.json'))

# parse CLAUDE table straight from the sim page so we can't drift out of sync
src = open(WT + '/src/app/app/lab/sim/page.tsx').read()
claude = {}
for m in re.finditer(r"'(/sim/court\d+\.jpg)': \{ c: \[(.*?)\], kx: ([-\d.]+), ky: ([-\d.]+)", src):
    pts = re.findall(r'x: ([-\d.]+), y: ([-\d.]+)', m.group(2))
    claude[m.group(1)] = [[float(x), float(y)] for x, y in pts]

for url in sorted(tim.keys()):
    r = tim[url]
    img = cv2.imread(WT + '/public/sim' + url[4:])
    if img is None:
        print(url, 'NO IMAGE'); continue
    tq = [[p['x'], p['y']] for p in r['yours']]
    cq = claude.get(url)
    to, tper = score(img, tq)
    co, cper = score(img, cq) if cq else (99, {})
    verdict = 'AGREE' if r['score'] >= 95 else ('TIM' if to < co - 0.3 else 'CLAUDE' if co < to - 0.3 else 'TIE')
    print(f"{url[5:12]}  agree={r['score']:3d}  tim={to:5.2f}px  claude={co:5.2f}px  -> {verdict}")
    if r['score'] < 95:
        worst_t = sorted(((v, k) for k, v in tper.items() if v is not None), reverse=True)[:3]
        worst_c = sorted(((v, k) for k, v in cper.items() if v is not None), reverse=True)[:3]
        print(f"         tim worst: {', '.join(f'{k} {v}' for v, k in worst_t)}")
        print(f"         claude worst: {', '.join(f'{k} {v}' for v, k in worst_c)}")
