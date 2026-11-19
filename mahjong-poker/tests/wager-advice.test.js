import test from 'node:test';
import assert from 'node:assert/strict';
import {Table} from '../dist/engine.js';
import {settlement} from '../dist/rules.js';
import {wagerAdvice,wagerAdviceHTML} from '../dist/wager-advice.js';
function situation(){const t=new Table();t.round=7;t.players[0].score=20000;t.players[0].bet=1000;t.players[0].hand=[0,0,11,23,33];t.dora=32;return t;}

test('20000 points with two scheduled hands left shows a conditional 5000-point pace',()=>{
  const t=situation(),a=wagerAdvice(t);
  assert.equal(a.remaining,2);assert.equal(a.gap,10000);assert.equal(a.paceStake,5000);assert.equal(a.boundary,'南4局');assert.equal(a.late,true);
  const html=wagerAdviceHTML(t);assert.match(html,/今の局を含む/);assert.match(html,/役・ドラなしの子ロン/);assert.match(html,/5,000点/);assert.match(html,/届かないかも/);assert.doesNotMatch(html,/最低/);
});
test('current hand uses role plus dora, and rounds sufficient stakes up to 100 points',()=>{
  const t=situation();t.players[0].hand=[1,1,11,21,5];t.dora=1;
  const a=wagerAdvice(t);assert.equal(a.ron.bonus.multiplier,4);assert.equal(a.ron.needed,2500);assert.equal(a.tsumo.needed,2500);
  assert.equal(a.ron.after,24000);assert.equal(a.tsumo.after,24000);assert.equal(a.canReach,false);
  assert.match(wagerAdviceHTML(t),/今の賭け点では届かない/);assert.match(wagerAdviceHTML(t),/今の倍率で仮計算/);
  for(const [mode,payers] of [['ron',[1]],['tsumo',[1,2,3]]]){
    const stake=a[mode].needed;t.players[0].bet=stake;
    const r=settlement(t.players,0,payers,t.dora,true,t.players[0].hand,t.dealer);assert.ok(20000+r.total>=30000);
    t.players[0].bet=stake-100;const below=settlement(t.players,0,payers,t.dora,true,t.players[0].hand,t.dealer);assert.ok(20000+below.total<30000);
  }
  t.players[0].bet=2500;assert.equal(wagerAdvice(t).canReach,true);assert.doesNotMatch(wagerAdviceHTML(t),/今の賭け点では届かない/);
});
test('dealer x1.5, final hand, extensions and renchan preserve the correct boundary',()=>{
  const t=situation();t.round=5;let a=wagerAdvice(t);assert.equal(a.dealerFactor,1.5);assert.equal(a.ron.needed,6700);assert.equal(a.tsumo.needed,6700);
  for(const [round,limit,remaining,boundary] of [[8,8,1,'南4局'],[11,12,2,'西4局'],[16,16,1,'北4局']]){
    t.round=round;t.roundLimit=limit;t.honba=3;a=wagerAdvice(t);assert.equal(a.remaining,remaining);assert.equal(a.boundary,boundary);
  }
});
test('roleless and six-tile hands never get winning projections; upper limit is explicit',()=>{
  const t=situation();t.players[0].hand=[0,11,23,29,33];let a=wagerAdvice(t);assert.equal(a.ron,undefined);assert.equal(a.tsumo,undefined);assert.match(wagerAdviceHTML(t),/役ができると/);
  t.players[0].hand=[0,0,11,23,33,1];assert.match(wagerAdviceHTML(t),/1枚捨てると/);
  t.players[0].hand=[0,0,11,23,33];t.players[0].score=-100000;t.round=8;assert.match(wagerAdviceHTML(t),/上限25,000点でも不足/);
});
test('available ron uses the completed hand, rather than the old five tiles',()=>{
  const t=situation();t.players[0].hand=[0,1,23,30,30];t.last={id:2,from:1};t.phase='reaction';t.dora=30;
  const a=wagerAdvice(t);assert.equal(a.ron.reaction,true);assert.equal(a.ron.bonus.base,2);assert.equal(a.ron.bonus.dora,2);assert.equal(a.ron.needed,2500);assert.match(wagerAdviceHTML(t),/このロンの形/);
});
test('honitsu with an honor pair also updates the 30000-point stake advice',()=>{
  const t=situation();t.players[0].hand=[10,10,12,33,33];t.dora=31;
  const a=wagerAdvice(t);assert.match(a.ron.role,/ホンイツ/);assert.deepEqual(a.ron.bonus.names,['ホンイツ']);assert.equal(a.ron.bonus.multiplier,2);assert.equal(a.ron.bonus.dora,0);
  assert.equal(a.ron.needed,5000);assert.equal(a.tsumo.needed,5000);assert.equal(a.tsumo.after,22000);
});
test('loose dora does not inflate the target hint but a completed 999 group does',()=>{
  const t=situation();t.players[0].hand=[0,0,8,17,26];t.dora=8;
  assert.equal(wagerAdvice(t).ron.bonus.multiplier,1);assert.equal(wagerAdvice(t).ron.needed,10000);
  t.players[0].hand=[0,0,8,8,8];assert.equal(wagerAdvice(t).ron.bonus.multiplier,4);assert.equal(wagerAdvice(t).ron.needed,2500);
});

test('target achieved and ended matches do not keep urging larger wagers',()=>{
  const t=situation();t.players[0].score=30000;assert.equal(wagerAdvice(t).reached,true);assert.match(wagerAdviceHTML(t),/到達中/);assert.doesNotMatch(wagerAdviceHTML(t),/届かない/);
  t.phase='result';assert.equal(wagerAdvice(t),null);assert.equal(wagerAdviceHTML(t),'');
});
