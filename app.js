/* 윤이 국어 — 앱 로직 (의존성 없음) */

/* ================= 한글 엔진: 글자 조립 · 발음 · 채점 =================
 * 앱과 자동 테스트가 함께 써요 (window.HANGUL)
 */
window.HANGUL = (() => {
  'use strict';
  const CHO = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
  const JUNG = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
  const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
  const JONG_JOIN = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
  const JUNG_JOIN = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
  const split = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, [...k]]));
  const JONG_SPLIT = split(JONG_JOIN), JUNG_SPLIT = split(JUNG_JOIN);
  const TENSE = { 'ㄱ': 'ㄲ', 'ㄷ': 'ㄸ', 'ㅂ': 'ㅃ', 'ㅅ': 'ㅆ', 'ㅈ': 'ㅉ' };
  const LAX = Object.fromEntries(Object.entries(TENSE).map(([a, b]) => [b, a]));
  const ASP = { 'ㄱ': 'ㅋ', 'ㄷ': 'ㅌ', 'ㅂ': 'ㅍ', 'ㅈ': 'ㅊ' };
  const NEUTRAL = { 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅎ': 'ㄷ', 'ㅍ': 'ㅂ', 'ㄿ': 'ㅂ', 'ㅄ': 'ㅂ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ', 'ㄻ': 'ㅁ', 'ㄼ': 'ㄹ', 'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㅀ': 'ㄹ' };
  const PUNCT = '.,?!';
  const isSyl = c => !!c && c.length === 1 && c.charCodeAt(0) >= 0xAC00 && c.charCodeAt(0) <= 0xD7A3;
  const isVowel = j => JUNG.includes(j);
  const isCons = j => CHO.includes(j) || JONG.includes(j) && j !== '';
  const isPunct = c => PUNCT.includes(c) && !!c;
  function dec(c) {
    if (!isSyl(c)) return null;
    const n = c.charCodeAt(0) - 0xAC00;
    return { cho: CHO[Math.floor(n / 588)], jung: JUNG[Math.floor(n % 588 / 28)], jong: JONG[n % 28] };
  }
  function comp(cho, jung, jong) {
    if (cho && jung) {
      const a = CHO.indexOf(cho), b = JUNG.indexOf(jung), c = JONG.indexOf(jong || '');
      if (a >= 0 && b >= 0 && c >= 0) return String.fromCharCode(0xAC00 + a * 588 + b * 28 + c);
    }
    return (cho || '') + (jung || '') + (jong || '');
  }
  const syls = s => [...String(s)];

  /* ---------- 두벌식 글자 조립기 (자동완성·맞춤법 고침 없음) ---------- */
  class Composer {
    constructor() { this.chars = []; this.meta = []; this.cur = 0; this.c = null; }
    blockStr() { const c = this.c; if (!c) return ''; return c.cho && c.jung ? comp(c.cho, c.jung, c.jong) : (c.cho || '') + (c.jung || ''); }
    text() { const a = this.chars.slice(); if (this.c) a.splice(this.cur, 0, this.blockStr()); return a.join(''); }
    cells() { // 화면에 그릴 칸: {ch, meta, composing}
      const a = this.chars.map((ch, i) => ({ ch, meta: this.meta[i] || {}, i }));
      if (this.c) a.splice(this.cur, 0, { ch: this.blockStr(), meta: {}, composing: true, i: -1 });
      return a;
    }
    insert(ch) { this.chars.splice(this.cur, 0, ch); this.meta.splice(this.cur, 0, {}); this.cur++; }
    commit() { if (this.c) { const s = this.blockStr(); this.c = null; if (s) this.insert(s); } }
    clearMarks() { this.meta = this.meta.map(() => ({})); this.endMiss = false; }
    type(j) {
      if (isPunct(j)) { this.commit(); this.insert(j); return; }
      const c = this.c;
      if (isVowel(j)) {
        if (!c) { this.c = { cho: '', jung: j, jong: '' }; return; }
        if (c.jong) { // 받침이 다음 글자로 넘어가요: 각 + ㅏ → 가가
          let keep = '', move = c.jong;
          if (JONG_SPLIT[c.jong]) [keep, move] = JONG_SPLIT[c.jong];
          c.jong = keep; this.commit(); this.c = { cho: move, jung: j, jong: '' }; return;
        }
        if (c.jung) {
          if (JUNG_JOIN[c.jung + j]) { c.jung = JUNG_JOIN[c.jung + j]; return; }
          this.commit(); this.c = { cho: '', jung: j, jong: '' }; return;
        }
        c.jung = j; return;
      }
      if (!isCons(j)) return;
      if (!c) { this.c = { cho: j, jung: '', jong: '' }; return; }
      if (c.cho && c.jung && !c.jong) {
        if (JONG.includes(j)) { c.jong = j; return; }
        this.commit(); this.c = { cho: j, jung: '', jong: '' }; return;
      }
      if (c.jong && JONG_JOIN[c.jong + j]) { c.jong = JONG_JOIN[c.jong + j]; return; }
      this.commit(); this.c = { cho: j, jung: '', jong: '' };
    }
    back() {
      const c = this.c;
      if (c) {
        if (c.jong) c.jong = JONG_SPLIT[c.jong] ? JONG_SPLIT[c.jong][0] : '';
        else if (c.jung && c.cho) c.jung = JUNG_SPLIT[c.jung] ? JUNG_SPLIT[c.jung][0] : '';
        else if (c.jung) c.jung = JUNG_SPLIT[c.jung] ? JUNG_SPLIT[c.jung][0] : '';
        else c.cho = '';
        if (!c.cho && !c.jung && !c.jong) this.c = null;
        return;
      }
      if (this.cur > 0) { this.chars.splice(this.cur - 1, 1); this.meta.splice(this.cur - 1, 1); this.cur--; }
    }
    space() { this.commit(); this.insert(' '); }
    setCursor(k) { this.commit(); this.cur = Math.max(0, Math.min(this.chars.length, k)); }
    setText(t) { this.chars = syls(t); this.meta = this.chars.map(() => ({})); this.cur = this.chars.length; this.c = null; }
  }
  // 글자 → 자판 누르는 순서 (테스트용)
  function keysFor(text) {
    const out = [];
    for (const ch of syls(text)) {
      if (ch === ' ') { out.push(' '); continue; }
      const d = dec(ch);
      if (!d) { out.push(ch); continue; }
      out.push(d.cho, ...(JUNG_SPLIT[d.jung] || [d.jung]));
      if (d.jong) out.push(...(JONG_SPLIT[d.jong] || [d.jong]));
    }
    return out;
  }

  /* ---------- 표준 발음 (1학년 범위 근사) ----------
   * 받침 대표음, 연음, 된소리, 비음화·유음화·구개음화·거센소리 */
  const PRIORITY = ['연음', '소리바뀜', '된소리', '받침'];
  function pron(text) {
    const ch = syls(text); const d = ch.map(dec); const tags = ch.map(() => new Set());
    for (let i = 0; i < ch.length; i++) {
      const a = d[i]; if (!a || !a.jong) continue;
      const b = d[i + 1];
      if (!b) { const n = NEUTRAL[a.jong]; if (n) { a.jong = n; tags[i].add('받침'); } continue; }
      if (b.cho === 'ㅇ') {
        if (a.jong === 'ㅇ') continue;
        if (a.jong === 'ㅎ') { a.jong = ''; tags[i].add('받침'); continue; }
        let keep = '', move = a.jong;
        if (JONG_SPLIT[a.jong]) [keep, move] = JONG_SPLIT[a.jong];
        if (!keep && (move === 'ㄷ' || move === 'ㅌ') && b.jung === 'ㅣ') { b.cho = move === 'ㄷ' ? 'ㅈ' : 'ㅊ'; tags[i].add('소리바뀜'); tags[i + 1].add('소리바뀜'); }
        else { b.cho = move; tags[i].add('연음'); tags[i + 1].add('연음'); }
        a.jong = keep; continue;
      }
      if (a.jong === 'ㅎ' || a.jong === 'ㄶ' || a.jong === 'ㅀ') {
        const rest = a.jong === 'ㅎ' ? '' : a.jong === 'ㄶ' ? 'ㄴ' : 'ㄹ';
        if (ASP[b.cho]) { b.cho = ASP[b.cho]; a.jong = rest; tags[i].add('소리바뀜'); tags[i + 1].add('소리바뀜'); continue; }
        if (b.cho === 'ㅅ') { b.cho = 'ㅆ'; a.jong = rest; tags[i + 1].add('된소리'); continue; }
        if (b.cho === 'ㄴ' && a.jong === 'ㅎ') { a.jong = 'ㄴ'; tags[i].add('소리바뀜'); continue; }
      }
      const n = NEUTRAL[a.jong] || a.jong;
      if (b.cho === 'ㅎ' && ASP[n]) { b.cho = ASP[n]; a.jong = ''; tags[i].add('소리바뀜'); tags[i + 1].add('소리바뀜'); continue; }
      if (n !== a.jong) { a.jong = n; tags[i].add('받침'); }
      if ((b.cho === 'ㄴ' || b.cho === 'ㅁ') && { 'ㄱ': 1, 'ㄷ': 1, 'ㅂ': 1 }[a.jong]) { a.jong = { 'ㄱ': 'ㅇ', 'ㄷ': 'ㄴ', 'ㅂ': 'ㅁ' }[a.jong]; tags[i].add('소리바뀜'); continue; }
      if (a.jong === 'ㄴ' && b.cho === 'ㄹ') { a.jong = 'ㄹ'; tags[i].add('소리바뀜'); continue; }
      if (a.jong === 'ㄹ' && b.cho === 'ㄴ') { b.cho = 'ㄹ'; tags[i + 1].add('소리바뀜'); continue; }
      if ({ 'ㄱ': 1, 'ㄷ': 1, 'ㅂ': 1 }[a.jong] && TENSE[b.cho]) { b.cho = TENSE[b.cho]; tags[i + 1].add('된소리'); }
    }
    return { text: ch.map((c, i) => d[i] ? comp(d[i].cho, d[i].jung, d[i].jong) : c).join(''), tags };
  }
  const primary = set => PRIORITY.find(p => set && set.has(p)) || null;
  // 낱말 정보: 소리, 글자마다 규칙 태그, 낱말에 들어 있는 규칙
  function info(text, sound) {
    const p = pron(text); let snd = p.text; const tags = p.tags;
    if (sound && syls(sound).length === syls(text).length && sound !== p.text) {
      const A = syls(p.text), B = syls(sound);
      A.forEach((c, i) => {
        if (c === B[i]) return;
        const x = dec(c), y = dec(B[i]);
        if (x && y && x.cho !== y.cho && TENSE[x.cho] === y.cho) tags[i].add('된소리'); else tags[i].add('소리바뀜');
      });
      snd = sound;
    }
    const rules = new Set(); tags.forEach(t => t.forEach(r => rules.add(r)));
    syls(text).forEach(c => { const x = dec(c); if (x && x.jong) rules.add('받침'); if (x && 'ㅐㅔㅒㅖㅘㅙㅚㅝㅞㅟㅢ'.includes(x.jung)) rules.add('모음'); });
    if (/\s/.test(String(text).trim())) rules.add('띄어쓰기');
    return { text, sound: snd, soundChars: syls(snd), tags, rules, differs: snd !== text };
  }
  // 틀린 글자 하나가 어떤 규칙을 틀린 건지 나누기
  function classify(e, g, pos, inf) {
    if (isPunct(e) || isPunct(g)) return '문장부호';
    if (!e || !g) return '기타';
    const tg = inf && inf.tags[pos];
    if (inf && inf.soundChars[pos] === g && g !== e && primary(tg)) return primary(tg);
    const a = dec(e), b = dec(g);
    if (!a || !b) return '기타';
    if (a.cho === b.cho && a.jung === b.jung) return tg && tg.has('연음') ? '연음' : '받침';
    if (a.cho === b.cho && a.jong === b.jong) return '모음';
    if (a.jung === b.jung && a.jong === b.jong && (TENSE[a.cho] === b.cho || LAX[a.cho] === b.cho)) return '된소리';
    if (tg && tg.has('연음')) return '연음';
    if (tg && tg.has('소리바뀜')) return '소리바뀜';
    if (tg && tg.has('된소리')) return '된소리';
    return '기타';
  }
  // 편집 거리 정렬 (글자 단위)
  function align(A, B) {
    const m = A.length, n = B.length;
    const D = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    const ops = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)) { ops.push({ op: A[i - 1] === B[j - 1] ? 'ok' : 'sub', e: i - 1, g: j - 1 }); i--; j--; }
      else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ op: 'del', e: i - 1, g: j }); i--; }
      else { ops.push({ op: 'ins', e: i, g: j - 1 }); j--; }
    }
    return ops.reverse();
  }
  /* 채점: 글자와 띄어쓰기를 따로 봐요.
   * opts.space: 띄어쓰기 채점, opts.punct: 문장부호 채점, opts.sound: 소리(있으면)
   * 결과 marks는 입력한 글자 위치 기준 */
  function grade(expected, input, opts = {}) {
    const E = syls(String(expected).trim().replace(/\s+/g, ' ')), I = syls(String(input).replace(/\s+$/, ''));
    const keep = c => c !== ' ' && (opts.punct || !isPunct(c));
    const eL = [], iL = [];
    E.forEach((c, pos) => { if (keep(c)) eL.push({ c, pos }); });
    I.forEach((c, pos) => { if (keep(c)) iL.push({ c, pos }); });
    const inf = info(E.join(''), opts.sound);
    const ops = align(eL.map(x => x.c), iL.map(x => x.c));
    const wrong = new Set(), missBefore = new Set(), spaceMiss = new Set(), spaceExtra = new Set();
    const cats = new Set(); const errs = [];
    for (const o of ops) {
      if (o.op === 'sub') { wrong.add(iL[o.g].pos); const cat = classify(eL[o.e].c, iL[o.g].c, eL[o.e].pos, inf); cats.add(cat); errs.push({ e: eL[o.e].c, g: iL[o.g].c, cat, epos: eL[o.e].pos }); }
      else if (o.op === 'ins') { wrong.add(iL[o.g].pos); const cat = isPunct(iL[o.g].c) ? '문장부호' : '기타'; cats.add(cat); errs.push({ e: '', g: iL[o.g].c, cat }); }
      else if (o.op === 'del') { missBefore.add(o.g < iL.length ? iL[o.g].pos : I.length); const cat = isPunct(eL[o.e].c) ? '문장부호' : '기타'; cats.add(cat); errs.push({ e: eL[o.e].c, g: '', cat, epos: eL[o.e].pos }); }
    }
    const lettersOk = !errs.some(x => x.cat !== '문장부호');
    const punctOk = !errs.some(x => x.cat === '문장부호');
    // 띄어쓰기: 정답과 짝이 맞는 이웃 글자 사이만 비교
    const gapAfter = (arr, src, k) => { const p = arr[k].pos; const nx = arr[k + 1]; if (!nx) return false; for (let q = p + 1; q < nx.pos; q++) if (src[q] === ' ') return true; return false; };
    let spaceOk = true;
    if (opts.space) {
      const pairs = ops.filter(o => o.op === 'ok' || o.op === 'sub');
      for (let k = 0; k + 1 < pairs.length; k++) {
        const a = pairs[k], b = pairs[k + 1];
        if (b.e !== a.e + 1 || b.g !== a.g + 1) continue;
        const want = gapAfter(eL, E, a.e), got = gapAfter(iL, I, a.g);
        if (want && !got) { spaceMiss.add(iL[a.g].pos); spaceOk = false; }
        if (!want && got) { for (let q = iL[a.g].pos + 1; q < iL[b.g].pos; q++) if (I[q] === ' ') spaceExtra.add(q); spaceOk = false; }
      }
      if (!spaceOk) cats.add('띄어쓰기');
    }
    const ok = lettersOk && (!opts.punct || punctOk) && (!opts.space || spaceOk);
    return { ok, lettersOk, spaceOk, punctOk, cats: [...cats], errs, wrong, missBefore, spaceMiss, spaceExtra, info: inf };
  }
  // 헷갈리는 보기 만들기 (소리 나는 대로 쓴 말, 비슷한 받침, 된소리, 모음)
  const GROUPS = [['ㅅ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㄷ'], ['ㄱ', 'ㄲ', 'ㅋ'], ['ㅂ', 'ㅍ'], ['ㄴ', 'ㅁ', 'ㅇ'], ['ㄹ', 'ㄴ']];
  const VSWAP = { 'ㅏ': 'ㅓ', 'ㅓ': 'ㅗ', 'ㅗ': 'ㅓ', 'ㅜ': 'ㅡ', 'ㅡ': 'ㅜ', 'ㅐ': 'ㅔ', 'ㅔ': 'ㅐ', 'ㅕ': 'ㅛ', 'ㅛ': 'ㅕ', 'ㅣ': 'ㅢ', 'ㅑ': 'ㅕ', 'ㅠ': 'ㅛ' };
  function variants(word, sound) {
    const inf = info(word, sound); const W = syls(word); const out = [];
    const put = arr => { const s = arr.join(''); if (s !== word && !out.includes(s)) out.push(s); };
    const mod = (i, f) => { const d = dec(W[i]); if (!d) return; const n = f({ ...d }); if (n) { const a = W.slice(); a[i] = comp(n.cho, n.jung, n.jong); if (isSyl(a[i])) put(a); } };
    if (inf.differs) put(inf.soundChars);
    W.forEach((c, i) => { const d = dec(c); if (!d || !d.jong) return; const g = GROUPS.find(x => x.includes(d.jong)); if (g) g.filter(x => x !== d.jong).forEach(x => mod(i, o => ({ ...o, jong: x }))); });
    W.forEach((c, i) => { const d = dec(c); if (!d) return; if (i > 0 && TENSE[d.cho]) mod(i, o => ({ ...o, cho: TENSE[d.cho] })); if (LAX[d.cho]) mod(i, o => ({ ...o, cho: LAX[d.cho] })); });
    W.forEach((c, i) => { const d = dec(c); if (d && d.jong) mod(i, o => ({ ...o, jong: '' })); });
    W.forEach((c, i) => { const d = dec(c); if (d && VSWAP[d.jung]) mod(i, o => ({ ...o, jung: VSWAP[d.jung] })); });
    W.forEach((c, i) => { const d = dec(c); if (d && !d.jong) { mod(i, o => ({ ...o, jong: 'ㄴ' })); mod(i, o => ({ ...o, jong: 'ㅇ' })); } });
    return out;
  }
  const jongGroup = j => (GROUPS.find(x => x.includes(j)) || ['ㄱ', 'ㄴ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ']).filter(x => x !== j);
  return { CHO, JUNG, JONG, TENSE, dec, comp, isSyl, isVowel, isPunct, syls, Composer, keysFor, pron, info, classify, grade, variants, jongGroup, primary };
})();

