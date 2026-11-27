'use strict';
// 西南戦争 1877 — ゲーム本体（西郷軍＝プレイヤー、政府軍＝AI）

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIDE = { s: '西郷軍', g: '政府軍' };

const ADJ = {};
for (const id in NODES) ADJ[id] = [];
EDGES.forEach(([a, b]) => { ADJ[a].push(b); ADJ[b].push(a); });

let S;                 // ゲーム状態
let sel = null;        // 選択中の拠点
let checked = new Set(); // 選択中の部隊ID
let target = null;     // 進軍先として地図で選んだ拠点（確定前）

// ───────── 基本操作 ─────────
const at = (loc, side) => S.units.filter((u) => u.loc === loc && u.side === side);
const field = (loc, side) => at(loc, side).filter((u) => !u.inFort);
const garrison = (loc) => at(loc, 'g').filter((u) => u.inFort);
const men = (units) => units.reduce((s, u) => s + u.men, 0);
const alive = (units) => units.filter((u) => S.units.includes(u));
const nm = (id) => NODES[id].name;

function addUnit(side, name, n, k, loc, extra = {}) {
  const u = { id: S.nextId++, side, name, men: n, k, loc, mp: 0, ...extra };
  S.units.push(u);
  return u;
}
function log(msg, cls = '') { S.log.push({ t: S.turn, msg, cls }); }

function dateStr(t) {
  const i = 4 + t - 1;
  return `明治10年${Math.floor(i / 3) + 1}月${['上旬', '中旬', '下旬'][i % 3]}`;
}

function distFrom(src) {
  const d = {}, q = [];
  [].concat(src).forEach((s) => { d[s] = 0; q.push(s); });
  while (q.length) {
    const c = q.shift();
    for (const n of ADJ[c]) if (d[n] === undefined) { d[n] = d[c] + 1; q.push(n); }
  }
  return d;
}

function gameOver(winner, title, text) {
  // 慶喜の書状が出た試合で政府を倒せば、勝が西郷と慶喜を引き合わせる
  if (winner === 's' && S.flags.keiki && (title === '政府瓦解' || title === '東京入城')) {
    title = '三人の会談';
    text = '勝海舟は、二人を同じ部屋に通した。<br>'
      + '十年前、江戸を攻める側にいた西郷と、戦わずに江戸を明け渡した慶喜である。</p>'
      + '<p>「さて、この国をどうしやしょう」と勝が言った。<br>'
      + '敵も味方もなかった。三人の前には、まだ誰も見たことのない国があった。';
  }
  if (!S.over) S.over = { winner, title, text };
}
function addPrestige(d) {
  S.prestige = clamp(S.prestige + d, 0, 100);
  if (S.prestige <= 0) {
    gameOver('s', '政府瓦解', '相次ぐ敗報と各地の蜂起に、大久保利通は職を辞した。<br>'
      + '混乱する東京で、西郷を迎えに出たのは勝海舟だった。十年前、江戸の町を戦火から守った二人である。</p>'
      + '<p>西郷は、板垣退助や副島種臣ら、かつて袂を分かった者たちを政府に呼び戻した。<br>'
      + '特権は戻らなかった。だが、士族には警察や軍の士官、学校の教壇、北海道の開拓地と、新しい持ち場が用意された。<br>'
      + '国会を開く約束も前倒しされた。</p>'
      + '<p>新しい政府の歩みは平坦ではないだろう。<br>'
      + 'それでも、刀を置いた者たちにも居場所のある国が、ここから始まる。');
  }
}
const addMorale = (d) => { S.morale = clamp(S.morale + d, 10, 100); };
const addAmmo = (d) => { S.ammo = clamp(S.ammo + d, 0, 100); };

// ───────── 戦力計算 ─────────
function strength(units) {
  if (!units.length) return 0;
  let v = units.reduce((s, u) => s + u.men * Q[u.k].v, 0);
  if (units[0].side === 's') {
    v *= 0.75 + 0.35 * S.morale / 100; // 士気
    v *= 0.6 + 0.4 * S.ammo / 100;     // 弾薬
    const lead = S.units.find((u) => u.leader);
    if (lead && (units.includes(lead) || lead.loc === units[0].loc)) v *= 1.1; // 西郷の本営
  }
  return v;
}
const fortMult = () => 3 + 0.7 * S.food;
// 落城後の熊本城：石垣と堀は残る。保持している側が野戦で守るときの補正
const FALLEN_FORT_DEF = 1.5;   // 天守は開戦直前に焼け落ちている。石垣と堀だけなので田原坂（×1.6）よりわずかに劣る
const defOf = (loc) => (NODES[loc].fort && S.fortFallen ? FALLEN_FORT_DEF : (NODES[loc].def || 1));

// 補給線：鹿児島から西郷の本営まで、自軍の支配地（包囲中の熊本を含む）が陸続きか
function supplied() {
  const lead = S.units.find((u) => u.leader);
  if (!lead || S.owner.kagoshima !== 's') return false;
  const pass = (n) => S.owner[n] === 's' || n === lead.loc
    || (garrison(n).length && men(field(n, 's')) >= SIEGE_MEN);
  const seen = new Set(['kagoshima']), q = ['kagoshima'];
  while (q.length) {
    const c = q.shift();
    if (c === lead.loc) return true;
    for (const n of ADJ[c]) if (!seen.has(n) && pass(n)) { seen.add(n); q.push(n); }
  }
  return false;
}

function applyLoss(units, f) {
  let lost = 0;
  for (const u of units) {
    if (u.leader) continue;
    const l = Math.round(u.men * f);
    u.men -= l; lost += l;
  }
  return lost;
}
function cleanup() {
  S.units = S.units.filter((u) => u.leader || u.men >= 100);
  if (!S.units.some((u) => u.leader)) {
    gameOver('g', '西郷隆盛、戦死', '「晋どん、もうここらでよか」。西郷を失った軍は四散し、最後の士族反乱は終わった。');
  }
}

// ───────── 占領 ─────────
// force: 攻め込んだ（入った）時点の兵数。戦闘の損害で2,000を割っても占領として数える
function occupy(loc, side, force = 0) {
  if (side === 's') {
    if (at(loc, 'g').length) return;
    S.owner[loc] = 's';
    if (!S.captured[loc] && PRESTIGE[loc] && Math.max(force, men(at(loc, 's'))) >= OCCUPY_MEN) {
      S.captured[loc] = true;
      log(`西郷軍が${nm(loc)}を占領。政府威信 −${PRESTIGE[loc]}`, 'win');
      if (loc === 'tokyo') {
        S.prestige = 0;
        gameOver('s', '東京入城', '西郷軍は東京に入った。<br>'
          + '十年前と同じく、勝海舟が城の門を開き、町は一軒も焼かれなかった。<br>'
          + '大久保は静かに職を退き、西郷はその手を取って「おはんの作った国じゃ」と言ったという。</p>'
          + '<p>維新は、もう一度やり直される。<br>'
          + '今度こそ、敵味方なく、皆で。');
        return;
      }
      addPrestige(-PRESTIGE[loc]);
      S.sActive = true;
      if (loc === 'nagasaki') {
        addAmmo(15);
        if (Math.random() < SHIP_CHANCE_FIRST) { S.ships = true; log('長崎港で蒸気船の奪取に成功。遠洋の海路が使えるようになった。', 'ev'); }
        else log('長崎港の蒸気船は港外へ退避していた。次のターン以降に再度機会をうかがう。', 'ev');
      }
      if (loc === 'osaka') { addAmmo(40); log('大阪砲兵工廠を押さえ、弾薬を大量に確保。', 'ev'); }
    }
  } else {
    if (at(loc, 's').length) return;
    const was = S.owner[loc];
    S.owner[loc] = 'g';
    if (loc === 'kagoshima' && was === 's') {
      addMorale(-10); addPrestige(5);
      log('政府軍が鹿児島を占領。弾薬の製造と補給が断たれた。士気 −10', 'lose');
    }
  }
}

