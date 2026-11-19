import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,canWin,hasSequencePair,hasHonitsu,groupedDoraIndices,displayRole,compare,bonus,probabilities,callOptions,ronCandidate,nextDora,makeWall,settlement} from '../dist/rules.js';
import {Table} from '../dist/engine.js';
import {scoreFormula,scoreDetails} from '../dist/score-view.js';
const examples=[
  [0,[0,11,23,29,33]], [1,[0,0,11,23,33]], [2,[0,0,11,11,33]], [3,[0,0,0,11,33]],
  [4,[0,10,20,3,13]], [5,[0,2,4,6,8]], [6,[0,0,0,11,11]], [7,[0,0,0,0,33]], [8,[0,1,2,3,4]]
];
test('all nine ranks and ordering',()=>{
  for(const [rank,hand] of examples)assert.equal(evaluate(hand).rank,rank);
  for(let i=1;i<examples.length;i++)assert.equal(compare(evaluate(examples[i][1]),evaluate(examples[i-1][1])),1);
  assert.throws(()=>evaluate([0,0,0,0,0]));
});
test('number / suit / honor tie breaks and grouped ranks',()=>{
  const e=evaluate;
  assert.equal(compare(e([0,0,11,23,32]),e([9,9,0,23,32])),-1);
  assert.equal(compare(e([27,27,0,12,24]),e([8,8,1,12,24])),1);
  assert.equal(compare(e([33,33,0,12,24]),e([32,32,0,12,24])),1);
  assert.equal(compare(e([0,0,0,33,33]),e([1,1,1,2,2])),-1);
  assert.equal(compare(e([0,0,11,11,33]),e([1,1,10,10,32])),1);
  assert.equal(compare(e([0,10,20,3,13]),e([0,10,20,3,13])),0);
});
test('honor straight, wind/dragon separation and numeric wrap',()=>{
  assert.equal(evaluate([27,28,29,30,31]).rank,4);
  assert.equal(evaluate([29,30,31,32,33]).rank,4);
  assert.equal(evaluate([27,27,28,29,30]).rank,5);
  assert.equal(evaluate([31,31,32,32,33]).rank,5);
  assert.equal(evaluate([27,28,29,31,33]).flush,false);
  assert.equal(evaluate([7,8,0,1,2]).straight,false);
});
test('five-tile bonuses, highest only, dora addition and defender restriction',()=>{
  assert.equal(bonus([1,1,11,21,5],1).multiplier,4);
  assert.equal(bonus([0,1,2,8,8],6).base,3);
  assert.equal(bonus([0,1,2,27,27],6).base,2);
  assert.equal(bonus([0,1,3,27,27],6).base,2);
  assert.equal(bonus([27,28,29,30,31],0).base,4);
  assert.equal(bonus([31,31,31,33,33],31).multiplier,8);
  assert.equal(bonus([27,27,27,30,30],0).base,5);
  assert.equal(bonus([31,31,31,33,33],31,false).multiplier,1);
});
test('pinfu x1 recognizes 11man + 345pin, keeps poker rank and adds dora correctly',()=>{
  const hand=[0,0,20,21,22];assert.equal(canWin(hand),true);assert.equal(evaluate(hand).rank,1);
  assert.equal(displayRole(hand),'1ペア / 平和');assert.deepEqual(bonus(hand,33),{base:1,dora:0,multiplier:1,names:['平和']});
  assert.deepEqual(bonus(hand,0),{base:1,dora:2,multiplier:3,names:['平和']});
  const players=Array.from({length:4},()=>({bet:6500,hand})),r=settlement(players,1,[0,2,3],33,true,hand,0);
  assert.equal(r.total,6500);assert.deepEqual(r.deltas,[-3250,6500,-1625,-1625]);assert.match(scoreDetails({...r,winner:1},players),/平和：×1/);
});
test('pinfu uses a complete suited sequence and a pair, including called / honor pairs',()=>{
  for(const hand of [[0,0,20,21,22],[30,30,0,1,2],[0,1,2,0,0]])assert.match(displayRole(hand),/平和/);
  for(const hand of [[0,0,20,22,23],[0,0,2,12,22],[0,1,2,28,30],[0,0,27,28,29],[0,0,0,1,1]])assert.doesNotMatch(displayRole(hand),/平和/);
  const hand=[0,0,20,21,22],r=ronCandidate([0,0,20,21,33],22,'straight',[0,1]);assert.ok(r);assert.match(displayRole(r.hand),/平和/);
  assert.equal(ronCandidate([0,0,20,21,33],22,'straight',[2,3,4]),null);
  const t=new Table(rng(8));t.actor=3;t.phase='drawn';t.players[3].hand=[22,4,12,23,29,33];t.discard(0);
  t.players[0].hand=[0,0,20,21,33];t.players[1].hand=t.players[2].hand=[4,12,22,28,33];
  const chi=t.reactions(0).calls.findIndex(c=>c.type==='チー');assert.ok(chi>=0);t.resolveReaction(`call:${chi}`);t.discard(5);
  assert.equal(t.players[0].meld.length,3);assert.match(displayRole(t.players[0].hand),/平和/);assert.deepEqual(bonus(t.players[0].hand,33).names,['平和']);
});
test('pinfu does not stack with higher bonuses or add role/dora multipliers on a counter win',()=>{
  const hand=[1,1,20,21,22];assert.match(displayRole(hand),/平和/);assert.deepEqual(bonus(hand,33),{base:2,dora:0,multiplier:2,names:['タンヤオ']});
  assert.deepEqual(bonus([0,1,2,8,8],33).names,['純チャン']);
  assert.deepEqual(bonus([0,0,20,21,22],0,false),{base:1,dora:0,multiplier:1,names:[]});
});

