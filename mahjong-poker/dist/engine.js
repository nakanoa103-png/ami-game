import {evaluate,canWin,compare,makeWall,nextDora,callOptions,ronCandidate,settlement,label,strength,displayRole,bestFive} from './rules.js';
function betCeiling(score) {
  const points=Math.min(25000,Math.max(0,Number(score)||0));
  return points<100?points:Math.floor(points/100)*100;
}
function clampBet(amount,score,minBet=100) {
  const ceiling=betCeiling(score);
  if(ceiling<=0)return 0;
  const minimum=Math.min(minBet,ceiling),value=Number(amount);
  const rounded=ceiling<100?value:Math.round((Number.isFinite(value)?value:minimum)/100)*100;
  return Math.max(minimum,Math.min(ceiling,rounded));
}
export function quality(hand) {
  const e=evaluate(hand), counts=new Map();hand.forEach(id=>counts.set(id,(counts.get(id)||0)+1));
  const suitCounts=[0,0,0,0,0];hand.forEach(id=>suitCounts[id<27?Math.floor(id/9):id<31?3:4]++);
  let near=0;
  for(let start=1;start<=5;start++) near=Math.max(near,new Set(hand.filter(id=>id<27&&id%9+1>=start&&id%9+1<=start+4).map(id=>id%9)).size);
  return e.rank*10000 + Math.max(...suitCounts)*100 + near*60 + [...counts.values()].reduce((a,n)=>a+n*n*20,0) + hand.reduce((a,id)=>a+strength(id),0);
}
export class Table {
  constructor(random=Math.random) {this.random=random;this.round=0;this.honba=0;this.handsPlayed=0;this.roundLimit=8;this.matchResult=null;this.players=['あなた','CPU 南','CPU 西','CPU 北'].map(name=>({name,score:25000,bet:1000,hand:[],meld:[],river:[]}));this.logs=[];this.newRound();}
  get dealer() {return (this.round-1)%4;}
  get roundWind() {return ['東','南','西','北'][Math.floor((this.round-1)/4)];}
  get roundLabel() {return `${this.roundWind}${(this.round-1)%4+1}局`;}
  get betLimit() {return betCeiling(this.players[0].score);}
  get minimumBet() {return 500+Math.max(0,this.handsPlayed-1)*500;}
  standings() {
    const rows=this.players.map((p,i)=>({i,name:p.name,score:p.score})).sort((a,b)=>b.score-a.score||a.i-b.i);
    rows.forEach((p,j)=>{p.rank=j>0&&p.score===rows[j-1].score?rows[j-1].rank:j+1;});return rows;
  }
  minimumBetFor(playerIndex) {
    const row=this.standings().find(v=>v.i===playerIndex);
    const below=this.standings().filter(v=>row&&v.rank>row.rank).map(v=>this.players[v.i].bet+100);
    return Math.max(this.minimumBet,...below);
  }
  enforceBetOrder() {
    const rows=this.standings();
    for(let j=rows.length-1;j>=0;j--) {
      const row=rows[j],p=this.players[row.i];
      const below=rows.filter(v=>v.rank>row.rank).map(v=>this.players[v.i].bet+100);
      const required=Math.max(this.minimumBet,...below);
      p.bet=clampBet(Math.max(p.bet,required),p.score,this.minimumBet);
    }
  }
  closeRound() {
    this.phase='result';
    const busted=this.players.filter(p=>p.score<=0);
    this.result.renchan=!busted.length&&this.result.winner===this.dealer;
    if(this.result.renchan) {
      this.result.continuation=`親の${this.players[this.dealer].name}が勝ったので連荘。次も${this.roundLabel}、${this.honba+1}本場です。`;
      this.log(this.result.continuation);return;
    }
    let reason=null;
    if(busted.length)reason=`${busted.map(p=>p.name).join('・')}が0点以下になったため終了。`;
    else if(this.round>=this.roundLimit) {
      const reachedTarget=this.players.some(p=>p.score>=30000);
      if(!reachedTarget&&this.round<16) {
        this.roundLimit+=4;
        this.result.extension=`全員が30,000点未満のため${this.round===8?'西入':'北入'}。次は${this.round===8?'西':'北'}1局です。`;
        this.log(this.result.extension);
      } else reason=this.round===16&&!reachedTarget?'北4局まで終わったため、ここで対局終了。':`${this.roundLabel}終了。30,000点以上のプレイヤーがいるため対局終了。`;
    }
    if(reason){
      const top=this.standings()[0],topAward={player:top.i,amount:20000};
      this.players[top.i].score+=topAward.amount;
      this.matchResult={reason,topAward,rankings:this.standings()};
      this.result.topAward=topAward;
      this.log(`${this.players[top.i].name}にトップ賞${topAward.amount.toLocaleString()}点。`);
      this.log(reason);
    }
  }
  chooseCpuBet(player) {
    const ranges=[[1500,2500],[3000,4500],[4500,6500],[5500,8000],[6500,9000],[7000,10000],[8000,12000],[10000,15000],[12000,18000],[15000,25000]];
    const [low,high]=ranges[evaluate(player.hand).rank];
    const bet=low+Math.floor(this.random()*((high-low)/500+1))*500;
    return clampBet(bet,player.score,this.minimumBet);
  }
  log(s) {this.logs.unshift(s);this.logs=this.logs.slice(0,40);}
  sorted(hand,meld) {return [...meld,...hand.slice(meld.length).sort((a,b)=>a-b)];}
  newRound() {
    if(this.matchResult||(this.round>0&&this.phase!=='result'))return false;
    if(this.round>0&&this.result?.renchan)this.honba++;else{this.round++;this.honba=0;}
    this.handsPlayed++;this.wall=makeWall(this.random);this.indicator=this.wall.pop();this.dora=nextDora(this.indicator);
    this.players.forEach(p=>{p.hand=[];p.meld=[];p.river=[];p.riverMeta=[];p.drawnIndex=null;});
    for(let n=0;n<5;n++)for(const p of this.players)p.hand.push(this.wall.pop());
    this.players.forEach((p,i)=>{p.hand.sort((a,b)=>a-b);p.bet=i?this.chooseCpuBet(p):clampBet(p.bet,p.score,this.minimumBet);});
    this.enforceBetOrder();
    this.actor=(this.round-1)%4;this.phase='start';this.last=null;this.result=null;this.excluded=[];this.logs=[];
    this.log(`${this.roundLabel}${this.honba?` ${this.honba}本場`:''}（${this.round}/${this.roundLimit}局予定・${this.handsPlayed}戦目）。親：${this.players[this.dealer].name}から開始。`);return true;
  }
  setBet(n) {if(this.phase==='result')return;this.players[0].bet=clampBet(n,this.players[0].score,Math.max(this.minimumBet,this.minimumBetFor(0)));this.enforceBetOrder();}
  draw() {
    if(this.phase!=='start')throw new Error('今は引けません');
    if(!this.wall.length){this.finishDraw();return;}
    const p=this.players[this.actor];p.drawnIndex=p.hand.length;p.hand.push(this.wall.pop());this.phase='drawn';this.log(`${p.name}が1枚ツモ。`);
  }
  discard(index) {
    if(this.phase!=='drawn')throw new Error('今は捨てられません');
    const p=this.players[this.actor];if(index<p.meld.length||index>=p.hand.length)throw new Error('鳴いた牌は固定です');
    const tedashi=index!==p.drawnIndex;
    const [id]=p.hand.splice(index,1);p.hand=this.sorted(p.hand,p.meld);p.river.push(id);p.riverMeta.push({tedashi});p.drawnIndex=null;
    this.last={id,from:this.actor,tedashi};this.phase='reaction';this.log(`${p.name} → ${label(id)}を${tedashi?'手出し':'ツモ切り'}。`);
  }
  tsumo(discardIndex=null) {
    if(this.phase!=='drawn')return false;
    const winner=this.actor,p=this.players[winner];
    if(!Number.isInteger(p.drawnIndex))return false;
    const locked=[...Array.from({length:p.meld.length},(_,i)=>i),p.drawnIndex];
    let best;
    if(Number.isInteger(discardIndex)) {
      if(discardIndex<p.meld.length||discardIndex>=p.hand.length||discardIndex===p.drawnIndex)return false;
      const hand=p.hand.filter((_,i)=>i!==discardIndex),evaluation=evaluate(hand);
      if(!canWin(hand))return false;
      best={hand,evaluation,drop:discardIndex};
    } else best=bestFive(p.hand,locked);
    if(!best||!canWin(best.hand))return false;
    if(best.drop>=0)this.excluded.push(p.hand[best.drop]);
    p.hand=best.hand;p.drawnIndex=null;
    const entries=this.players.map((player,i)=>({i,e:evaluate(player.hand)})).filter(v=>canWin(this.players[v.i].hand)).sort((a,b)=>compare(b.e,a.e));
    if(entries.length>1&&compare(entries[0].e,entries[1].e)===0) {
      this.result={title:'同点・引き分け',text:'最強の手牌が完全同点。点数移動なし。',deltas:[0,0,0,0]};
      this.log('完全同点で引き分け。');this.closeRound();return true;
    }
    if(entries[0].i!==winner) {
      const counter=entries[0].i;
      this.log(`${p.name}のツモを${this.players[counter].name}が返り討ち。`);
      this.pay(counter,[winner],false,`${this.players[counter].name}の返り討ち`,this.players[counter].hand,winner);
      return true;
    }
    this.log(`${p.name}がツモ。${displayRole(p.hand,p.meld)}。`);
    this.pay(winner,this.players.map((_,i)=>i).filter(i=>i!==winner),true,`${p.name}のツモ`,p.hand,winner);
    return true;
  }
  reactions(who) {
    if(this.phase!=='reaction'||who===this.last.from)return {ron:null,calls:[]};
    const p=this.players[who],locked=p.meld.map((_,i)=>i);
    return {ron:ronCandidate(p.hand,this.last.id,'straight',locked),calls:p.meld.length?[]:callOptions(p.hand,this.last.id,who===(this.last.from+1)%4)};
  }
  resolveReaction(humanChoice=null) {
    if(this.phase!=='reaction')return;
    const from=this.last.from, candidates=[];
    for(let step=1;step<=3;step++) {const i=(from+step)%4,r=this.reactions(i);if(r.ron&&(i!==0||humanChoice==='ron'))candidates.push({i,...r.ron,step});}
    if(candidates.length) {
      candidates.sort((a,b)=>compare(b.evaluation,a.evaluation)||a.step-b.step);const win=candidates[0];
      this.excluded.push(this.players[win.i].hand[win.drop]);this.players[win.i].hand=win.hand;this.players[from].river.pop();this.players[from].riverMeta.pop();
      this.pay(win.i,[from],true,`${this.players[win.i].name}のロン`,win.hand);return;
    }
    const claims=[];
    for(let step=1;step<=3;step++) {
      const i=(from+step)%4,p=this.players[i],r=this.reactions(i);
      for(let n=0;n<r.calls.length;n++) {
        const c=r.calls[n];if(i===0) {if(humanChoice!==`call:${n}`)continue;}
        else {
          const remaining=p.hand.filter((_,k)=>!c.indices.includes(k));const meld=[...c.indices.map(k=>p.hand[k]),this.last.id].sort((a,b)=>a-b);
          const possibilities=remaining.map((_,k)=>[...meld,...remaining.filter((_,j)=>j!==k)]);
          if(Math.max(...possibilities.map(quality))<=quality(p.hand)+70)continue;
        }
        claims.push({i,c,step});
      }
    }
    claims.sort((a,b)=>(a.c.type==='ポン'?0:1)-(b.c.type==='ポン'?0:1)||a.step-b.step);
    if(claims.length) {
      const {i,c}=claims[0],p=this.players[i];const meld=[...c.indices.map(k=>p.hand[k]),this.last.id].sort((a,b)=>a-b);
      const free=p.hand.filter((_,k)=>!c.indices.includes(k));p.meld=meld;p.hand=[...meld,...free];
      this.players[from].river.pop();this.players[from].riverMeta.pop();p.drawnIndex=null;this.actor=i;this.phase='drawn';this.log(`${p.name}が${label(this.last.id)}を${c.type}。残りから1枚捨てる。`);return;
    }
    this.actor=from;this.phase='afterDiscard';
  }
  advance() {if(this.phase!=='afterDiscard')return;this.actor=(this.actor+1)%4;this.phase='start';if(!this.wall.length)this.finishDraw();}
  showdown() {
    if(!['start','afterDiscard'].includes(this.phase))throw new Error('5枚のときだけ勝負できます');
    if(!canWin(this.players[this.actor].hand))return false;
    const initiator=this.actor, entries=this.players.map((p,i)=>({i,e:evaluate(p.hand)})).filter(v=>canWin(this.players[v.i].hand));entries.sort((a,b)=>compare(b.e,a.e));
    if(entries.length>1&&compare(entries[0].e,entries[1].e)===0) {this.result={title:'同点・引き分け',text:'最強の手牌が完全同点。点数移動なし。',deltas:[0,0,0,0]};this.log('完全同点で引き分け。');this.closeRound();return;}
    const winner=entries[0].i, payers=winner===initiator?[0,1,2,3].filter(i=>i!==winner):[initiator];
    this.log(`${this.players[initiator].name}が勝負を宣言。全員公開。`);
    this.pay(winner,payers,winner===initiator,`${this.players[winner].name}の勝ち`,this.players[winner].hand,initiator);
  }
  pay(winner,payers,initiated,title,hand,initiator=null) {
    if(this.phase==='result'||!canWin(hand))return false;
    const result=settlement(this.players,winner,payers,this.dora,initiated,hand,this.dealer);
    if(!initiated)result.mode='retaliation';
    result.deltas.forEach((d,i)=>this.players[i].score+=d);
    const role=displayRole(hand,this.players[winner].meld||[]),b=result.bonus;
    this.result={...result,winner,initiator,title,text:`${role} / 賭け点${result.stake.toLocaleString()}点 ×（役${b.base}＋ドラ${b.dora}）${result.winnerIsDealer?' × 親1.5':''}。受取総額${result.total.toLocaleString()}点。${initiated?'':'（返り討ち：役・ドラの倍率は1）'}`};
    this.log(`${title}。${result.payments.map(v=>`${this.players[v.payer].name}から${v.amount.toLocaleString()}点`).join('・')}。`);this.closeRound();
  }
  finishDraw() {if(this.phase==='result')return;this.result={title:'流局',text:'山がなくなりました。点数移動なし。',deltas:[0,0,0,0]};this.log('山切れで流局。');this.closeRound();}
  cpuStep() {
    if(this.actor===0)return;
    const p=this.players[this.actor];
    if(this.phase==='start') {
      p.bet=this.chooseCpuBet(p);this.enforceBetOrder();
      const e=evaluate(p.hand);
      if(e.rank>=4 || (e.rank>=2 && this.random()<.12) || (this.wall.length<25&&e.rank>=1&&this.random()<.15)) {this.showdown();return;}
      this.draw();
    } else if(this.phase==='drawn') {
      if(this.tsumo())return;
      let best=-Infinity,drop=p.meld.length;
      for(let i=p.meld.length;i<p.hand.length;i++){const q=quality(p.hand.filter((_,j)=>j!==i));if(q>best){best=q;drop=i;}}
      this.discard(drop);p.bet=this.chooseCpuBet(p);this.enforceBetOrder();
    } else if(this.phase==='afterDiscard')this.advance();
  }
}