// ───────── 戦闘 ─────────
// att が loc に攻め込む。o.assault: 城への強襲 / o.amph: 上陸戦
function battle(attSide, att, loc, o = {}) {
  const defSide = attSide === 's' ? 'g' : 's';
  const def = o.assault ? garrison(loc) : field(loc, defSide);
  const menA = men(att), menD = men(def);
  const nogiIn = [...att, ...def].some((u) => u.nogi);
  let A = strength(att) * rnd(0.85, 1.15) * (o.amph ? 0.8 : 1);
  let D = strength(def) * rnd(0.85, 1.15) * (o.assault ? fortMult() : defOf(loc));
  if (!o.assault && NODES[loc].fort) {   // 城兵の加勢
    const sup = 0.5 * strength(garrison(loc));
    if (attSide === 'g') A += sup; else D += sup;
  }
  const r = A / Math.max(D, 1);
  const win = r >= 1;
  const lostA = applyLoss(att, clamp(0.14 * Math.pow(1 / r, 0.9), 0.03, 0.45) + (win ? 0 : 0.08));
  const lostD = applyLoss(def, clamp(0.14 * Math.pow(r, 0.9), 0.03, 0.45) + (win ? 0.08 : 0));

  const sMen = attSide === 's' ? menA : menD;
  addAmmo(-(attSide === 's' ? 6 : 4) * (sMen >= 2000 ? 1 : 0.5));
  const big = Math.min(menA, menD) >= 2000;
  const sWin = (attSide === 's') === win;
  if (sWin) S.sActive = true;
  if (sWin) { addMorale(2); } else { addMorale(-5); }

  const title = o.assault ? `${nm(loc)}城強襲` : `${nm(loc)}の戦い`;
  const lossS = attSide === 's' ? lostA : lostD, lossG = attSide === 's' ? lostD : lostA;
  const flagTaken = sWin && nogiIn && !S.flags.nogiFlag;
  log(`【${title}】${SIDE[attSide]} ${fmt(menA)} が ${SIDE[defSide]} ${fmt(menD)} を攻撃 → ${SIDE[sWin ? 's' : 'g']}の勝利（損害 西郷軍 ${fmt(lossS)}／政府軍 ${fmt(lossG)}）`, sWin ? 'win' : 'lose');
  if (flagTaken) {
    // 史実：明治10年2月22日、植木の戦い。乃木はこの屈辱を負い目とし、明治天皇の崩御に殉じた
    S.flags.nogiFlag = 1;
    addMorale(5); addPrestige(-2);
    log('乃木希典の歩兵第十四連隊が連隊旗を奪われた。乃木はこの屈辱を、生涯忘れなかった。士気 +5、政府威信 −2', 'ev');
  }
  // 大久保の申し入れを断った後は、政府も後がなく、勝敗が威信を大きく動かす
  if (S.flags.okuboRefused) addPrestige(sWin ? (big ? -3 : -1) : (big ? 2 : 1));
  else addPrestige(sWin ? (big ? -2 : -1) : (big ? 1 : 0));

  if (win) {
    if (o.assault) fallFort(loc);
    else retreat(def, loc, defSide);
  }
  cleanup();
  return win;
}

function retreat(units, loc, side) {
  units = units.filter((u) => u.leader || u.men >= 100);
  if (!units.length) return;
  const enemy = side === 's' ? 'g' : 's';
  const base = distFrom(side === 's' ? 'kagoshima' : (NODES[loc].ky ? 'fukuoka' : 'tokyo'));
  const score = (n) => (S.owner[n] === side ? 0 : 5) + (base[n] ?? 50);
  const c = ADJ[loc].filter((n) => !at(n, enemy).length).sort((a, b) => score(a) - score(b));
  if (!c.length) {
    // 塞いでいる敵が薄ければ、まず陸で押し破る。厳しければ船を探し、それも無ければ死に物狂いで突破を図る
    const way = breakoutRoute(units, loc, enemy);
    if (way && way.A >= 1.3 * way.D && breakout(units, loc, side, enemy, way)) return;
    if (seaRetreat(units, loc, side, enemy, score)) return;
    if (way && !(way.A >= 1.3 * way.D) && breakout(units, loc, side, enemy, way)) return;
    log(`${nm(loc)}の${SIDE[side]} ${fmt(men(units))} は退路を断たれ、壊滅した。`, side === 's' ? 'lose' : 'win');
    S.units = S.units.filter((u) => !units.includes(u));
    return;
  }
  units.forEach((u) => { u.loc = c[0]; u.mp = 0; });
  log(`${SIDE[side]}は${nm(c[0])}へ退却。`);
  occupy(c[0], side);
}

// 退路を塞ぐ敵のうち、最も薄い所。敗走中なので突破する側の戦力は7割
const BREAKOUT_POWER = 0.7;
function breakoutRoute(units, loc, enemy) {
  const A = strength(units) * BREAKOUT_POWER;
  if (!A) return null;
  const ways = ADJ[loc].map((n) => ({ n, D: strength(at(n, enemy)) * defOf(n) }))
    .sort((a, b) => a.D - b.D);
  return ways.length ? { ...ways[0], A } : null;
}

function breakout(units, loc, side, enemy, way) {
  const block = at(way.n, enemy);
  const ok = way.A * rnd(0.85, 1.15) > way.D * rnd(0.85, 1.15);
  if (!ok) {
    log(`${nm(loc)}の${SIDE[side]}は${nm(way.n)}の${SIDE[enemy]} ${fmt(men(block))} の囲みを破れなかった。`, side === 's' ? 'lose' : 'win');
    return false;
  }
  const blockMen = men(block);
  const lostB = applyLoss(block, 0.2);
  const lostU = applyLoss(units, 0.1);
  log(`${nm(loc)}の${SIDE[side]}は、退路を塞ぐ${SIDE[enemy]} ${fmt(blockMen)} を${nm(way.n)}で突破した（損害 ${fmt(lostU)}／${fmt(lostB)}）。`, side === 's' ? 'win' : 'lose');
  units.forEach((u) => { u.loc = way.n; u.mp = 0; });
  const rest = block.filter((u) => u.leader || u.men >= 100);
  rest.forEach((u) => { u.inFort = false; });
  retreat(rest, way.n, enemy);
  S.units = S.units.filter((u) => !(u.loc === way.n && u.side === enemy));  // 退けなかった者は消える
  occupy(way.n, side);
  return true;
}

// 政府海軍に捕捉されたときの損害。大船団でも小船団でも失うのは一定数（ただし半数まで）
function catchLoss(units) {
  const n = men(units.filter((u) => !u.leader));
  if (!n) return 0;
  return applyLoss(units, Math.min(SEA_CATCH_LOSS, n * 0.5) / n);
}

// 陸の退路がないとき、港から自軍の港へ船で逃れる。運べるのは SEA_CAPACITY まで
function seaRetreat(units, loc, side, enemy, score) {
  if (!NODES[loc].port) return false;
  const lanes = SEA.filter((l) => (l.a === loc || l.b === loc)
    && (side === 'g' || !l.ships || S.ships))
    .map((l) => ({ l, to: l.a === loc ? l.b : l.a }))
    // 敵のいない港ならどこでも落ち延びられる。自軍支配の港を優先し、次に捕捉の危険が低い航路
    .filter((x) => !at(x.to, enemy).length)
    .sort((a, b) => (S.owner[a.to] === side ? 0 : 1) - (S.owner[b.to] === side ? 0 : 1)
      || a.l.risk - b.l.risk || score(a.to) - score(b.to));
  if (!lanes.length) return false;
  const { l, to } = lanes[0];
  // 西郷の本営が最優先、あとは質の高い部隊から乗せる
  const order = [...units].sort((a, b) => (b.leader ? 1 : 0) - (a.leader ? 1 : 0) || Q[b.k].v - Q[a.k].v || b.men - a.men);
  const before = men(units);
  let room = SEA_CAPACITY;
  const aboard = [];
  for (const u of order) {
    if (room <= 0) break;
    if (u.men > room) u.men = room;   // 乗り切れない兵は取り残される
    room -= u.men;
    aboard.push(u);
  }
  const left = units.filter((u) => !aboard.includes(u));
  S.units = S.units.filter((u) => !left.includes(u));
  aboard.forEach((u) => { u.loc = to; u.mp = 0; });
  // 落ち延びた先は支配下に入れるが、占領の手柄（威信の低下）にはしない
  S.owner[to] = side;
  const lostLeft = before - men(aboard);
  let msg = `${nm(loc)}の${SIDE[side]}は退路を断たれ、${fmt(men(aboard))} が船で${nm(to)}へ逃れた。`;
  if (lostLeft > 0) msg += `乗り切れなかった ${fmt(lostLeft)} は討たれた。`;
  if (side === 's' && Math.random() < l.risk) {
    const lost = catchLoss(aboard);
    msg += `途中で政府海軍に捕捉され、${fmt(lost)} を失った。`;
  }
  log(msg, side === 's' ? 'lose' : 'win');
  return true;
}

function fallFort(loc) {
  S.units = S.units.filter((u) => !(u.loc === loc && u.inFort));
  S.fortFallen = true;
  log('熊本城、陥落。鎮台の武器弾薬を接収した。士気 +10', 'win');
  addAmmo(30); addMorale(10);
  occupy(loc, 's');
}

// ───────── プレイヤーの行動 ─────────
function selectedUnits() {
  return at(sel, 's').filter((u) => checked.has(u.id));
}

// 選択中の部隊が行ける先の一覧
function destinations() {
  const units = selectedUnits();
  if (!units.length || S.over) return [];
  const out = [];
  const n = men(units);
  const odds = (to, amph) => {
    const en = field(to, 'g');
    if (!en.length) return null;
    let D = strength(en) * defOf(to);
    if (NODES[to].fort) D += 0.5 * strength(garrison(to));
    return { men: men(en), r: strength(units) * (amph ? 0.8 : 1) / Math.max(D, 1) };
  };
  if (units.every((u) => u.mp > 0)) {
    for (const to of ADJ[sel]) out.push({ to, type: 'land', ok: true, odds: odds(to, false) });
    for (const l of SEA) {
      if (l.a !== sel && l.b !== sel) continue;
      const to = l.a === sel ? l.b : l.a;
      let why = '';
      if (l.ships && !S.ships) why = '蒸気船が必要';
      else if (n > SEA_CAPACITY - S.seaUsed) why = `輸送力不足（残り ${fmt(SEA_CAPACITY - S.seaUsed)}）`;
      out.push({ to, type: 'sea', lane: l, ok: !why, why, odds: odds(to, true) });
    }
  }
  return out;
}

