# 윤이 국어 자동 테스트: 탭(1280x800)·폰(390x844) 하루 전체 흐름 + 틀렸을 때 흐름 + 요구사항 점검
# 사용: python3 test/flow.py . (저장소 맨 위에서) [스크린샷 폴더]
import sys, os, re, json, threading, http.server, functools, socketserver, time
from playwright.sync_api import sync_playwright

APP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'app')
SHOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else 'shots')
os.makedirs(SHOT, exist_ok=True)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=APP))
PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html'

# 음성 목업: 바로 끝나고, 무엇을 어떤 속도로 읽었는지 기록
MOCK = """
window.__spoken = [];
const fakeSS = { speaking:false, getVoices(){ return [{name:'Google 한국의', lang:'ko-KR', voiceURI:'g-ko', localService:false}]; },
  speak(u){ window.__spoken.push({t:u.text, r:u.rate}); setTimeout(()=>u.onend && u.onend(), 3); }, cancel(){}, onvoiceschanged:null };
Object.defineProperty(window, 'speechSynthesis', { value: fakeSS, configurable: true });
window.SpeechSynthesisUtterance = function(t){ this.text=t; };
window.__KO_LOG = [];
// 녹음 재생 목업(KREQ-65): 파일을 실제로 요청하고(없으면 onerror) 바로 끝나요. 무엇을 어떤 빠르기로 틀었는지 기록 (?realaudio면 진짜 Audio)
window.__audio = [];
if (!location.search.includes('realaudio')) window.Audio = function(src){ const a = this; a.src = src; a.playbackRate = 1; a.paused = true;
  a.play = () => { a.paused = false; window.__audio.push({src: String(src), rate: a.playbackRate});
    return fetch(src).then(r => { if (!r.ok) throw 0; setTimeout(() => { if (!a.paused) { a.paused = true; a.onended && a.onended(); } }, 5); })
      .catch(() => { setTimeout(() => a.onerror && a.onerror(), 1); }); };
  a.pause = () => { a.paused = true; }; };
"""
KO_IDX = json.load(open(os.path.join(APP, 'audio-ko', 'index.json'), encoding='utf-8'))
ko_norm = lambda t: re.sub(r'\s+', ' ', str(t)).strip()
ko_parts = lambda t: [x.strip() for x in re.split(r'(?<=[.!?])\s+', str(t)) if x.strip()]
ko_logs = []  # (기기, 문장)
CLASS_TEXTS = {'로봇이 걸어요.', '현이가 개미를 찾았어요.'}  # 테스트에서 아빠가 넣은 우리 반 문장(미리 녹음 불가 → 기기 음성)

results = []  # (항목, OK/FAIL, 설명)
def check(name, cond, info=''):
    results.append((name, 'OK' if cond else 'FAIL', info))
    if not cond: print('  ✗', name, info)

def run_js(page, js, arg=None):
    return page.evaluate(js, arg) if arg is not None else page.evaluate(js)

def act_id(page):
    return run_js(page, "() => { const L = YUNI.lesson; return L ? `${L.special||''}${L.s}:${L.i}:${YUNI.act ? YUNI.act.type : ''}` : '' }")

def wait_change(page, before, timeout=8000):
    t0 = time.time()
    while time.time() - t0 < timeout / 1000:
        scr = run_js(page, "() => document.querySelector('.reward') ? 'reward' : ''")
        if scr == 'reward' and run_js(page, "() => !!document.querySelector('.big-stars')"): return 'reward'
        a = act_id(page)
        if a != before and run_js(page, "() => !!document.querySelector('.stage')"): return a
        page.wait_for_timeout(40)
    return None

BAD_WORDS = ['땡', '❌', '✖', '✗']
def scan_bad(page, where):
    txt = run_js(page, "() => document.body.innerText")
    bad = [w for w in BAD_WORDS if w in txt]
    red = run_js(page, """() => [...document.querySelectorAll('.stage *')].some(e => { const c = getComputedStyle(e).color; const m = c.match(/\\d+/g); return m && +m[0] > 200 && +m[1] < 60 && +m[2] < 60; })""")
    return bad, red

def type_text(page, txt):
    for k in run_js(page, "t => HANGUL.keysFor(t)", txt):
        if k == ' ': page.click('[data-act=sp]')
        else: page.click(f'.key[data-arg="{k}"]')

def dict_wrong(page, times):
    """받아쓰기에서 times번 틀리게 쓰고 지워요"""
    for k in range(times):
        type_text(page, '가나다'); page.click('[data-act=submit]'); page.wait_for_timeout(250)
        n = run_js(page, "() => document.querySelectorAll('#grid .cell:not(.empty)').length")
        page.click('[data-act=curend]')
        for _ in range(n + 1): page.click('[data-act=bs]')

def answer(page, a, wrong_first=0):
    """현재 문제를 맞게 풀어요. wrong_first번 먼저 틀려요."""
    t = a['type']
    if t == 'msg': return
    if t == 'card': page.click('[data-act=next]'); return
    if t == 'pick':
        wrongs = [o for o in a['opts'] if o != a['w']['word']]
        for k in range(min(wrong_first, len(wrongs))):
            page.click(f'.choice[data-arg="{wrongs[k]}"]'); page.wait_for_timeout(150)
        page.click(f'.choice[data-arg="{a["w"]["word"]}"]'); return
    if t == 'jong':
        want = run_js(page, "a => HANGUL.dec([...a.w.word][a.ti]).jong", a)
        wrongs = [p for p in a['pieces'] if p != want]
        for k in range(min(wrong_first, len(wrongs))):
            page.click(f'.piece[data-arg="{wrongs[k]}"]'); page.wait_for_timeout(1500)
        page.click(f'.piece[data-arg="{want}"]'); return
    if t == 'build':
        extra = [c['t'] for c in a['cards'] if c['k'] == -1]
        for k in range(wrong_first):
            if extra: page.click(f'.tcard[data-arg="{extra[0]}"]'); page.wait_for_timeout(150)
        for tok in a['tokens']:
            page.locator(f'.tcard:not(.used)[data-arg="{tok}"]').first.click(); page.wait_for_timeout(30)
        return
    if t == 'dict':
        dict_wrong(page, wrong_first)
        type_text(page, a['text']); page.click('[data-act=submit]'); return
    if t == 'fix':
        W = list(a['w']['word'])
        for i in a['bad']:
            page.click(f'.fixbox[data-arg="{i}"]'); page.wait_for_timeout(60)
            page.click(f'.fixopt[data-arg="{W[i]}"]'); page.wait_for_timeout(60)
        return

