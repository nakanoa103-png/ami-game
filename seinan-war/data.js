'use strict';
// 西南戦争 1877 — マップと初期データ
// def: 防御側の地形補正 / port: 港 / ky: 九州 / home: 開戦時に西郷軍の地盤 / fort: 城（籠城可）

const NODES = {
  kagoshima:   { name: '鹿児島', x: 330, y: 632, def: 1.3, port: 1, ky: 1, home: 1 },
  kajiki:      { name: '加治木', x: 375, y: 582, ky: 1, home: 1 },
  miyakonojo:  { name: '都城',   x: 445, y: 602, ky: 1, home: 1 },
  miyazaki:    { name: '宮崎',   x: 498, y: 548, port: 1, ky: 1 },
  okuchi:      { name: '大口',   x: 320, y: 522, ky: 1, home: 1 },
  minamata:    { name: '水俣',   x: 262, y: 492, ky: 1 },
  hitoyoshi:   { name: '人吉',   x: 365, y: 468, def: 1.3, ky: 1 },
  yatsushiro:  { name: '八代',   x: 282, y: 432, port: 1, ky: 1 },
  kawashiri:   { name: '川尻',   x: 288, y: 384, ky: 1 },
  kumamoto:    { name: '熊本',   x: 305, y: 336, fort: 1, ky: 1 },
  tabaruzaka:  { name: '田原坂', x: 296, y: 286, def: 1.6, ky: 1 },
  takase:      { name: '高瀬',   x: 238, y: 296, ky: 1 },
  yamaga:      { name: '山鹿',   x: 345, y: 252, ky: 1 },
  otsu:        { name: '大津',   x: 370, y: 330, def: 1.2, ky: 1 },
  nankan:      { name: '南関',   x: 272, y: 236, ky: 1 },
  kurume:      { name: '久留米', x: 288, y: 188, ky: 1 },
  saga:        { name: '佐賀',   x: 212, y: 204, ky: 1 },
  nagasaki:    { name: '長崎',   x: 125, y: 290, port: 1, ky: 1 },
  fukuoka:     { name: '福岡',   x: 258, y: 130, port: 1, ky: 1 },
  kokura:      { name: '小倉',   x: 352, y: 104, port: 1, ky: 1 },
  nakatsu:     { name: '中津',   x: 415, y: 148, ky: 1 },
  oita:        { name: '大分',   x: 474, y: 218, port: 1, ky: 1 },
  taketa:      { name: '竹田',   x: 430, y: 302, def: 1.2, ky: 1 },
  nobeoka:     { name: '延岡',   x: 514, y: 408, port: 1, ky: 1 },
  shimonoseki: { name: '下関',   x: 366, y: 46, port: 1 },
  hiroshima:   { name: '広島',   x: 520, y: 66, port: 1 },
  okayama:     { name: '岡山',   x: 650, y: 82 },
  osaka:       { name: '大阪',   x: 780, y: 108, def: 1.3, port: 1 },
  nagoya:      { name: '名古屋', x: 870, y: 84 },
  tokyo:       { name: '東京',   x: 955, y: 58, def: 1.3, port: 1 },
  matsuyama:   { name: '松山',   x: 568, y: 196, port: 1 },
  kochi:       { name: '高知',   x: 652, y: 252, port: 1 },
};

const EDGES = [
  ['kagoshima', 'minamata'], ['kagoshima', 'kajiki'], ['kajiki', 'okuchi'], ['kajiki', 'miyakonojo'], ['kajiki', 'hitoyoshi'],
  ['miyakonojo', 'miyazaki'], ['miyazaki', 'nobeoka'], ['okuchi', 'minamata'], ['okuchi', 'hitoyoshi'],
  ['minamata', 'yatsushiro'], ['hitoyoshi', 'yatsushiro'], ['yatsushiro', 'kawashiri'],
  ['kawashiri', 'kumamoto'], ['kumamoto', 'tabaruzaka'], ['kumamoto', 'otsu'],
  ['tabaruzaka', 'takase'], ['tabaruzaka', 'yamaga'], ['takase', 'nankan'], ['yamaga', 'nankan'],
  ['nankan', 'kurume'], ['kurume', 'saga'], ['kurume', 'fukuoka'], ['saga', 'nagasaki'], ['saga', 'fukuoka'],
  ['fukuoka', 'kokura'], ['kokura', 'nakatsu'], ['nakatsu', 'oita'], ['oita', 'taketa'], ['oita', 'nobeoka'],
  ['taketa', 'otsu'], ['taketa', 'nobeoka'],
  ['kokura', 'shimonoseki'], ['shimonoseki', 'hiroshima'], ['hiroshima', 'okayama'], ['okayama', 'osaka'],
  ['osaka', 'nagoya'], ['nagoya', 'tokyo'], ['matsuyama', 'kochi'],
];