function doMove(to, type) {
  if (S.over) return;
  const d = destinations().find((x) => x.to === to && x.type === type);
  if (!d || !d.ok) return;
  let units = selectedUnits();
  const from = sel;
  const sea = type === 'sea';
  S.sActive = true;   // 進軍中は「動きがない」旬ではない
  let force = 0;
  if (sea) {
    S.seaUsed += men(units);
    if (Math.random() < d.lane.risk) {
      const lost = catchLoss(units);
      units.forEach((u) => { u.mp = 0; });
      log(`${nm(from)}を出た船団が政府海軍に捕捉された。${fmt(lost)} を失い、残りは${nm(from)}へ引き返した。`, 'lose');
      addMorale(-4);
      cleanup(); afterAction(from, []); return;
    }
    log(`${fmt(men(units))} が海路${nm(to)}へ向かった。`);
  }
  force = men(units);
  let moved = true;
  if (field(to, 'g').length) {
    moved = battle('s', units, to, { amph: sea });
    units = alive(units);
    units.forEach((u) => { u.mp = 0; });
    if (moved) units.forEach((u) => { u.loc = to; });
    else if (sea) log(`上陸に失敗し、${nm(from)}へ引き返した。`);
  } else {
    const stop = sea || garrison(to).length > 0;
    units.forEach((u) => { u.loc = to; u.mp = stop ? 0 : u.mp - 1; });
  }
  if (moved) occupy(to, 's', force);
  afterAction(moved ? to : from, units.filter((u) => u.mp > 0));
}

function doAssault() {
  if (S.over || sel !== 'kumamoto' || !garrison(sel).length) return;
  const units = selectedUnits().filter((u) => u.mp > 0);
  if (!units.length) return;
  battle('s', units, sel, { assault: true });
  alive(units).forEach((u) => { u.mp = 0; });
  afterAction(sel, []);
}

function doRecruit() {
  if (S.over || S.recruited || S.recruits >= 5 || S.owner.kagoshima !== 's') return;
  S.recruited = true; S.recruits++;
  addUnit('s', `徴募隊 第${S.recruits}`, 1500, 'levy', 'kagoshima');
  addMorale(-2);
  log('鹿児島で 1,500 を徴募した。強引な募兵に不満も出ている。士気 −2');
  render();
}

function canHisamitsu() {
  const lead = S.units.find((u) => u.leader);
  return S.turn <= 2 && !S.flags.hisamitsu && lead && lead.loc === 'kagoshima';
}
function doHisamitsu() {
  if (S.over || !canHisamitsu()) return;
  S.flags.hisamitsu = true;
  if (Math.random() < 0.25) {
    S.flags.hisamitsuJoined = true;
    addUnit('s', '旧藩郷士隊（久光の檄）', 5000, 'gentry', 'kagoshima');
    log('島津久光が挙兵を黙認し、檄を飛ばした。私学校と距離を置いていた郷士 5,000 が加わる。政府威信 −5', 'ev');
    addPrestige(-5);
  } else {
    log('久光は「西郷の私戦に島津家は与せず」と一蹴した。もとより望み薄で、陣中に動揺はない。', 'ev');
  }
  render();
}

function afterAction(loc, keep) {
  sel = loc; target = null;
  checked = new Set(keep.map((u) => u.id));
  render();
}

function selectNode(id) {
  sel = id; target = null;
  checked = new Set(at(id, 's').filter((u) => u.mp > 0).map((u) => u.id));
  render();
}

// ───────── ターン進行 ─────────
function endTurn() {
  if (S.over) return;
  const logFrom = S.log.length;
  // 熊本城の包囲
  if (!S.fortFallen) {
    if (men(field('kumamoto', 's')) >= SIEGE_MEN) {
      S.food--;
      S.sActive = true;   // 熊本城を締め上げているのは立派な戦果（世論は政府に戻らない）
      if (S.food <= 0) { log('熊本城は糧食が尽き、開城した。', 'win'); fallFort('kumamoto'); }
      else log(`熊本城を包囲中。城内の糧食は残り ${S.food} ターン分。`);
    }
  }
  if (!S.over) govTurn();
  if (!S.over) {
    S.turn++;
    if (S.turn > MAX_TURN) {
      if (S.prestige <= PEACE_LINE) gameOver('s', '和議成立', PEACE_TEXT);
      else gameOver('g', '時間切れ', '半年を超える戦いで弾薬も兵も尽きた。政府は持ちこたえ、挙兵は鎮圧された。捕らえられた西郷には、賊徒の首魁として極刑が待っている。');
    } else startTurn();
  }
  selectNode(sel);   // 新しいターン：動ける部隊を選び直す
  if (!S.over && $('#overlay').hidden) showNews(logFrom);
}

// ターン終了後の出来事をポップアップで見せる
// 進軍先をポップアップで選ぶ（地図とのスクロールの往復を減らす）
function showDests() {
  const dests = destinations();
  if (!dests.length) return;
  let h = `<h2>${nm(sel)}から進軍</h2><p class="hint">選択中 ${fmt(men(selectedUnits()))}。方角は${nm(sel)}から見たものです。</p><div class="dests">`;
  h += dests.map(destButton).join('');
  h += '</div><div class="row"><button type="button" data-act="close">閉じる</button></div>';
  showDialog(h);
}

let lastNewsFrom = 0;
function showNews(from) {
  lastNewsFrom = from;
  const items = S.log.slice(from);
  if (!items.length) return;
  let h = `<h2>${dateStr(Math.min(S.turn, MAX_TURN))}</h2><div class="situation">`;
  let lt = null;
  for (const e of items) {
    if (e.t !== lt) { h += `<h3>${dateStr(Math.min(e.t, MAX_TURN))}</h3>`; lt = e.t; }
    h += `<p class="${e.cls}">${e.msg}</p>`;
  }
  h += '</div><div class="row"><button type="button" class="primary" data-act="close">閉じる</button></div>';
  showDialog(h);
}

const PEACE_TEXT = '戦は決着しなかった。疲れ果てた両軍の間に立ったのは、勝海舟だった。<br>'
  + '大久保は和議に応じた。特権は戻らなかった。だが、士族には警察や軍の士官、学校の教壇、北海道の開拓地と、新しい持ち場が用意された。<br>'
  + '政府の独断を戒めるため、国会を開く道筋も示された。</p>'
  + '<p>西郷は鹿児島へ戻り、私学校は、若者が学び、外国の言葉や技術も身につける学校に生まれ変わった。<br>'
  + 'いつか、ここから育った者たちが、この国を支えるだろう。';

function startTurn() {
  // 戦果（勝利か占領）のないまま旬が過ぎると、世論は政府に戻っていく
  if (S.turn > 1 && !S.sActive && S.prestige > 0) {
    addPrestige(IDLE_RECOVERY);
    log(`西郷軍に目立った戦果のないまま旬が過ぎた。世論は政府に傾きつつある。政府威信 +${IDLE_RECOVERY}`, 'lose');
  }
  S.sActive = false;
  S.seaUsed = 0; S.recruited = false;
  S.units.forEach((u) => { u.mp = u.side === 's' ? 2 : 0; });
  if (supplied()) addAmmo(6);
  events();
  tohokuRise();
  keikiLetter();
  if (!S.over && !S.flags.okubo && S.prestige <= OKUBO_LINE) { S.flags.okubo = 1; S.okuboPending = true; }
  // 和議の機運：威信が和議ライン以下の旬が続けば、戦費に苦しむ政府は和議に応じる
  S.peaceStreak = S.prestige <= PEACE_LINE ? (S.peaceStreak || 0) + 1 : 0;
  if (!S.over && !S.okuboPending && S.peaceStreak >= PEACE_TURNS) {
    log(`政府威信の低迷が${PEACE_TURNS}旬続き、戦費に苦しむ政府は和議に応じた。`, 'win');
    gameOver('s', '和議成立', PEACE_TEXT);
  } else if (S.peaceStreak > 0) {
    log(`政府威信が和議ライン（${PEACE_LINE}）以下。この状態が${PEACE_TURNS}旬続けば和議（${S.peaceStreak}／${PEACE_TURNS}）`, 'ev');
  }
  if (S.captured.nagasaki && S.owner.nagasaki === 's' && !S.ships && Math.random() < SHIP_CHANCE_TURN) {
    S.ships = true; log('長崎に入港した蒸気船を奪取した。遠洋の海路が使えるようになった。', 'ev');
  }
}