def play_day(page, tag, wrong_plan=None, shots=True):
    """하루 5단계를 끝까지 풀어요. wrong_plan: {act타입: 틀릴 횟수} (각 타입 첫 문제만)"""
    wrong_plan = dict(wrong_plan or {})
    page.click('[data-act=go]')
    seen_types, n = set(), 0
    cur = wait_change(page, '')
    prev_missing, bad_found, red_found, input_found = [], [], False, False
    while cur and cur != 'reward' and n < 80:
        n += 1
        a = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))")
        L = run_js(page, "() => ({s: YUNI.lesson.s, i: YUNI.lesson.i})")
        if not (L['s'] == 0 and L['i'] == 0) and not run_js(page, "() => !!document.querySelector('[data-act=prev]:not([disabled])')"):
            prev_missing.append(cur)
        if run_js(page, "() => !!document.querySelector('.stage input, .stage textarea')"): input_found = True
        if shots and a['type'] not in seen_types:
            page.screenshot(path=f'{SHOT}/{tag}_{len(seen_types)+1:02d}_{a["type"]}{a.get("mode","")}.png')
        seen_types.add(a['type'])
        wf = wrong_plan.pop(a['type'], 0)
        answer(page, a, wf)
        if wf:
            b, r = scan_bad(page, cur); bad_found += b; red_found |= r
        nxt = wait_change(page, cur, 12000)
        if nxt is None: print('  멈춤:', cur, a['type']); break
        cur = nxt
    if shots: page.screenshot(path=f'{SHOT}/{tag}_99_reward.png')
    return {'end': cur, 'types': seen_types, 'prev_missing': prev_missing, 'bad': bad_found, 'red': red_found, 'input': input_found}

