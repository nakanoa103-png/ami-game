import {Table} from './engine.js';
import {MatchSeries} from './series.js';
import {label,evaluate,displayRole,groupedDoraIndices,canWin,settlement,probabilities,NAMES,HONORS} from './rules.js';
import {scoreFormula,paymentSummary,scoreDetails} from './score-view.js';
import {wagerAdviceHTML,wagerAdvice} from './wager-advice.js';
import {setupScreenControls} from './screen-view.js';
setupScreenControls(document);
const $=id=>document.getElementById(id), fmt=n=>n.toLocaleString('ja-JP');
let game=null,series=new MatchSeries(),setupOpen=true,resultView='hand',timer=null,betStep=100,selectedDiscard=null;
function tileHTML(id,{mini=false,back=false,locked=false,drawn=false,last=false,dora=false,ron=false,tedashi=false,selectable=false,winningDiscard=false,selectedDiscard=false,index=0}={}) {
  const suit=id<27?['m','s','p'][Math.floor(id/9)]:'h';
  const highlighted=dora&&!back;
  const ronHighlight=ron&&!back;
  const cls=`tile ${mini?'mini':''} ${back?'back':suit} ${!back&&id===31?'white':''} ${!back&&id===32?'green':''} ${!back&&id===33?'red':''} ${locked?'locked':''} ${drawn?'drawn':''} ${last?'last':''} ${highlighted?'is-dora':''} ${ronHighlight?'is-ron':''} ${winningDiscard?'winning-discard':''} ${selectedDiscard?'selected-discard':''} ${selectable?'selectable':''}`;
  const accessibleLabel=`${selectedDiscard?'選択中・':''}${winningDiscard?'捨て牌候補・':''}${back?'裏向き':label(id)}${highlighted?'（ドラ）':''}${ronHighlight?'（ロン可）':''}${tedashi?'（手出し）':''}${locked?'（鳴いて固定）':''}`;
  const attrs=selectable?`data-discard="${index}" aria-label="${accessibleLabel}を捨てる"`:`aria-label="${accessibleLabel}"`;
  const tag=selectable?'button':'span';
  return `<${tag} class="${cls}" ${attrs}>${tedashi?'<span class="tedashi-badge" aria-hidden="true">手</span>':''}${ronHighlight?'<span class="ron-badge" aria-hidden="true">ロン可</span>':''}${highlighted?'<span class="dora-badge" aria-hidden="true">ドラ</span>':''}${back?'':id<27?`<span class="value">${id%9+1}</span><span class="suit" aria-hidden="true">${['💰','|||','●'][Math.floor(id/9)]}</span>`:`<span class="value">${HONORS[id-27]}</span>`}</${tag}>`;
}
function button(text,fn,cls='') {const el=document.createElement('button');el.className=`button ${cls}`;el.textContent=text;el.addEventListener('click',fn);$('actions').append(el);}
function strengthLabel(value) {return value>=27?HONORS[value-27]:`${Math.floor(value/3)+1}${['萬','索','筒'][value%3]}`;}
function compareExplanation(winnerHand,challengerHand) {
  const winner=evaluate(winnerHand),challenger=evaluate(challengerHand);
  if(winner.rank!==challenger.rank)return `役の強さ：${winner.name}が${challenger.name}より上。`;
  const index=winner.key.findIndex((value,i)=>i>0&&value!==challenger.key[i]);
  if(index<0)return '牌の強さも同じです。';
  const group=winner.rank===1?'ペア':winner.rank===2?index===1?'強いペア':'弱いペア':winner.rank===3?'3枚組':winner.rank===6?'3枚組':winner.rank===7?'4枚組':'高い牌';
  return `同じ${winner.name}同士。${group}は${strengthLabel(winner.key[index])}が${strengthLabel(challenger.key[index])}より強い。`;
}
function act(fn) {clearTimeout(timer);fn();render();}
function continueMatch() {
  if(setupOpen||game.phase!=='result')return;
  act(()=>{
    if(!game.matchResult){game.newRound();resultView='hand';}
    else if(resultView==='hand'){series.record(game);resultView='match';}
    else if(resultView==='match'&&series.finished)resultView='series';
    else if(resultView==='series'){setupOpen=true;$('seriesCount').value=series.limit;}
    else {game=new Table();resultView='hand';}
  });
}
function render() {
  clearTimeout(timer);$('setupPanel').hidden=!setupOpen;$('playArea').hidden=setupOpen;
  if(setupOpen)return;
  const p=game.players[0],end=game.phase==='result',human=game.actor===0;
  if(game.phase!=='drawn'||!human)selectedDiscard=null;
  const winningDiscards=new Set(game.phase==='drawn'&&human?p.hand.map((_,i)=>i).filter(i=>i>=p.meld.length&&canWin(p.hand.filter((_,j)=>j!==i))):[]);
  const selectedTsumoHand=Number.isInteger(selectedDiscard)&&selectedDiscard!==p.drawnIndex&&winningDiscards.has(selectedDiscard)?p.hand.filter((_,i)=>i!==selectedDiscard):null;
  const canTsumo=Boolean(selectedTsumoHand&&Number.isInteger(p.drawnIndex));
  const doraIndices=new Set(groupedDoraIndices(p.hand,game.dora,p.meld));
  const response=game.phase==='reaction'?game.reactions(0):{ron:null,calls:[]};
  const over=Boolean(game.matchResult),showRank=over&&resultView!=='hand',showTotal=showRank&&resultView==='series';
  const rankings=showTotal?series.standings(game.players):over?game.matchResult.rankings:[];
  const leaders=showRank?rankings.filter(v=>v.rank===1):[];
  const winner=end&&Number.isInteger(game.result.winner)?game.result.winner:null;
  const countered=winner!==null&&Number.isInteger(game.result.initiator)&&game.result.initiator!==winner;
  const challenger=countered?game.result.initiator:null;
  const showdownReason=countered?compareExplanation(game.players[winner].hand,game.players[challenger].hand):'';
  const isWinner=i=>showRank?leaders.some(v=>v.i===i):winner===i;
  const winnerBadge=showRank?showTotal?'総合1位':'1位':'勝者';
  const matchTitle=showRank?`${leaders.map(v=>v.name).join('・')}の${showTotal?'総合':''}${leaders.length>1?'同点優勝':'優勝'}`:'';
  const winnerRole=winner!==null?[displayRole(game.players[winner].hand,game.players[winner].meld),...(game.result.bonus?.names??[]).filter(name=>!['平和','ホンイツ','5カード','国士無双'].includes(name))].join(' / '):'';
  const deltaText=i=>{const d=game.result.deltas[i];return `${d>0?'+':''}${fmt(d)}点`;};
  $('roundInfo').textContent=`${game.roundLabel}${game.honba?` ${game.honba}本場`:''}（${game.round}/${game.roundLimit}）· 残り${game.wall.length}枚`;
  $('seriesInfo').textContent=showTotal?`全${series.limit}回 終了`:`第${showRank?series.completed:series.completed+1}回 / 全${series.limit}回`;
  $('seriesProgress').textContent=`${series.completed}回終了 / 全${series.limit}回`;
  $('seriesTotals').innerHTML=series.standings(game.players).map(v=>`<li><span>${v.name}</span><b>${fmt(v.score)}点</b></li>`).join('');
  $('windBadge').textContent=`${game.roundWind}場`;
  $('windBadge').setAttribute('class',`wind-badge wind-${Math.floor((game.round-1)/4)}`);
  $('windNote').textContent=over?'対局終了':game.honba?`${game.honba}本場 · 親連荘中`:game.round<=8?'南4局で30,000点判定':game.round<=12?'延長中 · 西4局で30,000点判定':'北4局 · 親の連荘終了で終局';
  $('yourSeat').textContent=`${['東','南','西','北'][(4-game.dealer)%4]}${game.dealer===0?'・親':''}`;
  $('indicator').innerHTML=tileHTML(game.indicator,{mini:true});$('doraLabel').textContent=`ドラ：${label(game.dora)}`;
  $('latestDiscardBox').hidden=game.phase!=='reaction';
  if(game.phase==='reaction'){$('latestDiscardTile').innerHTML=tileHTML(game.last.id,{ron:Boolean(response.ron)});$('latestDiscardSource').textContent=`${game.players[game.last.from].name}の捨て牌`}
  $('yourScore').textContent=`${fmt(p.score)} 点`;$('yourRole').textContent=displayRole(canTsumo?selectedTsumoHand:p.hand.length===5?p.hand:p.hand.slice(0,5),p.meld);
  $('yourHand').innerHTML=p.hand.map((id,i)=>tileHTML(id,{locked:i<p.meld.length,drawn:p.hand.length===6&&i===p.drawnIndex,dora:id===game.dora,winningDiscard:winningDiscards.has(i),selectedDiscard:i===selectedDiscard,selectable:!end&&human&&game.phase==='drawn'&&i>=p.meld.length,index:i})).join('');
  $('yourHand').querySelectorAll('[data-discard]').forEach(el=>el.onclick=()=>{
    const index=Number(el.dataset.discard);
    if(selectedDiscard===index) {
      selectedDiscard=null;
      act(()=>game.discard(index));
      return;
    }
    selectedDiscard=index;
    render();
  });
  $('opponents').innerHTML=game.players.slice(1).map((other,j)=>{const i=j+1;return `<article class="opponent ${game.actor===i&&!end?'active':''} ${isWinner(i)?'winner':''}"><header><span class="seat">${['東','南','西','北'][(i-game.dealer+4)%4]}${i===game.dealer?'・親':''}</span> ${other.name}${isWinner(i)?`<span class="winner-badge">${winnerBadge}</span>`:''}</header><div class="mini-hand">${other.hand.map((id,k)=>tileHTML(id,{mini:true,back:!end&&k>=other.meld.length,locked:k<other.meld.length})).join('')}</div><div class="score">${fmt(other.score)} 点 ${end?`<b class="score-change ${game.result.deltas[i]>0?'gain':game.result.deltas[i]<0?'loss':'neutral'}">${deltaText(i)}</b>`:''}</div><small>賭け ${fmt(other.bet)}点 ${end?'· '+displayRole(other.hand,other.meld):''}</small></article>`;}).join('');
  $('playerZone').setAttribute('class',`player-zone ${isWinner(0)?'winner':''}`);
  $('yourOutcome').hidden=!end;$('yourOutcome').textContent=showRank?`${showTotal?'総合':''}${rankings.find(v=>v.i===0).rank}位`:end?`${winner===0?'勝者 · ':''}${deltaText(0)}`:'';
  $('yourOutcome').setAttribute('class',isWinner(0)?'winner-badge':'player-result');
  $('rivers').innerHTML=game.players.map((other,i)=>`<div class="river"><div class="river-label">${other.name}の河</div><div class="river-tiles ${response.ron&&game.last.from===i?'ron-river':''}">${other.river.map((id,k)=>tileHTML(id,{mini:true,tedashi:Boolean(other.riverMeta[k]?.tedashi),last:game.phase==='reaction'&&game.last.from===i&&k===other.river.length-1,ron:Boolean(response.ron&&game.last.from===i&&k===other.river.length-1)})).join('')||'<span style="font-size:10px;color:#8eac9d">—</span>'}</div></div>`).join('');
  $('ronAlert').hidden=!response.ron;
  $('ronAlert').innerHTML=response.ron?`<span><b>この捨て牌でロンできます</b><small>${game.players[game.last.from].name}の捨て牌はドラ表示牌の横に表示中</small></span>`:'';
  $('log').innerHTML=game.logs.slice(0,12).map(s=>`<li>${s}</li>`).join('');
  document.body?.classList?.toggle('round-ended',end);$('bet').value=p.bet;$('bet').disabled=end;$('betStep').disabled=end;
  updateBonus();$('actions').replaceChildren();$('result').hidden=!end;$('verdictNext').hidden=!end;
  const nextLabel=showTotal?'回数を選んでもう一度':showRank?series.finished?'総合結果を見る →':`第${series.completed+1}回を始める →`:over?'順位を見る →':game.result?.renchan?'次の局へ（親連荘） →':'次の局へ →';
  $('verdictNext').textContent=nextLabel;
  $('verdictNext').setAttribute('aria-label',`${nextLabel.replace(' →','')}（卓中央）`);
  $('matchStandings').hidden=!showRank;
  $('matchStandings').innerHTML=showRank?`<h3>${showTotal?'累計点の総合順位':`第${series.completed}回の順位`}</h3><ol>${rankings.map(v=>`<li class="${v.rank===1?'champion':''}"><b>${v.rank}位</b><span>${v.name}</span><strong>${fmt(v.score)}点</strong></li>`).join('')}</ol>`:'';
  $('tableCenter').setAttribute('class',`table-center ${end?'show-result':''}`);
  $('verdictLabel').textContent=showTotal?'全対局終了':showRank?'半荘終了':end?winner!==null?'この局の勝者':'この局の結果':'FIVE TILE SHOWDOWN';
  $('tableStatus').textContent=showRank?matchTitle:end?game.result.title:game.phase==='reaction'?'その一枚、どうする？':human?'あなたの手番':'思案のとき';
  $('tableHint').textContent=showTotal?`全${series.limit}回の終了時の持ち点を合計しました。`:showRank?game.matchResult.reason:end?winner!==null?`${winnerRole}　｜　${deltaText(winner)} 獲得`:'点数移動なし':`${game.players[game.actor].name} · ${game.phase==='drawn'?'捨て牌を選ぶ':game.phase==='reaction'?'捨て牌への反応待ち':`親：${game.players[game.dealer].name}`}`;
  $('winningTiles').hidden=winner===null||showRank;
  $('winningTiles').innerHTML=winner!==null?countered?`<span class="winning-tiles-label">勝者と勝負した人の手牌</span><div class="counter-showdown"><div class="counter-side"><small>${game.players[winner].name}（勝者） · ${displayRole(game.players[winner].hand,game.players[winner].meld)}</small><div class="winning-hand showdown-hand">${game.players[winner].hand.map(id=>tileHTML(id,{dora:id===game.dora})).join('')}</div></div><b class="showdown-vs">対</b><div class="counter-side"><small>${game.players[challenger].name}（勝負） · ${displayRole(game.players[challenger].hand,game.players[challenger].meld)}</small><div class="winning-hand showdown-hand">${game.players[challenger].hand.map(id=>tileHTML(id,{dora:id===game.dora})).join('')}</div></div></div><p class="showdown-reason">${showdownReason}</p>`:`<span class="winning-tiles-label">勝った5枚</span><div class="winning-hand">${game.players[winner].hand.map(id=>tileHTML(id,{dora:id===game.dora})).join('')}</div>`:'';
  $('winnerPayment').hidden=winner===null||showRank;
  $('winnerPayment').textContent=winner!==null?`${scoreFormula(game.result)}\n${paymentSummary(game.result,game.players)}`:'';
  const help=end?'全員の手牌と点数移動を確認できます。':human&&game.phase==='drawn'&&canTsumo?'選択中の牌をもう一度タップすると捨てます。ツモ上がりは下のボタンから選べます。':human&&game.phase==='drawn'&&Number.isInteger(selectedDiscard)?'選択中の牌をもう一度タップすると捨てます。別の牌をタップして選び直せます。':human&&game.phase==='drawn'&&winningDiscards.size?'捨て牌候補をタップして選択。同じ牌をもう一度タップすると捨てます。':human&&game.phase==='drawn'?'捨てる牌をタップして選択し、もう一度タップすると捨てます。':p.meld.length?'「鳴」の3枚は公開・固定されています。':'相手の手牌は、勝負のときまで裏向き。';
  const doraCount=p.hand.filter(id=>id===game.dora).length,pendingDora=doraCount-doraIndices.size;
  $('handHelp').textContent=`${help}${doraIndices.size?` 組に入ったドラ${doraIndices.size}枚が有効。`:''}${pendingDora?` ドラ${pendingDora}枚は組なしで加算なし。`:''}`;
  if(end) {
    $('message').textContent=showTotal?'全対局が終了しました。累計点で総合優勝が決まりました。':showRank?series.finished?'この回の順位です。次に総合結果を表示します。':`この回の持ち点を累計しました。次は第${series.completed+1}回です。`:over?'この局の上がりと得点を確認したら「順位を見る」へ。':game.result.continuation||game.result.extension||`${game.result.title}。${winner!==null?`${deltaText(winner)}獲得。`:''}点数を引き継いで次の局へ。`;
    $('result').hidden=showRank;
    $('result').innerHTML=`<span class="eyebrow">${over?'最終局の精算':'ROUND RESULT'}</span><h2>${game.result.title}</h2><p>${game.result.text}</p>${game.result.topAward?`<p class="top-award-note">半荘1位のトップ賞：${game.players[game.result.topAward.player].name}に＋${fmt(game.result.topAward.amount)}点</p>`:''}${scoreDetails(game.result,game.players)}<table><thead><tr><th>プレイヤー</th><th>役</th><th>この局の移動</th><th>持ち点（トップ賞後）</th></tr></thead><tbody>${game.players.map((v,i)=>`<tr class="${winner===i?'winner-row':''}"><td>${v.name}${winner===i?' <span class="winner-badge">この局の勝者</span>':''}</td><td>${displayRole(v.hand,v.meld)}</td><td class="${game.result.deltas[i]>=0?'positive':'negative'}">${game.result.deltas[i]>0?'+':''}${fmt(game.result.deltas[i])}</td><td>${fmt(v.score)}</td></tr>`).join('')}</tbody></table>`;
    button(nextLabel,continueMatch,'gold');return;
  }
  if(game.phase==='reaction') {
    const r=response;
    if(r.ron||r.calls.length) {
      $('message').textContent=`${game.players[game.last.from].name}の${label(game.last.id)}。ロン・鳴き、または見送る。`;
      if(r.ron)button(`ロン · ${displayRole(r.ron.hand,p.meld)}`,()=>act(()=>game.resolveReaction('ron')),'danger');
      r.calls.forEach((c,i)=>button(`${c.type}（${c.indices.map(k=>label(p.hand[k])).join('・')}）`,()=>act(()=>game.resolveReaction(`call:${i}`)),'gold'));
      button('見送る',()=>act(()=>game.resolveReaction()),'secondary');
    } else {$('message').textContent='捨て牌への反応を確認しています。';timer=setTimeout(()=>act(()=>game.resolveReaction()),450);}
    return;
  }
  if(human) {
    if(game.phase==='start') {$('message').textContent=canWin(p.hand)?'1枚引くか、現在の5枚で勝負を宣言できます。':evaluate(p.hand).rank===1?'ワンペアだけでは上がれません。順子＋対子、2ペア以上などを作りましょう。':'上がり役がありません。順子＋対子、2ペア以上などを作りましょう。';button('1枚引く',()=>act(()=>game.draw()));if(canWin(p.hand))button('この5枚で勝負',()=>act(()=>game.showdown()),'gold');}
    if(game.phase==='drawn') {
      if(canTsumo){const role=displayRole(selectedTsumoHand,p.meld),discard=selectedDiscard;$('message').textContent=`選択中の牌：${label(p.hand[discard])}。${role}でツモ上がりするか、この牌を捨てるか選んでください。`;button(`ツモ上がり · ${role}`,()=>act(()=>{selectedDiscard=null;game.tsumo(discard); }),'gold');button(`${label(p.hand[discard])}を捨てる`,()=>act(()=>{selectedDiscard=null;game.discard(discard); }),'secondary');}
      else if(Number.isInteger(selectedDiscard)){const discard=selectedDiscard;$('message').textContent=`選択中の牌：${label(p.hand[discard])}。この牌を捨てるか、別の牌を選んでください。`;button(`${label(p.hand[discard])}を捨てる`,()=>act(()=>{selectedDiscard=null;game.discard(discard); }),'secondary');}
      else $('message').textContent=winningDiscards.size?'候補牌をタップして選択し、下のボタンでツモか捨てるか確定してください。':'6枚から捨てる牌をタップして選んでください。';
    }
    if(game.phase==='afterDiscard') {
      if(!canWin(p.hand)) {
        $('message').textContent='上がり条件を満たしていないため、自動で次の人へ手番を渡します。';
        timer=setTimeout(()=>act(()=>{if(game.actor===0&&game.phase==='afterDiscard'&&!canWin(game.players[0].hand))game.advance();}),350);
      } else {$('message').textContent='手牌は5枚。勝負するか、相手に手番を渡します。';button('手番を渡す →',()=>act(()=>game.advance()));button('この5枚で勝負',()=>act(()=>game.showdown()),'gold');}
    }
  } else {$('message').textContent=`${game.players[game.actor].name}の手番です。賭け点は今も変更できます。`;timer=setTimeout(()=>act(()=>game.cpuStep()),650);}
}
function updateBonus() {
  const p=game.players[0],betLimit=game.betLimit,minBet=Math.min(game.minimumBetFor(0),betLimit);
  $('compactBet').textContent=`賭け${fmt(game.players[0].bet)}点`;
  $('betMinimum').textContent=fmt(minBet);$('betLimit').textContent=fmt(betLimit);$('bet').min=minBet;$('bet').max=betLimit;$('bet').step=betLimit<100?'any':'100';
  $('betUp').disabled=game.phase==='result'||p.bet>=betLimit;
  $('betDown').disabled=game.phase==='result'||p.bet<=minBet;
  document.querySelectorAll('[data-bet]').forEach(el=>el.disabled=game.phase==='result'||Number(el.dataset.bet)<minBet||Number(el.dataset.bet)>betLimit);
  const advice=wagerAdvice(game);
  $('stakeAdvice').hidden=!advice;
  $('stakeAdvice').setAttribute('class',`side-card stake-advice ${advice?.late&&!advice.reached?'near-end':''}`);
  $('stakeAdvice').innerHTML=wagerAdviceHTML(game);
  let previewHand=p.hand;
  if(p.hand.length===6){if(Number.isInteger(selectedDiscard)&&selectedDiscard!==p.drawnIndex){previewHand=p.hand.filter((_,i)=>i!==selectedDiscard);if(!canWin(previewHand)){$('bonusPreview').textContent='役ができる捨て牌候補を選んでください。';return;}}else{$('bonusPreview').textContent='役ができる捨て牌候補を選ぶと精算目安が表示されます。';return;}}
  else if(p.hand.length!==5){$('bonusPreview').textContent='1枚捨てると倍率の目安が表示されます。';return;}
  if(!canWin(previewHand)){$('bonusPreview').textContent=evaluate(previewHand).rank===1?'ワンペアだけでは上がれません。順子＋対子、2ペア以上、または他の役が必要です。':'上がり役がありません。順子＋対子、2ペア以上、または他の役が必要です。';return;}
  const preview=settlement(game.players,0,[1,2,3],game.dora,true,previewHand,game.dealer);
  $('bonusPreview').innerHTML=`${preview.bonus.names.length?`<b>${preview.bonus.names.join('・')} ×${preview.bonus.base}</b><br>`:''}${p.hand.length===6?'ツモ上がりすれば':'宣言して勝てば'} <b>総額${fmt(preview.total)}点</b><br>${scoreFormula(preview)}<br>${paymentSummary(preview,game.players)}`;
}
$('bet').addEventListener('input',e=>{const value=Number(e.target.value),limit=game.betLimit;if(Number.isFinite(value)&&(limit<100?value>=limit:value>=100&&value%100===0)&&value<=limit){game.setBet(value);$('bet').value=game.players[0].bet;updateBonus();}});
$('bet').addEventListener('change',e=>{game.setBet(e.target.value);$('bet').value=game.players[0].bet;updateBonus();});
$('betStep').addEventListener('change',e=>{const n=Number(e.target.value);if([100,500,1000,5000].includes(n))betStep=n;});
function adjustBet(direction){game.setBet(game.players[0].bet+direction*betStep);$('bet').value=game.players[0].bet;updateBonus();}
$('betUp').onclick=()=>adjustBet(1);$('betDown').onclick=()=>adjustBet(-1);
$('bet').addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();adjustBet(e.key==='ArrowUp'?1:-1);}});
$('verdictNext').onclick=continueMatch;
document.querySelectorAll('[data-bet]').forEach(el=>el.onclick=()=>{game.setBet(Number(el.dataset.bet));$('bet').value=game.players[0].bet;updateBonus();});
$('seriesCount').value=series.limit;
$('startSeries').onclick=()=>act(()=>{series=new MatchSeries($('seriesCount').value);game=new Table();resultView='hand';setupOpen=false;});
$('newGame').onclick=()=>{if(!setupOpen&&(series.completed||game.handsPlayed>1||game.logs.length>1)){if(!confirm('今回までの累計点をリセットして、回数の設定に戻りますか？'))return;}act(()=>{setupOpen=true;$('seriesCount').value=series.limit;});};
document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===el)));document.querySelectorAll('.view').forEach(view=>view.hidden=view.id!==el.dataset.tab);});
const descriptions=['同じ牌2枚＋残り3枚。順子＋対子なら平和×1','2組のペア＋残り1枚','同じ牌3枚＋残り2枚','種類を問わず数字5連続／字牌5連続','同じ種類5枚。風牌と三元牌は別','同じ牌3枚＋別の同じ牌2枚','同じ牌4枚＋残り1枚','ストレートとフラッシュを同時に満たす','萬・索・筒を問わず、同じ数字5枚。倍率×3','萬・索・筒は各1枚で、すべて1か9。風牌1枚、三元牌1枚を加えた5枚。倍率×6'];
const compactLayout=globalThis.matchMedia?.('(max-width:1024px), (pointer:coarse)');
const adaptTools=()=>{$('tableTools').open=!compactLayout?.matches;};
adaptTools();compactLayout?.addEventListener('change',adaptTools);
$('roleList').innerHTML=NAMES.slice(1).map((name,i)=>`<div class="role-row"><b>${i+1}. ${name}</b><span>${descriptions[i]}</span></div>`).join('');
const prob=probabilities(),pct=n=>(100*n/prob.total).toFixed(4);
$('probabilityCards').innerHTML=[['ストレート',prob.straight,false],['フラッシュ',prob.flush,true],['ストレートフラッシュ',prob.royal,false],['国士無双',prob.kokushi,true]].map(([name,n,featured])=>`<article class="prob-card ${featured?'featured':''}"><h3>${name}</h3><strong>${pct(n)}<small> %</small></strong><p>${fmt(n)} 通り / ${fmt(prob.total)} 通り</p><div class="prob-bar" style="width:${100*n/prob.straight}%"></div></article>`).join('');
$('exclusiveProbability').innerHTML=`<table><thead><tr><th>役を排他的に分類した場合</th><th>組合せ数</th><th>確率</th></tr></thead><tbody><tr><td>ストレートのみ</td><td>${fmt(prob.straightOnly)}</td><td>${pct(prob.straightOnly)}%</td></tr><tr><td>フラッシュのみ</td><td>${fmt(prob.flushOnly)}</td><td>${pct(prob.flushOnly)}%</td></tr><tr><td>ストレートフラッシュ</td><td>${fmt(prob.royal)}</td><td>${pct(prob.royal)}%</td></tr><tr><td>国士無双</td><td>${fmt(prob.kokushi)}</td><td>${pct(prob.kokushi)}%</td></tr></tbody></table>`;
render();