function events() {
  const F = S.flags;
  const here = (...ids) => ids.find((id) => at(id, 's').length > 0);
  const bonus = F.hisamitsuJoined ? 0.15 : 0;
  const rise = (name, n, loc) => { addUnit('s', name, n, 'ally', loc, { mp: 2 }); occupy(loc, 's'); };
  let p;

  if (!F.kumamototai && (p = here('kawashiri', 'kumamoto'))) {
    F.kumamototai = 1;
    rise('熊本隊（池辺吉十郎）', 1500, p); rise('協同隊（平川惟一・宮崎八郎）', 500, p);
    log(`熊本の士族が呼応。熊本隊と協同隊 計2,000 が${nm(p)}で合流した。`, 'ev');
  }
  if (!F.hyuga && S.turn >= 4 && !at('hitoyoshi', 'g').length) {
    F.hyuga = 1;
    rise('人吉隊・飫肥隊ほか日向諸隊', 2000, 'hitoyoshi');
    log('人吉・飫肥・佐土原などの士族 2,000 が人吉に集結した。', 'ev');
  }
  if (!F.nakatsu && (p = here('nakatsu', 'oita', 'taketa'))) {
    F.nakatsu = 1;
    rise('中津隊（増田宋太郎）', 600, p);
    log(`中津隊 600 が${nm(p)}で合流した。`, 'ev');
  }
  if (!F.saga && (p = here('saga', 'nagasaki'))) {
    F.saga = 1;
    rise('佐賀の残党', 600, p);
    log(`佐賀の乱の残党 600 が${nm(p)}で合流した。`, 'ev');
  }
  if (!F.fukuoka && (S.fortFallen || here('kurume', 'nankan', 'fukuoka')) && Math.random() < 0.4 + bonus) {
    F.fukuoka = 1;
    if (at('fukuoka', 'g').length) { log('福岡で士族が蜂起したが、政府軍に鎮圧された。政府威信 −1', 'ev'); addPrestige(-1); }
    else { rise('福岡党（越智彦四郎）', 800, 'fukuoka'); log('福岡で士族 800 が蜂起した。政府威信 −5', 'ev'); addPrestige(-5); }
  }
  const outside = S.units.some((u) => u.side === 's' && !NODES[u.loc].ky);
  // 西郷みずから四国に渡れば、武力蜂起に慎重だった板垣退助も動くかもしれない
  const lead = S.units.find((u) => u.leader);
  // 西郷の本営が長州の玄関口に入ると、長州出身の要人が浮き足立ち、山県有朋が九州の兵を割いて帰る
  if (!F.choshu && lead && lead.loc === 'shimonoseki') {
    F.choshu = 1;
    addPrestige(-5);
    const dest = ['hiroshima', 'okayama', 'osaka', 'tokyo'].find(govOk);
    let left = CHOSHU_RECALL, moved = 0;
    const pool = S.units.filter((u) => u.side === 'g' && NODES[u.loc] && NODES[u.loc].ky && !u.static && !u.inFort)
      .sort((a, b) => b.men - a.men);
    for (const u of pool) {
      if (left <= 0 || !dest) break;
      const n = Math.min(u.men, left);
      u.men -= n; left -= n; moved += n;
    }
    if (moved) addUnit('g', '山県有朋の帰還部隊', moved, 'line', dest, { mp: 0 });
    cleanup();
    log(moved
      ? `西郷が下関に入った。長州出身の要人は浮き足立ち、山県有朋は九州の兵 ${fmt(moved)} を割いて${nm(dest)}へ引き返した。政府威信 −5`
      : '西郷が下関に入った。長州出身の要人は浮き足立った。政府威信 −5', 'ev');
  }
  if (!F.itagaki && lead && (lead.loc === 'matsuyama' || lead.loc === 'kochi')) {
    F.itagaki = 1;
    if (Math.random() < ITAGAKI_CHANCE + bonus) {
      if (F.tosa && !at('kochi', 'g').length && S.units.some((u) => /立志社/.test(u.name))) {
        rise('板垣退助と立志社の同志', 1500, lead.loc);
        log(`西郷の来訪に、板垣退助がついに起った。立志社の先頭に立ち、同志 1,500 を率いて${nm(lead.loc)}で合流。政府威信 −8`, 'ev');
        addPrestige(-8);
      } else {
        F.tosa = 1;
        const loc = at('kochi', 'g').length ? lead.loc : 'kochi';
        rise('土佐立志社（板垣退助・林有造）', 4000, loc);
        log(`西郷の来訪に、板垣退助がついに起った。土佐立志社 4,000 が${nm(loc)}で挙兵。政府威信 −15`, 'ev');
        addPrestige(-15);
      }
    } else {
      log('板垣退助は西郷を丁重にもてなしたが、「わしは言論で政府と戦う」と兵は挙げなかった。', 'ev');
    }
  }
  if (!F.tosa && (S.fortFallen || S.prestige <= 50) && (outside || here('oita', 'kokura')) && Math.random() < 0.35 + bonus) {
    F.tosa = 1;
    if (at('kochi', 'g').length) { log('土佐立志社の挙兵計画が露見し、首謀者が捕縛された。'); }
    else { rise('土佐立志社（林有造）', 3000, 'kochi'); log('土佐立志社が挙兵。高知で 3,000 が立った。政府威信 −10', 'ev'); addPrestige(-10); }
  }
  if (!F.hagi && (p = here('shimonoseki'))) {
    F.hagi = 1;
    rise('山口の不平士族', 500, p);
    log('萩の乱の残党 500 が下関で合流した。政府威信 −3', 'ev'); addPrestige(-3);
  }
  if (!F.tohoku && S.captured.osaka) {
    F.tohoku = 1;
    log('大阪陥落の報に、荘内など東北諸県が不穏となった。政府威信 −10', 'ev'); addPrestige(-10);
  }
  if (S.turn === 3 && !F.yanagiwara) {
    F.yanagiwara = 1; F.hisamitsu = true;
    if (F.hisamitsuJoined && Math.random() >= ENVOY_CHANCE_IF_JOINED) {
      // 久光が挙兵側についたと知れており、政府は中立の念押しに来なかった
    } else if (F.hisamitsuJoined) {
      // 久光がすでに西郷についているので、中立の念押しは空振りに終わる
      addPrestige(-3);
      log('勅使柳原前光が軍艦で鹿児島に入ったが、島津久光は「島津家の進退は島津家が決める」と勅使を追い返した。旧藩の郷士が港を固め、勅使は何もできずに引き揚げた。政府威信 −3', 'ev');
    } else if (men(at('kagoshima', 's')) < 1000) {
      addAmmo(-15);
      log('勅使柳原前光が軍艦で鹿児島に入った。守備が手薄で、県令大山綱良は拘引され、火薬製造所を破壊された。弾薬 −15', 'ev');
    } else {
      log('勅使柳原前光が鹿児島に入り、島津久光・忠義は中立を表明した。守備隊がいたため、勅使はそれ以上手を出せなかった。', 'ev');
    }
  }
}

// ───────── 政府軍AI ─────────
function govOk(id) { return S.owner[id] === 'g' && !at(id, 's').length; }

function govTurn() {
  S.units.forEach((u) => { if (u.side === 'g') u.mp = 2; });
  const F = S.flags;
  const outside = S.units.some((u) => u.side === 's' && !NODES[u.loc].ky);

  // 増援
  const r = SCHEDULE[S.turn];
  if (r) {
    let order = ['fukuoka', 'kokura', 'shimonoseki', 'osaka', 'tokyo'];
    if (outside) order = ['osaka', 'tokyo', 'fukuoka'];
    if (S.tohoku) order = ['tokyo', ...order.filter((x) => x !== 'tokyo')];   // 東北士族に備える
    const loc = order.find(govOk);
    if (loc) { addUnit('g', r[1], r[0], r[2], loc, { mp: 2 }); log(`政府軍の増援 ${r[1]} ${fmt(r[0])} が${nm(loc)}に到着。`); }
  }
  if (S.tohoku) tohokuAttack();
  if (S.over) return;

  // 衝背軍の上陸（八代）
  if (S.turn >= 4 && !F.shohai && (F.shohaiWait || 0) <= S.turn
      && ['kumamoto', 'kawashiri', 'tabaruzaka', 'takase', 'yamaga', 'otsu'].some((id) => field(id, 's').length)) {
    if (landing('別働第二旅団（黒田清隆）', 4000, 'line', 'yatsushiro')) F.shohai = 1; else F.shohaiWait = S.turn + 2;
  }
  // 鹿児島上陸
  if (!S.over && S.turn >= 6 && S.owner.kagoshima === 's' && (F.kagoWait || 0) <= S.turn
      && strength(at('kagoshima', 's')) * NODES.kagoshima.def < 5000 * 0.8) {
    if (!landing('別働第一旅団（川村純義）', 5000, 'line', 'kagoshima')) F.kagoWait = S.turn + 2;
  }

  if (!S.over) shikokuLanding();
  if (!S.over) encircle();

  // 進軍：前線に近い集団から動かす
  const targets = govTargets('fukuoka');
  if (!targets.length) return;
  const d = distFrom(targets);
  const locs = [...new Set(S.units.filter((u) => u.side === 'g' && !u.static && !u.inFort).map((u) => u.loc))]
    .sort((a, b) => (d[a] ?? 99) - (d[b] ?? 99));
  for (const loc of locs) { if (S.over) return; moveGroup(loc); }
}

// ───────── レアイベント：慶喜の書状 ─────────
// 水戸の家に育った慶喜は朝廷に弓を引かない。挙兵ではなく、西郷の上京は反逆ではないと公にする
function keikiLetter() {
  const F = S.flags;
  if (S.over || F.keiki || !S.captured.osaka || S.prestige > KEIKI_LINE) return;
  if (Math.random() >= KEIKI_CHANCE) return;
  F.keiki = 1;
  let left = 0;
  for (const u of S.units.filter((x) => x.side === 'g')) {
    const n = Math.round(u.men * (/警視|新撰/.test(u.name) ? 0.2 : 0.05));   // 旧幕臣・旧佐幕藩の出身者が多い部隊ほど抜ける
    u.men -= n; left += n;
  }
  cleanup();
  addPrestige(-5);
  log('静岡の徳川慶喜が、勝海舟を通じて書状を公にした。「西郷には朝廷に背く心はあるまい。これ以上、臣下同士が血を流すことを憂う」', 'ev');
  log(`「賊軍」の名分が揺らぎ、政府軍から ${fmt(left)} が戦場を離れた。政府威信 −5`, 'ev');
}

