#!/usr/bin/env python3
"""한국어 녹음 만들기 (공통 65번) — 세 앱 같은 도구.
사용: python3 tools/make_ko_audio.py ko_sentences.json <supertonic 모델 폴더> [audio-ko 폴더] [--budget 초]
 - ko_sentences.json: [{"key": "앱이 ko()에 넘기는 문장(한 문장)", "say": "실제로 읽을 글(없으면 key)"}, ...]
 - 목소리: Supertonic 3, 목소리 6(sid 5), 속도 보통(1.0), num_steps 8, 한국어(lang ko)
 - 파일 이름: md5(key)[:12].mp3 (mono 24kHz 40kbps), audio-ko/index.json = {key: 파일 이름}
 - 이미 있는 파일은 건너뛰어요. --budget 초가 지나면 멈추고 다음에 이어서 해요 (index.json은 매번 저장).
 - 필요: pip install sherpa-onnx soundfile, ffmpeg
"""
import sys, os, json, hashlib, time, re, subprocess, tempfile
args = [a for a in sys.argv[1:] if not a.startswith('--')]
budget = 1e9
if '--budget' in sys.argv: budget = float(sys.argv[sys.argv.index('--budget') + 1]); args = [a for a in args if a != sys.argv[sys.argv.index('--budget') + 1]]
src, D = args[0], args[1].rstrip('/') + '/'
out = args[2] if len(args) > 2 else 'audio-ko'
os.makedirs(out, exist_ok=True)
VOICE_SID, SPEED, STEPS = 5, 1.0, 8
key_norm = lambda t: re.sub(r'\s+', ' ', str(t)).strip()
fname = lambda k: hashlib.md5(k.encode('utf-8')).hexdigest()[:12] + '.mp3'
items = json.load(open(src, encoding='utf-8'))
idx_path = os.path.join(out, 'index.json')
idx = json.load(open(idx_path, encoding='utf-8')) if os.path.exists(idx_path) else {}
todo = []
seen = set()
for it in items:
    k = key_norm(it['key']) if isinstance(it, dict) else key_norm(it)
    say = (it.get('say') if isinstance(it, dict) else None) or k
    if not k or k in seen: continue
    seen.add(k)
    f = fname(k)
    if os.path.exists(os.path.join(out, f)): idx[k] = f; continue
    todo.append((k, say, f))
print(f'전체 {len(seen)}개, 새로 만들 것 {len(todo)}개', flush=True)
if todo:
    import sherpa_onnx as so, soundfile as sf
    cfg = so.OfflineTtsConfig(model=so.OfflineTtsModelConfig(supertonic=so.OfflineTtsSupertonicModelConfig(
        duration_predictor=D + 'duration_predictor.int8.onnx', text_encoder=D + 'text_encoder.int8.onnx',
        vector_estimator=D + 'vector_estimator.int8.onnx', vocoder=D + 'vocoder.int8.onnx',
        tts_json=D + 'tts.json', unicode_indexer=D + 'unicode_indexer.bin', voice_style=D + 'voice.bin'), num_threads=2))
    tts = so.OfflineTts(cfg)
    t0 = time.time(); n = 0
    tmp = tempfile.mkdtemp()
    for k, say, f in todo:
        if time.time() - t0 > budget: break
        g = so.GenerationConfig(); g.sid = VOICE_SID; g.num_steps = STEPS; g.speed = SPEED; g.extra['lang'] = 'ko'
        a = tts.generate(say, g)
        w = os.path.join(tmp, 'x.wav'); sf.write(w, a.samples, a.sample_rate)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', w, '-ac', '1', '-ar', '24000', '-b:a', '40k', os.path.join(out, f)], check=True)
        idx[k] = f; n += 1
        if n % 25 == 0: json.dump(idx, open(idx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'이번에 {n}개 만듦, {round(time.time() - t0)}초', flush=True)
# 목록에 없는 문장은 index에서 빼요 (파일은 남아 있어도 앱이 안 써요)
idx = {k: v for k, v in idx.items() if k in seen}
json.dump(idx, open(idx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
left = sum(1 for k, _, f in todo if not os.path.exists(os.path.join(out, f)))
print(f'남은 것 {left}개', flush=True)