// 海路。ships: 蒸気船が必要 / risk: 政府海軍に捕捉される確率 / c: 描画用の制御点
const SEA = [
  { a: 'kagoshima', b: 'nagasaki', ships: 0, risk: 0.30, c: [110, 540] },
  { a: 'nagasaki', b: 'shimonoseki', ships: 1, risk: 0.25, c: [120, 40] },
  { a: 'kagoshima', b: 'kochi', ships: 1, risk: 0.30, c: [580, 600] },
  { a: 'kagoshima', b: 'osaka', ships: 1, risk: 0.35, c: [760, 560] },
  { a: 'kochi', b: 'osaka', ships: 0, risk: 0.20, c: [770, 250] },
  { a: 'osaka', b: 'tokyo', ships: 1, risk: 0.25, c: [910, 230] },
  { a: 'oita', b: 'matsuyama', ships: 0, risk: 0.15, c: [520, 190] },
  { a: 'matsuyama', b: 'hiroshima', ships: 0, risk: 0.15, c: [540, 130] },
];
const SEA_CAPACITY = 5000; // 1ターンに海上輸送できる兵数
const SHIP_CHANCE_FIRST = 0.6; // 長崎を初めて2,000以上で取ったとき、その場で蒸気船を奪える確率
const SHIP_CHANCE_TURN = 0.3;  // その後、長崎を支配している間、毎ターン始めに奪える確率
const SEA_CATCH_LOSS = 1000; // 政府海軍に捕捉されたときに失う兵数（船団の大きさによらず一定。ただし船上の半数まで）

// 兵の質
const Q = {
  elite:  { v: 1.65, label: '精鋭' },
  ally:   { v: 1.2, label: '党薩' },
  gentry: { v: 1.0, label: '郷士' },
  levy:   { v: 0.8, label: '徴募' },
  line:   { v: 1.0, label: '鎮台' },
  guard:  { v: 1.25, label: '近衛・警視' },
};

// 西郷軍が初めて占領したときに下がる政府威信
const PRESTIGE = {
  kumamoto: 15, fukuoka: 5, kokura: 4, nagasaki: 6, saga: 2, kurume: 2, oita: 3,
  shimonoseki: 5, hiroshima: 6, okayama: 4, osaka: 20, nagoya: 8, tokyo: 100,
  matsuyama: 2, kochi: 3,
};

// 政府軍の増援 [兵数, 名称, 質]
const SCHEDULE = {
  1: [4000, '第一・第二旅団', 'line'],
  2: [3000, '第三旅団', 'line'],
  3: [4000, '第四旅団', 'line'],
  4: [3000, '警視隊（抜刀隊）', 'guard'],
  5: [4000, '別働第三旅団', 'line'],
  6: [4000, '別働第四旅団', 'line'],
  7: [3000, '補充第一陣', 'line'], 8: [3000, '補充第二陣', 'line'], 9: [3000, '補充第三陣', 'line'],
  10: [3000, '新撰旅団', 'guard'], 11: [3000, '補充第四陣', 'line'], 12: [3000, '補充第五陣', 'line'],
  13: [3000, '補充第六陣', 'line'], 14: [3000, '補充第七陣', 'line'],
};

const MAX_TURN = 23;       // 明治10年2月中旬〜9月下旬
const SIEGE_MEN = 3000;    // 熊本城の包囲に必要な兵数（熊本そのものに置く）
const RELIEF_RATIO = 0.9;  // 包囲中、九州の政府軍はこの戦力比でも救援に攻めかかる
const RELIEF_DESPERATE = 0.6; // 城の糧食が残り2以下になると、ここまで無理をして攻める
const ITAGAKI_CHANCE = 0.6;  // 西郷が四国に入ったとき、板垣退助が挙兵に応じる確率
const ENVOY_CHANCE_IF_JOINED = 0.5; // 久光擁立後に勅使柳原が鹿児島へ来る確率（来れば追い返して威信 −3）
// レアイベント：東北士族の挙兵（第6ターン以降、政府威信50以下で毎ターンこの確率。大阪陥落後は +10%）
const TOHOKU_CHANCE = 0.01;
const TOHOKU_MEN = 4000;
const CHOSHU_RECALL = 4000; // 長州動揺：西郷が下関に入ったとき、九州から本州へ引き返す政府軍の兵数
// レアイベント：慶喜の書状（大阪陥落後、政府威信がこれ以下のとき毎ターンこの確率で一度だけ）
const KEIKI_LINE = 30;
const KEIKI_CHANCE = 0.25;
const BLOCK_HOLD = 0.6;     // 政府軍の別働隊は、西郷の本隊の（この割合）以上の強さを割けるときだけ退路を塞ぎに出る
const IDLE_RECOVERY = 1;   // 西郷軍が勝利も占領もしなかったターンの後、政府威信が戻る量
const OKUBO_LINE = 40;     // 政府威信がこれ以下になると、大久保から復権の申し入れが来る
const PEACE_LINE = 35;     // 和議ライン。最終ターン終了時、政府威信がこれ以下なら和議（西郷軍の勝ち）
const PEACE_TURNS = 5;     // 政府威信をこのターン数続けて和議ライン以下に保てば、その時点で和議
const OCCUPY_MEN = 2000;   // 占領として数える（威信が動く）のに必要な兵数
const START = { prestige: 75, morale: 80, ammo: 60, food: 5 };
