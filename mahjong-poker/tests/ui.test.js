import test from 'node:test';
import assert from 'node:assert/strict';
import {Table} from '../dist/engine.js';
class Element {
  constructor(){this.innerHTML='';this.textContent='';this.children=[];this.events={};this.dataset={};this.hidden=false;this.attributes={};}
  addEventListener(name,fn){this.events[name]=fn;}
  append(el){this.children.push(el);}
  replaceChildren(){this.children=[];}
  setAttribute(k,v){this.attributes[k]=v;}
  querySelectorAll(){this.discards=[...this.innerHTML.matchAll(/data-discard="(\d+)"/g)].map(m=>{const e=new Element();e.dataset.discard=m[1];return e;});return this.discards;}
}
test('UI event wiring: hidden hands, draw-discard, stake, reveal, next round, tabs',async()=>{
  const elements=new Map(), get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const tabs=['game','rules','probability'].map(id=>{const e=new Element();e.dataset.tab=id;return e;});
  const bets=[1000,3000,5000,10000].map(n=>{const e=new Element();e.dataset.bet=n;return e;});
  const views=['game','rules','probability'].map(id=>{const e=get(id);e.id=id;return e;});
  globalThis.document={getElementById:get,createElement:()=>new Element(),querySelectorAll:s=>s==='[data-tab]'?tabs:s==='[data-bet]'?bets:s==='.view'?views:[]};
  const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout,oldRandom=Math.random,oldMatchMedia=globalThis.matchMedia;
  const compactMedia={matches:true,addEventListener(type,fn){this.changed=fn;}};globalThis.matchMedia=()=>compactMedia;
  let seed=8,scheduled=null;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  globalThis.setTimeout=fn=>{scheduled=fn;return 1;};globalThis.clearTimeout=()=>{scheduled=null;};globalThis.confirm=()=>true;
  const tick=()=>{const fn=scheduled;assert.equal(typeof fn,'function');scheduled=null;fn();};
  try{
    await import('../dist/game.js');
    assert.equal(get('tableTools').open,false);get('tableTools').open=true;
    assert.equal(get('setupPanel').hidden,false);assert.equal(get('playArea').hidden,true);assert.equal(get('seriesCount').value,3);
    get('startSeries').onclick();assert.equal(get('setupPanel').hidden,true);assert.match(get('seriesInfo').textContent,/第1回.*全3回/);
    assert.equal(get('tableTools').open,true);compactMedia.matches=false;compactMedia.changed();assert.equal(get('tableTools').open,true);
    compactMedia.matches=true;compactMedia.changed();assert.equal(get('tableTools').open,false);
    const restart=()=>{get('newGame').onclick();get('startSeries').onclick();};
    const click=text=>{const e=get('actions').children.find(e=>e.textContent.includes(text));assert.ok(e,`button: ${text}`);e.events.click();};
    const step=()=>{
      const actions=get('actions').children;
      const selected=['この5枚で勝負','次の局','順位を見る','回を始める','総合結果を見る','ロン','見送る','1枚引く','手番を渡す'].map(text=>actions.find(e=>e.textContent.includes(text))).find(Boolean);
      if(selected)selected.events.click();else if(get('yourHand').discards.length)get('yourHand').discards.at(-1).onclick();else tick();
    };
    const untilResult=()=>{let steps=0;while(get('result').hidden&&steps++<2000)step();assert.equal(get('result').hidden,false);};
    assert.equal((get('opponents').innerHTML.match(/aria-label="裏向き"/g)||[]).length,15);
    assert.equal((get('opponents').innerHTML.match(/class="value"/g)||[]).length,0);
    assert.equal((get('yourHand').innerHTML.match(/class="value"/g)||[]).length,5);
    assert.equal(get('stakeAdvice').hidden,false);assert.match(get('stakeAdvice').innerHTML,/賭け点のヒント/);assert.match(get('stakeAdvice').innerHTML,/あと8局/);
    assert.match(get('yourHand').innerHTML,/1萬（ドラ候補・組なし）/);assert.match(get('handHelp').textContent,/組なしで加算なし/);
    assert.equal((get('yourHand').innerHTML.match(/class="dora-badge"/g)||[]).length,1);
    assert.doesNotMatch(get('opponents').innerHTML,/dora-badge|is-dora/);
    assert.equal(get('actions').children.some(e=>e.textContent.includes('勝負')),false);
    bets[3].onclick();assert.equal(get('bet').value,10000);assert.equal(get('compactBet').textContent,'賭け10,000点');
    for(const n of [100,500,1000,5000]){
      get('betStep').events.change({target:{value:String(n)}});
      get('betUp').onclick();assert.equal(get('bet').value,10000+n);
      get('betDown').onclick();assert.equal(get('bet').value,10000);
    }
    let prevented=false;get('bet').events.keydown({key:'ArrowDown',preventDefault:()=>{prevented=true;}});
    assert.equal(prevented,true);assert.equal(get('bet').value,5000);
    get('bet').events.change({target:{value:100}});get('betDown').onclick();assert.equal(get('bet').value,100);assert.equal(get('betDown').disabled,true);
    get('bet').events.change({target:{value:'500000'}});assert.equal(get('bet').value,25000);
    get('betUp').onclick();assert.equal(get('bet').value,25000);assert.equal(get('betUp').disabled,true);
    click('1枚引く');assert.equal(get('yourHand').discards.length,6);
    get('yourHand').discards[5].onclick();assert.equal((get('yourHand').innerHTML.match(/class="value"/g)||[]).length,5);
    assert.doesNotMatch(get('rivers').innerHTML,/tedashi-badge/);assert.match(get('log').innerHTML,/ツモ切り/);
    // A discard must resolve opponents' reactions before the roleless hand auto-passes.
    assert.match(get('message').textContent,/反応を確認/);tick();
    assert.match(get('message').textContent,/役なし.*自動/);assert.equal(get('actions').children.length,0);tick();
    assert.match(get('message').textContent,/CPU 南の手番/);
    restart();untilResult();assert.equal(get('result').hidden,false);
    assert.equal(get('verdictNext').hidden,false);
    assert.equal((get('opponents').innerHTML.match(/aria-label="裏向き"/g)||[]).length,0);
    assert.equal(get('bet').disabled,true);get('verdictNext').onclick();assert.equal(get('result').hidden,true);assert.equal(get('verdictNext').hidden,true);
    assert.equal(get('stakeAdvice').hidden,false);
    restart();untilResult();get('verdictNext').onclick();assert.equal(get('result').hidden,true);
    tabs[2].onclick();assert.equal(get('probability').hidden,false);assert.equal(get('game').hidden,true);
    assert.match(get('probabilityCards').innerHTML,/0\.3157/);
    tabs[0].onclick();let steps=0;
    while(get('matchStandings').hidden&&steps++<1500) {
      step();
    }
    assert.equal(get('matchStandings').hidden,false);assert.match(get('tableStatus').textContent,/優勝/);assert.doesNotMatch(get('tableStatus').textContent,/総合/);
    assert.equal((get('matchStandings').innerHTML.match(/<li /g)||[]).length,4);
    assert.equal(get('actions').children.some(e=>e.textContent.includes('次の局')),false);
    click('第2回を始める');assert.match(get('roundInfo').textContent,/東1局（1\/8）/);assert.equal(get('matchStandings').hidden,true);assert.equal(get('yourScore').textContent,'25,000 点');assert.match(get('seriesProgress').textContent,/1回終了/);
    steps=0;while(!get('tableStatus').textContent.includes('総合')&&steps++<5000)step();
    assert.match(get('tableStatus').textContent,/総合.*優勝/);assert.match(get('seriesProgress').textContent,/3回終了/);assert.equal(get('winningTiles').hidden,true);
    click('回数を選んでもう一度');assert.equal(get('setupPanel').hidden,false);get('startSeries').onclick();
    // Render a real legal ron candidate with the same tile also earlier in the river.
    const originalRound=Table.prototype.newRound;
    Table.prototype.newRound=function(){const ok=originalRound.call(this);this.players[0].hand=[0,1,23,30,30];this.players[1].river=[2,3,2];this.players[1].riverMeta=[{tedashi:true},{tedashi:false},{tedashi:true}];this.players[2].hand=this.players[3].hand=[4,10,22,28,33];this.actor=1;this.phase='reaction';this.last={id:2,from:1};return ok;};
    try{restart();}finally{Table.prototype.newRound=originalRound;}
    assert.equal(get('ronAlert').hidden,false);assert.match(get('ronAlert').innerHTML,/この捨て牌でロンできます/);
    assert.equal((get('rivers').innerHTML.match(/is-ron/g)||[]).length,1);assert.match(get('rivers').innerHTML,/3萬（ロン可）/);
    assert.equal((get('rivers').innerHTML.match(/tedashi-badge/g)||[]).length,2);assert.match(get('rivers').innerHTML,/3萬（ロン可）（手出し）/);
    get('bet').value='8000';get('bet').events.input({target:{value:'8000'}});assert.match(get('bonusPreview').innerHTML,/8,000点/);
    assert.match(get('stakeAdvice').innerHTML,/今の賭け8,000点/);assert.match(get('stakeAdvice').innerHTML,/このロンの形/);
    click('ロン');assert.equal(get('stakeAdvice').hidden,true);assert.equal(get('ronAlert').hidden,true);assert.doesNotMatch(get('rivers').innerHTML,/is-ron/);assert.match(get('result').innerHTML,/得点の内訳/);assert.match(get('result').innerHTML,/8,000点/);
    // A bankruptcy must show the hand winner, even when someone else wins the match.
    Table.prototype.newRound=function(){const ok=originalRound.call(this);this.players[0].hand=[0,0,0,11,11];this.players[0].score=10000;this.players[0].bet=1000;this.players[1].score=1500;this.players[2].score=60000;this.players[3].score=28500;this.pay(0,[1],false,'あなたのロン',this.players[0].hand);return ok;};
    try{restart();}finally{Table.prototype.newRound=originalRound;}
    assert.equal(get('winningTiles').hidden,false);assert.equal(get('winnerPayment').hidden,false);assert.equal(get('matchStandings').hidden,true);
    assert.match(get('tableStatus').textContent,/あなたのロン/);assert.match(get('tableHint').textContent,/フルハウス/);assert.doesNotMatch(get('tableStatus').textContent,/優勝/);
    click('順位を見る');assert.match(get('tableStatus').textContent,/CPU 西の優勝/);assert.doesNotMatch(get('tableStatus').textContent,/総合/);assert.equal(get('winningTiles').hidden,true);assert.match(get('seriesTotals').innerHTML,/60,000点/);
    get('verdictNext').onclick();assert.match(get('seriesInfo').textContent,/第2回/);assert.equal(get('yourScore').textContent,'25,000 点');
    Table.prototype.newRound=function(){const ok=originalRound.call(this);this.players[0].hand=[0,0,20,21,22];this.dora=33;this.players.slice(1).forEach(p=>p.hand=[4,12,22,28,33]);return ok;};
    try{restart();}finally{Table.prototype.newRound=originalRound;}
    assert.equal(get('yourRole').textContent,'1ペア / 平和');assert.match(get('bonusPreview').innerHTML,/平和 ×1/);assert.doesNotMatch(get('bonusPreview').innerHTML,/役なし/);
    assert.match(get('stakeAdvice').innerHTML,/平和/);assert.ok(get('actions').children.some(e=>e.textContent==='この5枚で勝負'));
    click('この5枚で勝負');assert.match(get('tableHint').textContent,/平和/);assert.equal((get('tableHint').textContent.match(/平和/g)||[]).length,1);
    assert.match(get('result').innerHTML,/平和：×1/);assert.doesNotMatch(get('result').innerHTML,/役の加算なし/);
    Table.prototype.newRound=function(){const ok=originalRound.call(this);this.players[0].hand=[0,0,3,33,33];this.dora=32;this.players.slice(1).forEach(p=>p.hand=[1,12,22,28,33]);return ok;};
    try{restart();}finally{Table.prototype.newRound=originalRound;}
    assert.equal(get('yourRole').textContent,'2ペア / ホンイツ');assert.match(get('bonusPreview').innerHTML,/ホンイツ ×2/);assert.match(get('bonusPreview').innerHTML,/役2＋ドラ0/);
    assert.match(get('stakeAdvice').innerHTML,/ホンイツ/);click('この5枚で勝負');assert.equal((get('tableHint').textContent.match(/ホンイツ/g)||[]).length,1);
    assert.match(get('result').innerHTML,/ホンイツ：×2/);assert.match(get('winnerPayment').textContent,/3,000点/);
    Table.prototype.newRound=function(){const ok=originalRound.call(this);this.players[0].hand=[0,0,8,17,26];this.dora=8;this.players.slice(1).forEach(p=>p.hand=[1,12,22,28,33]);return ok;};
    try{restart();}finally{Table.prototype.newRound=originalRound;}
    assert.equal(get('yourRole').textContent,'1ペア');assert.doesNotMatch(get('bonusPreview').innerHTML,/純チャン|清一色/);assert.match(get('bonusPreview').innerHTML,/役1＋ドラ0/);assert.match(get('yourHand').innerHTML,/9萬（ドラ候補・組なし）/);
    Table.prototype.newRound=function(){const ok=originalRound.call(this);this.players[0].hand=[0,0,8,8,8];this.dora=8;this.players.slice(1).forEach(p=>p.hand=[1,12,22,28,33]);return ok;};
    try{restart();}finally{Table.prototype.newRound=originalRound;}
    assert.equal(get('yourRole').textContent,'フルハウス');assert.doesNotMatch(get('yourHand').innerHTML,/is-pending-dora/);assert.match(get('bonusPreview').innerHTML,/役1＋ドラ3/);assert.doesNotMatch(get('bonusPreview').innerHTML,/純チャン/);
    click('この5枚で勝負');assert.match(get('tableHint').textContent,/フルハウス/);assert.doesNotMatch(get('result').innerHTML,/清一色|純チャン/);assert.match(get('winnerPayment').textContent,/6,000点/);
  }finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;Math.random=oldRandom;if(oldMatchMedia)globalThis.matchMedia=oldMatchMedia;else delete globalThis.matchMedia;delete globalThis.document;delete globalThis.confirm;}
});