test('honitsu x2 needs a basic role, one number suit and an honor pair or triplet',()=>{
  for(const hand of [[0,0,3,27,27],[10,10,12,33,33],[19,19,21,31,31],[0,1,2,30,30],[0,0,0,33,33],[10,10,33,33,33]]){
    assert.equal(hasHonitsu(hand),true);assert.match(displayRole(hand),/ホンイツ/);assert.ok(bonus(hand,28).names.includes('ホンイツ'));
  }
  const hand=[10,10,12,16,33];assert.equal(evaluate(hand).rank,1);assert.equal(hasHonitsu(hand),false);assert.deepEqual(bonus(hand,27),{base:1,dora:0,multiplier:1,names:[]});
});
test('honitsu excludes mixed number suits, pure number hands, all honors and roleless hands',()=>{
  for(const hand of [[0,0,12,16,33],[0,0,3,6,8],[27,27,28,29,30],[0,2,4,27,33],[9,11,13,27,28],[10,10,12,16,33]]){
    assert.equal(hasHonitsu(hand),false);assert.doesNotMatch(displayRole(hand),/ホンイツ/);assert.ok(!bonus(hand,32).names.includes('ホンイツ'));
  }
  assert.equal(canWin([0,2,4,27,33]),false);
});
test('honitsu follows highest-only bonuses and dora addition, while counter wins have no bonus',()=>{
  const hand=[0,0,3,33,33];assert.deepEqual(bonus(hand,0),{base:2,dora:2,multiplier:4,names:['ホンイツ']});
  assert.equal(bonus([0,1,2,27,27],33).base,2);assert.deepEqual(bonus([9,10,11,32,32],33).names,['緑一色']);
  assert.deepEqual(bonus(hand,0,false),{base:1,dora:0,multiplier:1,names:[]});
  const players=Array.from({length:4},()=>({name:'席',bet:6500,hand})),r=settlement(players,1,[0,2,3],27,true,hand,0);
  assert.equal(r.total,13000);assert.deepEqual(r.deltas,[-6500,13000,-3250,-3250]);assert.match(scoreDetails({...r,winner:1},players),/ホンイツ：×2/);
  assert.equal(settlement(players,1,[0],0,false,hand,0).total,6500);
});

