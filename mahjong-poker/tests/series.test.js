import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchSeries} from '../dist/series.js';
import {Table} from '../dist/engine.js';

function ended(scores){const t=new Table();scores.forEach((n,i)=>t.players[i].score=n);t.finishDraw();t.matchResult={reason:'test',rankings:t.standings()};return t;}

test('series defaults to three and validates the requested match count',()=>{
  assert.equal(new MatchSeries().limit,3);
  for(const n of ['',0,-1,NaN,Infinity])assert.equal(new MatchSeries(n).limit,3);
  assert.equal(new MatchSeries(1).limit,1);assert.equal(new MatchSeries(5).limit,5);
  assert.equal(new MatchSeries(1000).limit,99);assert.equal(new MatchSeries(3.8).limit,3);
});
test('cumulative balances include negatives, ties and all three matches exactly once',()=>{
  const s=new MatchSeries(),a=ended([60000,-10000,25000,25000]),b=ended([10000,40000,25000,25000]),c=ended([5000,25000,35000,35000]);
  assert.equal(s.record(new Table()),false);assert.equal(s.completed,0);
  assert.equal(s.record(a),true);assert.equal(s.record(a),false);assert.deepEqual(s.totals,[60000,-10000,25000,25000]);
  assert.equal(s.record(b),true);assert.equal(s.finished,false);assert.equal(s.record(c),true);assert.equal(s.finished,true);
  assert.deepEqual(s.totals,[75000,55000,85000,85000]);assert.equal(s.totals.reduce((a,b)=>a+b,0),300000);
  assert.deepEqual(s.standings(a.players).map(v=>[v.i,v.rank]),[[2,1],[3,1],[0,3],[1,4]]);
  assert.equal(s.record(ended([25000,25000,25000,25000])),false);assert.equal(s.completed,3);
  a.players[0].score=0;assert.equal(s.matches[0].scores[0],60000);
});
test('one-match series finishes immediately and a new table starts with fresh balances',()=>{
  const s=new MatchSeries(1),t=ended([60000,30000,10000,0]);s.record(t);assert.equal(s.finished,true);
  const next=new Table();assert.deepEqual(next.players.map(p=>p.score),[25000,25000,25000,25000]);
  assert.deepEqual(s.totals,[60000,30000,10000,0]);
});
