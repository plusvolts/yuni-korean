#!/usr/bin/env node
/* 윤이 국어 — 한국어 녹음 문장 목록 만들기 (공통 65번, plan/0_COMMON_spec.md 5-2)
   사용: node tools/ko_sentences.js  →  tools/ko_sentences.json = [{key, say}]
   key = 앱이 ko()/dictate()에 넘기는 글(ko는 . ! ? 문장 단위), say = 실제로 읽을 글(발음 [괄호]·이모지 빼기, 자모는 이름으로)
   content.js나 app.js의 말을 바꾸면 이 도구와 tools/make_ko_audio.py를 다시 돌려요. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const window = {}; new Function('window', fs.readFileSync(path.join(root, 'content.js'), 'utf8'))(window);
const C = window.CONTENT;
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const norm = t => String(t || '').replace(/\s+/g, ' ').trim();
const koSentences = t => String(t).split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
const JAMO = { 'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음', 'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅊ': '치읓', 'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗',
  'ㄲ': '쌍기역', 'ㄸ': '쌍디귿', 'ㅃ': '쌍비읍', 'ㅆ': '쌍시옷', 'ㅉ': '쌍지읒', 'ㅐ': '애', 'ㅔ': '에' };
const SAY_FIX = { // 그대로 읽으면 어색한 문장
  '은후: 고마워!': '고마워!',
  '문장 끝에 . ? ! 를 알맞게 써요. 묻는 말은 ?, 놀란 말은 !': '문장 끝에 마침표, 물음표, 느낌표를 알맞게 써요. 묻는 말은 물음표, 놀란 말은 느낌표.',
};
function say(k) {
  if (SAY_FIX[k]) return SAY_FIX[k];
  let s = k.replace(/\[([^\]]*)\]/g, '$1').replace(/[∨]/g, ' ').replace(/🐢/g, '거북이').replace(/①/g, '일').replace(/②/g, '이')
    .replace(/(\S)-(\S)/g, '$1 $2').replace(/·/g, ', ').replace(/ㅉ로/g, 'ㅉ으로')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ㄱ-ㅎㅏ-ㅣ]([가-힣]?)/g, (m, j) => (JAMO[m[0]] || m[0]) + (j ? j : ' ')).replace(/\//g, ', ').replace(/"/g, '');
  return norm(s.replace(/ +([,.!?])/g, '$1'));
}
const out = new Map();
const addKey = k => { k = norm(k); if (k && /[가-힣]/.test(k) && !out.has(k)) out.set(k, say(k)); };
// ko(): 문장 전체(한 문장이면 그대로) + 문장 단위. 문장부호만 있는 조각이 생기면 전체 녹음으로
function addKo(t) {
  t = norm(t); if (!t) return;
  const parts = koSentences(t);
  if (parts.length === 1) return addKey(t);
  if (parts.some(p => !/[가-힣]/.test(p))) { addKey(t); return; }
  parts.forEach(addKey);
}
// 받아쓰기 dictate(): 전체 글 + (여러 낱말이면) 띄어 읽기 단위
const readUnits = t => { t = norm(t); return t.includes('/') ? t.split('/').map(x => x.trim()).filter(Boolean) : t.split(' ').filter(Boolean); };
function addDict(t) { addKey(norm(t).replace(/\//g, ' ')); const u = readUnits(t); if (u.length > 1) u.forEach(addKey); }

const name = '윤이', callName = '윤이야';
// ① app.js 고정 문장: ko('…') / ko(조건 ? '…' : '…')
for (const m of app.matchAll(/\bko\(([^;]*?)\)(?:\.then|;|\s*\})/g)) for (const s of m[1].matchAll(/'([^']*[가-힣][^']*)'/g)) addKo(s[1]);
// ② 이름·단원·단계가 들어가는 문장 (기본값: 아이 이름 윤이)
addKo(`안녕, ${callName}! 오늘도 같이 받아쓰기 하자!`);
addKo(`안녕, ${callName}! 오늘의 낱말을 들어봐요.`);
C.units.forEach(u => addKo(`${u.title} 단원을 끝내면 받을 수 있어요`));
C.units.filter(u => u.ready !== false && u.words.length).forEach(u => { addKo(`오늘의 규칙, ${u.title}!`); if (u.card) addKo(u.card.text); });
for (const m of app.matchAll(/\{ id: '\w+', name: '([^']+)', icon/g)) addKo(`다음은 ${m[1]}!`);
addKo(`오늘 국어 끝! 정말 잘했어, ${callName}.`);
for (let g = 10; g >= 1; g--) addKo(`받아쓰기 ${g}급 합격!`);
addKo('스티커도 받았어!'); addKo('내일 또 만나!');
addKo('오늘은 도전하는 날! 10문제 중 8개를 한 번에 맞히면 스티커를 받아요.');
// ③ content.js 말: 힌트, 칭찬, 다시 듣기
Object.values(C.rules).forEach(r => addKo(r.hint));
C.lines.praise.forEach(addKo); addKo(C.lines.retry);
addKo('복습할 말이 아직 없어요! 바로 오늘의 규칙으로 가요');
// ④ 받아쓰기로 불러주는 낱말·문장
C.units.forEach(u => (u.words || []).forEach(w => addDict(w.word)));
C.grades.forEach(g => g.items.forEach(it => addDict(it.text)));
addDict('나비가 꽃에 앉아요.');
const list = [...out].map(([key, s]) => ({ key, say: s }));
fs.writeFileSync(path.join(__dirname, 'ko_sentences.json'), JSON.stringify(list, null, 1));
console.log(list.length + '개 → tools/ko_sentences.json');