test('isolated 9man 9sou 9pin add neither junchan nor dora, while 999man is valid',()=>{
  const loose=[0,0,8,17,26],full=[0,0,8,8,8];
  assert.equal(evaluate(loose).rank,1);assert.deepEqual(bonus(loose,8),{base:1,dora:0,multiplier:1,names:[]});assert.equal(displayRole(loose),'1ペア');
  assert.equal(evaluate(full).rank,6);assert.deepEqual(bonus(full,8),{base:1,dora:3,multiplier:4,names:[]});
  assert.equal(displayRole(full),'フルハウス');
  const players=Array.from({length:4},()=>({bet:1000,hand:full}));assert.equal(settlement(players,1,[0,2,3],8,true,full,0).total,4000);
  assert.equal(settlement(players,1,[0],8,false,full,0).total,1000);
});
test('dora count only includes disjoint pairs, triples, quads or suited sequences',()=>{
  for(const [hand,dora,count] of [
    [[0,0,8,17,26],8,0],[[0,0,8,8,8],8,3],[[0,0,8,17,26],0,2],
    [[0,0,6,7,8],8,1],[[0,0,6,8,17],8,0],[[0,0,0,0,8],0,4],
    [[27,28,29,0,0],27,0],[[27,27,0,0,33],27,2],[[0,1,2,3,4],2,1]
  ])assert.equal(groupedDoraIndices(hand,dora).length,count);
  assert.deepEqual(groupedDoraIndices([0,0,8,17,26,8],8),[2,5]);
});
test('fixed called groups cannot be reused to manufacture additional dora',()=>{
  const hand=[0,1,2,0,33],meld=[0,1,2];assert.equal(groupedDoraIndices(hand,0).length,2);assert.deepEqual(groupedDoraIndices(hand,0,meld),[0]);
  assert.equal(bonus(hand,0,true,meld).dora,1);
  const players=Array.from({length:4},()=>({bet:1000,hand,meld}));assert.equal(settlement(players,1,[0,2,3],0,true,hand,0).bonus.dora,1);
});
test('chanta / junchan need complete groups; flush does not receive a chinitsu bonus',()=>{
  for(const hand of [[0,0,8,27,28],[0,0,8,8,33],[0,0,0,8,27]])assert.ok(!bonus(hand,32).names.some(n=>n==='チャンタ'||n==='純チャン'));
  assert.ok(bonus([0,1,2,27,27],33).names.includes('チャンタ'));assert.ok(bonus([0,1,2,8,8],33).names.includes('純チャン'));
  assert.ok(!bonus([0,0,0,27,27],33).names.includes('チャンタ'));assert.ok(!bonus([0,0,26,26,26],33).names.includes('純チャン'));
  for(const hand of [[0,0,3,6,8],[0,1,2,3,4]]){assert.equal(evaluate(hand).flush,true);assert.equal(bonus(hand,33).base,1);assert.ok(!bonus(hand,33).names.includes('清一色'));}
  assert.equal(hasHonitsu([10,10,12,16,33]),true);
  const hand=[8,0,8,0,8];assert.deepEqual(bonus(hand,8),bonus([...hand].reverse(),8));
});

test('chii from upper player only, pon for anyone, honor chii forbidden',()=>{
  assert.equal(callOptions([0,2,5,11,33],1,true).some(c=>c.type==='チー'),true);
  assert.equal(callOptions([0,2,5,11,33],1,false).length,0);
  assert.equal(callOptions([1,1,5,11,33],1,false)[0].type,'ポン');
  assert.equal(callOptions([27,29,5,11,33],28,true).length,0);
});
test('green hand requires a 發 pair/triple and a complete souzu group',()=>{
  for(const hand of [[9,10,11,32,32],[15,16,17,32,32],[9,9,9,32,32],[17,17,32,32,32]]) {
    const b=bonus(hand,0);assert.equal(b.base,4);assert.deepEqual(b.names,['緑一色']);
  }
  for(const hand of [[9,10,11,12,32],[9,11,13,15,17],[9,9,17,32,32],[9,32,32,32,32],[0,1,2,32,32],[9,11,12,32,32],[16,17,18,32,32],[9,9,32,32,33]]) assert.ok(!bonus(hand,8).names.includes('緑一色'));
  assert.equal(bonus([9,10,11,32,32],32).multiplier,6);
  assert.equal(bonus([9,10,11,32,32],32,false).multiplier,1);
});