// ───────── レアイベント：東北士族の挙兵（NPC。操作はできない） ─────────
function tohokuRise() {
  const F = S.flags;
  if (S.over || F.tohokuRise || S.turn < 6 || S.prestige > 50) return;
  if (Math.random() >= TOHOKU_CHANCE + (S.captured.osaka ? 0.10 : 0)) return;
  F.tohokuRise = 1;
  S.tohoku = { men: TOHOKU_MEN };
  addPrestige(-5);
  log(`荘内の旧士族を中心に、東北の不平士族 ${fmt(TOHOKU_MEN)} が挙兵した。「南洲翁に続け」と東京を目指す。政府威信 −5`, 'ev');
}

function tohokuAttack() {
  const T = S.tohoku;
  const def = at('tokyo', 'g');
  const menT = T.men, menG = men(def);
  const A = T.men * 1.1 * rnd(0.85, 1.15);
  const D = strength(def) * defOf('tokyo') * rnd(0.85, 1.15);
  const r = A / Math.max(D, 1);
  const win = r >= 1;
  const lostT = Math.round(T.men * (clamp(0.14 * Math.pow(1 / r, 0.9), 0.05, 0.45) + (win ? 0 : 0.08)));
  const lostG = applyLoss(def, clamp(0.14 * Math.pow(r, 0.9), 0.03, 0.45) + (win ? 0.08 : 0));
  T.men -= lostT;
  addPrestige(win ? -3 : -1);   // 勝てば大打撃、負けても首都の騒擾は政府の面目を損なう
  log(`【東京攻防】東北士族 ${fmt(menT)} が東京の政府軍 ${fmt(menG)} を攻撃 → ${win ? '東北士族' : '政府軍'}の勝利（損害 東北士族 ${fmt(lostT)}／政府軍 ${fmt(lostG)}）。政府威信 −${win ? 3 : 1}`, win ? 'win' : 'lose');
  cleanup();
  if (win && (r >= 1.5 || men(at('tokyo', 'g')) < 500)) {
    retreat(at('tokyo', 'g'), 'tokyo', 'g');
    S.units = S.units.filter((u) => !(u.loc === 'tokyo' && u.side === 'g'));
    addPrestige(-25);
    log('東北士族が東京に入った。政府要人は横浜へ逃れ、数日後に東京は奪い返されたものの、政府の面目は丸つぶれとなった。政府威信 −25', 'win');
    S.tohoku = null;
    return;
  }
  if (T.men < 600) { log('東北士族は力尽きて四散した。', 'lose'); S.tohoku = null; }
}

// 西郷軍が熊本城を包囲している（3,000以上が熊本にいて、城が落ちていない）
const sieging = () => garrison('kumamoto').length > 0 && men(field('kumamoto', 's')) >= SIEGE_MEN;

// 政府軍の目標。熊本城が囲まれている間、九州の部隊は解囲を最優先する
function govTargets(from) {
  if (NODES[from].ky && garrison('kumamoto').length && field('kumamoto', 's').length) return ['kumamoto'];
  return [...new Set(S.units.filter((u) => u.side === 's').map((u) => u.loc))];
}

// 西郷の本営に本隊が迫ったら、別働隊を出して退路（陸の隣と、船で逃げられる港）を先に塞ぐ
function encircle() {
  const lead = S.units.find((u) => u.leader);
  if (!lead) return;
  const L = lead.loc;
  const sS = strength(at(L, 's'));
  const near = ADJ[L].reduce((a, n) => a + strength(field(n, 'g').filter((u) => !u.static)), 0);
  if (near < 0.6 * sS * defOf(L)) return;   // 本隊がまだ来ていない
  const need = BREAKOUT_POWER * sS * 1.1;  // 突破されない程度の兵
  const escapes = ADJ[L].filter((n) => !at(n, 'g').length && !at(n, 's').length).map((n) => ({ n, sea: false }));
  if (NODES[L].port) {
    SEA.filter((l) => (l.a === L || l.b === L) && (!l.ships || S.ships))
      .map((l) => (l.a === L ? l.b : l.a))
      .filter((p) => !at(p, 'g').length && !at(p, 's').length)
      .forEach((p) => escapes.push({ n: p, sea: true }));
  }
  let sent = 0;
  for (const e of escapes) {
    if (sent >= 3) break;
    // 西郷軍のいる所を通らずに2歩以内で行ける部隊。港へは、どこの港からでも船で回せる
    const reach = {};
    const q = [e.n]; reach[e.n] = 0;
    while (q.length) {
      const c = q.shift();
      if (reach[c] >= 2) continue;
      for (const m of ADJ[c]) if (reach[m] === undefined && m !== L && !at(m, 's').length) { reach[m] = reach[c] + 1; q.push(m); }
    }
    const srcs = [...new Set(S.units.filter((u) => u.side === 'g' && !u.static && !u.inFort && u.mp > 0).map((u) => u.loc))]
      .filter((x) => x !== e.n && (reach[x] !== undefined || (e.sea && NODES[x].port)))
      .map((x) => ({ x, g: field(x, 'g').filter((u) => !u.static && u.mp > 0) }))
      .map((o) => ({ ...o, spare: strength(o.g) * 0.4 }))
      .filter((o) => o.spare >= need * 0.6)
      .sort((a, b) => b.spare - a.spare);
    if (!srcs.length) continue;
    const { x, g } = srcs[0];
    // 群全体から割く（どの部隊からも同じ割合）。目安は need の強さ、上限は群の4割
    const take = Math.min(0.4, need / strength(g));
    // 西郷の本隊に打って出られても持ちこたえられないなら、出しても各個撃破されるだけ
    if (strength(g) * take * defOf(e.n) < BLOCK_HOLD * sS) continue;
    let n = 0;
    g.forEach((u) => { const k = Math.round(u.men * take); u.men -= k; n += k; });
    const lead2 = g.sort((a, b) => b.men - a.men)[0];
    addUnit('g', `${lead2.name.replace(/（.*$/, '')}・別働隊`, n, lead2.k, e.n, { mp: 0, block: L });
    occupy(e.n, 'g');
    log(`政府軍の別働隊 ${fmt(n)} が${e.sea ? '海路' : ''}${nm(e.n)}に回り込み、${nm(L)}の退路を塞いだ。`, 'lose');
    sent++;
  }
}

// 四国は街道で本土とつながっていないので、西郷軍がいれば海から攻め込む
function shikokuLanding() {
  const tgts = ['matsuyama', 'kochi'].filter((id) => at(id, 's').length)
    .sort((a, b) => (at(b, 's').some((u) => u.leader) ? 1 : 0) - (at(a, 's').some((u) => u.leader) ? 1 : 0));
  for (const t of tgts) {
    const D = strength(field(t, 's')) * defOf(t);
    const opts = SEA.filter((l) => l.a === t || l.b === t)
      .map((l) => l.a === t ? l.b : l.a)
      .filter((p) => S.owner[p] === 'g')
      // 西郷軍の主力が2歩以内に迫っている港からは兵を出さない（大阪などを空にしない）
      .filter((p) => { const dp = distFrom(p); return !S.units.some((u) => u.side === 's' && (dp[u.loc] ?? 99) <= 2); })
      .map((p) => ({ p, g: field(p, 'g').filter((u) => !u.static && u.mp > 0) }))
      .filter((o) => o.g.length && strength(o.g) * 0.8 >= 1.15 * D)
      .sort((a, b) => strength(b.g) - strength(a.g));
    if (!opts.length) continue;
    const { p, g } = opts[0];
    log(`政府軍 ${fmt(men(g))} が${nm(p)}から海路${nm(t)}に上陸を図る。`, 'lose');
    g.forEach((u) => { u.mp = 0; });
    if (field(t, 's').length && !battle('g', g, t, { amph: true })) { log('上陸は撃退された。', 'win'); continue; }
    alive(g).forEach((u) => { u.loc = t; });
    occupy(t, 'g');
    return;   // 1ターンに1回
  }
}

function landing(name, n, k, loc) {
  const u = addUnit('g', name, n, k, '_sea', { mp: 0 });
  log(`政府軍 ${name} ${fmt(n)} が海路${nm(loc)}に上陸を図る。`, 'lose');
  if (field(loc, 's').length && !battle('g', [u], loc, { amph: true })) {
    S.units = S.units.filter((x) => x !== u);
    log('上陸は撃退され、船団は引き揚げた。', 'win');
    return false;
  }
  if (!S.units.includes(u)) return false;
  u.loc = loc;
  occupy(loc, 'g');
  return true;
}

