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
"""

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
        def type_text(txt):
            for k in run_js(page, "t => HANGUL.keysFor(t)", txt):
                if k == ' ': page.click('[data-act=sp]')
                else: page.click(f'.key[data-arg="{k}"]')
        for k in range(wrong_first):
            type_text('가나다'); page.click('[data-act=submit]'); page.wait_for_timeout(250)
            # 지우기
            n = run_js(page, "() => document.querySelectorAll('#grid .cell:not(.empty)').length")
            page.click('[data-act=curend]')
            for _ in range(n + 1): page.click('[data-act=bs]')
        type_text(a['text']); page.click('[data-act=submit]'); return
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
    br = p.chromium.launch()
    for dev, vp, mobile in [('tab', {'width': 1280, 'height': 800}, False), ('phone', {'width': 390, 'height': 844}, True)]:
        print(f'== {dev} {vp}')
        ctx = br.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=1.5 if not mobile else 2)
        ctx.add_init_script(MOCK)
        page = ctx.new_page()
        errors = []
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
        check(f'[{dev}] KREQ-18 하루 별 20개 이하 + 보너스 3', st['day']['stars'] <= 20 and st['day'].get('bonus') == 1, json.dumps(st['day']))
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
        page.click('[data-act=quit]'); page.wait_for_selector('.go-btn')
        r2 = play_day(page, dev + '_d2', shots=False)
        day2 = run_js(page, "() => { const S = YUNI.state; return S.log[Object.keys(S.log).pop()] }")
        check(f'[{dev}] 한 번에 다 맞힌 날 별 {day2["stars"]}개 (19개 이하 설계, 최대 20)', r2['end'] == 'reward' and 15 <= day2['stars'] <= 20, json.dumps(day2))

        # 받아쓰기 음성: 띄어 읽기 단위로 끊어서 천천히 (0.8)
        run_js(page, "() => { window.__spoken = []; }")
        # --- 아빠 화면 ---
        page.click('[data-act=home]'); page.wait_for_selector('.go-btn')
        page.click('[data-act=parent]'); page.wait_for_selector('#ans')
        prob = run_js(page, "() => document.querySelector('.gate b + div').textContent")
        x, y = [int(v) for v in re.findall(r'\d+', prob)]
        page.fill('#ans', str(x * y)); page.click('[data-act=ok]'); page.wait_for_selector('.parent')
        txt = run_js(page, "() => document.body.innerText")
        for need, rid in [('곱셈', None), ('진도 조정', 'KREQ-14'), ('진도 초기화', 'KREQ-14'), ('별 조정', 'KREQ-14'), ('받은 보상', 'KREQ-15'), ('백업 파일 저장', 'KREQ-16'), ('새 버전 확인', 'KREQ-23'),
                          ('기획·변경 기록', 'KREQ-21'), ('우리 반 받아쓰기', 'KREQ-41'), ('규칙별 정답률', 'KREQ-47'), ('어려운 말 목록', 'KREQ-47'), ('채점 설정', 'KREQ-43'), ('100점 스티커', 'KREQ-41'), ('하루 최대 시간', 'KREQ-11')]:
            if rid: check(f'[{dev}] {rid} 아빠 화면: {need}', need in txt)
        check(f'[{dev}] KREQ-40 콘텐츠 점검 경고 없음', run_js(page, "() => YUNI.contentWarnings().warn.length") == 0, json.dumps(run_js(page, "() => YUNI.contentWarnings().warn"), ensure_ascii=False))
        page.screenshot(path=f'{SHOT}/{dev}_50_parent.png', full_page=False)
        # 우리 반 받아쓰기 입력
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
        check(f'[{dev}] KREQ-12 받아쓰기 음성: 띄어 읽기 단위로 끊어 천천히(0.8)', spoken == a['text'].split(' '), str(spoken))
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
        check(f'[{dev}] 오류 없음 (끝까지)', not errors, str(errors[:3]))
        ctx.close()

    # --- 정적 점검 ---
    src = open(f'{APP}/app.js', encoding='utf-8').read(); sw = open(f'{APP}/sw.js', encoding='utf-8').read(); spec = open(f'{APP}/기획서.md', encoding='utf-8').read()
    man = json.load(open(f'{APP}/manifest.webmanifest', encoding='utf-8'))
    ver = re.search(r"APP_VERSION = '([\d.]+)'", src).group(1)
    check('KREQ-16 저장 키 상수 yuni-hangul-v1', "const KEY = 'yuni-hangul-v1'" in src and 'yuni-english-v1' not in src and 'yuni-math' not in src)
    check('KREQ-11 밤 시간 잠금 없음 (시각으로 잠그지 않음)', not re.search(r'getHours\(\)', src))
    check('KREQ-34 타이머·초시계 없음', not re.search(r'남은 시간|초시계|카운트다운|countdown', src))
    check('KREQ-18 하루 최대 20·보너스 3', 'DAY_STAR_MAX = 20, DAY_BONUS = 3' in src)
    check('KREQ-23 APP_VERSION·sw VERSION·기획서 버전 일치', f"yuni-hangul-{ver}'" in sw and f'**v{ver}**' in spec, ver)
    check('KREQ-48 주황 색·국어 이름', man['theme_color'] == '#ff7a1a' and man['name'] == '윤이 국어')
    check('KREQ-02 오프라인 캐시 목록에 기획서.md', '기획서.md' in sw)
    for rid in ['KREQ-01', 'KREQ-02', 'KREQ-04', 'KREQ-07', 'KREQ-08', 'KREQ-12', 'KREQ-16', 'KREQ-17', 'KREQ-18', 'KREQ-40', 'KREQ-41', 'KREQ-42', 'KREQ-43', 'KREQ-45', 'KREQ-47']:
        check(f'기획서.md에 {rid} 있음', rid in spec)
    br.close()

print('\n=== 요구사항 점검 ===')
for n, s, i in results: print(f'{s:4} {n}' + (f'  ({i})' if s == 'FAIL' and i else ''))
fails = [r for r in results if r[1] == 'FAIL']
print(f'\n{"ALL OK" if not fails else f"FAIL {len(fails)}개"} — {len(results)}개 항목')
srv.shutdown()
sys.exit(1 if fails else 0)