test('all seats: chii only from the preceding player, pon and ron from every other seat',()=>{
  const t=new Table(rng(8));t.phase='reaction';
  for(let from=0;from<4;from++)for(let who=0;who<4;who++){
    t.last={id:1,from};t.players[who].hand=[0,2,5,11,33];
    assert.equal(t.reactions(who).calls.some(c=>c.type==='チー'),who===(from+1)%4);
    t.players[who].hand=[1,1,5,11,33];
    assert.equal(t.reactions(who).calls.some(c=>c.type==='ポン'),who!==from);
    t.last={id:2,from};t.players[who].hand=[0,1,23,30,30];
    assert.equal(Boolean(t.reactions(who).ron),who!==from);
  }
});

test('discards distinguish the physical drawn tile, including equal tile IDs',()=>{
  for(const index of [0,5]){
    const t=new Table(rng(8)),p=t.players[0];p.hand=[0,3,12,24,33];t.wall.push(0);
    t.draw();assert.equal(p.drawnIndex,5);t.discard(index);
    assert.equal(p.river.at(-1),0);assert.equal(p.riverMeta.at(-1).tedashi,index!==5);
    assert.equal(t.last.tedashi,index!==5);assert.equal(p.drawnIndex,null);
    assert.match(t.logs[0],index===5?/ツモ切り/:/手出し/);
    t.finishDraw();t.newRound();assert.deepEqual(p.riverMeta,[]);assert.equal(p.drawnIndex,null);
  }
});

