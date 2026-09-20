/*
 * 윤이 국어 — 학습 콘텐츠
 * ------------------------------------------------------------
 * 아빠가 직접 고치는 파일이에요.
 *  - 낱말: { word: '음악', sound: '으막', img: '🎵' }
 *      word  = 바르게 쓴 말
 *      sound = 소리 나는 대로 (쓰는 것과 소리가 같으면 빼도 돼요. 앱이 발음 규칙으로 알아서 계산해요)
 *      img   = 그림(이모지)
 *  - 단원 modes: 그 단원에서 쓰는 문제 모드 번호 (1 바른 글자 골라요, 2 받침 끼우기, 3 소리는 이렇게 글자는?, 4 낱말 만들기, 8 받아쓰기)
 *  - 앱이 낱말마다 받침·소리 규칙을 검사해서, 단원 규칙에 맞지 않으면 아빠 화면 "콘텐츠 점검"에 경고를 보여줘요.
 *  - 고친 뒤 app.js의 APP_VERSION과 sw.js의 VERSION을 올려야 설치된 앱에 반영돼요.
 */
window.CONTENT = {
  units: [
    {
      id: 'u1', title: '받침 없는 말', icon: '🦋', sticker: '🦋', days: 3, modes: [1, 4], check: 'nojong',
      card: { img: '🦋', example: '나비', text: '받침이 없는 글자는 소리 나는 대로 써요. 나-비, 바-다! 한 글자씩 또박또박 들어봐요.' },
      mission: '집에서 받침 없는 두 글자 낱말 세 개 찾기 (예: 우유, 의자, 가지)',
      words: [
        { word: '나비', img: '🦋' }, { word: '고래', img: '🐋' }, { word: '바다', img: '🌊' }, { word: '오리', img: '🦆' },
        { word: '기차', img: '🚂' }, { word: '모자', img: '🧢' }, { word: '사자', img: '🦁' }, { word: '하마', img: '🦛' },
        { word: '거미', img: '🕷️' }, { word: '포도', img: '🍇' }, { word: '우유', img: '🥛' }, { word: '무지개', img: '🌈' },
      ],
    },
    {
      id: 'u2', title: '대표 받침', icon: '🐜', sticker: '🐜', days: 5, modes: [1, 2, 4], check: 'plainjong',
      card: { img: '🐻', example: '곰', text: '글자 밑에 붙는 자음을 받침이라고 해요. 물, 곰, 강처럼 받침 소리가 그대로 나는 말부터 써 봐요.' },
      mission: '집에서 받침 ㅇ이 들어간 물건 찾기 (예: 공, 가방, 풍선)',
      words: [
        { word: '물', img: '💧' }, { word: '곰', img: '🐻' }, { word: '강', img: '🏞️' }, { word: '밥', img: '🍚' },
        { word: '달', img: '🌙' }, { word: '별', img: '⭐' }, { word: '공', img: '⚽' }, { word: '산', img: '⛰️' },
        { word: '상어', img: '🦈' }, { word: '사탕', img: '🍬' }, { word: '가방', img: '🎒' }, { word: '풍선', img: '🎈' },
        { word: '수박', img: '🍉' }, { word: '거북', img: '🐢' }, { word: '연필', img: '✏️' }, { word: '딸기', img: '🍓' },
      ],
    },
    {
      id: 'u3', title: 'ㄷ 소리 받침', icon: '🌸', sticker: '🌸', days: 5, modes: [1, 2, 3], check: 'tjong',
      card: { img: '🌸', example: '꽃', text: '꽃은 [꼳]이라고 소리 나요. ㄷ 소리가 나는 받침은 ㅅ ㅈ ㅊ ㅌ 중에 있어요. 뒤에 "이"를 붙여 보면 알 수 있어요. 꽃이 [꼬치]!' },
      mission: '집에서 받침 ㅅ이 들어간 물건 찾기 (예: 옷, 빗, 붓)',
      words: [
        { word: '꽃', sound: '꼳', img: '🌸' }, { word: '옷', sound: '옫', img: '👕' }, { word: '낮', sound: '낟', img: '🌞' },
        { word: '밭', sound: '받', img: '🥕' }, { word: '빛', sound: '빋', img: '💡' }, { word: '붓', sound: '붇', img: '🖌️' },
        { word: '솥', sound: '솓', img: '🍲' }, { word: '끝', sound: '끋', img: '🏁' }, { word: '맛', sound: '맏', img: '😋' },
        { word: '벚꽃', sound: '벋꼳', img: '🌸' }, { word: '젖소', sound: '젇쏘', img: '🐄' }, { word: '낫', sound: '낟', img: '🌾' },
      ],
    },
    {
      id: 'u4', title: 'ㄱ·ㅂ 소리 받침', icon: '🍃', sticker: '🍃', days: 3, modes: [1, 2, 3], check: 'kpjong',
      card: { img: '🍃', example: '잎', text: '밖은 [박], 잎은 [입]이라고 소리 나요. ㄱ 소리 받침은 ㄱ ㄲ ㅋ, ㅂ 소리 받침은 ㅂ ㅍ일 수 있어요. 뒤에 "에"를 붙여 봐요. 밖에 [바께], 잎에 [이페]!' },
      mission: '현이에게 "밖, 잎, 앞"을 불러주고 받아쓰기 시켜보기',
      words: [
        { word: '밖', sound: '박', img: '🚪' }, { word: '부엌', sound: '부억', img: '🍳' }, { word: '앞', sound: '압', img: '⬆️' },
        { word: '잎', sound: '입', img: '🍃' }, { word: '숲', sound: '숩', img: '🌳' }, { word: '옆', sound: '엽', img: '↔️' },
        { word: '무릎', sound: '무릅', img: '🦵' }, { word: '늪', sound: '늡', img: '🐊' }, { word: '낚시', sound: '낙씨', img: '🎣' },
        { word: '짚', sound: '집', img: '🌾' },
      ],
    },
    {
      id: 'u5', title: '받침이 넘어가는 말', icon: '🎵', sticker: '🎵', days: 5, modes: [3, 1, 4], check: 'yeoneum',
      card: { img: '🎵', example: '음악', text: '받침 뒤에 ㅇ이 오면 받침이 뒤로 넘어가서 소리 나요. [으막]이라고 들려도 음악이라고 써요. 앞 글자의 받침을 꼭 써요!' },
      mission: '물고기·곤충 이름에 "이"를 붙여 소리 내 보기 (거북이 [거부기], 곰이 [고미])',
      words: [
        { word: '음악', sound: '으막', img: '🎵' }, { word: '얼음', sound: '어름', img: '🧊' }, { word: '거북이', sound: '거부기', img: '🐢' },
        { word: '문어', sound: '무너', img: '🐙' }, { word: '낙엽', sound: '나겹', img: '🍂' }, { word: '목요일', sound: '모교일', img: '📅' },
        { word: '금요일', sound: '그묘일', img: '📅' }, { word: '일요일', sound: '이료일', img: '📅' }, { word: '옷이', sound: '오시', img: '👕' },
        { word: '꽃이', sound: '꼬치', img: '🌸' }, { word: '집에', sound: '지베', img: '🏠' }, { word: '곰이', sound: '고미', img: '🐻' },
        { word: '책을', sound: '채글', img: '📖' }, { word: '물을', sound: '무를', img: '💧' },
      ],
    },
    {
      id: 'u6', title: '소리가 세지는 말', icon: '🏫', sticker: '🏫', days: 4, modes: [3, 1, 8], check: 'tense',
      card: { img: '🏫', example: '학교', text: '[학꾜]처럼 뒤 글자가 세게 소리 나도, 글자는 원래대로 학교라고 써요. ㄲ ㄸ ㅃ ㅆ ㅉ로 쓰지 않아요!' },
      mission: '집에서 학교 준비물 이름 받아쓰기 (책상 [책쌍], 숙제 [숙쩨])',
      words: [
        { word: '학교', sound: '학꾜', img: '🏫' }, { word: '국수', sound: '국쑤', img: '🍜' }, { word: '식당', sound: '식땅', img: '🍽️' },
        { word: '책상', sound: '책쌍', img: '🪑' }, { word: '숙제', sound: '숙쩨', img: '📝' }, { word: '박수', sound: '박쑤', img: '👏' },
        { word: '약속', sound: '약쏙', img: '🤙' }, { word: '접시', sound: '접씨', img: '🍽️' }, { word: '눈사람', sound: '눈싸람', img: '⛄' },
        { word: '물고기', sound: '물꼬기', img: '🐟' }, { word: '떡볶이', sound: '떡뽀끼', img: '🍢' }, { word: '국자', sound: '국짜', img: '🥄' },
      ],
    },
    {
      id: 'u7', title: '소리가 바뀌는 말', icon: '🌅', sticker: '🌅', days: 4, modes: [3, 1], check: 'change',
      card: { img: '🌅', example: '같이', text: '[가치], [궁물]처럼 소리가 바뀌어 들려도, 글자는 원래 모양대로 같이, 국물이라고 써요.' },
      mission: '과학실험: 물과 얼음을 같이 컵에 넣고 "같이"를 받아쓰기',
      words: [
        { word: '같이', sound: '가치', img: '👫' }, { word: '해돋이', sound: '해도지', img: '🌅' }, { word: '국물', sound: '궁물', img: '🥣' },
        { word: '식물', sound: '싱물', img: '🌱' }, { word: '먹물', sound: '멍물', img: '🦑' }, { word: '박물관', sound: '방물관', img: '🏛️' },
        { word: '콧물', sound: '콘물', img: '🤧' }, { word: '난로', sound: '날로', img: '🔥' }, { word: '설날', sound: '설랄', img: '🧧' },
        { word: '거짓말', sound: '거진말', img: '🤥' }, { word: '칼날', sound: '칼랄', img: '🔪' }, { word: '붙이다', sound: '부치다', img: '📌' },
      ],
    },
    // v0.2 이후에 열려요
    { id: 'u8', title: '헷갈리는 모음 ㅐ/ㅔ', icon: '🦐', sticker: '🦐', days: 3, ready: false, words: [] },
    { id: 'u9', title: '흉내 내는 말', icon: '🐸', sticker: '🐸', days: 4, ready: false, words: [] },
    { id: 'u10', title: '띄어쓰기 ① 낱말 사이', icon: '🤖', sticker: '🤖', days: 4, ready: false, words: [] },
    { id: 'u11', title: '띄어쓰기 ② 붙여 쓰는 말', icon: '🐟', sticker: '🐟', days: 4, ready: false, words: [] },
    { id: 'u12', title: '문장부호', icon: '❗', sticker: '❗', days: 3, ready: false, words: [] },
    { id: 'u13', title: '종합 받아쓰기', icon: '🏆', sticker: '🏆', days: 5, ready: false, words: [] },
  ],

  // 받아쓰기 급수 (10급 → 1급). 한 급에 10개, 8개 이상 한 번에 맞히면 다음 급
  grades: [
    { g: 10, title: '받침 없는 낱말', items: [
      { text: '나비', img: '🦋' }, { text: '바다', img: '🌊' }, { text: '고래', img: '🐋' }, { text: '오리', img: '🦆' }, { text: '기차', img: '🚂' },
      { text: '모자', img: '🧢' }, { text: '거미', img: '🕷️' }, { text: '하마', img: '🦛' }, { text: '포도', img: '🍇' }, { text: '로보', img: '🤖' },
    ] },
    { g: 9, title: '대표 받침 낱말', items: [
      { text: '문어', img: '🐙' }, { text: '상어', img: '🦈' }, { text: '곰', img: '🐻' }, { text: '달', img: '🌙' }, { text: '별', img: '⭐' },
      { text: '사탕', img: '🍬' }, { text: '연필', img: '✏️' }, { text: '가방', img: '🎒' }, { text: '수박', img: '🍉' }, { text: '풍선', img: '🎈' },
    ] },
    { g: 8, title: '소리가 다른 받침 낱말', items: [
      { text: '꽃', img: '🌸' }, { text: '옷', img: '👕' }, { text: '밖', img: '🚪' }, { text: '잎', img: '🍃' }, { text: '숲', img: '🌳' },
      { text: '부엌', img: '🍳' }, { text: '낮', img: '🌞' }, { text: '밭', img: '🥕' }, { text: '앞', img: '⬆️' }, { text: '빛', img: '💡' },
    ] },
    // 7급~1급은 v0.2 이후 (7급: 두 낱말 띄어쓰기, 6급: 짧은 문장 …)
  ],

  // 규칙 이름과 힌트(2단계 힌트 카드)
  rules: {
    '받침': { name: '받침', hint: '받침을 다시 봐요. 소리와 다르게 쓰는 받침이 있어요. 뒤에 "이"나 "에"를 붙여 소리 내 보면 진짜 받침이 들려요.' },
    '연음': { name: '받침이 넘어가는 말', hint: '받침 뒤에 ㅇ이 오면 받침 소리가 뒤로 넘어가요. 앞 글자에 받침을 꼭 써요.' },
    '된소리': { name: '소리가 세지는 말', hint: '세게 소리 나도 글자는 원래대로 써요. ㄲ ㄸ ㅃ ㅆ ㅉ로 쓰지 않을 때가 많아요.' },
    '소리바뀜': { name: '소리가 바뀌는 말', hint: '소리가 바뀌어 들려도 낱말의 원래 모양대로 써요.' },
    '모음': { name: '모음', hint: '모음을 잘 들어봐요. 입 모양을 생각하며 천천히 따라 말해 봐요.' },
    '기타': { name: '글자', hint: '한 글자씩 천천히 들으며 써 봐요. 🐢 버튼으로 천천히 들을 수 있어요.' },
    '띄어쓰기': { name: '띄어쓰기', hint: '낱말과 낱말 사이는 띄어 써요. 은·는·이·가·을·를은 앞말에 붙여 써요.' },
    '문장부호': { name: '문장부호', hint: '문장 끝에 . ? ! 를 알맞게 써요. 묻는 말은 ?, 놀란 말은 !' },
  },

  // 로봇 친구가 하는 말
  lines: {
    praise: ['잘했어!', '정답!', '멋져!', '바로 그거야!', '최고야!', '완벽해!', '와, 대단해!', '맞았어!'],
    retry: '다시 들어볼까?',
  },

  // 함께하는 친구들 (앱 속 캐릭터)
  friends: {
    eunhoo: { name: '은후', color: '#ffb74d', role: '같이 문제 푸는 친구' },
    chorok: { name: '초록', color: '#66bb6a', role: '친척동생' },
    hyun: { name: '현', color: '#64b5f6', role: '윤이가 가르쳐주는 동생' },
  },
};
