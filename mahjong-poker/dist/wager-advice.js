import {bonus,canWin,displayRole} from './rules.js';
const fmt=n=>n.toLocaleString('ja-JP');
const target=30000,maxBet=25000;
const needed=(gap,factor)=>Math.max(100,Math.ceil(gap/factor/100)*100);

export function wagerAdvice(table){
  if(table.phase==='result')return null;
  const p=table.players[0],remaining=Math.max(1,table.roundLimit-table.round+1),gap=Math.max(0,target-p.score);
  const boundary=table.roundLimit===8?'南4局':table.roundLimit===12?'西4局':'北4局';
  const info={remaining,gap,boundary,score:p.score,bet:p.bet,late:remaining<=2};
  if(!gap)return {...info,reached:true};
  info.paceStake=needed(gap,remaining);
  const dealerFactor=table.dealer===0?1.5:1;
  const current=p.hand.length===5&&canWin(p.hand)?p.hand:null;
  const reaction=table.phase==='reaction'?table.reactions(0).ron:null;
  function outcome(hand){
    const b=bonus(hand,table.dora,true,p.meld),factor=b.multiplier*dealerFactor;
    return {role:displayRole(hand,p.meld),bonus:b,needed:needed(gap,factor),after:p.score+p.bet*factor};
  }
  if(reaction)info.ron={...outcome(reaction.hand),reaction:true};
  else if(current)info.ron=outcome(current);
  if(current)info.tsumo=outcome(current);
  info.dealerFactor=dealerFactor;
  info.canReach=Boolean(info.ron?.after>=target||info.tsumo?.after>=target);
  return info;
}

export function wagerAdviceHTML(table){
  const a=wagerAdvice(table);if(!a)return '';
  const heading=`<span class="eyebrow">STAKE HINT</span><h2>賭け点のヒント</h2><p class="advice-timing"><b>${a.boundary}の判定まで、あと${a.remaining}局</b><br>今の局を含む・連荘で増える場合あり</p>`;
  if(a.reached)return `${heading}<p>現在 <b>${fmt(a.score)}点</b>。30,000点に到達中です。</p>`;
  const pace=a.paceStake>maxBet?'上限25,000点でも不足する計算です':`1局 <b>${fmt(a.paceStake)}点</b>が目安です`;
  const warning=a.bet<a.paceStake&&!a.canReach?' 今の賭け点では届かないかも。':'';
  const formatNeeded=n=>n>maxBet?'上限25,000点でも不足':`${fmt(n)}点以上`;
  const shape=(name,v)=>v?`<div><b>${name}：${formatNeeded(v.needed)}</b><small>${v.reaction?'このロンの形':'今の5枚'}：${v.role}／役${v.bonus.base}＋ドラ${v.bonus.dora}${a.dealerFactor===1.5?'／親1.5倍':''}<br>今の賭け${fmt(a.bet)}点で勝てば ${fmt(v.after)}点</small></div>`:'';
  const current=a.ron||a.tsumo?`<div class="advice-current"><h3>1勝で30,000点に届く目安</h3>${shape(a.ron?.reaction?'この捨て牌でロン':'ロン（今の倍率で仮計算）',a.ron)}${shape('ツモ・自分から勝負',a.tsumo)}</div>`:`<p>${table.players[0].hand.length===6?'1枚捨てると、':'役ができると、'}今の手で届く賭け点を計算します。</p>`;
  return `${heading}<p>現在 <b>${fmt(a.score)}点</b>。30,000点まであと <b>${fmt(a.gap)}点</b>。</p><p>役・ドラなしの子ロンで、残り${a.remaining}局を1勝ずつできるなら、${pace}。${warning}</p>${current}<small>役・ドラ次第で、少ない賭け点でも届くかも。ロンの可否・倍率は完成した手で決まります。返り討ちは役・ドラ倍率なし。連荘・西入・北入や失点でも変わる目安です。</small>`;
}