test('claimed discards remove their mark; discards following calls are hand discards',()=>{
  const t=new Table(rng(8));t.actor=3;t.phase='drawn';t.players[3].hand=[1,4,12,23,29,33];t.discard(0);
  t.players[0].hand=[0,2,7,22,33];t.players[1].hand=t.players[2].hand=[4,12,22,28,33];
  const call=t.reactions(0).calls.findIndex(c=>c.type==='チー');assert.ok(call>=0);
  t.resolveReaction(`call:${call}`);assert.equal(t.actor,0);assert.equal(t.phase,'drawn');
  assert.deepEqual(t.players[3].river,[]);assert.deepEqual(t.players[3].riverMeta,[]);assert.equal(t.players[0].drawnIndex,null);
  t.discard(5);assert.equal(t.players[0].riverMeta[0].tedashi,true);
});
test('same-number two pair / full house uses exact tile groups and highest multiplier',()=>{
  for(const hand of [[9,9,18,18,33],[0,0,18,18,12],[9,9,9,18,18]]) assert.equal(bonus(hand,32).base,3);
  // A 1/9 full house has no sequence, so neither junchan nor same-number bonuses apply.
  assert.deepEqual(bonus([0,0,26,26,26],32).names,[]);
  assert.ok(bonus([9,9,18,18,33],32).names.includes('同数2ペア'));
  assert.ok(bonus([9,9,9,18,18],32).names.includes('同数フルハウス'));
  // Two triples/pairs must have the same number, not merely five numbers in total.
  assert.ok(!bonus([9,9,19,19,33],32).names.includes('同数2ペア'));
  assert.ok(!bonus([27,27,28,28,33],32).names.some(n=>n.startsWith('同数')));
  assert.equal(bonus([10,10,19,19,13],10).multiplier,5);
  assert.equal(bonus([10,10,10,19,19],10).multiplier,6);
  assert.deepEqual(bonus([10,10,19,19,13],32).names,['同数2ペア']);
  assert.equal(bonus([9,9,18,18,33],9,false).multiplier,1);
  const p=[{bet:1000,hand:[9,9,18,18,33]},{bet:500},{bet:500},{bet:500}];
  assert.deepEqual(settlement(p,0,[1,2,3],32,true).deltas,[4500,-1500,-1500,-1500]);
});
test('ron must use discard, improve hand, make straight or better, preserve meld',()=>{
  assert.ok(ronCandidate([0,10,20,3,33],13));
  assert.equal(ronCandidate([0,10,20,7,33],13),null);
  assert.equal(ronCandidate([0,10,20,3,13],33),null);
  assert.equal(ronCandidate([33,10,20,3,13],0,'straight',[0,1,2]),null);
  assert.ok(ronCandidate([0,0,0,8,33],8,'straight',[0,1,2]));
});
test('straight remains valid; sequence plus loose tiles / honors cannot win',()=>{
  assert.equal(canWin([0,10,20,3,13]),true);
  assert.equal(canWin([0,1,2,14,15]),false); // 123萬 + 67索
  assert.equal(canWin([0,1,2,28,30]),false); // 123萬 + 南北
  assert.equal(canWin([0,1,2,30,30]),true); // 123萬 + 北北
  assert.equal(canWin([0,1,2,23,23]),true); // 123萬 + 66筒
  assert.equal(hasSequencePair([0,1,2,30,30]),true);
  assert.equal(hasSequencePair([0,10,20,30,30]),false);
  assert.equal(canWin([0,1,2,5,6]),true); // existing flush is a valid independent role
});
test('ron accepts a newly completed suited sequence plus pair, but not loose tiles',()=>{
  const r=ronCandidate([0,1,23,30,30],2);assert.ok(r);assert.equal(hasSequencePair(r.hand),true);
  assert.equal(ronCandidate([0,1,23,28,30],2),null);
  assert.equal(ronCandidate([0,5,23,28,30],30),null); // ordinary pair alone does not broaden ron
  assert.equal(ronCandidate([0,1,23,30,30],2,'straight',[0,1,2]),null);
});
test('roleless players cannot declare a showdown or receive a payout',()=>{
  const t=new Table(rng(8));const before=t.players.map(p=>p.score);
  assert.equal(t.showdown(),false);assert.equal(t.phase,'start');assert.equal(t.result,null);assert.deepEqual(t.players.map(p=>p.score),before);
  assert.equal(t.pay(0,[1],true,'役なし',t.players[0].hand),false);assert.deepEqual(t.players.map(p=>p.score),before);
  t.players[0].hand=[0,0,11,23,27];t.players.slice(1).forEach(p=>p.hand=[1,12,23,29,33]);t.showdown();assert.equal(t.result.winner,0);
});
test('dora cycles and full 136-tile wall',()=>{
  for(const [from,to] of [[8,0],[17,9],[26,18],[30,27],[33,31],[27,28]])assert.equal(nextDora(from),to);
  const w=makeWall();assert.equal(w.length,136);for(let i=0;i<34;i++)assert.equal(w.filter(t=>t===i).length,4);
});
test('settlement uses winner stake and conserves total points',()=>{
  const p=[{bet:1000,hand:[1,1,11,21,5]},{bet:3000},{bet:500},{bet:2000}];
  assert.deepEqual(settlement(p,0,[1,2,3],33,true).deltas,[3000,-1000,-1000,-1000]);
  assert.deepEqual(settlement(p,0,[1],1,false).deltas,[1500,-1500,0,0]);
  assert.deepEqual(settlement(p,0,[2],1,true).deltas,[6000,0,-6000,0]);
});
test('exact random-deal probability formula',()=>{
  assert.deepEqual(probabilities(),{total:359933112,royal:15360,straight:1247232,flush:1136136,straightOnly:1231872,flushOnly:1120776});
});
test('showdown initiator / waiting player settlement',()=>{
  const t=new Table();t.dora=33;t.actor=0;t.phase='start';
  t.players.forEach((p,i)=>{p.hand=examples[i+1][1];p.bet=1000;});
  t.showdown();assert.equal(t.result.winner,3);assert.deepEqual(t.result.deltas,[-1000,0,0,1000]);
  t.phase='start';t.players[0].hand=examples[8][1];t.showdown();assert.equal(t.result.winner,0);assert.deepEqual(t.result.deltas,[1500,-500,-500,-500]);
});
test('8000 child tsumo is total 8000, split dealer 4000 / children 2000',()=>{
  const players=Array.from({length:4},(_,i)=>({name:`席${i}`,bet:8000,hand:examples[1][1]}));
  const r=settlement(players,1,[0,2,3],8,true,players[1].hand,0);
  assert.equal(r.total,8000);assert.deepEqual(r.deltas,[-4000,8000,-2000,-2000]);
  assert.deepEqual(r.payments.map(p=>[p.payer,p.amount,p.share]),[[0,4000,'1/2'],[2,2000,'1/4'],[3,2000,'1/4']]);
  assert.equal(r.deltas.reduce((a,n)=>a+n,0),0);assert.equal(scoreFormula(r),'8,000点 ×（役1＋ドラ0） ＝ 8,000点');
});
test('6500 x role 2 is total 13000 shared among three, including dealer x1.5',()=>{
  const hand=[1,1,11,21,5],players=Array.from({length:4},(_,i)=>({name:`席${i}`,bet:6500,hand}));
  const r=settlement(players,1,[0,2,3],33,true,hand,0);
  assert.equal(r.total,13000);assert.deepEqual(r.deltas,[-6500,13000,-3250,-3250]);
  assert.equal(scoreFormula(r),'6,500点 ×（役2＋ドラ0） ＝ 13,000点');
  const html=scoreDetails({...r,winner:1},players);assert.match(html,/13,000点を3人で分担/);assert.doesNotMatch(html,/× 3人/);
  const parent=settlement(players,0,[1,2,3],33,true,hand,0);assert.equal(parent.total,19500);assert.deepEqual(parent.deltas,[19500,-6500,-6500,-6500]);
  for(let dealer=0;dealer<4;dealer++)for(let winner=0;winner<4;winner++)for(const stake of [100,6500,25000]){
    players[winner].bet=stake;const payers=[0,1,2,3].filter(i=>i!==winner);
    const split=settlement(players,winner,payers,33,true,hand,dealer),ron=settlement(players,winner,[payers[0]],33,true,hand,dealer);
    assert.equal(split.total,ron.total);assert.equal(split.payments.reduce((n,p)=>n+p.amount,0),split.total);assert.equal(split.deltas.reduce((n,d)=>n+d,0),0);
    assert.ok(split.payments.every(p=>Number.isInteger(p.amount)&&p.amount%25===0));
  }
});