function moveGroup(start) {
  let cur = start;
  for (let i = 0; i < 2; i++) {
    if (S.over) return;
    const lead = S.units.find((u) => u.leader);
    const g = field(cur, 'g').filter((u) => !u.static && u.mp > 0 && !(u.block && lead && u.block === lead.loc));
    if (!g.length) return;
    const targets = govTargets(cur);
    if (!targets.length) return;
    const d = distFrom(targets);
    const dc = d[cur] ?? 99;
    const outside = S.units.some((u) => u.side === 's' && !NODES[u.loc].ky);
    // 本州の予備：海からの脅威がある間は大阪・東京を離れない。東北士族が健在なら東京は動かない
    if (cur === 'tokyo' && S.tohoku) return;
    if ((cur === 'osaka' || cur === 'tokyo') && (S.ships || outside) && dc > 3) return;
    // 海路での転進
    // （開戦直後は船腹が足りず、政府領の港どうしに限る。敵前上陸は別働旅団のイベントだけ）
    if (NODES[cur].port && dc >= 6 && S.turn >= 4) {
      const ports = Object.keys(NODES)
        .filter((p) => NODES[p].port && p !== cur && S.owner[p] === 'g' && d[p] >= 2)
        .sort((a, b) => d[a] - d[b]);
      if (ports.length && d[ports[0]] + 3 <= dc) {
        const p = ports[0];
        log(`政府軍 ${fmt(men(g))} が${nm(cur)}から海路${nm(p)}に上陸した。`);
        g.forEach((u) => { u.loc = p; u.mp = 0; });
        occupy(p, 'g');
        return;
      }
    }
    if (dc >= 99 || dc === 0) return;
    // 隣の敵が優勢なら、後方の味方へ下がって集結する（城が危ういときは退かない）
    // 熊本城が囲まれている間、九州の救援軍は下がらずに押し続ける
    const urgent = sieging() && NODES[cur].ky;
    const threatHere = Math.max(0, ...ADJ[cur].map((n) => strength(field(n, 's'))));
    if (i === 0 && !urgent && threatHere > 1.3 * strength(field(cur, 'g')) * defOf(cur)) {
      const back = ADJ[cur].filter((n) => !at(n, 's').length && d[n] > dc)
        .sort((a, b) => strength(field(b, 'g')) - strength(field(a, 'g')));
      if (back.length) {
        g.forEach((u) => { u.loc = back[0]; u.mp = 0; });
        log(`政府軍 ${fmt(men(g))} は${nm(cur)}から${nm(back[0])}へ後退した。`);
        return;
      }
    }
    const next = ADJ[cur].find((n) => d[n] === dc - 1);
    const en = field(next, 's');
    if (en.length) {
      let A = strength(g);
      if (NODES[next].fort) A += 0.5 * strength(garrison(next));
      const D = strength(en) * defOf(next);
      let th = 1.15;
      // 熊本城が囲まれていれば、損害を承知で攻め急ぐ（史実の田原坂の17日間）
      if (sieging() && NODES[cur].ky) th = S.food <= 2 ? RELIEF_DESPERATE : RELIEF_RATIO;
      if (S.turn >= 16) th = Math.min(th, 0.95);
      if (A / Math.max(D, 1) < th) return;   // 増援を待つ
      const win = battle('g', g, next);
      const a = alive(g);
      a.forEach((u) => { u.mp = 0; });
      if (win) { a.forEach((u) => { u.loc = next; }); occupy(next, 'g'); }
      return;
    }
    // 優勢な敵の隣へ小勢で出ない（各個撃破を避けて後続を待つ）
    const threat = Math.max(0, ...ADJ[next].map((n) => strength(field(n, 's'))));
    if (!(sieging() && NODES[cur].ky) && dc > 1 && (strength(g) + strength(field(next, 'g'))) * defOf(next) < 0.75 * threat) return;
    g.forEach((u) => { u.loc = next; u.mp--; });
    occupy(next, 'g');
    cur = next;
  }
}

// ───────── 初期配置 ─────────
function newGame() {
  lastNewsFrom = 0;
  S = {
    turn: 1, prestige: START.prestige, morale: START.morale, ammo: START.ammo, food: START.food,
    ships: false, seaUsed: 0, fortFallen: false, recruits: 0, recruited: false,
    flags: {}, captured: {}, owner: {}, units: [], log: [], over: null, nextId: 1,
  };
  for (const id in NODES) S.owner[id] = NODES[id].home ? 's' : 'g';
  const k = 'kagoshima';
  addUnit('s', '西郷隆盛（本営）', 300, 'elite', k, { leader: true });
  addUnit('s', '一番大隊（篠原国幹）', 2000, 'elite', k);
  addUnit('s', '二番大隊（村田新八）', 2000, 'elite', k);
  addUnit('s', '三番大隊（永山弥一郎）', 2000, 'elite', k);
  addUnit('s', '四番大隊（桐野利秋）', 2000, 'elite', k);
  addUnit('s', '五番大隊（池上四郎）', 2000, 'elite', k);
  addUnit('s', '六・七番連合大隊（別府晋介）', 3000, 'elite', k);
  S.units.forEach((u) => { u.mp = 2; });
  addUnit('g', '熊本鎮台（谷干城）', 3500, 'line', 'kumamoto', { inFort: true, static: true });
  addUnit('g', '歩兵第十四連隊（乃木希典）', 1500, 'line', 'kokura', { nogi: true });
  addUnit('g', '長崎警備隊', 500, 'line', 'nagasaki', { static: true });
  addUnit('g', '福岡守備隊', 1500, 'line', 'fukuoka', { static: true });
  addUnit('g', '下関守備隊', 1000, 'line', 'shimonoseki', { static: true });
  addUnit('g', '広島鎮台', 2500, 'line', 'hiroshima', { static: true });
  addUnit('g', '大阪鎮台', 4500, 'line', 'osaka', { static: true });
  addUnit('g', '名古屋鎮台', 2000, 'line', 'nagoya', { static: true });
  addUnit('g', '近衛・東京鎮台', 6000, 'guard', 'tokyo', { static: true });
  log('明治10年2月、私学校党は西郷隆盛を擁して鹿児島を発つ。', 'ev');
  selectNode(k);
}

// ───────── 描画 ─────────
const LAND = [
  '238,104 300,82 378,86 442,130 502,204 524,300 548,408 524,552 472,622 400,666 332,672 286,640 252,540 232,452 248,392 226,318 206,262 150,336 92,314 100,258 172,220 182,164',
  '332,18 1000,18 1000,112 930,128 860,124 815,150 770,150 740,120 600,104 480,94 402,76 342,64',
  '532,172 640,160 722,200 702,282 622,292 562,252 527,212',
];

function renderMap() {
  const dests = destinations();
  const dmap = {};
  dests.forEach((d) => { if (d.ok) dmap[d.to] = dmap[d.to] === 'land' ? 'land' : d.type; });
  let h = LAND.map((p) => `<polygon class="land" points="${p}"/>`).join('');
  h += '<text class="maplabel" x="60" y="450">東シナ海</text><text class="maplabel" x="600" y="330">太平洋</text><text class="maplabel" x="600" y="140">瀬戸内海</text>';
  for (const l of SEA) {
    const a = NODES[l.a], b = NODES[l.b];
    h += `<path class="lane" d="M${a.x},${a.y} Q${l.c[0]},${l.c[1]} ${b.x},${b.y}"/>`;
  }
  for (const [a, b] of EDGES) h += `<line class="road" x1="${NODES[a].x}" y1="${NODES[a].y}" x2="${NODES[b].x}" y2="${NODES[b].y}"/>`;
  const lead = S.units.find((u) => u.leader);
  for (const id in NODES) {
    const n = NODES[id];
    const sm = men(at(id, 's')), gm = men(at(id, 'g'));
    const tip = [`${n.name}（${SIDE[S.owner[id]]}）`]
      .concat(S.units.filter((u) => u.loc === id).map((u) => `${SIDE[u.side]} ${u.name} ${fmt(u.men)}`)).join('\n');
    h += `<g class="node ${S.owner[id]}${id === sel ? ' sel' : ''}${id === target ? ' tgt' : ''}" data-node="${id}"><title>${tip}</title>`;
    if (dmap[id]) h += `<circle class="ring${dmap[id] === 'sea' ? ' sea' : ''}" cx="${n.x}" cy="${n.y}" r="15"/>`;
    h += n.fort ? `<rect x="${n.x - 9}" y="${n.y - 9}" width="18" height="18"/>` : `<circle cx="${n.x}" cy="${n.y}" r="8"/>`;
    h += `<text class="name" x="${n.x}" y="${n.y - 14}">${n.name}</text>`;
    let y = n.y + 24;
    if (sm) { h += `<text class="cs" x="${n.x}" y="${y}">${lead && lead.loc === id ? '★' : ''}${fmt(sm)}</text>`; y += 14; }
    if (gm) h += `<text class="cg" x="${n.x}" y="${y}">${fmt(gm)}</text>`;
    h += '</g>';
  }
  if (S.tohoku) h += `<text class="npc" x="935" y="36">東北士族 ${fmt(S.tohoku.men)} →</text>`;
  $('#map').innerHTML = h;
}

function gauge(label, v, color, mark) {
  const m = mark ? `<span class="mark" style="left:${mark}%" title="和議ライン ${mark}"></span>` : '';
  return `<div class="gauge"><span>${label}</span><div class="bar"><i style="width:${v}%;background:${color}"></i>${m}</div><b>${Math.round(v)}</b></div>`;
}

function renderStatus() {
  $('#btn-end').disabled = !!S.over;
  $('#date').textContent = `${dateStr(Math.min(S.turn, MAX_TURN))}（第${Math.min(S.turn, MAX_TURN)}ターン／全${MAX_TURN}）`;
  const sAll = S.units.filter((u) => u.side === 's'), gAll = S.units.filter((u) => u.side === 'g');
  $('#status').innerHTML =
    gauge('政府威信', S.prestige, 'var(--gov)', PEACE_LINE)
    + `<p class="goal"><b>0</b>で政府瓦解／<b>${PEACE_LINE}以下</b>を${PEACE_TURNS}旬保てば和議（${S.prestige <= PEACE_LINE ? `継続 ${S.peaceStreak || 0}／${PEACE_TURNS}` : `あと${Math.ceil(S.prestige - PEACE_LINE)}`}）</p>`
    + gauge('士気', S.morale, 'var(--saigo)') + gauge('弾薬', S.ammo, '#8a6d1c')
    + `<div class="forces"><span class="s">西郷軍 <b>${fmt(men(sAll))}</b></span><span class="g">政府軍 <b>${fmt(men(gAll))}</b></span>`
    + `<span>蒸気船 <b>${S.ships ? 'あり' : 'なし'}</b></span><span>補給線 <b>${supplied() ? '接続' : '遮断'}</b></span></div>`
    + (S.fortFallen ? '' : `<p class="hint">熊本城の糧食：残り ${S.food} ターン分（${fmt(SIEGE_MEN)} 以上で包囲すると減る）</p>`);
}