(() => {
  'use strict';
  const APP_VERSION = '0.1.0';
  const HG = window.HANGUL;
  const C = window.CONTENT;
  const U = C.units;
  const READY = U.map((u, i) => i).filter(i => U[i].ready !== false && U[i].words.length);
  const STEPS = [
    { id: 'greet', name: '인사', icon: '👋' },
    { id: 'review', name: '복습', icon: '🔁' },
    { id: 'rule', name: '오늘의 규칙', icon: '✨' },
    { id: 'dict', name: '받아쓰기', icon: '✏️' },
    { id: 'fix', name: '은후 고쳐주기', icon: '🧑‍🏫' },
  ];
  const KEY = 'yuni-hangul-v1'; // 절대 바꾸지 않아요 (KREQ-16)
  const $app = document.getElementById('app');

  /* ================= 저장소 ================= */
  function defaults() {
    return {
      settings: {
        robotName: '로보', childName: '윤이', dailyLimit: 20, koVoice: '', koRate: 0.9, dictRate: 0.8, listenMax: 0,
        spaceOn: true, spaceFrom: 7, punctOn: true, punctFrom: 2, classSpace: true, classPunct: true,
        goalStars: 50, goalText: '아빠와 약속한 선물',
      },
      pos: { u: 0, d: 1, s: 0 }, done: {}, stars: 0, goalBase: 0,
      srs: {}, days: [], log: {}, stickers: {}, override: '', rewards: [],
      grade: 10, gradeOk: {}, badges: {}, ruleStats: {}, cls: { title: '', date: '', items: [] }, special: [], dictCount: 0,
    };
  }
  function merge(o) { const d = defaults(); return Object.assign(d, o, { settings: Object.assign(d.settings, o.settings || {}), cls: Object.assign(d.cls, o.cls || {}) }); }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return merge(JSON.parse(raw)); } catch (e) { /* 저장소 사용 불가 */ }
    return defaults();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ================= 날짜 ================= */
  const pad = n => String(n).padStart(2, '0');
  const ymd = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const today = () => ymd(new Date());
  const addDays = (n, from) => { const d = from ? new Date(from + 'T12:00:00') : new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const dayDiff = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);
  function todayLog() { const k = today(); S.log[k] = S.log[k] || { sec: 0, stars: 0 }; return S.log[k]; }
  function streak() {
    const set = new Set(S.days); let n = 0; let d = today();
    if (!set.has(d)) d = addDays(-1);
    while (set.has(d)) { n++; d = addDays(-1, d); }
    return n;
  }

  /* ================= 유틸 ================= */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = s => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; };
  const rng = seed => { let a = hash(String(seed)); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const shuffle = (a, r = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2400); }
  const friendHtml = (id, lg) => { const f = C.friends[id]; return `<div class="friend${lg ? ' lg' : ''}" style="background:${f.color}">${esc(f.name)}</div>`; };
  const robotName = () => S.settings.robotName || '로보';
  const callName = () => { const n = S.settings.childName || '윤이'; const d = HG.dec(n.slice(-1)); return n + (d && d.jong ? '아' : '야'); };
  const josa = (w, a, b) => { const d = HG.dec(String(w).slice(-1)); return w + (d && d.jong ? a : b); };
  const RULES = C.rules;
  const ruleName = r => (RULES[r] && RULES[r].name) || r;
  const normText = t => String(t || '').trim().replace(/\s+/g, ' ');
  // 낱말 사전 (모든 단원)
  const WORDS = {};
  U.forEach((u, ui) => (u.words || []).forEach(w => { WORDS[w.word] = { ...w, u: ui }; }));
  const infoCache = {};
  const winfo = w => { const k = w.word + '|' + (w.sound || ''); return infoCache[k] || (infoCache[k] = HG.info(w.word, w.sound)); };

  /* ================= 소리 ================= */
  let voices = [];
  function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } }
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  const koVoices = () => voices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('ko'));
  function koVoice() {
    const ks = koVoices();
    const chosen = S.settings.koVoice && ks.find(v => v.voiceURI === S.settings.koVoice || v.name === S.settings.koVoice);
    // 아빠가 고른 목소리 → 구글 → 삼성 → 아무 한국어 목소리
    return chosen || ks.find(v => /google/i.test(v.name)) || ks.find(v => /samsung/i.test(v.name)) || ks[0] || null;
  }
  let sayToken = 0;
  function speak(text, rate) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window) || !text) return resolve();
      const my = sayToken;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = rate; u.pitch = 1.0;
      const v = koVoice(); if (v) u.voice = v;
      let done = false; const fin = () => { if (!done) { done = true; resolve(my === sayToken); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 1500 + text.length * 200 / rate);
      try { speechSynthesis.speak(u); } catch (e) { fin(); }
    });
  }
  // 안내 말: 문장부호마다 짧게 끊어서 읽어요
  async function ko(t) {
    const parts = String(t).split(/(?<=[.!?,])\s+/).map(x => x.trim()).filter(Boolean);
    const my = sayToken; const rate = Number(S.settings.koRate) || 0.9;
    for (let i = 0; i < parts.length; i++) {
      if (my !== sayToken) return;
      await speak(parts[i], rate);
      if (i < parts.length - 1) await sleep(120);
    }
  }
  /* 받아쓰기 불러주기: 아빠 녹음 → 없으면 띄어 읽기 단위(낱말 묶음)마다 끊어서 천천히 */
  let curAudio = null;
  function playUrl(src) {
    return new Promise(resolve => {
      let done = false; const fin = ok => { if (!done) { done = true; resolve(ok); } };
      try { const a = new Audio(src); curAudio = a; a.onended = () => fin(true); a.onerror = () => fin(false); a.play().catch(() => fin(false)); setTimeout(() => fin(true), 30000); } catch (e) { fin(false); }
    });
  }
  function readUnits(text) {
    const t = normText(text);
    if (t.includes('/')) return t.split('/').map(x => x.trim()).filter(Boolean);
    return t.split(' ').filter(Boolean);
  }
  async function dictate(text, slow) {
    const my = sayToken; const key = normText(text).replace(/\//g, ' ');
    if (REC.has(key)) {
      const blob = await DB.get(key).catch(() => null);
      if (my !== sayToken) return;
      if (blob) { const url = URL.createObjectURL(blob); const ok = await playUrl(url); URL.revokeObjectURL(url); if (ok) return; }
    }
    const rate = slow ? 0.65 : (Number(S.settings.dictRate) || 0.8);
    const parts = readUnits(text);
    for (let i = 0; i < parts.length; i++) {
      if (my !== sayToken) return;
      await speak(parts[i], rate);
      if (i < parts.length - 1) await sleep(slow ? 650 : 380);
    }
  }
  function hush() { sayToken++; try { speechSynthesis.cancel(); } catch (e) { /* */ } if (curAudio) { try { curAudio.pause(); } catch (e) { /* */ } curAudio = null; } }
  const praise = () => pick(C.lines.praise);

  let actx = null;
  function tone(freqs, dur, vol = 0.22) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(); const g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
        const t0 = actx.currentTime + i * dur;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0); o.stop(t0 + dur + 0.02);
      });
    } catch (e) { /* */ }
  }
  const ding = () => tone([880, 1320], 0.14);
  const soft = () => tone([660, 587], 0.12, 0.12); // 틀렸을 때: "땡" 대신 작고 부드러운 소리

  /* ================= 녹음 보관 (태블릿 안 IndexedDB에만) ================= */
  const REC = new Set();
  const DB = (() => {
    let p = null;
    const open = () => p || (p = new Promise((res, rej) => {
      try { const r = indexedDB.open('yuni-hangul-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('rec'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('rec', mode); const st = t.objectStore('rec'); const q = fn(st); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
    return {
      get: k => tx('readonly', st => st.get(k)),
      put: (k, v) => tx('readwrite', st => st.put(v, k)),
      del: k => tx('readwrite', st => st.delete(k)),
      keys: () => tx('readonly', st => st.getAllKeys()),
    };
  })();
  DB.keys().then(ks => (ks || []).forEach(k => REC.add(k))).catch(() => {});

  /* ================= 화면 관리 ================= */
  let H = {}; // 현재 화면의 버튼 핸들러
  let screen = '';
  let actToken = 0;
  function render(name, html, handlers) {
    screen = name; hush(); actToken++; stopRecording();
    document.querySelectorAll('.confetti,.feedback,.drag-ghost').forEach(x => x.remove());
    $app.innerHTML = html; H = handlers || {}; window.scrollTo(0, 0);
  }
  $app.addEventListener('click', e => {
    const say = e.target.closest('[data-say]');
    if (say) { e.stopPropagation(); hush(); ko(say.dataset.say); return; }
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && H[b.dataset.act]) H[b.dataset.act](b.dataset.arg, b, e);
  });

  /* ================= 잠금 (하루 시간 제한만, 밤 잠금 없음) ================= */
  function lockReason() {
    if (S.override === today()) return '';
    if (todayLog().sec >= Number(S.settings.dailyLimit) * 60) return 'time';
    return '';
  }
  function lockedScreen() {
    render('locked', `<div class="screen"><div class="reward">
      <div class="robot">😴</div>
      <div class="bubble">오늘 국어는 여기까지! 정말 잘했어요.
      <small>${esc(robotName())}도 이제 쉬러 가요</small></div>
      <div class="home-links"><button class="btn" data-act="home">처음으로</button><button class="btn small" data-act="parent">아빠 화면</button></div>
    </div></div>`, { home: homeScreen, parent: () => gateScreen(parentScreen) });
    ko('오늘 국어는 여기까지! 정말 잘했어요.');
  }
  setInterval(() => {
    if (screen === 'lesson' && !document.hidden) { todayLog().sec += 10; save(); }
  }, 10000);

  /* ================= 우리 반 받아쓰기 ================= */
  const clsItems = () => (S.cls.items || []).filter(x => x && normText(x.text));
  const clsActive = () => clsItems().length > 0 && !!S.cls.date && today() <= S.cls.date;
  const clsDday = () => S.cls.date ? dayDiff(S.cls.date, today()) : null;
  const clsLabel = () => { const n = clsDday(); return n === null ? '' : n > 0 ? `시험 D-${n}` : n === 0 ? '오늘 시험!' : '시험 끝'; };

  /* ================= 홈 ================= */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (screen === 'home') homeScreen(); });
  const unitOf = i => U[i] || U[0];
  function posLabel() {
    const { u, d, s } = S.pos; const un = unitOf(u);
    return `${un.icon} ${u + 1}단원 ${un.title} ${d}일차 · ${STEPS[s].name}${s > 0 ? '부터 이어하기' : ''}`;
  }
  function homeScreen() {
    const g = Math.max(0, S.stars - S.goalBase); const goal = Math.max(1, Number(S.settings.goalStars));
    const pct = Math.min(100, Math.round(g / goal * 100));
    const st = streak(); const cls = clsItems().length;
    render('home', `<div class="screen">
      <div class="topbar">
        <div class="stars">⭐ ${S.stars}</div>
        ${st ? `<div class="stars">🔥 ${st}일 연속</div>` : ''}
        <div class="stars grade-chip">🎖️ ${S.grade}급</div>
        <div class="spacer"></div>
        ${installEvt ? '<button class="btn small" data-act="install">📲 앱 설치</button>' : ''}
        <button class="icon-btn" data-act="parent" aria-label="아빠 화면">⚙️</button>
      </div>
      <div class="home-main">
        <div class="bubble">안녕, ${esc(S.settings.childName)}!<small>나는 ${esc(robotName())}야. 오늘도 받아쓰기 놀이 하자!</small></div>
        <div class="robot" data-act="hello">🤖</div>
        <div class="friends">${Object.keys(C.friends).map(id => friendHtml(id)).join('')}</div>
        <button class="btn primary go-btn" data-act="go">오늘 국어<small>${esc(posLabel())}</small></button>
        <div class="home-links">
          <button class="btn" data-act="picker">🧭 단계 고르기</button>
          <button class="btn" data-act="stickers">📒 스티커북</button>
          ${cls ? `<button class="btn cls-btn" data-act="cls">📝 우리 반 받아쓰기<small>${esc(clsLabel())}</small></button>` : ''}
        </div>
        <button class="goal card" data-act="rewards" style="text-align:left"><div class="row"><b>🎁 ${esc(S.settings.goalText)}</b><div class="spacer"></div><span class="muted">${g >= goal ? '달성! 🎉' : `${g} / ${goal}`}</span></div>
          <div class="goal-bar"><i style="width:${pct}%"></i></div>
          <div class="row" style="margin-top:8px"><span class="muted">받은 보상 ${S.rewards.length}개</span><div class="spacer"></div><span class="muted">보상 목록 보기 ›</span></div></button>
      </div>
    </div>`, {
      go: () => startLesson(S.pos.u, S.pos.d, S.pos.s),
      picker: () => pickerScreen('units'),
      stickers: stickerScreen,
      rewards: rewardScreen,
      cls: startClassPractice,
      parent: () => gateScreen(parentScreen),
      hello: () => { hush(); ko(`안녕, ${callName()}! 오늘도 같이 받아쓰기 하자!`); },
      install: async () => { if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* */ } installEvt = null; homeScreen(); } },
    });
  }

  /* ================= 단계 고르기 ================= */
  const daysOf = u => unitOf(u).days;
  const doneCount = u => { let n = 0; for (let d = 1; d <= daysOf(u); d++) if (S.done[`${u}-${d}`]) n++; return n; };
  function parseCode(code) {
    const m = String(code).trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})(?:\s*-\s*(\d))?$/);
    if (!m) return null;
    const u = +m[1] - 1, d = +m[2], s = m[3] ? +m[3] - 1 : 0;
    if (!READY.includes(u) || d < 1 || d > daysOf(u) || s < 0 || s >= STEPS.length) return null;
    return { u, d, s };
  }
  function pickerScreen(level, u, d) {
    let body = '';
    if (level === 'units') {
      body = `<h2 class="title">어떤 규칙을 할까?</h2>
        <div class="grid">${U.map((un, i) => READY.includes(i) ? `<button class="tile${S.pos.u === i ? ' now' : ''}" data-act="unit" data-arg="${i}">
          <span class="em">${un.icon}</span><b>${i + 1}. ${esc(un.title)}</b><small>${doneCount(i)} / ${un.days}일</small></button>`
        : `<div class="tile locked"><span class="em">${un.icon}</span><b>${i + 1}. ${esc(un.title)}</b><small>곧 열려요</small></div>`).join('')}</div>
        <div class="card code-row"><b>진도 코드</b><input id="code" inputmode="numeric" placeholder="예: 3-2"><button class="btn small primary" data-act="code">바로 가기</button>
          <span class="muted">단원-일차(-단계). 다른 기기에서 하던 곳부터 시작해요.</span></div>`;
    } else if (level === 'days') {
      const un = unitOf(u);
      body = `<h2 class="title">${un.icon} ${esc(un.title)} — 며칠째 할까?</h2>
        <div class="days">${Array.from({ length: un.days }, (_, i) => i + 1).map(dd => `<button class="day${S.done[`${u}-${dd}`] ? ' done' : ''}${S.pos.u === u && S.pos.d === dd ? ' now' : ''}" data-act="day" data-arg="${dd}">${dd}${dd === un.days ? '<small>도전</small>' : ''}</button>`).join('')}</div>`;
    } else {
      const un = unitOf(u);
      body = `<h2 class="title">${un.icon} ${esc(un.title)} ${d}일차 — 어디부터 할까?</h2>
        <div class="steps">${STEPS.map((st, i) => `<button class="tile" data-act="step" data-arg="${i}"><span class="em">${st.icon}</span><b>${i + 1}. ${st.name}</b></button>`).join('')}</div>`;
    }
    render('picker', `<div class="screen">
      <div class="topbar"><button class="icon-btn" data-act="back" aria-label="뒤로">⬅️</button><div class="spacer"></div><button class="icon-btn" data-act="home" aria-label="처음으로">🏠</button></div>
      ${body}</div>`, {
      back: () => level === 'units' ? homeScreen() : level === 'days' ? pickerScreen('units') : pickerScreen('days', u),
      home: homeScreen,
      unit: a => pickerScreen('days', +a),
      day: a => pickerScreen('steps', u, +a),
      step: a => startLesson(u, d, +a),
      code: () => { const p = parseCode(document.getElementById('code').value); if (!p) return toast('예: 3-2 처럼 적어주세요'); startLesson(p.u, p.d, p.s); },
    });
  }

  /* ================= 받은 보상 ================= */
  function rewardScreen() {
    const g = Math.max(0, S.stars - S.goalBase); const goal = Math.max(1, Number(S.settings.goalStars));
    const list = S.rewards.slice().reverse();
    render('rewards', `<div class="screen">
      <div class="topbar"><button class="icon-btn" data-act="home" aria-label="처음으로">🏠</button><h2 class="title">🎁 받은 보상</h2></div>
      <div class="card goal" style="width:100%"><div class="row"><b>지금 목표: ${esc(S.settings.goalText)}</b><div class="spacer"></div><span class="muted">${Math.min(g, goal)} / ${goal}</span></div>
        <div class="goal-bar"><i style="width:${Math.min(100, Math.round(g / goal * 100))}%"></i></div>
        ${g >= goal ? '<p style="margin:10px 0 0;font-weight:800">목표 달성! 아빠에게 보여줘요 🎉</p>' : `<p class="muted" style="margin:10px 0 0">별 ${goal - g}개만 더 모으면 돼요!</p>`}</div>
      ${list.length ? `<div class="grid">${list.map((r, i) => `<div class="tile"><span class="em">🎁</span><b>${esc(r.text)}</b><small>${esc(r.date)} · 별 ${r.stars}개</small><small>${list.length - i}번째 보상</small></div>`).join('')}</div>`
        : '<p class="muted">아직 받은 보상이 없어요. 별을 모아서 첫 보상을 받아봐요!</p>'}
    </div>`, { home: homeScreen });
    if (g >= goal) ko('목표 달성! 아빠에게 보여줘요!');
  }

  /* ================= 스티커북 ================= */
  function stickerScreen() {
    const gradesAll = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    render('stickers', `<div class="screen">
      <div class="topbar"><button class="icon-btn" data-act="home" aria-label="처음으로">🏠</button><h2 class="title">📒 스티커북</h2></div>
      <h3 class="sub">단원 스티커</h3>
      <div class="grid">${U.map((un, i) => `<button class="tile${S.stickers[i] ? '' : ' locked'}" data-act="st" data-arg="${i}">
        <span class="em">${S.stickers[i] ? un.sticker : '❔'}</span><b>${esc(un.title)}</b><small>${READY.includes(i) ? `${doneCount(i)} / ${un.days}일` : '곧 열려요'}</small></button>`).join('')}</div>
      <h3 class="sub">받아쓰기 급수 배지</h3>
      <div class="badges">${gradesAll.map(g => `<div class="badge${S.badges[g] ? '' : ' locked'}"><span>🎖️</span><b>${g}급</b></div>`).join('')}</div>
      ${S.special.length ? `<h3 class="sub">특별 스티커</h3><div class="grid">${S.special.map(x => `<div class="tile"><span class="em">${esc(x.icon || '💯')}</span><b>${esc(x.text)}</b><small>${esc(x.date)}</small></div>`).join('')}</div>` : ''}
      <p class="muted">단원 마지막 날 도전 문제를 8개 이상 맞히면 스티커를 받아요. 스티커를 누르면 낱말을 다시 들을 수 있어요.</p>
    </div>`, {
      home: homeScreen,
      st: async a => {
        const un = U[+a];
        if (!S.stickers[+a]) { hush(); ko(`${un.title} 단원을 끝내면 받을 수 있어요`); return; }
        hush(); const my = sayToken;
        for (const w of un.words) { if (my !== sayToken) break; await dictate(w.word); await sleep(250); }
      },
    });
  }

  /* ================= 수업 만들기 ================= */
  function dayWords(u, d) {
    const ws = unitOf(u).words.map(w => ({ ...w, u })); const n = ws.length; if (!n) return [];
    const per = Math.max(3, Math.ceil(n / unitOf(u).days)); const start = ((d - 1) * per) % n;
    return Array.from({ length: Math.min(per, n) }, (_, k) => ws[(start + k) % n]);
  }
  const srsWord = k => { const r = S.srs[k]; return r && r.w ? r.w : WORDS[k] ? { ...WORDS[k] } : { word: k }; };
  function dueReviews() {
    const td = today();
    return Object.entries(S.srs).filter(([, r]) => r.due && r.due <= td).sort((a, b) => a[1].due.localeCompare(b[1].due)).slice(0, 3).map(([k]) => srsWord(k));
  }
  function reviewFill(u, d, need, have, r) {
    const seen = new Set(have.map(w => w.word)); const out = [];
    const add = list => { for (const w of shuffle(list, r)) { if (out.length >= need) return; if (!seen.has(w.word)) { seen.add(w.word); out.push(w); } } };
    // 지난 단원 낱말 → 이 단원 앞 일차 낱말 → 전에 익힌 낱말
    const prevU = READY.filter(i => i < u); if (prevU.length) add(unitOf(prevU[prevU.length - 1]).words.map(w => ({ ...w, u: prevU[prevU.length - 1] })));
    for (let dd = 1; dd < d; dd++) add(dayWords(u, dd));
    add(Object.entries(S.srs).filter(([, r2]) => r2.learned).map(([k]) => srsWord(k)));
    return out;
  }
  function pickOpts(w, mode, r) {
    const inf = winfo(w); const vs = HG.variants(w.word, w.sound).filter(v => HG.syls(v).every(HG.isSyl));
    const out = [];
    if (inf.differs) out.push(inf.sound);
    const rest = vs.filter(v => !out.includes(v)).slice(0, 6);
    while (out.length < 2 && rest.length) out.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
    return shuffle([w.word, ...out], r);
  }
  function makeProblem(w, mode, key, extra = {}) {
    const r = rng(key); const inf = winfo(w); const W = HG.syls(w.word);
    if (mode === 3 && !inf.differs) mode = 1;
    if (mode === 2 && !W.some(c => (HG.dec(c) || {}).jong)) mode = 1;
    if (mode === 8) return { type: 'dict', text: w.word, sound: w.sound, img: w.img, src: 'word', w, ...extra };
    if (mode === 1 || mode === 3) return { type: 'pick', mode, w, opts: pickOpts(w, mode, r), ...extra };
    if (mode === 2) {
      const idx = W.map((c, i) => i).filter(i => (HG.dec(W[i]) || {}).jong);
      const ti = idx.find(i => inf.tags[i].size) ?? idx[idx.length - 1];
      const j = HG.dec(W[ti]).jong;
      const others = shuffle(HG.jongGroup(j), r).slice(0, 2);
      if (others.length < 2) others.push(...shuffle(['ㄱ', 'ㄴ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ'].filter(x => x !== j && !others.includes(x)), r).slice(0, 2 - others.length));
      return { type: 'jong', w, ti, pieces: shuffle([j, ...others], r), ...extra };
    }
    // 4 낱말 만들기: 두 글자 이상은 글자 카드, 한 글자는 자모 카드
    let tokens, jamo = false, extraTok = null;
    if (W.length >= 2) {
      tokens = W;
      for (const v of HG.variants(w.word, w.sound)) { const V = HG.syls(v); if (V.length !== W.length) continue; const diff = V.map((c, i) => c !== W[i] ? i : -1).filter(i => i >= 0); if (diff.length === 1 && !W.includes(V[diff[0]])) { extraTok = V[diff[0]]; break; } }
    } else {
      const d = HG.dec(W[0]); jamo = true; tokens = [d.cho, d.jung, d.jong].filter(Boolean);
      extraTok = d.jong ? HG.jongGroup(d.jong)[0] : (HG.TENSE[d.cho] || 'ㅇ');
    }
    const cards = tokens.map((t, k) => ({ t, k }));
    if (extraTok) cards.push({ t: extraTok, k: -1 });
    return { type: 'build', w, tokens, jamo, cards: shuffle(cards, r), ...extra };
  }
  function gradeData(g) { return C.grades.find(x => x.g === g) || null; }
  const gradeOkCount = g => Object.keys(S.gradeOk[g] || {}).length;
  function dictFromGrade(key) {
    const r = rng(key); let G = gradeData(S.grade);
    let pool;
    if (!G || S.badges[S.grade]) { // 마지막 급까지 합격했으면 열린 급에서 골고루
      pool = C.grades.flatMap(g2 => g2.items.map((it, idx) => ({ it, idx, g: g2.g })));
      pool = shuffle(pool, r);
    } else {
      const ok = S.gradeOk[G.g] || {};
      const items = G.items.map((it, idx) => ({ it, idx, g: G.g }));
      pool = shuffle(items.filter(x => !ok[x.idx]), r).concat(shuffle(items.filter(x => ok[x.idx]), r));
    }
    return pool.slice(0, 5).map(x => {
      const st = S.settings;
      return { type: 'dict', text: x.it.text, sound: x.it.sound, img: x.it.img, src: 'grade', g: x.g, idx: x.idx,
        space: !!st.spaceOn && x.g <= Number(st.spaceFrom), punct: !!st.punctOn && x.g <= Number(st.punctFrom) };
    });
  }
  function dictFromClass(n, key) {
    const r = rng(key); const items = clsItems().map((it, idx) => ({ it, idx }));
    const order = shuffle(items, r).sort((a, b) => ((a.it.ok || 0) > 0) - ((b.it.ok || 0) > 0) || (a.it.ok || 0) - (b.it.ok || 0));
    return order.slice(0, n).map(x => ({ type: 'dict', text: normText(x.it.text), src: 'class', idx: x.idx, space: !!S.settings.classSpace, punct: !!S.settings.classPunct }));
  }
  function buildStep(s) {
    if (L.cache[s]) return L.cache[s];
    const { u, d } = L; const id = STEPS[s].id; const key = `${u}-${d}-${s}`; const r = rng(key);
    let acts;
    if (id === 'greet') acts = [makeProblem(L.dayWords[0], 1, key + 'g', { greet: true })];
    else if (id === 'review') {
      let items = dueReviews();
      if (items.length < 3) items = items.concat(reviewFill(u, d, 3 - items.length, items, r));
      acts = items.length ? items.map((w, k) => makeProblem(w, winfo(w).differs ? 3 : 1, key + k, { review: true }))
        : [{ type: 'msg', text: '복습할 말이 아직 없어요! 바로 오늘의 규칙으로 가요 🚀' }];
    } else if (id === 'rule') {
      const un = unitOf(u); const challenge = d === un.days; const n = challenge ? 10 : 6;
      const pool = challenge ? shuffle(un.words.map(w => ({ ...w, u })), r) : shuffle(L.dayWords, r).concat(shuffle(L.dayWords, r));
      const modes = un.modes || [1]; const off = Math.floor(r() * modes.length);
      acts = [{ type: 'card', u, challenge }];
      for (let k = 0; k < n; k++) acts.push(makeProblem(pool[k % pool.length], modes[(k + off) % modes.length], key + k, { challenge }));
    } else if (id === 'dict') acts = clsActive() ? dictFromClass(5, key + today()) : dictFromGrade(key + S.grade);
    else {
      const cand = L.dayWords.filter(w => winfo(w).differs); const w = pick(cand.length ? cand : L.dayWords, r);
      let wrong = winfo(w).differs ? winfo(w).sound : pick(HG.variants(w.word).filter(v => HG.syls(v).length === HG.syls(w.word).length).slice(0, 4), r);
      const W = HG.syls(w.word), X = HG.syls(wrong);
      acts = [{ type: 'fix', w, wrong, bad: W.map((c, i) => c !== X[i] ? i : -1).filter(i => i >= 0) }];
    }
    L.cache[s] = acts; return acts;
  }

  /* ================= 수업 진행 ================= */
  let L = null;
  function newL(u, d, s) { return { u, d, s, acts: [], i: 0, cache: {}, awarded: {}, statted: {}, marked: {}, heard: {}, ch: { n: 0, ok: 0 }, promoted: null, special: null, earned: 0, results: [] }; }
  function startLesson(u, d, s) {
    if (lockReason()) return lockedScreen();
    if (!READY.includes(u)) u = READY[0];
    d = Math.max(1, Math.min(daysOf(u), d || 1)); s = Math.max(0, Math.min(STEPS.length - 1, s || 0));
    S.pos = { u, d, s }; if (!S.days.includes(today())) S.days.push(today()); save();
    L = newL(u, d, s); L.dayWords = dayWords(u, d);
    L.acts = buildStep(s);
    showAct();
  }
  function startClassPractice() {
    if (!clsItems().length) return toast('아빠 화면에서 우리 반 받아쓰기 문장을 먼저 넣어주세요');
    if (lockReason()) return lockedScreen();
    if (!S.days.includes(today())) S.days.push(today()); save();
    L = newL(S.pos.u, S.pos.d, 3); L.special = 'class'; L.dayWords = dayWords(S.pos.u, S.pos.d);
    L.acts = dictFromClass(clsItems().length, 'cls' + today() + Math.random());
    showAct();
  }
  function stepIntro() {
    const st = STEPS[L.s];
    render('lesson', `<div class="screen"><div class="reward"><div class="robot">${st.icon}</div><div class="bubble">다음은 ${st.name}!</div></div></div>`);
    const my = actToken;
    ko(`다음은 ${st.name}!`).then(() => sleep(300)).then(() => { if (my === actToken) showAct(); });
  }
  function nextAct() {
    L.i++;
    if (L.i < L.acts.length) return showAct();
    if (L.special) return finishSpecial();
    if (STEPS[L.s].id === 'dict') checkPromotion();
    L.s++; S.pos.s = L.s; save();
    if (L.s >= STEPS.length) return finishDay();
    if (lockReason()) return lockedScreen();
    L.acts = buildStep(L.s); L.i = 0;
    stepIntro();
  }
  function checkPromotion() {
    const g = S.grade; const G = gradeData(g);
    if (!G || S.badges[g]) return;
    if (gradeOkCount(g) >= 8) {
      S.badges[g] = today(); L.promoted = g;
      if (gradeData(g - 1)) S.grade = g - 1;
      save();
    }
  }
  // 별: 한 번에 맞히면 1개, 다시 맞히면 0개, 문제당 한 번만. 하루 끝 보너스 3개 포함 하루 20개 이하
  const DAY_STAR_MAX = 20, DAY_BONUS = 3;
  const actKey = () => `${L.special ? 'c' : L.s}:${L.i}`;
  function award(attempts) {
    const key = actKey(); const tl = todayLog();
    let n = attempts === 0 ? 1 : 0;
    const room = DAY_STAR_MAX - (tl.bonus ? 0 : DAY_BONUS) - tl.stars;
    if (L.awarded[key] || room < n) n = 0; // 이전 버튼으로 다시 풀어도 별은 한 번만
    L.awarded[key] = 1;
    if (n) {
      S.stars += n; L.earned += n; tl.stars += n; save();
      const el = document.querySelector('.stars'); if (el) el.textContent = `⭐ ${S.stars}`;
    }
    return n;
  }
  // 규칙별 정답률: 문제마다 첫 시도만 기록
  function stat(rules, cats, ok) {
    const key = actKey(); if (L.statted[key]) return; L.statted[key] = 1;
    const bad = new Set(cats || []);
    const all = new Set([...(rules || []), ...bad]); all.delete('기타');
    const specific = [...bad].some(b => b !== '기타');
    for (const r of all) { const x = S.ruleStats[r] || (S.ruleStats[r] = { n: 0, ok: 0 }); x.n++; if (ok || (specific && !bad.has(r))) x.ok++; }
    save();
  }
  // 어려운 말 상자: 틀리면 1일 뒤, 복습에서 맞히면 3일·7일 뒤, 3번 연속 맞히면 빠져요
  function mark(w, correct, isReview, got) {
    const k = w.word; if (!k) return;
    const r = S.srs[k] || (S.srs[k] = { streak: 0, due: null, wrong: 0, seen: 0, learned: null, mastered: false, wrongAs: {} });
    r.w = { word: w.word, sound: w.sound, img: w.img, u: w.u };
    r.seen++;
    if (!correct) { r.wrong++; r.streak = 0; r.mastered = false; r.due = addDays(1); if (got && got !== k) { r.wrongAs = r.wrongAs || {}; r.wrongAs[got] = (r.wrongAs[got] || 0) + 1; } }
    else {
      if (!r.learned) r.learned = today();
      if (isReview && r.due && r.due <= today()) {
        r.streak++;
        if (r.streak >= 3) { r.mastered = true; r.due = null; } else r.due = addDays(r.streak === 1 ? 3 : 7);
      }
    }
    save();
  }
  function flash(emoji) { const f = document.createElement('div'); f.className = 'feedback'; f.innerHTML = `<span>${emoji}</span>`; document.body.appendChild(f); setTimeout(() => f.remove(), 950); }

  const stepList = () => L.special ? [{ name: '우리 반 받아쓰기', icon: '📝' }] : STEPS;
  function lessonFrame(inner, opts = {}) {
    const total = L.acts.length; const p = Math.round(L.i / total * 100);
    const sIdx = L.special ? 0 : L.s; const first = L.special ? L.i === 0 : (L.s === 0 && L.i === 0);
    const title = L.special ? `📝 우리 반 받아쓰기 ${S.cls.title ? esc(S.cls.title) : ''} · ${L.i + 1} / ${total}`
      : `${unitOf(L.u).icon} ${L.u + 1}단원 ${esc(unitOf(L.u).title)} ${L.d}일차 · ${STEPS[L.s].name}`;
    return `<div class="screen">
      <div class="topbar">
        <button class="icon-btn" data-act="quit" aria-label="처음으로">🏠</button>
        <button class="icon-btn" data-act="prev" aria-label="이전 문제"${first ? ' disabled style="opacity:.35"' : ''}>◀</button>
        <div class="train">${stepList().map((st, i) => `<div class="car${i < sIdx ? ' done' : i === sIdx ? ' now' : ''}" style="--p:${p}%">${i === sIdx ? '<i></i>' : ''}</div>`).join('')}</div>
        <div class="stars">⭐ ${S.stars}</div>
      </div>
      <div class="step-name">${title}</div>
      <div class="stage${opts.split ? ' split' : ''}${opts.kb ? ' kb' : ''}">${inner}</div>
    </div>`;
  }
  const baseHandlers = () => ({ quit: homeScreen, prev: prevAct });
  // 이전 문제로 (단계 첫 문제면 앞 단계 마지막 문제로). 만들어 둔 문제를 다시 써서 같은 문제가 나와요
  function prevAct() {
    hush();
    if (L.special) { if (L.i > 0) { L.i--; showAct(); } return; }
    let s = L.s, i = L.i, acts = L.acts;
    do {
      if (i > 0) i--;
      else if (s > 0) { s--; acts = buildStep(s); i = acts.length - 1; }
      else return;
    } while (acts[i].type === 'msg' && (i > 0 || s > 0));
    if (acts[i].type === 'msg') return;
    L.s = s; L.i = i; L.acts = acts; S.pos.s = s; save();
    showAct();
  }
  function showAct() {
    const a = L.acts[L.i];
    ({ msg: actMsg, card: actCard, pick: actPick, jong: actJong, build: actBuild, dict: actDict, fix: actFix })[a.type](a);
  }
  function setHint(t) { const h = document.getElementById('hint'); if (h) h.textContent = t; }
  const listenBtns = () => `<div class="listen-row"><button class="listen" data-act="play" aria-label="다시 듣기">🔊</button><button class="listen slow" data-act="slow" aria-label="천천히 듣기">🐢</button></div>`;
  const picHtml = img => img ? `<div class="pic">${esc(img)}</div>` : '';
  // 틀린 글자만 주황색으로 (빨간 X 없음)
  function diffHtml(got, want) {
    const G = HG.syls(got), W = HG.syls(want);
    return G.map((c, i) => c !== W[i] ? `<span class="miss">${esc(c)}</span>` : esc(c)).join('');
  }
  function showHintCard(cat, a) {
    const el = document.getElementById('hintcard'); const rule = RULES[cat] || RULES['기타'];
    const inf = a.w ? winfo(a.w) : a.text ? HG.info(a.text, a.sound) : null;
    const sound = inf && inf.differs && !/\s/.test(inf.text) ? `<div class="snd">소리는 <b>[${esc(inf.sound)}]</b></div>` : '';
    if (el) { el.hidden = false; el.innerHTML = `<b>💡 ${esc(ruleName(cat))}</b>${sound}<div>${esc(rule.hint)}</div>`; }
    return rule.hint;
  }
  /* 답하기 흐름: 1번째 틀림 → 다시 듣기, 2번째 → 규칙 힌트 카드, 3번째 → 정답 보고 따라 하기 */
  function flow(a, cfg) {
    const f = { att: 0, done: false };
    const text = cfg.text; const rules = cfg.rules || (a.w ? [...winfo(a.w).rules] : []);
    f.wrong = async (cat, got) => {
      if (f.done) return;
      f.att++; soft(); const my = actToken;
      if (f.att === 1) { stat(rules, [cat], false); if (a.w && cfg.srs !== false) { mark(a.w, false, a.review, got); L.marked[actKey()] = 1; } }
      if (f.att === 1) { setHint('다시 들어볼까? 🐢'); await ko(C.lines.retry); if (my === actToken) await dictate(text, true); }
      else if (f.att === 2) { const h = showHintCard(cat, a); setHint(''); if (cfg.onHint2) cfg.onHint2(); await ko(h); }
      if (my !== actToken) return;
      if (f.att >= 3 || (cfg.left && cfg.left() <= 1)) { cfg.reveal(); }
    };
    f.right = async (opts = {}) => {
      if (f.done) return; f.done = true;
      const my = actToken; ding();
      const n = award(f.att); flash(n ? '⭐' : '👍');
      if (f.att === 0) { stat(rules, [], true); if (a.w && cfg.srs !== false && !L.marked[actKey()]) mark(a.w, true, a.review); if (a.challenge) { L.ch.n++; L.ch.ok++; } }
      else if (a.challenge && !L.statted['ch' + actKey()]) { L.statted['ch' + actKey()] = 1; L.ch.n++; }
      if (cfg.after) cfg.after(f.att);
      if (!opts.quiet) await dictate(text);
      if (my === actToken && n && Math.random() < 0.6) await ko(praise());
      await sleep(350); if (my === actToken) nextAct();
    };
    return f;
  }

  function actMsg(a) {
    render('lesson', lessonFrame(`<div class="prompt"><div class="robot">🤖</div><div class="bubble">${esc(a.text)}</div></div>
      <div class="next-row"><button class="btn primary" data-act="next">좋아요 ▶</button></div>`), { ...baseHandlers(), next: nextAct });
    const my = actToken; ko(a.text.replace(/[^\p{L}\p{N}\s!?.]/gu, '')).then(() => sleep(600)).then(() => { if (my === actToken) nextAct(); });
  }

  function actCard(a) {
    const un = unitOf(a.u); const cd = un.card || {}; const ex = WORDS[cd.example] || { word: cd.example };
    const inf = ex.word ? winfo(ex) : null;
    const extra = a.challenge ? '오늘은 도전하는 날! 10문제 중 8개를 한 번에 맞히면 스티커를 받아요.' : '';
    render('lesson', lessonFrame(`<div class="prompt rule-card">
        <div class="pic">${esc(cd.img || un.icon)}</div>
        <div class="bubble">📘 ${esc(un.title)}</div>
        ${ex.word ? `<div class="word">${esc(ex.word)}${inf && inf.differs ? ` <span class="snd">[${esc(inf.sound)}]</span>` : ''}</div>` : ''}
        <div class="card rule-text">${esc(cd.text || '')}${extra ? `<p class="challenge">🏆 ${esc(extra)}</p>` : ''}</div>
        <div class="listen-row"><button class="listen" data-act="play" aria-label="설명 듣기">🔊</button></div>
      </div>
      <div class="next-row"><button class="btn primary" data-act="next">알았어요! 문제 풀기 ▶</button></div>`), {
      ...baseHandlers(), next: nextAct,
      play: () => { hush(); ko(cd.text + ' ' + extra); },
    });
    const my = actToken;
    (async () => { await ko(`오늘의 규칙, ${un.title}!`); if (my !== actToken) return; await ko(cd.text || ''); if (my !== actToken) return; if (extra) await ko(extra); })();
  }

  /* --- 모드 1 바른 글자 골라요 / 모드 3 소리는 이렇게, 글자는? --- */
  function actPick(a) {
    const w = a.w; const inf = winfo(w);
    const bubble = a.greet ? `안녕, ${esc(callName())}! 오늘의 낱말을 들어봐요` : a.review ? '🔁 기억나요? 바른 글자를 골라요' : a.mode === 3 ? '소리는 이렇게 나요. 글자는 어떻게 써요?' : '잘 듣고 바른 글자를 골라요';
    const f = flow(a, {
      text: w.word,
      left: () => document.querySelectorAll('.choice:not(.wrong)').length,
      reveal: () => { document.querySelectorAll('.choice').forEach(c => { if (c.dataset.arg === w.word) c.classList.add('glow'); }); setHint('정답을 보고 따라 눌러요 👉'); },
    });
    render('lesson', lessonFrame(`<div class="prompt">
        ${a.greet ? '<div class="robot sm">🤖</div>' : ''}
        <div class="bubble">${bubble}</div>
        ${picHtml(w.img)}
        ${a.mode === 3 ? `<div class="sound-big">[${esc(inf.sound)}]</div>` : ''}
        ${listenBtns()}
        <div class="hint" id="hint"></div>
        <div class="hintcard" id="hintcard" hidden></div>
      </div>
      <div class="choices text-choices">${a.opts.map(x => `<button class="choice text big" data-act="pick" data-arg="${esc(x)}">${esc(x)}</button>`).join('')}</div>`, { split: true }), {
      ...baseHandlers(),
      play: () => { hush(); dictate(w.word); }, slow: () => { hush(); dictate(w.word, true); },
      pick: (arg, btn) => {
        if (btn.classList.contains('wrong') || document.querySelector('.choice.right')) return;
        hush();
        if (arg === w.word) { btn.classList.add('right'); f.right(); }
        else { btn.classList.add('wrong'); btn.innerHTML = diffHtml(arg, w.word); f.wrong(HG.grade(w.word, arg, { sound: w.sound }).cats[0] || '기타', arg); }
      },
    });
    const my = actToken;
    (async () => {
      if (a.greet) { await ko(`안녕, ${callName()}! 오늘의 낱말을 들어봐요.`); }
      else if (a.mode === 3 && !L.heard.m3) { L.heard.m3 = 1; await ko('소리는 이렇게 나요. 글자는 어떻게 쓸까?'); }
      else if (a.mode === 1 && !L.heard.m1) { L.heard.m1 = 1; await ko('잘 듣고 바른 글자를 골라요.'); }
      if (my === actToken) dictate(w.word);
    })();
  }

  /* --- 모드 2 받침 끼우기 (끌어놓기 또는 톡) --- */
  function actJong(a) {
    const w = a.w; const W = HG.syls(w.word); const d = HG.dec(W[a.ti]); const base = HG.comp(d.cho, d.jung, '');
    const targetInner = () => `<span class="base">${esc(base)}</span><span class="slot" id="slot" data-drop="1">받침</span>`;
    const wordRow = () => W.map((c, i) => i === a.ti ? `<span class="jong-target" id="jt" data-drop="1">${targetInner()}</span>` : `<span class="syl">${esc(c)}</span>`).join('');
    const f = flow(a, {
      text: w.word,
      left: () => document.querySelectorAll('.piece:not(.wrong)').length,
      reveal: () => { document.querySelectorAll('.piece').forEach(p => { if (p.dataset.arg === d.jong) p.classList.add('glow'); }); setHint('반짝이는 조각을 끼워요 👉'); },
    });
    let busy = false;
    const choose = async j => {
      if (busy || f.done) return; const btn = [...document.querySelectorAll('.piece')].find(p => p.dataset.arg === j);
      if (!btn || btn.classList.contains('wrong')) return;
      hush();
      const jt = document.getElementById('jt');
      if (j === d.jong) { jt.innerHTML = `<span class="syl ok">${esc(W[a.ti])}</span>`; btn.classList.add('right'); f.right(); return; }
      busy = true; btn.classList.add('wrong');
      jt.innerHTML = `<span class="syl"><span class="miss">${esc(HG.comp(d.cho, d.jung, j))}</span></span>`;
      const got = W.map((c, i) => i === a.ti ? HG.comp(d.cho, d.jung, j) : c).join('');
      f.wrong(HG.grade(w.word, got, { sound: w.sound }).cats[0] || '받침', got);
      await sleep(1300); busy = false;
      const jt2 = document.getElementById('jt'); if (!f.done && jt2) jt2.innerHTML = targetInner();
    };
    render('lesson', lessonFrame(`<div class="prompt">
        <div class="bubble">받침 조각을 끼워요</div>
        ${picHtml(w.img)}
        ${listenBtns()}
        <div class="hint" id="hint"></div>
        <div class="hintcard" id="hintcard" hidden></div>
      </div>
      <div class="prompt">
        <div class="jong-word">${wordRow()}</div>
        <div class="pieces">${a.pieces.map(j => `<button class="piece" data-act="piece" data-arg="${esc(j)}">${esc(j)}</button>`).join('')}</div>
        <div class="muted">조각을 끌어다 놓거나 톡 눌러요</div>
      </div>`, { split: true }), {
      ...baseHandlers(),
      play: () => { hush(); dictate(w.word); }, slow: () => { hush(); dictate(w.word, true); },
      piece: j => choose(j),
    });
    enableDrag('.piece', choose);
    const my = actToken;
    (async () => { if (!L.heard.m2) { L.heard.m2 = 1; await ko('잘 듣고 알맞은 받침 조각을 끼워요.'); } if (my === actToken) dictate(w.word); })();
  }
  // 끌어놓기: 손가락으로 끌어 받침 칸에 놓으면 선택 (그냥 톡 눌러도 돼요)
  function enableDrag(sel, onDrop) {
    document.querySelectorAll(sel).forEach(el => {
      el.addEventListener('pointerdown', e => {
        if (el.classList.contains('wrong')) return;
        const sx = e.clientX, sy = e.clientY; let ghost = null; let moved = false;
        const move = ev => {
          if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 12) return;
          moved = true;
          if (!ghost) { ghost = el.cloneNode(true); ghost.className = 'piece drag-ghost'; document.body.appendChild(ghost); }
          ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
        };
        const up = ev => {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
          if (ghost) ghost.remove();
          if (!moved) return; // 톡 누름은 click으로 처리
          el.dataset.dragged = '1'; setTimeout(() => { delete el.dataset.dragged; }, 50);
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          if (t && t.closest('[data-drop]')) onDrop(el.dataset.arg);
        };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      });
      el.addEventListener('click', e => { if (el.dataset.dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    });
  }

  /* --- 모드 4 낱말 만들기 --- */
  function actBuild(a) {
    const w = a.w; const filled = [];
    const slotHtml = () => {
      if (a.jamo) { const [c1, c2, c3] = filled; const s = filled.length >= 2 ? HG.comp(c1, c2, c3 || '') : (c1 || ''); return `<span class="slot-box big${filled.length === a.tokens.length ? ' ok' : ''}">${esc(s) || '&nbsp;'}</span><span class="muted">${filled.length} / ${a.tokens.length}</span>`; }
      return a.tokens.map((t, k) => `<span class="slot-box${k < filled.length ? ' ok' : ''}">${k < filled.length ? esc(filled[k]) : '&nbsp;'}</span>`).join('');
    };
    const f = flow(a, {
      text: w.word,
      reveal: () => { glowNext(); setHint('반짝이는 카드를 차례대로 눌러요 👉'); },
    });
    const glowNext = () => { document.querySelectorAll('.tcard').forEach(c => c.classList.remove('glow')); const nx = [...document.querySelectorAll('.tcard:not(.used)')].find(c => c.dataset.arg === a.tokens[filled.length]); if (nx) nx.classList.add('glow'); };
    render('lesson', lessonFrame(`<div class="prompt">
        <div class="bubble">${a.jamo ? '자음·모음 카드로 글자를 만들어요' : '글자 카드로 낱말을 만들어요'}</div>
        ${picHtml(w.img)}
        ${listenBtns()}
        <div class="hint" id="hint"></div>
        <div class="hintcard" id="hintcard" hidden></div>
      </div>
      <div class="prompt">
        <div class="slots" id="slots">${slotHtml()}</div>
        <div class="tcards">${a.cards.map((c, n) => `<button class="tcard" data-act="card" data-arg="${esc(c.t)}" data-n="${n}">${esc(c.t)}</button>`).join('')}</div>
      </div>`, { split: true }), {
      ...baseHandlers(),
      play: () => { hush(); dictate(w.word); }, slow: () => { hush(); dictate(w.word, true); },
      card: (t, btn) => {
        if (f.done || btn.classList.contains('used')) return;
        hush();
        if (t === a.tokens[filled.length]) {
          filled.push(t); btn.classList.add('used'); btn.classList.remove('glow', 'wrong');
          document.getElementById('slots').innerHTML = slotHtml();
          if (filled.length === a.tokens.length) f.right(); else if (f.att >= 3) glowNext();
        } else {
          btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
          setTimeout(() => btn.classList.remove('wrong'), 900);
          const want = a.tokens[filled.length];
          const cat = a.jamo ? (filled.length === 2 ? '받침' : HG.isVowel(want) ? '모음' : (HG.TENSE[want] === t || HG.TENSE[t] === want) ? '된소리' : '기타')
            : (HG.grade(want, t).cats[0] || '기타');
          f.wrong(cat, null);
        }
      },
    });
    const my = actToken;
    (async () => { if (!L.heard.m4) { L.heard.m4 = 1; await ko(a.jamo ? '잘 듣고 카드를 차례대로 눌러서 글자를 만들어요.' : '잘 듣고 글자 카드를 차례대로 눌러요.'); } if (my === actToken) dictate(w.word); })();
  }

  /* --- 모드 8 받아쓰기 (윤이 한글 자판) --- */
  const KB_ROWS = [
    [...'ㄱㄴㄷㄹㅁㅂㅅ'], [...'ㅇㅈㅊㅋㅌㅍㅎ'], [...'ㄲㄸㅃㅆㅉ', 'bs'],
    [...'ㅏㅑㅓㅕㅗㅛㅜ'], [...'ㅠㅡㅣㅐㅔㅒㅖ'], ['left', 'sp', 'right'],
  ];
  function kbHtml(punct) {
    const key = k => {
      if (k === 'bs') return '<button class="key fn" data-act="bs" style="grid-column:span 2" aria-label="지우기">⌫ 지우기</button>';
      if (k === 'sp') return '<button class="key fn space" data-act="sp" style="grid-column:span 5" aria-label="띄어쓰기">␣ 띄어쓰기</button>';
      if (k === 'left') return '<button class="key fn" data-act="left" aria-label="왼쪽으로">◀</button>';
      if (k === 'right') return '<button class="key fn" data-act="right" aria-label="오른쪽으로">▶</button>';
      const cls = HG.isVowel(k) ? 'v' : HG.TENSE[k] === undefined && 'ㄲㄸㅃㅆㅉ'.includes(k) ? 'c tense' : 'c';
      return `<button class="key ${cls}" data-act="key" data-arg="${k}">${k}</button>`;
    };
    const last = punct ? `${[...'.,?!'].map(p => `<button class="key fn" data-act="key" data-arg="${p}">${p}</button>`).join('')}<button class="key submit" data-act="submit" style="grid-column:span 3">✔ 다 썼어요</button>`
      : '<button class="key submit" data-act="submit" style="grid-column:span 7">✔ 다 썼어요</button>';
    return `<div class="kbd" id="kbd">${KB_ROWS.map(r => r.map(key).join('')).join('')}${last}</div>`;
  }
  function gridHtml(cp) {
    const cells = cp.cells(); const out = [];
    const cursorAt = cp.c ? -1 : cp.cur;
    cells.forEach((c, k) => {
      if (k === cursorAt) out.push('<i class="caret"></i>');
      if (c.meta.mb) out.push('<i class="missmark">▾</i>');
      const cls = ['cell']; if (c.ch === ' ') cls.push('sp'); if (c.composing) cls.push('comp'); if (c.meta.w) cls.push('miss'); if (c.meta.sx) cls.push('sx');
      out.push(`<span class="${cls.join(' ')}" data-act="cur" data-arg="${c.composing ? -1 : c.i}">${c.ch === ' ' ? (c.meta.sx ? '⁀' : '') : esc(c.ch)}</span>`);
      if (c.meta.sm) out.push('<i class="vmark">∨</i>');
    });
    if (cursorAt === cells.length) out.push('<i class="caret"></i>');
    if (cp.endMiss) out.push('<i class="missmark">▾</i>');
    const pad = Math.max(8, Math.ceil((cells.length + 1) / 8) * 8) - cells.length;
    for (let k = 0; k < pad; k++) out.push('<span class="cell empty" data-act="curend"></span>');
    return out.join('');
  }
  function actDict(a) {
    const cp = new HG.Composer(); a.heardN = 0;
    const title = a.src === 'class' ? `📝 우리 반 받아쓰기${S.cls.title ? ' ' + esc(S.cls.title) : ''}` : a.src === 'grade' ? `🎖️ ${a.g}급 받아쓰기` : '✏️ 잘 듣고 써요';
    const idxInStep = L.acts.filter(x => x.type === 'dict').indexOf(a) + 1; const nDict = L.acts.filter(x => x.type === 'dict').length;
    const scoring = [a.space ? '띄어쓰기도 봐요' : '', a.punct ? '문장부호도 봐요' : ''].filter(Boolean).join(' · ');
    let copyMode = false; let skipShown = false;
    const redraw = () => { const g = document.getElementById('grid'); if (g) g.innerHTML = gridHtml(cp); };
    const canListen = () => { const mx = Number(S.settings.listenMax) || 0; return !mx || a.heardN < mx; };
    const listen = slow => {
      if (!canListen()) { toast('불러주기는 여기까지! 기억나는 대로 써요'); return; }
      a.heardN++; hush(); dictate(a.text, slow);
      if (!canListen()) document.querySelectorAll('.listen').forEach(b => { b.disabled = true; b.style.opacity = '.35'; });
    };
    const rules = [...HG.info(a.text, a.sound).rules].filter(r => r !== '띄어쓰기').concat(a.space ? ['띄어쓰기'] : [], a.punct && /[.,?!]/.test(a.text) ? ['문장부호'] : []);
    const f = flow(a, {
      text: a.text, srs: a.src === 'word', rules,
      reveal: () => {
        copyMode = true;
        const el = document.getElementById('hintcard'); el.hidden = false;
        el.innerHTML = `<b>정답을 보고 따라 써요</b><div class="answer">${esc(a.text)}</div>`;
        cp.setText(''); cp.clearMarks(); redraw(); setHint('');
        ko('정답을 보고 따라 써 봐요.');
      },
    });
    render('lesson', lessonFrame(`<div class="prompt dict-left">
        <div class="bubble">${title}${nDict > 1 ? ` <small>${idxInStep} / ${nDict}</small>` : ''}</div>
        <div class="row" style="justify-content:center">${a.src !== 'class' && a.img ? `<div class="pic sm">${esc(a.img)}</div>` : ''}${listenBtns()}</div>
        ${scoring ? `<div class="muted">${scoring}</div>` : ''}
        <div class="grid-paper" id="grid" data-act="curend">${gridHtml(cp)}</div>
        <div class="hint" id="hint"></div>
        <div class="hintcard" id="hintcard" hidden></div>
        <div class="next-row" id="skipRow" hidden><button class="btn small" data-act="skip">다음 ▶</button></div>
      </div>
      <div class="kb-wrap">${kbHtml(a.punct || /[.,?!]/.test(a.text))}</div>`, { split: true, kb: true }), {
      ...baseHandlers(),
      play: () => listen(false), slow: () => listen(true),
      key: k => { cp.type(k); redraw(); },
      bs: () => { cp.back(); redraw(); },
      sp: () => { cp.space(); redraw(); },
      left: () => { cp.setCursor(cp.cur - (cp.c ? 0 : 1)); redraw(); },
      right: () => { cp.setCursor(cp.cur + 1); redraw(); },
      cur: (i, el, e) => { e.stopPropagation(); if (+i >= 0) { cp.setCursor(+i + 1); redraw(); } },
      curend: () => { cp.setCursor(cp.chars.length + 1); redraw(); },
      skip: () => { if (!f.done) { f.done = true; award(3); nextAct(); } },
      submit: async () => {
        if (f.done) return;
        cp.commit(); const input = cp.text();
        if (!input.trim()) { toast('먼저 써 봐요'); return; }
        hush();
        const res = HG.grade(a.text, input, { space: a.space, punct: a.punct, sound: a.sound });
        cp.clearMarks();
        res.wrong.forEach(p => { if (cp.meta[p]) cp.meta[p].w = true; });
        res.spaceMiss.forEach(p => { if (cp.meta[p]) cp.meta[p].sm = true; });
        res.spaceExtra.forEach(p => { if (cp.meta[p]) cp.meta[p].sx = true; });
        res.missBefore.forEach(p => { if (p >= cp.chars.length) cp.endMiss = true; else if (cp.meta[p]) cp.meta[p].mb = true; });
        redraw();
        if (res.ok) {
          if (!copyMode) recordDict(a, f.att === 0);
          L.results.push({ text: a.text, ok: f.att === 0 && !copyMode });
          if (copyMode) { f.done = true; ding(); flash('👍'); award(3); setHint('잘 따라 썼어요!'); const my = actToken; await ko('잘 따라 썼어요!'); await sleep(300); if (my === actToken) nextAct(); return; }
          setHint('정답! 🎉'); return f.right({ quiet: true }).then(() => {});
        }
        if (copyMode) { setHint('주황색 글자를 정답과 비교해 봐요'); if (!skipShown) { skipShown = true; document.getElementById('skipRow').hidden = false; } return; }
        if (f.att === 0) { recordDict(a, false, res); L.results.push({ text: a.text, ok: false }); }
        const onlySpace = res.lettersOk && res.punctOk && !res.spaceOk;
        const cat = onlySpace ? '띄어쓰기' : (res.errs.find(x => x.cat !== '기타') || res.errs[0] || { cat: '기타' }).cat;
        const msg = onlySpace ? '글자는 모두 맞았어요! 띄어 쓸 곳만 다시 보자 (∨ 자리)' : '주황색 글자를 고쳐 봐요. 글자를 톡 누르면 그 뒤로 가요';
        if (f.att === 0 && onlySpace) { soft(); f.att++; stat(rules, ['띄어쓰기'], false); setHint(msg); await ko('글자는 모두 맞았어요! 띄어 쓸 곳만 다시 보자.'); return; }
        await f.wrong(cat, input);
        if (f.att === 1) setHint(msg);
      },
    });
    const my = actToken;
    (async () => {
      if (!L.heard.m8) { L.heard.m8 = 1; await ko(a.src === 'class' ? '우리 반 받아쓰기! 잘 듣고 써요.' : '잘 듣고 윤이 자판으로 써요.'); }
      if (my === actToken) { a.heardN++; dictate(a.text); }
    })();
  }
  // 받아쓰기 기록: 급수 합격 칸, 우리 반 문장 연습 횟수, 어려운 말 상자
  function recordDict(a, firstOk, res) {
    S.dictCount = (S.dictCount || 0) + 1;
    if (a.src === 'grade' && firstOk) { S.gradeOk[a.g] = S.gradeOk[a.g] || {}; S.gradeOk[a.g][a.idx] = today(); }
    if (a.src === 'class') { const it = clsItems()[a.idx]; if (it) { it.tries = (it.tries || 0) + 1; if (firstOk) { it.ok = (it.ok || 0) + 1; it.lastOk = today(); } } }
    if (a.src === 'word' && a.w && !L.marked[actKey()]) { mark(a.w, firstOk, a.review, res ? cpText(res) : null); L.marked[actKey()] = 1; }
    if (a.src !== 'word' && res && !firstOk) {
      // 문장에서 틀린 낱말(어절)을 어려운 말 상자에 넣어요
      const words = normText(a.text).split(' '); let p = 0; const spans = words.map(wd => { const s = p; p += HG.syls(wd).length + 1; return [s, p - 1, wd]; });
      const hit = new Set();
      res.errs.forEach(x => { if (x.epos === undefined) return; const sp = spans.find(([s, e]) => x.epos >= s && x.epos < e); if (sp) hit.add(sp[2].replace(/[.,?!]/g, '')); });
      hit.forEach(wd => { if (wd) mark(WORDS[wd] ? { ...WORDS[wd] } : { word: wd }, false, false, null); });
    }
    save();
  }
  const cpText = res => res && res.errs.length ? res.errs.map(x => `${x.e || '□'}→${x.g || '□'}`).join(', ') : null;

  /* --- 은후 받아쓰기 고쳐주기 --- */
  function actFix(a) {
    const w = a.w; const W = HG.syls(w.word); const X = HG.syls(a.wrong); const fixed = new Set(); let sel = null;
    const boxes = () => X.map((c, i) => `<button class="fixbox${fixed.has(i) ? ' ok' : ''}${sel === i ? ' sel' : ''}" data-act="box" data-arg="${i}">${esc(fixed.has(i) ? W[i] : c)}</button>`).join('');
    const optsFor = i => {
      const r = rng(w.word + i); const alt = HG.variants(w.word, w.sound).map(v => HG.syls(v)[i]).filter(c => c && c !== W[i] && c !== X[i]);
      return shuffle([W[i], X[i], ...(alt.length ? [alt[0]] : [])], r);
    };
    const f = flow(a, {
      text: w.word,
      reveal: () => { document.querySelectorAll('.fixbox').forEach(b => { if (a.bad.includes(+b.dataset.arg) && !fixed.has(+b.dataset.arg)) b.classList.add('glow'); }); document.querySelectorAll('.fixopt').forEach(b => { if (sel !== null && b.dataset.arg === W[sel]) b.classList.add('glow'); }); setHint('반짝이는 곳을 따라 눌러요 👉'); },
    });
    const draw = () => {
      document.getElementById('paper').innerHTML = boxes();
      const o = document.getElementById('fixopts');
      o.innerHTML = sel === null ? '' : optsFor(sel).map(c => `<button class="choice text big fixopt" data-act="opt" data-arg="${esc(c)}">${esc(c)}</button>`).join('');
    };
    render('lesson', lessonFrame(`<div class="prompt">
        <div class="say">${friendHtml('eunhoo', true)}<span class="text">내가 받아쓰기를 했는데, 틀린 글자가 있대. 찾아서 고쳐 줄래?</span></div>
        ${picHtml(w.img)}
        ${listenBtns()}
        <div class="hint" id="hint"></div>
        <div class="hintcard" id="hintcard" hidden></div>
      </div>
      <div class="prompt">
        <div class="paper-label">은후의 받아쓰기 공책</div>
        <div class="paper" id="paper">${boxes()}</div>
        <div class="muted" id="fixmsg">틀린 글자를 톡 눌러요</div>
        <div class="choices text-choices" id="fixopts"></div>
      </div>`, { split: true }), {
      ...baseHandlers(),
      play: () => { hush(); dictate(w.word); }, slow: () => { hush(); dictate(w.word, true); },
      box: i => {
        i = +i; if (f.done || fixed.has(i)) return; hush();
        if (a.bad.includes(i)) { sel = i; document.getElementById('fixmsg').textContent = '바른 글자를 골라요'; draw(); if (f.att >= 3) document.querySelectorAll('.fixopt').forEach(b => { if (b.dataset.arg === W[i]) b.classList.add('glow'); }); }
        else { setHint('그 글자는 은후가 맞게 썼어요!'); f.wrong('기타', null); }
      },
      opt: c => {
        if (f.done || sel === null) return; hush();
        if (c === W[sel]) {
          fixed.add(sel); sel = null; draw(); ding();
          if (a.bad.every(i => fixed.has(i))) { document.getElementById('fixmsg').textContent = '다 고쳤어요! 은후: 고마워!'; f.right().then(() => {}); ko('은후: 고마워!'); }
          else { document.getElementById('fixmsg').textContent = '또 틀린 글자가 있어요. 찾아봐요'; if (f.att >= 3) f.reveal2(); }
        } else { f.wrong(HG.classify(W[sel], c, sel, winfo(w)), null); }
      },
    });
    f.reveal2 = () => document.querySelectorAll('.fixbox').forEach(b => { if (a.bad.includes(+b.dataset.arg) && !fixed.has(+b.dataset.arg)) b.classList.add('glow'); });
    const my = actToken;
    (async () => { await ko('은후가 받아쓰기를 했는데, 틀린 글자가 있대. 찾아서 고쳐 줄래?'); if (my === actToken) dictate(w.word); })();
  }

  /* ================= 하루 끝 ================= */
  function confetti() {
    const em = ['⭐', '🌟', '🎉', '✨'];
    for (let i = 0; i < 24; i++) {
      const c = document.createElement('div'); c.className = 'confetti'; c.textContent = pick(em);
      c.style.left = Math.random() * 100 + 'vw'; c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's'; c.style.animationDelay = Math.random() * .6 + 's';
      document.body.appendChild(c); setTimeout(() => c.remove(), 4200);
    }
  }
  function giveBonus() {
    const tl = todayLog(); if (tl.bonus) return 0;
    const bonus = Math.max(0, Math.min(DAY_BONUS, DAY_STAR_MAX - tl.stars));
    tl.bonus = 1; S.stars += bonus; L.earned += bonus; tl.stars += bonus; save(); return bonus;
  }
  function finishDay() {
    const { u, d } = L; const un = unitOf(u);
    S.done[`${u}-${d}`] = today();
    let newSticker = false; let chMsg = '';
    if (d === un.days) {
      if (L.ch.ok >= 8 && !S.stickers[u]) { S.stickers[u] = today(); newSticker = true; }
      else if (!S.stickers[u]) chMsg = `도전 ${L.ch.ok}개 맞혔어요! 8개를 맞히면 스티커를 받아요. 단계 고르기에서 다시 도전할 수 있어요.`;
    }
    // 다음 진도 (열린 단원 안에서 돌아요)
    let nu = u, nd = d + 1; if (nd > un.days) { nd = 1; const k = READY.indexOf(u); nu = READY[(k + 1) % READY.length]; }
    S.pos = { u: nu, d: nd, s: 0 };
    const bonus = giveBonus(); save();
    const pg = L.promoted;
    render('reward', `<div class="screen"><div class="reward">
      <div class="friends">${Object.keys(C.friends).map(id => friendHtml(id, true)).join('')}</div>
      <div class="bubble">오늘 국어 끝! 정말 잘했어, ${esc(callName())}!<small>내일 또 만나요 👋</small></div>
      <div class="big-stars">⭐ +${L.earned}</div>
      ${bonus ? `<div class="muted" style="font-weight:800;margin-top:-10px">끝까지 한 보너스 ⭐${bonus} 포함</div>` : ''}
      ${pg ? `<div class="sticker-new">🎖️</div><div class="bubble">받아쓰기 ${pg}급 합격!${gradeData(pg - 1) ? `<small>이제 ${pg - 1}급에 도전해요</small>` : '<small>다음 급은 곧 열려요</small>'}</div>` : ''}
      ${newSticker ? `<div class="sticker-new">${un.sticker}</div><div class="bubble">${esc(un.title)} 스티커를 받았어요!</div>` : ''}
      ${chMsg ? `<div class="card mission">🏆 ${esc(chMsg)}</div>` : ''}
      ${un.mission && d === un.days ? `<div class="card mission">🏠 집에서 하는 글자 미션: ${esc(un.mission)}</div>` : ''}
      ${clsActive() ? `<div class="card mission">📝 우리 반 받아쓰기 ${esc(clsLabel())} — 홈에서 더 연습할 수 있어요</div>` : ''}
      <div class="home-links">
        <button class="btn" data-act="stickers">📒 스티커북</button>
        <button class="btn primary" data-act="home">끝!</button>
      </div>
    </div></div>`, { home: homeScreen, stickers: stickerScreen });
    confetti(); tone([523, 659, 784, 1046], 0.16);
    ko(`오늘 국어 끝! 정말 잘했어, ${callName()}. ${pg ? `받아쓰기 ${pg}급 합격!` : ''} ${newSticker ? '스티커도 받았어!' : '내일 또 만나!'}`);
  }
  function finishSpecial() {
    const ok = L.results.filter(r => r.ok).length; const n = L.acts.length;
    const all = ok === n;
    render('reward', `<div class="screen"><div class="reward">
      <div class="robot">📝</div>
      <div class="bubble">우리 반 받아쓰기 연습 끝!<small>${esc(clsLabel())}</small></div>
      <div class="big-stars">${ok} / ${n}</div>
      <div class="card result-list">${L.acts.map(a => { const r = L.results.find(x => x.text === a.text); return `<div>${r && r.ok ? '✅' : '🔁'} ${esc(a.text)}</div>`; }).join('')}</div>
      <p class="muted">🔁 표시 문장은 다음에 먼저 나와요</p>
      <div class="home-links"><button class="btn" data-act="again">한 번 더</button><button class="btn primary" data-act="home">끝!</button></div>
    </div></div>`, { home: homeScreen, again: startClassPractice });
    if (all) { confetti(); tone([523, 659, 784, 1046], 0.16); }
    ko(all ? '모두 한 번에 맞혔어요! 시험도 잘 볼 수 있어!' : '잘했어요! 틀린 문장은 다음에 또 연습해요.');
  }

  /* ================= 아빠 화면 ================= */
  function gateScreen(next) {
    const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
    render('gate', `<div class="screen"><div class="topbar"><button class="icon-btn" data-act="home">🏠</button></div>
      <div class="gate"><div class="card"><b>어른 확인</b><div style="font-size:40px;font-weight:900">${a} × ${b} = ?</div>
      <input id="ans" inputmode="numeric" autocomplete="off"><button class="btn primary" data-act="ok">확인</button></div></div></div>`, {
      home: homeScreen,
      ok: () => { if (+document.getElementById('ans').value === a * b) next(); else { toast('다시 계산해 보세요'); gateScreen(next); } },
    });
    setTimeout(() => { const i = document.getElementById('ans'); if (i) { i.focus(); i.addEventListener('keydown', e => { if (e.key === 'Enter') H.ok(); }); } }, 50);
  }
  function restore(txt) {
    txt = String(txt || '').trim(); let o = null;
    try { o = JSON.parse(txt); } catch (e) { try { o = JSON.parse(decodeURIComponent(escape(atob(txt)))); } catch (e2) { o = null; } }
    if (!o || !o.pos || o.pos.u === undefined) return false;
    S = merge(o); save(); return true;
  }
  /* 새 버전 확인·적용 (진도·별·설정은 localStorage에 그대로 남아요) */
  const verNum = v => String(v || '0').split('.').map(Number);
  const isNewer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  let latestVer = null;
  async function checkUpdate() {
    const r = await fetch('app.js?check=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('fetch');
    const m = (await r.text()).match(/APP_VERSION = '([\d.]+)'/);
    latestVer = m ? m[1] : null; return latestVer;
  }
  async function applyUpdate() {
    toast('새 버전을 받는 중이에요…');
    const files = ['./', 'index.html', 'app.js', 'content.js', 'style.css', 'sw.js', 'manifest.webmanifest', '기획서.md'];
    try { await Promise.all(files.map(u => fetch(encodeURI(u), { cache: 'reload' }).catch(() => {}))); } catch (e) { /* */ }
    try { if (navigator.serviceWorker) for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister(); } catch (e) { /* */ }
    try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* */ }
    location.replace(location.pathname + '?v=' + Date.now());
  }

  /* 기획·변경 기록: 앱 안의 기획서.md를 읽어서 보여줘요 */
  function mdToHtml(md) {
    const inl = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
    const out = []; const lines = md.split('\n'); let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (l.startsWith('```')) { const buf = []; i++; while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]); i++; out.push(`<pre class="spec-code">${esc(buf.join('\n'))}</pre>`); continue; }
      if (/^#{1,3} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n + 1}>${inl(l.replace(/^#+ /, ''))}</h${n + 1}>`); i++; continue; }
      if (l.startsWith('|')) {
        const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
        const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const body = rows.filter((r, k) => k !== 1);
        out.push(`<div class="spec-table"><table>${body.map((r, k) => `<tr>${cells(r).map(c => k === 0 ? `<th>${inl(c)}</th>` : `<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</table></div>`); continue;
      }
      if (/^(- |\d+\. )/.test(l)) {
        const ol = /^\d+\. /.test(l); const items = [];
        while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) items.push(lines[i++].replace(/^(- |\d+\. )/, ''));
        out.push(`<${ol ? 'ol' : 'ul'} class="list">${items.map(x => `<li>${inl(x)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`); continue;
      }
      if (l.trim()) out.push(`<p>${inl(l)}</p>`);
      i++;
    }
    return out.join('');
  }
  function specScreen() {
    render('spec', `<div class="screen"><div class="parent">
      <div class="topbar"><button class="icon-btn" data-act="back" aria-label="아빠 화면으로">⬅️</button><h2 class="title">📋 기획·변경 기록</h2><div class="spacer"></div><span class="muted">v${APP_VERSION}</span></div>
      <div class="card spec" id="spec">불러오는 중…</div></div></div>`, { back: parentScreen });
    const show = md => { const el = document.getElementById('spec'); if (el) el.innerHTML = mdToHtml(md); };
    if (window.__SPEC_INLINE) return show(window.__SPEC_INLINE);
    fetch(encodeURI('기획서.md')).then(r => { if (!r.ok) throw 0; return r.text(); }).then(show)
      .catch(() => { const el = document.getElementById('spec'); if (el) el.textContent = '기획서.md 파일을 찾지 못했어요. 앱 폴더에 기획서.md가 있는지 확인해 주세요.'; });
  }
  function exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }

  /* 콘텐츠 점검: 낱말이 단원 규칙에 맞는지 */
  function contentWarnings() {
    const warn = [], note = [];
    const has = (inf, r) => inf.rules.has(r) && inf.tags.some(t => t.has(r));
    U.forEach((un, ui) => (un.words || []).forEach(w => {
      if (!HG.syls(w.word).every(HG.isSyl)) { warn.push(`${ui + 1}단원 "${w.word}": 한글 글자만 넣어주세요`); return; }
      const inf = winfo(w); const J = HG.syls(w.word).map(c => HG.dec(c).jong);
      const ok = {
        nojong: () => J.every(j => !j),
        plainjong: () => J.some(Boolean) && !inf.differs,
        tjong: () => J.some((j, i) => 'ㅅㅈㅊㅌㅎ'.includes(j || '-') && inf.tags[i].has('받침')),
        kpjong: () => J.some((j, i) => 'ㄲㅋㅍ'.includes(j || '-') && inf.tags[i].has('받침')),
        yeoneum: () => has(inf, '연음'),
        tense: () => has(inf, '된소리'),
        change: () => has(inf, '소리바뀜'),
      }[un.check];
      if (ok && !ok()) warn.push(`${ui + 1}단원 ${un.title}: "${w.word}" [${inf.sound}]는 이 단원 규칙과 맞지 않아요`);
      const p = HG.pron(w.word).text; if (w.sound && w.sound !== p) note.push(`"${w.word}": 적힌 소리 [${w.sound}], 발음 규칙 계산 [${p}] (사이시옷 소리 등은 적힌 소리를 써요)`);
    }));
    return { warn, note };
  }

  /* 아빠 녹음 (MediaRecorder → IndexedDB) */
  let recState = null;
  function stopRecording() { if (recState) { try { recState.mr.stop(); } catch (e) { /* */ } } }
  async function toggleRecord(key, btn) {
    if (recState) { const same = recState.key === key; stopRecording(); if (same) return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('이 브라우저는 녹음을 지원하지 않아요 (크롬에서 열어주세요)'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast('마이크 권한이 필요해요 (크롬 설정 → 사이트 설정 → 마이크)'); return; }
    const mr = new MediaRecorder(stream); const chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); recState = null;
      document.querySelectorAll('[data-act="rec"]').forEach(b => { b.classList.remove('on'); b.textContent = '🎙 녹음'; });
      if (!chunks.length) return;
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      try { await DB.put(key, blob); REC.add(key); toast('녹음을 저장했어요. 이제 이 문장은 아빠 목소리로 불러줘요'); } catch (e) { toast('녹음을 저장하지 못했어요'); }
      if (screen === 'parent') refreshClsRows();
    };
    recState = { mr, key, stream }; mr.start();
    btn.classList.add('on'); btn.textContent = '⏹ 멈추기';
    setTimeout(() => { if (recState && recState.mr === mr) stopRecording(); }, 20000);
  }
  function clsRowsHtml() {
    const items = clsItems();
    if (!items.length) return '<p class="muted">아직 문장이 없어요. 아래 칸에 한 줄에 한 문장씩 적고 저장하세요.</p>';
    return `<ol class="list cls-list">${items.map((it, i) => { const k = normText(it.text); return `<li><b>${esc(it.text)}</b>
      <span class="muted">연습 ${it.tries || 0}번 · 한 번에 맞힘 ${it.ok || 0}번${REC.has(k) ? ' · 🎙 아빠 녹음 있음' : ''}</span>
      <span class="row" style="flex-wrap:wrap;gap:6px;margin:4px 0 8px"><button class="btn small" data-act="rec" data-arg="${i}">🎙 녹음</button><button class="btn small" data-act="recplay" data-arg="${i}">▶ 듣기</button>${REC.has(k) ? `<button class="btn small" data-act="recdel" data-arg="${i}">녹음 지우기</button>` : ''}</span></li>`; }).join('')}</ol>`;
  }
  function refreshClsRows() { const el = document.getElementById('clsRows'); if (el) el.innerHTML = clsRowsHtml(); }

  function parentScreen() {
    const weekAgo = addDays(-6);
    const days7 = S.days.filter(d => d >= weekAgo).length;
    const learned7 = Object.values(S.srs).filter(r => r.learned && r.learned >= weekAgo).length;
    const learnedAll = Object.values(S.srs).filter(r => r.learned).length;
    const boxN = Object.values(S.srs).filter(r => r.due).length;
    const hard = Object.entries(S.srs).filter(([, r]) => r.wrong > 0).sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 10)
      .map(([k, r]) => { const as = Object.entries(r.wrongAs || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g, n]) => `${esc(g)}${n > 1 ? `(${n})` : ''}`).join(', ');
        return `<li>${esc((r.w && r.w.img) || '')} <b>${esc(k)}</b>${as ? ` → ${as}` : ''} — ${r.wrong}번 틀림${r.mastered ? ' · 이제 알아요' : r.due ? ` · 복습 ${esc(r.due.slice(5))}` : ''}</li>`; }).join('');
    const RS = ['받침', '연음', '된소리', '소리바뀜', '모음', '띄어쓰기', '문장부호'];
    const rs = RS.map(r => { const x = S.ruleStats[r] || { n: 0, ok: 0 }; const pc = x.n ? Math.round(x.ok / x.n * 100) : null;
      return `<div class="rate"><span>${esc(ruleName(r))}</span><div class="goal-bar"><i style="width:${pc || 0}%;background:${pc === null ? 'var(--line)' : pc >= 80 ? 'var(--good)' : 'var(--primary)'}"></i></div><b>${pc === null ? '—' : pc + '%'}</b><small class="muted">${x.ok}/${x.n}</small></div>`; }).join('');
    const min = Math.round(todayLog().sec / 60);
    const st = S.settings; const code = `${S.pos.u + 1}-${S.pos.d}-${S.pos.s + 1}`;
    const cw = contentWarnings();
    const gOpts = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const sel = (key, list, cur) => `<select data-set="${key}" data-num="1">${list.map(([v, n]) => `<option value="${v}"${Number(cur) === Number(v) ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    const chk = (key, label) => `<label class="chk"><input type="checkbox" data-set="${key}"${st[key] ? ' checked' : ''}>${label}</label>`;
    render('parent', `<div class="screen"><div class="parent">
      <div class="topbar"><button class="icon-btn" data-act="home">🏠</button><h2 class="title">아빠 화면</h2><div class="spacer"></div><button class="btn small" data-act="spec">📋 기획·변경 기록</button><span class="muted">v${APP_VERSION}</span></div>
      <div class="card"><h3>이번 주 (최근 7일)</h3><div class="kv">
        <div>학습한 날<b>${days7}일</b></div><div>새로 익힌 낱말<b>${learned7}개</b></div><div>오늘 사용<b>${min}분</b></div><div>연속<b>${streak()}일</b></div>
      </div>
      <h3 style="margin-top:14px">어려운 말 목록 <span class="muted">(어려운 말 상자 ${boxN}개)</span></h3>${hard ? `<ol class="list">${hard}</ol>` : '<p class="muted">아직 없어요</p>'}</div>
      <div class="card"><h3>규칙별 정답률 <span class="muted">(처음 푼 것만)</span></h3><div class="rates">${rs}</div></div>
      <div class="card"><h3>전체</h3><div class="kv">
        <div>누적 학습일<b>${S.days.length}일</b></div><div>익힌 낱말<b>${learnedAll}개</b></div><div>받아쓰기 문장<b>${S.dictCount || 0}개</b></div><div>받아쓰기 급수<b>${S.grade}급</b></div><div>별<b>${S.stars}개</b></div><div>스티커<b>${Object.keys(S.stickers).length} / ${READY.length}</b></div>
      </div></div>
      <div class="card"><h3>📝 우리 반 받아쓰기</h3>
        <p class="muted">학교에서 받은 받아쓰기 문장을 넣고 시험 날짜를 정하면, 시험 날까지 매일 받아쓰기 단계가 이 문장으로 바뀌어요 (틀린 문장 먼저). 홈의 “우리 반 받아쓰기” 버튼으로 언제든 연습할 수 있어요.</p>
        <div class="form">
          <label>제목<input id="clsTitle" value="${esc(S.cls.title || '')}" placeholder="예: 3회 받아쓰기"></label>
          <label>시험 날짜<input id="clsDate" type="date" value="${esc(S.cls.date || '')}"></label>
        </div>
        <textarea id="clsText" class="cls-text" placeholder="한 줄에 한 문장씩 (최대 20개)&#10;예: 나비가 꽃에 앉아요.">${esc(clsItems().map(x => x.text).join('\n'))}</textarea>
        <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn small primary" data-act="clssave">문장 저장</button><button class="btn small" data-act="clsclear">문장 모두 지우기</button><span class="muted">${esc(clsLabel())}</span></div>
        <h3 style="margin-top:14px">문장별 아빠 녹음</h3>
        <p class="muted">🎙 녹음을 누르고 선생님처럼 또박또박 불러준 뒤 ⏹ 멈추기를 누르세요. 녹음이 있으면 태블릿 음성 대신 녹음을 틀어줘요. 녹음은 이 태블릿 안에만 저장돼요 (백업 파일에는 들어가지 않아요).</p>
        <div id="clsRows">${clsRowsHtml()}</div>
        <div class="row" style="flex-wrap:wrap"><button class="btn small" data-act="hundred">💯 학교 받아쓰기 100점 스티커 주기</button></div>
      </div>
      <div class="card"><h3>채점 설정</h3><div class="form">
        ${chk('spaceOn', '급수 받아쓰기에서 띄어쓰기 채점')}
        <label>띄어쓰기 채점 시작<select data-set="spaceFrom" data-num="1">${gOpts.map(g => `<option value="${g}"${Number(st.spaceFrom) === g ? ' selected' : ''}>${g}급부터</option>`).join('')}</select></label>
        ${chk('punctOn', '급수 받아쓰기에서 문장부호 채점')}
        <label>문장부호 채점 시작<select data-set="punctFrom" data-num="1">${gOpts.map(g => `<option value="${g}"${Number(st.punctFrom) === g ? ' selected' : ''}>${g}급부터</option>`).join('')}</select></label>
        ${chk('classSpace', '우리 반 받아쓰기에서 띄어쓰기 채점')}
        ${chk('classPunct', '우리 반 받아쓰기에서 문장부호 채점')}
        <label>불러주기 횟수${sel('listenMax', [[0, '무제한 (연습)'], [2, '2번만 (시험처럼)']], st.listenMax)}</label>
        <label>받아쓰기 읽기 속도${sel('dictRate', [[0.65, '아주 천천히'], [0.8, '천천히 (추천)'], [0.9, '보통']], st.dictRate)}</label>
      </div></div>
      <div class="card"><h3>앱 업데이트</h3>
        <p>이 기기의 앱: <b>v${APP_VERSION}</b> <span id="verInfo" class="muted">${latestVer ? (isNewer(latestVer, APP_VERSION) ? `· 새 버전 v${latestVer}이 있어요!` : '· 최신 버전이에요') : ''}</span></p>
        <div class="row" style="flex-wrap:wrap"><button class="btn small" data-act="checkver">🔄 새 버전 확인</button>
          <button class="btn small primary" data-act="doupdate" id="updBtn"${latestVer && isNewer(latestVer, APP_VERSION) ? '' : ' hidden'}>⬇️ 지금 업데이트</button></div>
        <p class="muted">업데이트해도 진도·별·보상·설정은 그대로 남아요. 인터넷이 연결돼 있어야 해요.</p>
      </div>
      <div class="card"><h3>진도 조정</h3>
        <p>지금 진도: <b>${esc(unitOf(S.pos.u).title)} ${S.pos.d}일차 · ${STEPS[S.pos.s].name}</b> <span class="muted">(코드 ${code})</span> · 받아쓰기 <b>${S.grade}급</b></p>
        <div class="form">
          <label>단원<select id="adjU">${READY.map(i => `<option value="${i}"${S.pos.u === i ? ' selected' : ''}>${i + 1}. ${esc(U[i].title)} (${doneCount(i)}/${U[i].days}일)</option>`).join('')}</select></label>
          <label>일차<select id="adjD">${Array.from({ length: 5 }, (_, i) => `<option value="${i + 1}"${S.pos.d === i + 1 ? ' selected' : ''}>${i + 1}일차</option>`).join('')}</select></label>
          <label>단계<select id="adjS">${STEPS.map((x, i) => `<option value="${i}"${S.pos.s === i ? ' selected' : ''}>${i + 1}. ${x.name}</option>`).join('')}</select></label>
          <label>받아쓰기 급수<select id="adjG">${C.grades.map(g => `<option value="${g.g}"${S.grade === g.g ? ' selected' : ''}>${g.g}급 — ${esc(g.title)}</option>`).join('')}</select></label>
          <label class="chk"><input type="checkbox" id="adjMark">앞 일차는 완료, 뒤 일차는 미완료로 맞추기 (스티커·급수 배지도 함께)</label>
        </div>
        <div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn small primary" data-act="adjpos">이 진도로 바꾸기</button>
          <button class="btn small" data-act="resetprog" id="resetProgBtn">진도 초기화</button></div>
        <p class="muted">일차는 단원 길이에 맞춰 줄어들어요. 진도 초기화: 진도·완료한 날·스티커·급수·어려운 말 상자·정답률을 처음으로 돌려요. 별·받은 보상·설정·우리 반 문장은 그대로예요.</p>
      </div>
      <div class="card"><h3>별 조정</h3>
        <p>지금 별: <b style="font-size:24px">${S.stars}개</b> <span class="muted">(현재 목표에 모은 별 ${Math.max(0, S.stars - S.goalBase)}개 · 오늘 ${todayLog().stars}개 / 하루 최대 ${DAY_STAR_MAX}개)</span></p>
        <div class="row" style="flex-wrap:wrap"><button class="btn small" data-act="star" data-arg="-10">−10</button><button class="btn small" data-act="star" data-arg="-1">−1</button><button class="btn small" data-act="star" data-arg="1">+1</button><button class="btn small" data-act="star" data-arg="10">+10</button></div>
        <div class="code-row" style="margin-top:10px"><input id="starSet" type="number" min="0" placeholder="개수"><button class="btn small primary" data-act="starset">이 개수로 맞추기</button></div>
      </div>
      <div class="card"><h3>받은 보상 (${S.rewards.length}개)</h3>
        ${S.rewards.length ? `<ol class="list">${S.rewards.map((r, i) => `<li>${esc(r.date)} — ${esc(r.text)} (별 ${r.stars}개) <button class="btn small" style="min-height:36px;padding:4px 10px" data-act="delrw" data-arg="${i}">삭제</button></li>`).join('')}</ol>` : '<p class="muted">아직 없어요. 목표를 달성하면 아래 설정의 “🎁 보상 줬어요”를 눌러 기록하세요.</p>'}
      </div>
      <div class="card"><h3>진도 옮기기·백업</h3>
        <p>이 기기의 현재 진도 코드: <b style="font-size:24px">${code}</b> <span class="muted">(단원-일차-단계)</span></p>
        <div class="code-row"><input id="pcode" placeholder="예: 3-2-1"><button class="btn small primary" data-act="setpos">이 진도로 맞추기</button></div>
        <p class="muted">별·스티커·복습 기록까지 모두 옮기려면 아래 백업 코드를 복사해 다른 기기의 같은 칸에 붙여넣고 “가져오기”를 누르세요.</p>
        <textarea id="backup" placeholder="백업 코드"></textarea>
        <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn small" data-act="export">내보내기(복사)</button><button class="btn small" data-act="import">가져오기</button>
          <button class="btn small" data-act="savefile">💾 백업 파일 저장</button><label class="btn small" style="cursor:pointer">📂 백업 파일 불러오기<input type="file" id="loadFile" accept=".json,application/json,text/plain" hidden></label></div>
        <p class="muted">앱을 지웠다 다시 설치하기 전에는 “백업 파일 저장”을 꼭 눌러두세요. 영어·수학 앱과는 저장이 따로예요.</p>
      </div>
      <div class="card"><h3>설정</h3><div class="form">
        <label>부르는 이름<input data-set="childName" value="${esc(st.childName)}"></label>
        <label>로봇 친구 이름<input data-set="robotName" value="${esc(st.robotName)}"></label>
        <label>한국어 목소리<select data-set="koVoice"><option value="">자동 (구글 음성 우선)</option>${koVoices().map(v => `<option value="${esc(v.voiceURI || v.name)}"${st.koVoice === (v.voiceURI || v.name) ? ' selected' : ''}>${esc(v.name)}${v.localService ? '' : ' (온라인)'}</option>`).join('')}</select></label>
        <label>안내 말 속도${sel('koRate', [[0.8, '천천히'], [0.9, '보통 (추천)'], [1, '빠르게']], st.koRate)}</label>
        <div class="row" style="flex-wrap:wrap"><button class="btn small" data-act="kotest">🔈 받아쓰기 들어보기</button>
          <span class="muted">${koVoices().length ? `이 기기의 한국어 목소리 ${koVoices().length}개` : '⚠️ 한국어 목소리를 못 찾았어요. 아래 안내를 보세요'}</span></div>
        <label>하루 최대 시간(분)<input data-set="dailyLimit" type="number" min="5" max="120" value="${st.dailyLimit}"></label>
        <label>별 목표(개)<input data-set="goalStars" type="number" min="5" max="999" value="${st.goalStars}"></label>
        <label>목표 보상<input data-set="goalText" value="${esc(st.goalText)}"></label>
      </div>
      <div class="row" style="margin-top:12px;flex-wrap:wrap">
        <button class="btn small" data-act="unlock">오늘 시간 잠금 풀기</button>
        <button class="btn small" data-act="gave">🎁 보상 줬어요 (목표 새로 시작)</button>
        <button class="btn small" data-act="reset" id="resetBtn">전체 초기화 (별·보상·설정까지)</button>
      </div></div>
      <div class="card"><h3>콘텐츠 점검</h3>
        ${cw.warn.length ? `<ul class="list warn">${cw.warn.map(x => `<li>⚠️ ${esc(x)}</li>`).join('')}</ul>` : '<p>✅ 모든 낱말이 단원 규칙에 맞아요.</p>'}
        ${cw.note.length ? `<details><summary class="muted">참고 ${cw.note.length}개</summary><ul class="list">${cw.note.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
      </div>
      <div class="card"><h3>안내</h3><ul class="list">
        <li>낱말·급수 문장 수정은 <b>content.js</b>에서 해요. 고친 뒤 <b>app.js</b>의 APP_VERSION과 <b>sw.js</b>의 VERSION을 올리면 설치된 앱에 반영돼요.</li>
        <li>받아쓰기 소리가 잘 안 들리면: 태블릿 <b>설정 → 일반 → 글자 읽어주기(TTS) → 기본 엔진</b>을 <b>Google 음성 인식 및 합성</b>으로 바꾸고, <b>한국어 음성 데이터(고품질)</b>를 설치한 뒤 앱을 다시 켜세요.</li>
        <li>태블릿 음성이 어색하게 읽는 문장은 우리 반 받아쓰기에 넣고 🎙 녹음하면 아빠 목소리로 바뀌어요.</li>
        <li>윤이 자판에는 자동완성·맞춤법 고침이 없어요. 태블릿 기본 키보드는 쓰지 않아요.</li>
      </ul></div>
    </div></div>`, {
      home: homeScreen,
      clssave: () => {
        const lines = document.getElementById('clsText').value.split('\n').map(normText).filter(Boolean).slice(0, 20);
        const old = {}; clsItems().forEach(it => { old[normText(it.text)] = it; });
        S.cls = { title: document.getElementById('clsTitle').value.trim(), date: document.getElementById('clsDate').value, items: lines.map(t => old[t] || { text: t, ok: 0, tries: 0 }) };
        save(); toast(`${lines.length}문장을 저장했어요${S.cls.date ? '' : ' (시험 날짜도 넣어주세요)'}`); parentScreen();
      },
      clsclear: (x, btn) => { if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = '정말 지울까요? 한 번 더 누르기'; return; } S.cls = { title: '', date: '', items: [] }; save(); parentScreen(); },
      rec: (i, btn) => { const it = clsItems()[+i]; if (it) toggleRecord(normText(it.text), btn); },
      recplay: i => { const it = clsItems()[+i]; if (it) { hush(); dictate(it.text); } },
      recdel: async i => { const it = clsItems()[+i]; if (!it) return; const k = normText(it.text); try { await DB.del(k); } catch (e) { /* */ } REC.delete(k); refreshClsRows(); toast('녹음을 지웠어요'); },
      hundred: () => { S.special.push({ date: today(), text: `우리 반 받아쓰기 100점${S.cls.title ? ` (${S.cls.title})` : ''}`, icon: '💯' }); save(); toast('💯 100점 스티커를 줬어요! 스티커북에 붙었어요'); },
      setpos: () => { const p = parseCode(document.getElementById('pcode').value); if (!p) return toast('예: 3-2-1 처럼 적어주세요'); S.pos = p; save(); toast(`진도를 ${p.u + 1}-${p.d}-${p.s + 1}로 맞췄어요`); parentScreen(); },
      export: async () => { const c = exportCode(); const ta = document.getElementById('backup'); ta.value = c; ta.select(); try { await navigator.clipboard.writeText(c); toast('복사했어요. 다른 기기에 붙여넣으세요'); } catch (e) { toast('코드를 길게 눌러 복사하세요'); } },
      import: () => { if (restore(document.getElementById('backup').value)) { toast('가져왔어요!'); parentScreen(); } else toast('백업 코드가 올바르지 않아요'); },
      savefile: () => {
        try {
          const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `yuni-hangul-backup-${today()}.json`;
          document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          toast('백업 파일을 저장했어요 (다운로드 폴더)');
        } catch (e) { toast('저장하지 못했어요. 내보내기(복사)를 이용하세요'); }
      },
      adjpos: () => {
        const u = +document.getElementById('adjU').value; const d = Math.min(daysOf(u), +document.getElementById('adjD').value); const sIdx = +document.getElementById('adjS').value; const g = +document.getElementById('adjG').value;
        if (document.getElementById('adjMark').checked) {
          S.done = {}; S.stickers = {}; S.badges = {};
          READY.forEach(ui => { for (let di = 1; di <= daysOf(ui); di++) if (ui < u || (ui === u && di < d)) S.done[`${ui}-${di}`] = today(); if (ui < u) S.stickers[ui] = today(); });
          C.grades.forEach(x => { if (x.g > g) S.badges[x.g] = today(); });
        }
        S.pos = { u, d, s: sIdx }; S.grade = g; save(); toast(`진도를 ${U[u].title} ${d}일차 · ${STEPS[sIdx].name}, 받아쓰기 ${g}급으로 바꿨어요`); parentScreen();
      },
      resetprog: (x, btn) => {
        if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = '정말 진도 초기화? 한 번 더 누르기'; return; }
        S.pos = { u: 0, d: 1, s: 0 }; S.done = {}; S.stickers = {}; S.srs = {}; S.grade = 10; S.gradeOk = {}; S.badges = {}; S.ruleStats = {}; S.dictCount = 0;
        save(); toast('진도를 처음으로 돌렸어요'); parentScreen();
      },
      star: a => { S.stars = Math.max(0, S.stars + Number(a)); S.goalBase = Math.min(S.goalBase, S.stars); save(); parentScreen(); },
      starset: () => { const v = parseInt(document.getElementById('starSet').value, 10); if (!(v >= 0)) return toast('0 이상의 숫자를 적어주세요'); S.stars = v; S.goalBase = Math.min(S.goalBase, S.stars); save(); toast(`별을 ${v}개로 맞췄어요`); parentScreen(); },
      delrw: (i, btn) => { if (!btn.dataset.sure) { btn.dataset.sure = 1; btn.textContent = '한 번 더 누르면 삭제'; return; } S.rewards.splice(+i, 1); save(); parentScreen(); },
      spec: specScreen,
      checkver: async () => {
        const info = document.getElementById('verInfo'); if (info) info.textContent = '· 확인 중…';
        try {
          const v = await checkUpdate();
          const nw = v && isNewer(v, APP_VERSION);
          if (info) info.textContent = nw ? `· 새 버전 v${v}이 있어요!` : `· 최신 버전이에요 (서버 v${v || '?'})`;
          const b = document.getElementById('updBtn'); if (b) b.hidden = !nw;
        } catch (e) { if (info) info.textContent = '· 확인하지 못했어요. 인터넷 연결을 확인해 주세요'; }
      },
      doupdate: applyUpdate,
      kotest: () => { hush(); ko('받아쓰기 들어보기.').then(() => dictate('나비가 꽃에 앉아요.')); },
      unlock: () => { S.override = today(); save(); toast('오늘은 시간 제한 없이 할 수 있어요'); },
      gave: () => { S.rewards.push({ date: today(), text: S.settings.goalText, stars: Number(S.settings.goalStars) }); S.goalBase = S.stars; save(); toast('보상을 기록했어요. 새 목표를 시작해요!'); parentScreen(); },
      reset: (x, btn) => { if (btn.dataset.sure) { S = defaults(); save(); toast('초기화했어요'); homeScreen(); } else { btn.dataset.sure = 1; btn.textContent = '정말 초기화? 한 번 더 누르기'; } },
    });
    const lf = document.getElementById('loadFile');
    if (lf) lf.addEventListener('change', () => { const f = lf.files[0]; if (!f) return; f.text().then(txt => { if (restore(txt)) { toast('백업을 불러왔어요!'); parentScreen(); } else toast('백업 파일이 올바르지 않아요'); }); });
    document.querySelectorAll('[data-set]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.set;
      S.settings[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.dataset.num) ? Number(el.value) : el.value.trim();
      save(); toast('저장했어요');
    }));
  }

  /* ================= 시작 ================= */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  // 저장된 진도가 브라우저 정리로 지워지지 않게 요청
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* */ }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { hush(); stopRecording(); } });
  window.YUNI = { get state() { return S; }, get act() { return L && L.acts[L.i]; }, get lesson() { return L; }, parseCode, contentWarnings, KEY, APP_VERSION, DAY_STAR_MAX, DAY_BONUS }; // 테스트용
  homeScreen();
  // 시작하고 잠시 뒤 새 버전이 있는지 조용히 확인
  setTimeout(() => { if (!/^https?:/.test(location.protocol) || window.__SPEC_INLINE || navigator.onLine === false) return;
    checkUpdate().then(v => { if (v && isNewer(v, APP_VERSION) && screen === 'home') toast(`새 버전 v${v}이 있어요. 아빠 화면에서 업데이트하세요`); }).catch(() => {}); }, 3000);
})();