test('role x2 plus two dora becomes x4; dealer multiplies the result by 1.5',()=>{
  const hand=[1,1,11,21,5],players=Array.from({length:4},(_,i)=>({name:`席${i}`,bet:8000,hand}));
  const child=settlement(players,1,[0,2,3],1,true,hand,0);
  assert.equal(child.bonus.base,2);assert.equal(child.bonus.dora,2);assert.equal(child.bonus.multiplier,4);
  assert.equal(child.baseAmount,32000);assert.equal(child.total,32000);assert.deepEqual(child.deltas,[-16000,32000,-8000,-8000]);
  const parent=settlement(players,0,[1,2,3],1,true,hand,0);
  assert.equal(parent.dealerMultiplier,1.5);assert.equal(parent.amount,48000);assert.equal(parent.total,48000);
  assert.deepEqual(parent.deltas,[48000,-16000,-16000,-16000]);
  const html=scoreDetails({...parent,winner:0},players);
  assert.match(html,/タンヤオ：×2/);assert.match(html,/2枚：＋2/);assert.match(html,/32,000 × 1.5 ＝ 48,000点/);assert.match(html,/48,000点を3人で分担/);assert.doesNotMatch(html,/× 3人/);
});
test('dealer ron is x1.5, child ron is unchanged, and small split payments stay exact',()=>{
  const players=Array.from({length:4},()=>({bet:8000,hand:examples[1][1]}));
  assert.deepEqual(settlement(players,0,[1],8,true,players[0].hand,0).deltas,[12000,-12000,0,0]);
  assert.deepEqual(settlement(players,1,[0],8,true,players[1].hand,0).deltas,[-8000,8000,0,0]);
  players[1].bet=100;const r=settlement(players,1,[0,2,3],8,true,players[1].hand,0);
  assert.deepEqual(r.deltas,[-50,100,-25,-25]);assert.equal(r.deltas.reduce((a,n)=>a+n,0),0);
  assert.equal(settlement(players,0,[1],0,false,players[0].hand,0).bonus.multiplier,1);
});
test('dealer wins repeat the same numbered hand, increment honba and retain points',()=>{
  const t=new Table(rng(4));t.players[0].hand=examples[1][1];t.players[0].bet=1000;
  t.pay(0,[1],false,'親の勝ち',t.players[0].hand);assert.equal(t.result.renchan,true);assert.equal(t.matchResult,null);
  const score=t.players[0].score;t.newRound();assert.equal(t.roundLabel,'東1局');assert.equal(t.dealer,0);assert.equal(t.actor,0);assert.equal(t.honba,1);assert.equal(t.handsPlayed,2);assert.equal(t.players[0].score,score);
  t.players[0].hand=examples[1][1];t.pay(0,[1],false,'親の勝ち',t.players[0].hand);t.newRound();assert.equal(t.honba,2);assert.equal(t.round,1);
  t.players[2].hand=examples[1][1];t.players[2].bet=500;t.pay(2,[0],false,'子の勝ち',t.players[2].hand);assert.equal(t.result.renchan,false);
  t.newRound();assert.equal(t.roundLabel,'東2局');assert.equal(t.dealer,1);assert.equal(t.honba,0);
});
test('dealer repeats at the last numbered hand, but bankruptcy always ends play',()=>{
  const t=new Table(rng(4));t.round=8;[22000,22000,21000,35000].forEach((n,i)=>t.players[i].score=n);
  t.players[3].hand=examples[1][1];t.players[3].bet=5000;t.pay(3,[0],false,'親の勝ち',t.players[3].hand);
  assert.equal(t.result.renchan,true);assert.equal(t.matchResult,null);t.newRound();assert.equal(t.round,8);assert.equal(t.honba,1);
  t.players[0].hand=examples[1][1];t.players[0].bet=1000;t.pay(0,[3],false,'子の勝ち',t.players[0].hand);assert.ok(t.matchResult);
  const bust=new Table(rng(1));bust.players[0].hand=examples[1][1];bust.players[0].bet=25000;bust.pay(0,[1],false,'親の勝ち',bust.players[0].hand);
  assert.equal(bust.result.renchan,false);assert.ok(bust.matchResult);assert.equal(bust.newRound(),false);
});
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('half game rotates dealer and ends after exactly eight rounds, including draws',()=>{
  const t=new Table(rng(8));
  [30000,25000,25000,20000].forEach((score,i)=>t.players[i].score=score);
  assert.equal(t.newRound(),false);assert.equal(t.round,1);
  for(let n=1;n<=8;n++) {
    assert.equal(t.roundLabel,`${n<=4?'東':'南'}${(n-1)%4+1}局`);assert.equal(t.dealer,(n-1)%4);
    t.finishDraw();
    if(n<8){assert.equal(t.matchResult,null);assert.equal(t.newRound(),true);}
  }
  assert.match(t.matchResult.reason,/南4局/);assert.equal(t.newRound(),false);assert.equal(t.round,8);
  assert.deepEqual(t.matchResult.rankings.map(v=>v.rank),[1,2,2,4]);
});
test('no 30000-point player extends South to West, then North, stopping at North 4',()=>{
  const t=new Table(rng(8));
  for(let n=1;n<=16;n++) {
    assert.equal(t.roundLabel,`${['東','南','西','北'][Math.floor((n-1)/4)]}${(n-1)%4+1}局`);
    t.finishDraw();
    if(n===8){assert.equal(t.roundLimit,12);assert.match(t.result.extension,/西入/);}
    if(n===12){assert.equal(t.roundLimit,16);assert.match(t.result.extension,/北入/);}
    if(n<16){assert.equal(t.matchResult,null);assert.equal(t.newRound(),true);}
  }
  assert.match(t.matchResult.reason,/北4局/);assert.equal(t.newRound(),false);assert.equal(t.round,16);
  assert.deepEqual(t.matchResult.rankings.map(v=>v.rank),[1,1,1,1]);
});
test('30000 is inclusive and extension fields check the target at the end of the field',()=>{
  for(const endRound of [8,12,16]) {
    const t=new Table(rng(1));t.round=endRound;t.roundLimit=endRound;
    [30000,25000,25000,20000].forEach((score,i)=>t.players[i].score=score);
    t.finishDraw();assert.ok(t.matchResult);assert.match(t.matchResult.reason,/30,000点以上/);
  }
  const t=new Table(rng(1));t.round=8;
  [29900,25000,25000,20100].forEach((score,i)=>t.players[i].score=score);t.finishDraw();assert.equal(t.matchResult,null);assert.equal(t.roundLimit,12);
  t.newRound();t.players[0].score=30000;t.players[3].score=20000;t.finishDraw();assert.equal(t.matchResult,null);
});
test('zero / negative points end after settlement and rank equal scores equally',()=>{
  for(const balance of [1500,1000]) {
    const t=new Table(rng(4));t.players[0].hand=examples[1][1];t.players[1].score=balance;t.players[0].bet=1000;
    const before=t.players.reduce((s,p)=>s+p.score,0);
    t.pay(0,[1],false,'テスト勝ち',t.players[0].hand);
    assert.equal(t.players[1].score,balance-1500);assert.match(t.matchResult.reason,/CPU 南.*0点以下/);
    assert.equal(t.newRound(),false);assert.equal(t.round,1);assert.equal(t.players.reduce((s,p)=>s+p.score,0),before);
    assert.deepEqual(t.matchResult.rankings.map(v=>v.rank),[1,2,2,4]);
    const scores=t.players.map(p=>p.score);t.pay(0,[1],false,'二重精算',t.players[0].hand);assert.deepEqual(t.players.map(p=>p.score),scores);
  }
});
test('last-round tied showdown also ends the half game without point transfers',()=>{
  const t=new Table(rng(1));t.round=8;
  [30000,25000,25000,20000].forEach((score,i)=>t.players[i].score=score);
  t.players[0].hand=t.players[1].hand=examples[1][1];
  t.players[2].hand=[0,10,22,28,32];t.players[3].hand=[0,12,21,27,31];
  t.showdown();assert.equal(t.result.title,'同点・引き分け');assert.ok(t.matchResult);assert.deepEqual(t.result.deltas,[0,0,0,0]);
});
test('CPU raises stakes for strong hands BEFORE showdown and respects its balance',()=>{
  const t=new Table(()=>0);
  for(const p of t.players)p.hand=examples[0][1];
  const p=t.players[1];p.hand=examples[4][1];t.actor=1;p.bet=500;t.cpuStep();
  assert.equal(t.result.winner,1);assert.ok(p.bet>=6500);assert.ok(t.result.amount>=6500);
  assert.equal(t.chooseCpuBet({...p,score:700}),700);
  assert.ok(t.chooseCpuBet({...p,score:25000,hand:examples[0][1]})>=1500);
  assert.ok(t.chooseCpuBet({...p,score:25000,hand:examples[1][1]})>=3000);
});
test('200 complete rounds: tile conservation, locked melds, scores, termination',()=>{
  let calls=0,rons=0;
  for(let seed=1;seed<=200;seed++){
    const t=new Table(rng(seed));let steps=0;
    while(t.phase!=='result'&&steps++<2000){
      const tiles=[...t.wall,t.indicator,...t.excluded,...t.players.flatMap(p=>[...p.hand,...p.river])];
      assert.equal(tiles.length,136);for(let id=0;id<34;id++)assert.equal(tiles.filter(x=>x===id).length,4);
      for(let i=0;i<4;i++){const p=t.players[i];assert.equal(p.hand.length,t.actor===i&&t.phase==='drawn'?6:5);assert.deepEqual(p.hand.slice(0,p.meld.length),p.meld);assert.equal(p.river.length,p.riverMeta.length);}
      if(t.phase==='reaction') {const r=t.reactions(0);const choice=r.ron?'ron':r.calls.length?'call:0':null;const prev=t.players.reduce((s,p)=>s+p.meld.length,0);t.resolveReaction(choice);if(t.players.reduce((s,p)=>s+p.meld.length,0)>prev)calls++;if(t.phase==='result'&&t.result.title.includes('ロン'))rons++;}
      else if(t.actor===0){if(t.phase==='start')t.draw();else if(t.phase==='drawn')t.discard(5);else if(t.phase==='afterDiscard')t.advance();}
      else t.cpuStep();
    }
    assert.equal(t.phase,'result');assert.equal(t.players.reduce((s,p)=>s+p.score,0),100000);
    const tiles=[...t.wall,t.indicator,...t.excluded,...t.players.flatMap(p=>[...p.hand,...p.river])];assert.equal(tiles.length,136);
  }
  assert.ok(calls>0);assert.ok(rons>0);
});