function unitLi(u, selectable) {
  const info = `<span class="n">${fmt(u.men)}</span><small>${Q[u.k].label}${u.inFort ? '・籠城' : ''}${u.side === 's' ? `・移動${u.mp}` : ''}</small>`;
  if (!selectable) return `<li class="${u.side}"><span>${u.name}</span>${info}</li>`;
  return `<li class="s"><label><input type="checkbox" data-unit="${u.id}"${checked.has(u.id) ? ' checked' : ''}${u.mp > 0 ? '' : ' disabled'}><span>${u.name}</span></label>${info}</li>`;
}

function nodeTags(id) {
  const n = NODES[id];
  let h = `<div class="tags"><span class="tag ${S.owner[id]}">${SIDE[S.owner[id]]}支配</span>`;
  if (defOf(id) > 1) h += `<span class="tag">防御 ×${defOf(id)}</span>`;
  if (n.fort && !S.fortFallen) h += `<span class="tag">城 ×${fortMult()}</span>`;
  if (n.port) h += '<span class="tag">港</span>';
  return h + '</div>' + shipHint(id);
}

// 長崎では、蒸気船を奪える状態かどうかを示す
function shipHint(id) {
  if (id !== 'nagasaki') return '';
  const pct = (p) => `${Math.round(p * 100)}%`;
  let t;
  if (S.ships) t = '蒸気船：奪取済み。遠洋の海路が使える。';
  else if (S.captured.nagasaki && S.owner.nagasaki === 's') t = `蒸気船：長崎を支配している限り、毎ターン始めに${pct(SHIP_CHANCE_TURN)}で奪取を狙える。`;
  else if (S.captured.nagasaki) t = `蒸気船：長崎を取り返せば、毎ターン${pct(SHIP_CHANCE_TURN)}の判定が再開する。`;
  else {
    t = `蒸気船：${fmt(OCCUPY_MEN)}以上で入ると、その場で${pct(SHIP_CHANCE_FIRST)}で奪取。以後も支配している限り毎ターン${pct(SHIP_CHANCE_TURN)}。`;
    const here = men(at('nagasaki', 's'));
    if (here) t += `いまは${fmt(here)}。部隊を足して合計${fmt(OCCUPY_MEN)}以上になると判定する。`;
  }
  return `<p class="ship">${t}</p>`;
}

// 現在地から見た方角（地図は上が北）
function dirOf(from, to) {
  const a = NODES[from], b = NODES[to];
  const deg = Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI;   // 東=0, 北=90
  return ['東', '北東', '北', '北西', '西', '南西', '南', '南東'][Math.round(((deg + 360) % 360) / 45) % 8];
}

function destButton(d) {
  let info = d.type === 'sea' ? `海路・捕捉の危険 ${Math.round(d.lane.risk * 100)}%` : '陸路';
  if (d.odds) info += `・敵 ${fmt(d.odds.men)}・戦力比 ${d.odds.r.toFixed(2)}`;
  if (garrison(d.to).length) info += '・城に籠城兵';
  if (!d.ok) info = d.why;
  return `<button type="button" data-go="${d.to}" data-type="${d.type}"${d.ok ? '' : ' disabled'}${d.odds ? ' class="danger"' : ''}>${d.odds ? '攻撃：' : ''}${nm(d.to)} <small>【${dirOf(sel, d.to)}】${info}</small></button>`;
}

// 地図で進軍先を選んだ状態：行き先の様子を見せ、進軍は確定ボタンで
function renderTarget() {
  const su = at(target, 's'), gu = at(target, 'g');
  let h = `<h2>進軍先：${nm(target)}</h2>` + nodeTags(target);
  if (su.length) h += `<h3>西郷軍 ${fmt(men(su))}</h3><ul class="units">${su.map((u) => unitLi(u, false)).join('')}</ul>`;
  if (gu.length) h += `<h3>政府軍 ${fmt(men(gu))}</h3><ul class="units">${gu.map((u) => unitLi(u, false)).join('')}</ul>`;
  if (!su.length && !gu.length) h += '<p class="hint">部隊はいない。</p>';
  h += `<p class="from">${nm(sel)}から ${fmt(men(selectedUnits()))} を進める</p><div class="dests">`;
  h += destinations().filter((d) => d.to === target).map(destButton).join('');
  h += '</div><div class="row"><button type="button" data-act="cancelTarget">やめる</button>'
    + `<button type="button" data-act="viewTarget">${nm(target)}を選ぶ</button></div>`
    + '<p class="hint">ボタンを押すまで進軍しない。地図で別の進軍先を押すと切り替わる。</p>';
  $('#node').innerHTML = h;
}

function renderNode() {
  if (target) { renderTarget(); return; }
  const n = NODES[sel];
  const su = at(sel, 's'), gu = at(sel, 'g');
  let h = `<h2>${n.name}</h2>` + nodeTags(sel);
  if (destinations().length) h += '<div class="row"><button type="button" class="primary" data-act="destPopup">進軍先を選ぶ</button></div>';
  if (su.length) {
    const movable = su.filter((u) => u.mp > 0).length;
    const dis = movable && !S.over ? '' : ' disabled';
    h += `<div class="unit-head"><h3>西郷軍 ${fmt(men(su))}</h3>`
      + `<button type="button" class="mini" data-act="checkAll"${dis}>全部選ぶ</button>`
      + `<button type="button" class="mini" data-act="checkNone"${dis}>全部外す</button></div>`
      + `<ul class="units">${su.map((u) => unitLi(u, true)).join('')}</ul>`;
  }
  if (gu.length) h += `<h3>政府軍 ${fmt(men(gu))}</h3><ul class="units">${gu.map((u) => unitLi(u, false)).join('')}</ul>`;
  if (!su.length && !gu.length) h += '<p class="hint">部隊はいない。</p>';

  const dests = destinations();
  if (dests.length) {
    h += `<h3>進軍先（選択中 ${fmt(men(selectedUnits()))}）</h3><div class="dests">`;
    h += dests.map(destButton).join('');
    h += '</div>';
  } else if (su.length && !S.over) {
    h += '<p class="hint">移動できる部隊にチェックを入れると進軍先が出る。</p>';
  }
  if (sel === 'kumamoto' && garrison(sel).length && su.length) {
    const units = selectedUnits().filter((u) => u.mp > 0);
    const r = units.length ? strength(units) / (strength(garrison(sel)) * fortMult()) : 0;
    h += `<div class="row"><button type="button" class="danger" data-act="assault"${units.length ? '' : ' disabled'}>熊本城を強襲 <small>戦力比 ${r.toFixed(2)}</small></button></div>`;
    h += '<p class="hint">戦力比が1未満なら失敗して大損害。包囲して糧食切れを待つこともできる。</p>';
  }
  $('#node').innerHTML = h;
}

function renderActions() {
  const rec = !S.recruited && S.recruits < 5 && S.owner.kagoshima === 's';
  let h = '<div class="row">';
  h += `<button type="button" data-act="recruit"${rec && !S.over ? '' : ' disabled'}>鹿児島で徴募（残り${5 - S.recruits}回）</button>`;
  if (!S.flags.hisamitsu) h += `<button type="button" data-act="hisamitsu"${canHisamitsu() && !S.over ? '' : ' disabled'}>久光を担ぐ（成功率25%）</button>`;
  h += '</div>';
  if (S.turn > 1) h += '<div class="row"><button type="button" data-act="lastNews">前の旬の出来事</button></div>';
  $('#actions').innerHTML = h;
}

const NEWS_COUNT = 6;
function renderLog() {
  let h = '', last = null;
  for (let i = S.log.length - 1; i >= 0 && i >= S.log.length - 120; i--) {
    const e = S.log[i];
    if (e.t !== last) { h += `<p class="t">${dateStr(Math.min(e.t, MAX_TURN))}</p>`; last = e.t; }
    h += `<p class="${e.cls}">${e.msg}</p>`;
  }
  $('#log').innerHTML = h;
}

function showDialog(html) { $('#dialog').innerHTML = html; $('#overlay').hidden = false; }
function hideDialog() { $('#overlay').hidden = true; }