with sync_playwright() as p:
    br = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for dev, vp, mobile in [('tab', {'width': 1280, 'height': 800}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(f'== {dev} {vp}')
        ctx = br.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=1.5 if not mobile else 2)
        ctx.add_init_script(MOCK)
        page = ctx.new_page()
        errors = []; reqs = []
        page.on('request', lambda r: reqs.append(r.url))
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
        page.goto(URL); page.wait_for_selector('.go-btn')
        page.screenshot(path=f'{SHOT}/{dev}_00_home.png')

        # --- 한글 엔진 (페이지 안에서) ---
        eng = run_js(page, """() => { const H = HANGUL; const t = (k) => { const c = new H.Composer(); H.keysFor(k).forEach(x => x === ' ' ? c.space() : c.type(x)); return c.text(); };
          const g1 = H.grade('음악','으막'), g2 = H.grade('나비가 꽃에 앉아요.','나비가꽃에 앉아요', {space:true});
          return { compose: ['꽃','닭','나비가 꽃에 앉아요','과자','의자','떡볶이'].every(x => t(x) === x), kkot: (()=>{const c=new H.Composer(); [...'ㄲㅗㅊ'].forEach(x=>c.type(x)); return c.text();})(),
            yeon: g1.cats.join(), spaceOnly: [g2.lettersOk, g2.spaceOk].join(), tense: H.grade('학교','학꾜').cats.join(), vowel: H.grade('개','게').cats.join(), batchim: H.grade('꽃','꼼').cats.join(),
            units: H.pron('나비가 꽃에 앉아요').text }; }""")
        if dev == 'tab':
            check('KREQ-42 자판 글자 조립 (ㄲㅗㅊ→꽃, 겹받침·겹모음)', eng['compose'] and eng['kkot'] == '꽃', json.dumps(eng, ensure_ascii=False))
            check('KREQ-43 글자·띄어쓰기 따로 채점', eng['spaceOnly'] == 'true,false')
            check('KREQ-43 틀린 규칙 자동 분류 (연음·된소리·모음·받침)', eng['yeon'] == '연음' and eng['tense'] == '된소리' and eng['vowel'] == '모음' and eng['batchim'] == '받침')

        # --- 하루 전체 (틀리는 흐름 포함) ---
        r1 = play_day(page, dev, wrong_plan={'pick': 2, 'dict': 3, 'jong': 1, 'build': 1, 'fix': 0})
        st = run_js(page, "() => { const S = YUNI.state; const k = Object.keys(S.log).pop(); return { stars: S.stars, day: S.log[k], pos: S.pos, srs: Object.keys(S.srs), rs: S.ruleStats, grade: S.grade, gok: S.gradeOk } }")
        check(f'[{dev}] KREQ-04 하루 5단계를 끝까지 (보상 화면)', r1['end'] == 'reward', str(r1['end']))
        check(f'[{dev}] MVP 모드 1·2·3·4·8·은후 고쳐주기 등장', {'pick', 'dict', 'fix', 'card'} <= r1['types'], ','.join(sorted(r1['types'])))
        check(f'[{dev}] KREQ-17 모든 문제에 ◀ 이전 버튼', not r1['prev_missing'], str(r1['prev_missing'][:3]))
        check(f'[{dev}] KREQ-07 "땡"·X 표시 없음, 빨간 글자 없음', not r1['bad'] and not r1['red'], str(r1['bad']))
        check(f'[{dev}] KREQ-42 수업 중 기본 키보드 입력칸 없음', not r1['input'])
        check(f'[{dev}] KREQ-18 하루 별 50개 이하 + 보너스 3', st['day']['stars'] <= 50 and st['day'].get('bonus') == 1, json.dumps(st['day']))
        check(f'[{dev}] KREQ-08 틀린 말이 어려운 말 상자에', len(st['srs']) > 0, str(st['srs'][:5]))
        check(f'[{dev}] KREQ-47 규칙별 정답률 쌓임', len(st['rs']) > 0, json.dumps(st['rs'], ensure_ascii=False))
        check(f'[{dev}] KREQ-09 다음 날로 진도 이동', st['pos'] == {'u': 0, 'd': 2, 's': 0}, str(st['pos']))
        check(f'[{dev}] 오류 없음 (콘솔)', not errors, str(errors[:3]))

        # 둘째 날: 한 번에 다 맞히기 → 별 확인 + 이전 버튼으로 같은 문제
        run_js(page, "() => { YUNI.state.log = {}; }")
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        page.click('[data-act=go]'); cur = wait_change(page, '')
        a0 = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))")
        answer(page, a0); cur = wait_change(page, cur)
        page.wait_for_timeout(100)
        a1 = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))")
        stars_before = run_js(page, "() => YUNI.state.stars")
        page.click('[data-act=prev]'); page.wait_for_timeout(200)
        a0b = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))")
        check(f'[{dev}] KREQ-17 이전으로 가도 같은 문제', json.dumps(a0b, sort_keys=True) == json.dumps(a0, sort_keys=True), f"{a0.get('w',{}).get('word')} / {a0b.get('w',{}).get('word')}")
        answer(page, a0b); wait_change(page, act_id(page))
        check(f'[{dev}] KREQ-18 다시 푼 문제는 별 없음', run_js(page, "() => YUNI.state.stars") == stars_before)
        # 상한 확인: 오늘 47개 + 보너스 자리 3 = 50 → 문제를 맞혀도 0개, 26개면 1개
        run_js(page, "() => { const S = YUNI.state; const k = Object.keys(S.log).pop(); S.log[k].stars = 47; S.log[k].bonus = 0; YUNI.lesson.awarded = {}; }")
        s47 = run_js(page, "() => YUNI.state.stars")
        a0c = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))"); answer(page, a0c); wait_change(page, act_id(page))
        check(f'[{dev}] KREQ-18 하루 50개 상한 (47개+보너스 3이면 더 안 줌)', run_js(page, "() => YUNI.state.stars") == s47)
        run_js(page, "() => { YUNI.state.log = {}; }")
        page.click('[data-act=quit]'); page.wait_for_selector('.go-btn')
        r2 = play_day(page, dev + '_d2', shots=False)
        day2 = run_js(page, "() => { const S = YUNI.state; return S.log[Object.keys(S.log).pop()] }")
        check(f'[{dev}] 한 번에 다 맞힌 날 별 {day2["stars"]}개 (문제 16 + 보너스 3)', r2['end'] == 'reward' and 15 <= day2['stars'] <= 19, json.dumps(day2))

        # --- KREQ-64 (공통 64번) 별: 몇 번 만에 맞혀도 1개, 정답 본 뒤 따라 써도 1개, 넘어가면 0개, 문제당 한 번만 ---
        run_js(page, "() => { YUNI.state.log = {}; YUNI.state.pos = {u: 0, d: 1, s: 0}; }")
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        stars = lambda: run_js(page, "() => YUNI.state.stars")
        k64 = {}
        for attempt in range(2):
            page.click('[data-act=go]'); cur = wait_change(page, '')
            n = 0
            while cur and cur != 'reward' and n < 60 and len(k64) < 4:
                n += 1
                a = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))")
                s0 = stars()
                if a['type'] == 'pick' and 'retry' not in k64:
                    answer(page, a, 1); cur2 = wait_change(page, cur, 12000)
                    k64['retry'] = (stars() - s0, a['w']['word'])
                    s1 = stars(); page.click('[data-act=prev]'); page.wait_for_timeout(200)
                    ab = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))"); answer(page, ab); wait_change(page, act_id(page), 12000)
                    k64['retry_again'] = (stars() - s1, ab.get('w', {}).get('word'))
                    cur = act_id(page); continue
                if a['type'] == 'dict' and 'copy' not in k64:
                    dict_wrong(page, 3); page.wait_for_timeout(400)
                    vis = run_js(page, "() => { const r = document.getElementById('skipRow'); return !!r && !r.hidden && r.getClientRects().length > 0; }")
                    h = run_js(page, "() => document.getElementById('hint').textContent")
                    page.screenshot(path=f'{SHOT}/{dev}_64_reveal.png')
                    type_text(page, a['text']); page.click('[data-act=submit]')
                    h2 = run_js(page, "() => document.getElementById('hint').textContent")
                    cur = wait_change(page, cur, 12000)
                    k64['copy'] = (stars() - s0, vis, h, h2)
                    continue
                if a['type'] == 'dict' and 'skip' not in k64:
                    dict_wrong(page, 3); page.wait_for_timeout(400)
                    page.click('[data-act=skip]'); nxt = wait_change(page, cur, 12000)
                    d_skip = stars() - s0
                    s1 = stars(); page.click('[data-act=prev]'); page.wait_for_timeout(250)
                    ab = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))"); answer(page, ab); wait_change(page, act_id(page), 12000)
                    k64['skip'] = (d_skip, stars() - s1, ab.get('text') == a['text'])
                    cur = act_id(page); continue
                answer(page, a); cur = wait_change(page, cur, 12000)
            if cur != 'reward': page.click('[data-act=quit]'); page.wait_for_selector('.go-btn')
            else: page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
            if len(k64) >= 4: break
            run_js(page, "() => { YUNI.state.pos = {u: 0, d: 2, s: 3}; }")
        r_ = k64.get('retry', (None,)); ra = k64.get('retry_again', (None,)); cp_ = k64.get('copy', (None, False, '', '')); sk = k64.get('skip', (None, None, False))
        check(f'[{dev}] KREQ-18/64 두 번째 시도에 맞히면 별 +1 (바른 글자 고르기)', r_[0] == 1, str(r_))
        check(f'[{dev}] KREQ-18/64 같은 문제(◀ 이전)는 두 번 별 없음', ra[0] == 0 and ra[1] == r_[-1], str(ra))
        check(f'[{dev}] KREQ-64 정답 보여줄 때 "다음 ▶"과 "정답을 따라 쓰면 별을 받아요" 안내', cp_[1] and '정답을 따라 쓰면 별을 받아요' in cp_[2], str(cp_))
        check(f'[{dev}] KREQ-64 정답 본 뒤 맞게 따라 쓰면 별 +1 ("잘 따라 썼어요! ⭐")', cp_[0] == 1 and '⭐' in cp_[3], str(cp_))
        check(f'[{dev}] KREQ-64 "다음 ▶"으로 넘어가면 별 0, ◀ 이전으로 와서 맞혀도 별 0', sk[0] == 0 and sk[1] == 0 and sk[2], str(sk))

        # 받아쓰기 음성: 띄어 읽기 단위로 끊어서 천천히 (0.8)
        run_js(page, "() => { window.__spoken = []; }")
        # --- 아빠 화면 ---
        if not run_js(page, "() => !!document.querySelector('.go-btn')"): page.click('[data-act=home]')
        page.wait_for_selector('.go-btn')
        page.click('[data-act=parent]'); page.wait_for_selector('#ans')
        page.screenshot(path=f'{SHOT}/{dev}_49_gate.png')
        gate_txt = run_js(page, "() => document.querySelector('.gate').innerText")
        # KREQ-61 암호 잠금: 틀린 암호는 안 열리고 1234로 열려요
        page.fill('#ans', '0000'); page.click('[data-act=ok]'); page.wait_for_timeout(250)
        wrong_ok = run_js(page, "() => !document.querySelector('.parent') && !!document.querySelector('#ans')")
        page.fill('#ans', '1234'); page.click('[data-act=ok]'); page.wait_for_selector('.parent', timeout=3000)
        check(f'[{dev}] KREQ-61 틀린 암호(0000)는 안 열리고 기본 암호 1234로 열림', wrong_ok and run_js(page, "() => !!document.querySelector('.parent') && YUNI.state.settings.parentPin === '1234'"))
        check(f'[{dev}] KREQ-61 암호 화면: 곱셈 문제 없이 가려진 암호칸 + "암호를 잊었어요"', not re.search(r'\d+\s*×\s*\d+', gate_txt) and '암호를 잊었어요' in gate_txt, gate_txt)
        txt = run_js(page, "() => document.querySelector('.parent').textContent")
        for need, rid in [('진도 조정', 'KREQ-14'), ('진도 초기화', 'KREQ-14'), ('별 조정', 'KREQ-14'), ('받은 보상', 'KREQ-15'), ('백업 파일 저장', 'KREQ-16'), ('새 버전 확인', 'KREQ-23'),
                          ('기획·변경 기록', 'KREQ-21'), ('우리 반 받아쓰기', 'KREQ-41'), ('규칙별 정답률', 'KREQ-47'), ('어려운 말 목록', 'KREQ-47'), ('채점 설정', 'KREQ-43'), ('100점 스티커', 'KREQ-41'), ('하루 최대 시간', 'KREQ-11')]:
            if rid: check(f'[{dev}] {rid} 아빠 화면: {need}', need in txt)
        check(f'[{dev}] KREQ-40 콘텐츠 점검 경고 없음', run_js(page, "() => YUNI.contentWarnings().warn.length") == 0, json.dumps(run_js(page, "() => YUNI.contentWarnings().warn"), ensure_ascii=False))
        page.screenshot(path=f'{SHOT}/{dev}_50_parent.png', full_page=False)
        vis_panels = "() => [...document.querySelectorAll('.ppanel')].filter(p => !p.hidden && getComputedStyle(p).display !== 'none' && p.getClientRects().length).map(p => p.dataset.panel)"
        # --- KREQ-63 탭 메뉴 6개, 패널은 하나만 ---
        tabs = run_js(page, "() => [...document.querySelectorAll('.ptabs .ptab')].map(b => b.dataset.arg)")
        check(f'[{dev}] KREQ-63 탭 6개 (요약·통계·보상·별·학습·진도·설정·백업·업데이트)', tabs == ['summary', 'stats', 'reward', 'progress', 'settings', 'manage'], str(tabs))
        check(f'[{dev}] KREQ-63 처음엔 요약 패널 하나만 보임', run_js(page, vis_panels) == ['summary'], str(run_js(page, vis_panels)))
        sw_ok, sw_info, hscroll = True, [], []
        for k in tabs:
            page.click(f'.ptab[data-arg="{k}"]'); page.wait_for_timeout(120)
            vp_ = run_js(page, vis_panels); on = run_js(page, "() => [...document.querySelectorAll('.ptab.on')].map(b => b.dataset.arg)")
            if vp_ != [k] or on != [k]: sw_ok = False; sw_info.append(f'{k}:{vp_}/{on}')
            if not run_js(page, "() => document.scrollingElement.scrollWidth <= innerWidth + 1"): hscroll.append(k)
            page.screenshot(path=f'{SHOT}/{dev}_5{tabs.index(k)+2}_tab_{k}.png')
        check(f'[{dev}] KREQ-63 탭을 누르면 그 패널 하나만 보임', sw_ok, ','.join(sw_info))
        check(f'[{dev}] KREQ-01 아빠 화면 모든 탭 가로 넘침 없음', not hscroll, ','.join(hscroll))
        page.click('.ptab[data-arg="reward"]'); s0 = run_js(page, "() => YUNI.state.stars")
        page.click('[data-act=star][data-arg="1"]'); page.wait_for_timeout(150)
        check(f'[{dev}] KREQ-63 별 +1 (화면 다시 그림) 뒤에도 보상·별 탭 유지', run_js(page, "() => YUNI.state.stars") == s0 + 1 and run_js(page, vis_panels) == ['reward'] and run_js(page, "() => document.querySelector('.ptab.on').dataset.arg") == 'reward')
        page.click('[data-act=star][data-arg="-1"]'); page.wait_for_timeout(100)
        # --- KREQ-62 날짜별 통계 ---
        seed = run_js(page, """() => { const S = YUNI.state; const p = n => String(n).padStart(2, '0'); const f = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
          S.log[f(1)] = { sec: 600, stars: 12, bonus: 1 }; S.log[f(3)] = { sec: 1260, stars: 25, app: 1800 }; S.log[f(10)] = { sec: 300, stars: 7 }; return { d1: f(1), d3: f(3), d10: f(10) }; }""")
        page.click('.ptab[data-arg="stats"]'); page.click('[data-act=statdays][data-arg="7"]'); page.wait_for_timeout(120)
        rows = run_js(page, "() => [...document.querySelectorAll('.stat-list .stat-row')].map(r => ({d: r.dataset.date, t: r.textContent}))")
        rt = {r['d']: r['t'] for r in rows}
        check(f'[{dev}] KREQ-62 통계 탭 최근 7일 = 7줄, 날짜별 분·별 (어제 10분·12개, 3일 전 21분·25개·앱 30분)', len(rows) == 7 and run_js(page, vis_panels) == ['stats']
              and '10분' in rt.get(seed['d1'], '') and '12개' in rt.get(seed['d1'], '') and '21분' in rt.get(seed['d3'], '') and '25개' in rt.get(seed['d3'], '') and '앱 켠 시간 30분' in rt.get(seed['d3'], '') and seed['d10'] not in rt,
              json.dumps(rows[:4], ensure_ascii=False))
        page.screenshot(path=f'{SHOT}/{dev}_53_tab_stats_seeded.png')
        page.click('[data-act=statdays][data-arg="14"]'); page.wait_for_timeout(120)
        n14 = run_js(page, "() => document.querySelectorAll('.stat-list .stat-row').length"); t14 = run_js(page, f"() => (document.querySelector('.stat-row[data-date=\"{seed['d10']}\"]') || {{}}).textContent || ''")
        page.click('[data-act=statdays][data-arg="30"]'); page.wait_for_timeout(120)
        n30 = run_js(page, "() => document.querySelectorAll('.stat-list .stat-row').length")
        check(f'[{dev}] KREQ-62 14일·30일 버튼 → 14줄·30줄, 탭 유지', n14 == 14 and '5분' in t14 and '7개' in t14 and n30 == 30 and run_js(page, vis_panels) == ['stats'], f'{n14},{n30},{t14}')
        page.click('[data-act=statdays][data-arg="7"]'); page.wait_for_timeout(80)
        # --- KREQ-61 암호 바꾸기 (설정 탭) ---
        page.click('.ptab[data-arg="settings"]')
        page.fill('#pinNew', '5678'); page.fill('#pinNew2', '5679'); page.click('[data-act=setpin]'); page.wait_for_timeout(120)
        mismatch_ok = run_js(page, "() => YUNI.state.settings.parentPin") == '1234'
        page.fill('#pinNew', '12'); page.fill('#pinNew2', '12'); page.click('[data-act=setpin]'); page.wait_for_timeout(120)
        short_ok = run_js(page, "() => YUNI.state.settings.parentPin") == '1234'
        page.fill('#pinNew', '5678'); page.fill('#pinNew2', '5678'); page.click('[data-act=setpin]'); page.wait_for_timeout(150)
        changed = run_js(page, "() => YUNI.state.settings.parentPin") == '5678' and run_js(page, vis_panels) == ['settings']
        tab_in_view = "() => { const b = document.querySelector('.ptab.on'); if (!b) return null; const r = b.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom > 0 && r.top < innerHeight ? b.dataset.arg : 'out:' + b.dataset.arg + ':' + Math.round(r.left) + '-' + Math.round(r.right); }"
        in_settings = run_js(page, tab_in_view)
        page.click('.ptab[data-arg="manage"]'); page.wait_for_timeout(100)
        page.fill('#pcode', run_js(page, "() => { const q = YUNI.state.pos; return `${q.u+1}-${q.d}-${q.s+1}`; }")); page.click('[data-act=setpos]'); page.wait_for_timeout(250)
        in_manage = run_js(page, tab_in_view)
        check(f'[{dev}] KREQ-63 다시 그린 뒤(설정 탭 암호 바꾸기·백업 탭 진도 맞추기) 켜진 탭 버튼이 화면 안에 보임', in_settings == 'settings' and in_manage == 'manage' and run_js(page, vis_panels) == ['manage']
              and run_js(page, "() => document.scrollingElement.scrollWidth <= innerWidth + 1"), f'{in_settings},{in_manage}')
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        page.click('[data-act=parent]'); page.wait_for_selector('#ans')
        page.fill('#ans', '1234'); page.click('[data-act=ok]'); page.wait_for_timeout(250)
        old_blocked = run_js(page, "() => !document.querySelector('.parent')")
        page.fill('#ans', '5678'); page.click('[data-act=ok]'); page.wait_for_selector('.parent', timeout=3000)
        check(f'[{dev}] KREQ-61 설정 탭에서 암호 바꾸기 (다르게 두 번·4자리 미만은 거절) → 새 암호로 열리고 1234는 안 열림', mismatch_ok and short_ok and changed and old_blocked and run_js(page, "() => !!document.querySelector('.parent')"),
              f'{mismatch_ok},{short_ok},{changed},{old_blocked}')
        # 암호를 잊었어요 → 곱셈 맞히면 1234로
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        page.click('[data-act=parent]'); page.wait_for_selector('#ans'); page.click('[data-act=forgot]'); page.wait_for_timeout(150)
        prob = run_js(page, "() => document.querySelector('.gate').innerText")
        page.screenshot(path=f'{SHOT}/{dev}_49_pinreset.png')
        m = re.search(r'(\d+)\s*×\s*(\d+)', prob)
        x, y = int(m.group(1)), int(m.group(2))
        page.fill('#ans', str(x * y + 1)); page.click('[data-act=ok]'); page.wait_for_timeout(150)
        wrong_stay = run_js(page, "() => !document.querySelector('.parent') && YUNI.state.settings.parentPin === '5678'")
        m = re.search(r'(\d+)\s*×\s*(\d+)', run_js(page, "() => document.querySelector('.gate').innerText")); x, y = int(m.group(1)), int(m.group(2))
        page.fill('#ans', str(x * y)); page.click('[data-act=ok]'); page.wait_for_selector('.parent', timeout=3000)
        check(f'[{dev}] KREQ-61 "암호를 잊었어요" 두 자리×두 자리 곱셈 맞히면 1234로 되돌림 (틀리면 그대로)', wrong_stay and 10 <= x <= 99 and 10 <= y <= 99 and run_js(page, "() => YUNI.state.settings.parentPin") == '1234'
              and run_js(page, vis_panels) == ['settings'], f'{x}x{y} {wrong_stay}')
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        page.click('[data-act=parent]'); page.wait_for_selector('#ans'); page.fill('#ans', '1234'); page.click('[data-act=ok]'); page.wait_for_selector('.parent')
        check(f'[{dev}] KREQ-61 되돌린 뒤 1234로 다시 열림', run_js(page, vis_panels) == ['summary'])
        # 우리 반 받아쓰기 입력 (학습·진도 탭)
        page.click('.ptab[data-arg="progress"]')
        page.fill('#clsTitle', '3회')
        page.fill('#clsDate', run_js(page, "() => { const d = new Date(); d.setDate(d.getDate()+3); return d.toISOString().slice(0,10); }"))
        page.fill('#clsText', '나비가 꽃에 앉아요.\n로봇이 걸어요.\n현이가 개미를 찾았어요.')
        page.click('[data-act=clssave]'); page.wait_for_timeout(200)
        check(f'[{dev}] KREQ-45 문장별 녹음 버튼', run_js(page, "() => document.querySelectorAll('[data-act=rec]').length") == 3)
        page.locator('#clsRows').screenshot(path=f'{SHOT}/{dev}_51_class.png')
        # 기획서 화면
        page.click('[data-act=spec]'); page.wait_for_selector('.spec table', timeout=4000)
        spec_txt = run_js(page, "() => document.querySelector('.spec').innerText")
        check(f'[{dev}] KREQ-21 앱 안 기획서 표시', 'KREQ-43' in spec_txt and 'v0.1' in spec_txt)
        page.click('[data-act=back]'); page.wait_for_selector('.parent')
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        check(f'[{dev}] KREQ-41 홈에 우리 반 받아쓰기 (D-day)', 'D-3' in run_js(page, "() => document.querySelector('.cls-btn') ? document.querySelector('.cls-btn').innerText : ''"))
        page.screenshot(path=f'{SHOT}/{dev}_01_home_cls.png')
        # 우리 반 연습: 첫 문장 틀린 띄어쓰기 → 글자는 맞았어요 메시지
        run_js(page, "() => { window.__spoken = []; }")
        page.click('[data-act=cls]'); cur = wait_change(page, '')
        a = run_js(page, "() => JSON.parse(JSON.stringify(YUNI.act))")
        page.wait_for_timeout(2500)
        spoken = run_js(page, "() => window.__spoken.filter(x => Math.abs(x.r - 0.8) < 0.01).map(x => x.t)")
        aud = run_js(page, "() => window.__audio.filter(x => x.src.includes('audio-ko/')).map(x => [x.src.split('/').pop(), x.rate])")
        if a['text'] in KO_IDX:
            check(f'[{dev}] KREQ-12/65 받아쓰기 음성: 녹음 문장 전체를 보통 빠르기로 (받아쓰기 속도 0.8 = 녹음 원래 빠르기)', [KO_IDX[a['text']], 1] in [[f, round(r, 2)] for f, r in aud], str(aud))
        else:
            check(f'[{dev}] KREQ-12 받아쓰기 음성(녹음 없는 우리 반 문장 → 기기 음성): 띄어 읽기 단위로 끊어 천천히(0.8)', spoken == a['text'].split(' '), str(spoken))
        nospace = a['text'].replace(' ', '', 1)
        for k in run_js(page, "t => HANGUL.keysFor(t)", nospace):
            page.click('[data-act=sp]') if k == ' ' else page.click(f'.key[data-arg="{k}"]')
        page.click('[data-act=submit]'); page.wait_for_timeout(400)
        hint = run_js(page, "() => document.getElementById('hint').textContent")
        check(f'[{dev}] KREQ-43 띄어쓰기만 틀리면 "글자는 모두 맞았어요"', '글자는 모두 맞았어요' in hint and run_js(page, "() => !!document.querySelector('.vmark')"), hint)
        page.screenshot(path=f'{SHOT}/{dev}_60_dict_space.png')
        of = run_js(page, "() => document.scrollingElement.scrollWidth <= innerWidth + 1")
        check(f'[{dev}] KREQ-01 가로 넘침 없음 (받아쓰기)', of)
        page.click('[data-act=quit]'); page.wait_for_selector('.go-btn')
        # 저장 키
        keys = run_js(page, "() => Object.keys(localStorage)")
        check(f'[{dev}] KREQ-16 저장 키 yuni-hangul-v1만 사용', keys == ['yuni-hangul-v1'], str(keys))
        # 오늘의 받아쓰기 단계가 우리 반 문장으로 바뀜
        run_js(page, "() => { YUNI.state.pos = {u:0,d:2,s:3}; }")
        page.click('[data-act=go]'); wait_change(page, '')
        a = run_js(page, "() => YUNI.act")
        check(f'[{dev}] KREQ-41 시험 전에는 받아쓰기 단계가 우리 반 문장', a['type'] == 'dict' and a['src'] == 'class')
        page.click('[data-act=quit]'); page.wait_for_selector('.go-btn')
        # 스티커북·단계 고르기
        page.click('[data-act=stickers]'); page.wait_for_selector('.badges'); page.screenshot(path=f'{SHOT}/{dev}_70_stickers.png'); page.click('[data-act=home]')
        page.click('[data-act=picker]'); page.wait_for_selector('.grid'); page.screenshot(path=f'{SHOT}/{dev}_71_picker.png')
        check(f'[{dev}] KREQ-40 단원 1~7 열림, 8~13 곧 열려요', run_js(page, "() => document.querySelectorAll('button.tile').length") == 7 and run_js(page, "() => document.querySelectorAll('.tile.locked').length") == 6)
        check(f'[{dev}] KREQ-01 가로 넘침 없음 (단계 고르기)', run_js(page, "() => document.scrollingElement.scrollWidth <= innerWidth + 1"))
        page.fill('#code', '5-2'); page.click('[data-act=code]'); wait_change(page, '')
        check(f'[{dev}] KREQ-09 진도 코드로 바로 가기', run_js(page, "() => YUNI.state.pos.u") == 4)
        # --- KREQ-65 한국어 녹음 목소리: 받아쓰기 보통·🐢 천천히, 녹음 없는 문장, 기기 음성 설정 ---
        for sel_ in ['[data-act=quit]', '[data-act=home]']:
            if not run_js(page, "() => !!document.querySelector('.go-btn')") and page.locator(sel_).count(): page.click(sel_); page.wait_for_timeout(200)
        page.wait_for_selector('.go-btn')
        dk = "async ([t, slow]) => { window.__audio = []; window.__spoken = []; await YUNI.dictate(t, slow); return { a: window.__audio.map(x => [x.src.split('/').pop(), Math.round(x.rate * 100) / 100]), s: window.__spoken.map(x => [x.t, x.r]) }; }"
        n1 = run_js(page, dk, ['나비가 꽃에 앉아요.', False]); s1 = run_js(page, dk, ['나비가 꽃에 앉아요.', True])
        w0 = run_js(page, dk, ['나비', False]); w1 = run_js(page, dk, ['나비', True])
        units = [KO_IDX.get(u) for u in ['나비가', '꽃에', '앉아요.']]
        check(f'[{dev}] KREQ-65 받아쓰기 보통 = 녹음 문장 전체(1.0배), 기기 음성 안 씀', n1['a'] == [[KO_IDX['나비가 꽃에 앉아요.'], 1]] and not n1['s'], json.dumps(n1, ensure_ascii=False))
        check(f'[{dev}] KREQ-65 받아쓰기 🐢 천천히 = 띄어 읽기 단위 녹음을 0.8배로 하나씩', all(units) and s1['a'] == [[f, 0.8] for f in units] and not s1['s'], json.dumps(s1, ensure_ascii=False))
        check(f'[{dev}] KREQ-65 낱말 받아쓰기: 보통 1.0배, 🐢 0.8배 (같은 녹음)', w0['a'] == [[KO_IDX['나비'], 1]] and w1['a'] == [[KO_IDX['나비'], 0.8]], json.dumps([w0, w1], ensure_ascii=False))
        c1 = run_js(page, dk, ['로봇이 걸어요.', True])
        check(f'[{dev}] KREQ-65 녹음 없는 우리 반 문장은 기기 음성(🐢 0.65, 단위로 끊어)', c1['s'] == [['로봇이', 0.65], ['걸어요.', 0.65]] and not any('audio-ko' in x[0] for x in c1['a']) , json.dumps(c1, ensure_ascii=False))
        kk = run_js(page, "async () => { window.__audio = []; window.__spoken = []; await YUNI.ko('다시 들어볼까? 오늘 국어 끝!'); return { a: window.__audio.map(x => x.src.split('/').pop()), s: window.__spoken.map(x => x.t) }; }")
        check(f'[{dev}] KREQ-65 ko(): 문장마다 녹음 재생, 기기 음성 안 씀', kk['a'] == [KO_IDX['다시 들어볼까?'], KO_IDX['오늘 국어 끝!']] and not kk['s'], json.dumps(kk, ensure_ascii=False))
        check(f'[{dev}] KREQ-65 audio-ko/*.mp3 파일 요청이 실제로 나감', any(re.search(r'/audio-ko/[0-9a-f]{12}\.mp3', u) for u in reqs), str(len(reqs)))
        # 아빠 화면 설정 "한국어 읽기: 기기 음성" → 녹음 안 씀
        page.click('[data-act=parent]'); page.wait_for_selector('#ans'); page.fill('#ans', '1234'); page.click('[data-act=ok]'); page.wait_for_selector('.parent')
        page.click('.ptab[data-arg="settings"]'); page.select_option('select[data-set="koVoiceMode"]', 'device'); page.wait_for_timeout(150)
        mode = run_js(page, "() => YUNI.state.settings.koVoiceMode")
        before = len([u for u in reqs if '/audio-ko/' in u and u.endswith('.mp3')])
        dv = run_js(page, "async () => { window.__audio = []; window.__spoken = []; await YUNI.ko('다시 들어볼까?'); await YUNI.dictate('나비가 꽃에 앉아요.', true); return { a: window.__audio.length, s: window.__spoken.map(x => [x.t, x.r]) }; }")
        after = len([u for u in reqs if '/audio-ko/' in u and u.endswith('.mp3')])
        check(f'[{dev}] KREQ-65 설정 "기기 음성" → audio-ko 요청 없음, 기기 음성으로 읽음 (🐢 0.65 단위)', mode == 'device' and dv['a'] == 0 and after == before and dv['s'][0][0] == '다시 들어볼까?' and dv['s'][1:] == [['나비가', 0.65], ['꽃에', 0.65], ['앉아요.', 0.65]], json.dumps(dv, ensure_ascii=False))
        page.select_option('select[data-set="koVoiceMode"]', 'rec'); page.wait_for_timeout(100)
        check(f'[{dev}] KREQ-65 설정 되돌리기 (녹음 목소리 기본)', run_js(page, "() => YUNI.state.settings.koVoiceMode") == 'rec')
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        ko_logs.extend((dev, t) for t in run_js(page, "() => window.__KO_LOG"))
        check(f'[{dev}] 오류 없음 (끝까지)', not errors, str(errors[:3]))
        ctx.close()

    # --- KREQ-65 녹음 목록 적용 범위: 하루 흐름에서 실제로 읽은 한국어가 녹음 목록에 있는지 ---
    logged = sorted({ko_norm(t) for _, t in ko_logs if ko_norm(t)})
    user = [t for t in logged if t in CLASS_TEXTS or ko_norm(t.replace('/', ' ')) in CLASS_TEXTS]
    target = [t for t in logged if t not in user]
    covered = [t for t in target if t in KO_IDX or all(x in KO_IDX for x in ko_parts(t))]
    missing = [t for t in target if t not in covered]
    pct = 100 * len(covered) / max(1, len(target))
    print(f'KREQ-65 적용 범위: 읽은 글 {len(target)}개 중 녹음 {len(covered)}개 ({pct:.1f}%), 우리 반 문장(기기 음성) {len(user)}개')
    for t in missing: print('   녹음 없음:', t)
    check(f'KREQ-65 하루 흐름에서 읽은 한국어의 95% 이상이 녹음 목록에 ({pct:.1f}%)', pct >= 95 and len(target) >= 30, '; '.join(missing[:8]))
    # 진짜 Audio로 재생 (mp3가 브라우저에서 열리고 끝까지 재생되는지)
    ctx = br.new_context(); ctx.add_init_script(MOCK); page = ctx.new_page(); reqs = []
    page.on('request', lambda r: reqs.append(r.url))
    page.goto(URL + '?realaudio=1'); page.wait_for_selector('.go-btn'); page.wait_for_function("() => fetch('audio-ko/index.json').then(() => true)")
    page.wait_for_timeout(300)
    real = run_js(page, "async () => { const t0 = Date.now(); window.__spoken = []; await YUNI.ko('다시 들어볼까?'); return { ms: Date.now() - t0, dev: window.__spoken.length }; }")
    check('KREQ-65 진짜 Audio로 녹음 재생 (mp3 요청, 기기 음성 안 씀)', any('/audio-ko/' + KO_IDX['다시 들어볼까?'] in u for u in reqs) and real['dev'] == 0, json.dumps(real))
    ctx.close()

    # --- 정적 점검 ---
    src = open(f'{APP}/app.js', encoding='utf-8').read(); sw = open(f'{APP}/sw.js', encoding='utf-8').read(); spec = open(f'{APP}/기획서.md', encoding='utf-8').read()
    man = json.load(open(f'{APP}/manifest.webmanifest', encoding='utf-8'))
    ver = re.search(r"APP_VERSION = '([\d.]+)'", src).group(1)
    check('KREQ-16 저장 키 상수 yuni-hangul-v1', "const KEY = 'yuni-hangul-v1'" in src and 'yuni-english-v1' not in src and 'yuni-math' not in src)
    check('KREQ-11 밤 시간 잠금 없음 (시각으로 잠그지 않음)', not re.search(r'getHours\(\)', src))
    check('KREQ-34 타이머·초시계 없음', not re.search(r'남은 시간|초시계|카운트다운|countdown', src))
    check('KREQ-18 하루 최대 50·보너스 3', 'DAY_STAR_MAX = 50, DAY_BONUS = 3' in src)
    check('KREQ-23 APP_VERSION·sw VERSION·기획서 버전 일치', f"yuni-hangul-{ver}'" in sw and f'**v{ver}**' in spec, ver)
    check('KREQ-48 주황 색·국어 이름', man['theme_color'] == '#ff7a1a' and man['name'] == '윤이 국어')
    check('KREQ-02 오프라인 캐시 목록에 기획서.md', '기획서.md' in sw)
    check('KREQ-65 sw.js가 audio-ko/index.json 캐시 + 녹음 파일 백그라운드 받기, 업데이트 목록에도', "'audio-ko/index.json'" in sw and 'cacheAudio' in sw and "'audio-ko/index.json']" in src)
    check('KREQ-65 녹음 파일이 index.json과 맞음', all(os.path.exists(os.path.join(APP, 'audio-ko', f)) for f in KO_IDX.values()), str(len(KO_IDX)))
    for rid in ['KREQ-01', 'KREQ-02', 'KREQ-04', 'KREQ-07', 'KREQ-08', 'KREQ-12', 'KREQ-16', 'KREQ-17', 'KREQ-18', 'KREQ-40', 'KREQ-41', 'KREQ-42', 'KREQ-43', 'KREQ-45', 'KREQ-47', 'KREQ-60', 'KREQ-61', 'KREQ-62', 'KREQ-63', 'KREQ-64', 'KREQ-65']:
        check(f'기획서.md에 {rid} 있음', rid in spec)
    br.close()

print('\n=== 요구사항 점검 ===')
for n, s, i in results: print(f'{s:4} {n}' + (f'  ({i})' if s == 'FAIL' and i else ''))
fails = [r for r in results if r[1] == 'FAIL']
print(f'\n{"ALL OK" if not fails else f"FAIL {len(fails)}개"} — {len(results)}개 항목')
srv.shutdown()
sys.exit(1 if fails else 0)