const helpHtml = (label) => `
<h2>西南戦争 1877</h2>
<p>あなたは西郷隆盛を擁した私学校党の幹部です。${MAX_TURN}ターン（約7か月）のうちに<b>政府威信を0</b>にすれば即勝利。威信を<b>${PEACE_LINE}以下</b>のまま${PEACE_TURNS}旬（ターンの始めで数えます）保てば、その時点で和議となって勝ち。最終ターンを終えた時点で${PEACE_LINE}以下でも和議です。西郷を失うか、最終ターンを終えて${PEACE_LINE + 1}以上残れば負けです。</p>
<ul>
<li><b>移動</b>：拠点を選び、動かす部隊にチェックを入れて、右の進軍先ボタンを押します。地図の点線の輪（進軍先）を押すと、その拠点の様子を見てから進軍を確定できます。押しただけでは動きません。1ターンに2歩まで。</li>
<li><b>熊本城</b>：強襲はまず失敗します。${fmt(SIEGE_MEN)}以上で囲み続ければ${START.food}ターンで開城。全軍で囲むか、抑えを残して東上するかが分かれ目です。</li>
<li><b>落城後の熊本城</b>：取った後は防御 ×${FALLEN_FORT_DEF} の拠点になります（奪い返されれば政府軍が使います）。少数の守備で政府軍を引きつけ、主力を東へ出せます。ただし籠もるだけでは政府威信は下がりません。</li>
<li><b>弾薬と士気</b>：戦うたびに弾薬が減り、戦力が落ちます。補給源は鹿児島だけで、西郷の本営まで支配地が陸続きのときだけ届きます。熊本城を囲まずに素通りすると、城に街道を断たれます。鹿児島を空にすると政府軍が上陸してきます。</li>
<li><b>私学校の精鋭は補充できません</b>。徴募兵は質が低く、士気も下げます。</li>
<li><b>戦果</b>：進軍も勝利も占領も熊本城の包囲もないターンが過ぎると、政府威信が${IDLE_RECOVERY}戻ります。動かずに籠もっているだけでは勝てません。</li>
<li><b>占領</b>：町を取ると政府威信が下がりますが、${fmt(OCCUPY_MEN)}以上の兵で攻め込んだ（入った）ときだけ数えます。戦闘の損害で割り込んでも構いません。</li>
<li><b>退却</b>：負けると街道でつながった隣へ退きます。陸の逃げ道がないときは、港から海路でつながった、政府軍のいない港へ船で逃れます（自軍の港が優先。${fmt(SEA_CAPACITY)}まで。乗り切れない兵は失われ、捕捉の危険もあります）。退路を塞ぐ敵が薄ければ、押し破って逃れることもできます（敗走中なので戦力は${BREAKOUT_POWER * 10}割で計算）。それもできなければ全滅です。政府軍は西郷の本営に迫ると、別働隊で退路を塞ぎにきます。</li>
<li><b>大久保の密使</b>：政府威信が${OKUBO_LINE}以下になると、一度だけ西郷の復権を条件に講和を持ちかけてきます。受ければ引き分けで終わります。</li>
<li><b>呼応</b>：勝利と進出に応じて各地の士族が立ちます。熊本で止まると誰も動きません。</li>
<li><b>海路</b>：長崎を取れば蒸気船が手に入ることがあり、大阪・東京を直接突けます。ただし政府海軍に捕まると、船団の大きさによらず${fmt(SEA_CATCH_LOSS)}を失って引き返します（少数なら半数）。<br>蒸気船を奪うには、長崎へ${fmt(OCCUPY_MEN)}以上で攻め込んで（入って）ください。数えるのは入った時点の兵数で、戦闘で減って${fmt(OCCUPY_MEN)}を割っても構いません。その場で${Math.round(SHIP_CHANCE_FIRST * 100)}%、以後も長崎を支配している限り毎ターン${Math.round(SHIP_CHANCE_TURN * 100)}%で奪えます。敗走して船で逃げ込んだだけでは数えません。</li>
</ul>
<div class="row"><button type="button" class="primary" data-act="close">${label}</button></div>`;

// 申し入れを受けるか決める前に、この旬に何が起きたかと今の戦況を見せる
const okuboHtml = () => `
<h2>一蔵どんの密使</h2>
${okuboSituation()}
<p>相次ぐ敗報に、東京の大久保利通から密使が来た。</p>
<p>「兵を収めるなら、西郷を陸軍大将に復し、参議として政府に迎える。私学校の者の罪は問わない」</p>
<p>政府は西郷の人望で威信を立て直すつもりらしい。政府に戻れば、刀ではなく政で、西郷の志を形にできるかもしれない。</p>
<ul>
<li><b>受ける</b>：戦はここで終わる。結末は<b>引き分け</b>「西郷復権」。</li>
<li><b>断る</b>：大義を貫き、士気 +10。政府も後がなくなり、以後の大きな戦いは勝てば威信 −3、負ければ +2 と振れ幅が大きくなる。</li>
</ul>
<div class="row"><button type="button" class="primary" data-act="okuboAccept">受ける</button><button type="button" data-act="okuboRefuse">断る</button></div>`;

function okuboSituation() {
  const news = S.log.filter((e) => e.t === S.turn || e.t === S.turn - 1).slice(-8);
  const sMen = men(S.units.filter((u) => u.side === 's')), gMen = men(S.units.filter((u) => u.side === 'g'));
  let h = '<div class="situation"><h3>いまの戦況</h3>'
    + `<p>${dateStr(S.turn)}（残り ${MAX_TURN - S.turn + 1} ターン）／政府威信 <b>${Math.round(S.prestige)}</b>（和議ラインまであと ${Math.max(0, Math.ceil(S.prestige - PEACE_LINE))}）／士気 ${Math.round(S.morale)}／弾薬 ${Math.round(S.ammo)}<br>`
    + `西郷軍 ${fmt(sMen)}／政府軍 ${fmt(gMen)}／補給線 ${supplied() ? '接続' : '遮断'}</p>`;
  if (news.length) h += '<h3>この旬の出来事</h3><ul>' + news.map((e) => `<li class="${e.cls}">${e.msg}</li>`).join('') + '</ul>';
  return h + '</div>';
}

function okuboAnswer(accept) {
  S.okuboPending = false;
  hideDialog();
  if (accept) {
    log('西郷は大久保の申し入れを受け、兵を収めた。', 'ev');
    gameOver('d', '西郷復権', '戦を終えた西郷は、再び政の道へ戻った。<br>'
      + '数年後、海の向こうから、祖国の改革を志す若者（金玉均）たちが訪れる。<br>'
      + '西郷は彼らの言葉に耳を傾け、ともに歩む道を選んだ。</p>'
      + '<p>その先にも、困難は待っているだろう。<br>'
      + 'それでも、この日、歴史はもう一つの道を歩み始めた。');
  } else {
    S.flags.okuboRefused = true;
    addMorale(10);
    log('西郷は「今さら政府には戻らぬ」と密使を帰した。士気 +10。以後、戦の勝敗が威信を大きく動かす。', 'ev');
  }
  render();
}

function render() {
  if (!NODES[sel]) sel = 'kagoshima';
  checked = new Set(at(sel, 's').filter((u) => checked.has(u.id) && u.mp > 0).map((u) => u.id));
  if (target && !destinations().some((d) => d.to === target)) target = null;
  renderMap(); renderStatus(); renderNode(); renderActions(); renderLog();
  if (S.okuboPending && $('#overlay').hidden) showDialog(okuboHtml());
  if (S.over && !S.overShown) {
    S.overShown = true;
    showDialog(`<h2>${{ s: '勝利', g: '敗北', d: '引き分け' }[S.over.winner]}：${S.over.title}</h2><p>${S.over.text}</p>
      <p>${dateStr(Math.min(S.turn, MAX_TURN))}／政府威信 ${Math.round(S.prestige)}／西郷軍 ${fmt(men(S.units.filter((u) => u.side === 's')))}</p>
      <div class="row"><button type="button" class="primary" data-act="new">もう一度</button><button type="button" data-act="close">地図を見る</button></div>`);
  }
}

// ───────── 入力 ─────────
document.addEventListener('click', (e) => {
  const node = e.target.closest('[data-node]');
  if (node) {
    const id = node.dataset.node;
    // 進軍先なら「行き先として選ぶ」だけ。進軍は右の確定ボタンで
    if (id !== sel && destinations().some((x) => x.to === id)) { target = id; render(); }
    else selectNode(id);
    return;
  }
  const go = e.target.closest('[data-go]');
  if (go) { hideDialog(); doMove(go.dataset.go, go.dataset.type); return; }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  switch (act.dataset.act) {
    case 'end': endTurn(); break;
    case 'assault': doAssault(); break;
    case 'recruit': doRecruit(); break;
    case 'hisamitsu': doHisamitsu(); break;
    case 'new': hideDialog(); newGame(); break;
    case 'close': hideDialog(); break;
    case 'destPopup': showDests(); break;
    case 'lastNews': showNews(lastNewsFrom); break;
    case 'okuboAccept': okuboAnswer(true); break;
    case 'okuboRefuse': okuboAnswer(false); break;
    case 'checkAll': checked = new Set(at(sel, 's').filter((u) => u.mp > 0).map((u) => u.id)); render(); break;
    case 'checkNone': checked = new Set(); render(); break;
    case 'cancelTarget': target = null; render(); break;
    case 'viewTarget': selectNode(target); break;
  }
});
document.addEventListener('change', (e) => {
  const id = e.target.dataset && e.target.dataset.unit;
  if (!id) return;
  if (e.target.checked) checked.add(+id); else checked.delete(+id);
  render();
});
// 途中で開いたときは「閉じる」。ゲームはそのまま続く
$('#btn-help').addEventListener('click', () => showDialog(helpHtml('閉じてゲームに戻る')));
// 枠の外を押しても閉じる
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' && !S.okuboPending) hideDialog(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#overlay').hidden) { if (!S.okuboPending) hideDialog(); }
  else if (target) { target = null; render(); }
});

newGame();
showDialog(helpHtml('始める'));
