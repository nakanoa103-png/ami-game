export const HONORS = ['東','南','西','北','白','發','中'];
export const NAMES = ['役なし','1ペア','2ペア','3カード','ストレート','フラッシュ','フルハウス','4カード','ストレートフラッシュ','5カード','国士無双'];
export const tile = id => ({id, suit: id < 27 ? Math.floor(id/9) : 3, value: id < 27 ? id%9+1 : id-26});
export const label = id => id < 27 ? `${id%9+1}${['萬','索','筒'][Math.floor(id/9)]}` : HONORS[id-27];
// Honors outrank all numbers; for equal numbers: 萬 < 索 < 筒.
export const strength = id => id < 27 ? (id%9)*3 + Math.floor(id/9) : id;
export const isOutside = id => id >= 27 || id%9 === 0 || id%9 === 8;
export function compare(a,b) {
  const av = a.key || a, bv = b.key || b;
  for(let i=0;i<Math.max(av.length,bv.length);i++) { const d=(av[i]??-1)-(bv[i]??-1); if(d) return Math.sign(d); }
  return 0;
}
export function evaluate(hand) {
  if(hand.length !== 5) throw new Error('役判定は5枚です');
  const counts = new Map(); hand.forEach(id=>counts.set(id,(counts.get(id)||0)+1));
  if([...counts.values()].some(n=>n>4)) throw new Error('同じ牌は4枚までです');
  const groups=[...counts.entries()].sort((a,b)=>b[1]-a[1] || strength(b[0])-strength(a[0]));
  const descending = [...hand].sort((a,b)=>strength(b)-strength(a));
  const nums = hand.every(id=>id<27), honors=hand.every(id=>id>=27);
  const vals=hand.map(id=>tile(id).value).sort((a,b)=>a-b);
  const kokushi=[0,1,2].every(suit=>hand.filter(id=>id<27&&Math.floor(id/9)===suit&&(id%9===0||id%9===8)).length===1)&&hand.filter(id=>id>=27&&id<=30).length===1&&hand.filter(id=>id>=31&&id<=33).length===1;
  const fiveCard=nums&&vals.every(v=>v===vals[0]);
  const straight=(nums||honors) && vals.every((v,i)=>i===0||v===vals[i-1]+1);
  const family=id=>id<27?Math.floor(id/9):id<31?3:4;
  const flush=hand.every(id=>family(id)===family(hand[0]));
  let rank=0, order=descending;
  if(kokushi) rank=10;
  else if(fiveCard) rank=9;
  else if(straight&&flush) rank=8;
  else if(groups[0][1]===4) rank=7;
  else if(groups[0][1]===3&&groups[1][1]===2) rank=6;
  else if(flush) rank=5;
  else if(straight) rank=4;
  else if(groups[0][1]===3) rank=3;
  else if(groups.filter(g=>g[1]===2).length===2) rank=2;
  else if(groups[0][1]===2) rank=1;
  if([1,2,3,6,7].includes(rank)) order=groups.map(g=>g[0]);
  if(rank>=9) order=descending;
  return {rank,name:NAMES[rank],key:[rank,...order.map(strength)],straight,flush};
}
export const canWin=hand=>{
  const rank=evaluate(hand).rank;
  return rank>1||(rank===1&&hasSequencePair(hand));
};
export function hasSequencePair(hand) {
  if(hand.length!==5)return false;
  for(let i=0;i<4;i++)for(let j=i+1;j<5;j++) {
    if(hand[i]!==hand[j])continue;
    const rest=hand.filter((_,k)=>k!==i&&k!==j).sort((a,b)=>a-b);
    if(rest[2]<27&&Math.floor(rest[0]/9)===Math.floor(rest[2]/9)&&rest[1]===rest[0]+1&&rest[2]===rest[0]+2)return true;
  }
  return false;
}
export function bestFive(pool, required=null) {
  if(pool.length===5) return canWin(pool)?{hand:[...pool],evaluation:evaluate(pool),drop:-1}:null;
  let best=null;
  const excluded=new Set(required===null?[]:Array.isArray(required)?required:[required]);
  for(let i=0;i<pool.length;i++) {
    if(excluded.has(i)) continue;
    const hand=pool.filter((_,j)=>i!==j), evaluation=evaluate(hand);
    if(!canWin(hand))continue;
    if(!best||compare(evaluation,best.evaluation)>0) best={hand,evaluation,drop:i};
  }
  return best;
}
export function hasHonitsu(hand,meld=[]) {
  if(hand.length!==5||!hand.some(id=>id>=27))return false;
  const numbers=hand.filter(id=>id<27);
  const honorCounts=new Map();hand.filter(id=>id>=27).forEach(id=>honorCounts.set(id,(honorCounts.get(id)||0)+1));
  const hasHonorPairOrTriplet=[...honorCounts.values()].some(count=>count>=2);
  const pairAndThreeGroup=completePartition(hand,g=>g.tiles.length===2||g.tiles.length===3,meld);
  return numbers.length>0&&new Set(numbers.map(id=>Math.floor(id/9))).size===1&&hasHonorPairOrTriplet&&pairAndThreeGroup;
}
function tileGroups(hand,meld=[]) {
  const full=(1<<hand.length)-1,groups=[];
  for(let mask=1;mask<=full;mask++) {
    const tiles=hand.filter((_,i)=>mask&(1<<i)).sort((a,b)=>a-b);
    if(tiles.length<2||tiles.length>4)continue;
    const same=tiles.every(id=>id===tiles[0]);
    const sequence=tiles.length===3&&tiles[2]<27&&Math.floor(tiles[0]/9)===Math.floor(tiles[2]/9)&&tiles[1]===tiles[0]+1&&tiles[2]===tiles[0]+2;
    if(same||sequence)groups.push({mask,tiles});
  }
  const locked=(1<<meld.length)-1;
  const fixed=locked?groups.find(g=>g.mask===locked&&meld.every((id,i)=>id===hand[i])):null;
  return {full,locked,fixed,valid:!locked||Boolean(fixed),groups:groups.filter(g=>!(g.mask&locked))};
}
function completePartition(hand,predicate=()=>true,meld=[]) {
  const c=tileGroups(hand,meld);if(!c.valid||(c.fixed&&!predicate(c.fixed)))return false;
  const groups=c.groups.filter(predicate),memo=new Map();
  function visit(used) {
    if(used===c.full)return true;
    if(memo.has(used))return memo.get(used);
    const first=(c.full^used)&-(c.full^used);
    const ok=groups.some(g=>(g.mask&first)&&!(g.mask&used)&&visit(used|g.mask));memo.set(used,ok);return ok;
  }
  return visit(c.locked);
}
export function groupedDoraIndices(hand,dora,meld=[]) {
  const c=tileGroups(hand,meld);if(!c.valid)return [];
  const count=mask=>hand.reduce((n,id,i)=>n+Boolean((mask&(1<<i))&&id===dora),0);
  const size=mask=>hand.reduce((n,_,i)=>n+Boolean(mask&(1<<i)),0),memo=new Map();
  function best(used) {
    if(memo.has(used))return memo.get(used);
    let chosen=used;
    for(const g of c.groups)if(!(g.mask&used)){
      const next=best(used|g.mask);
      if(count(next)>count(chosen)||(count(next)===count(chosen)&&size(next)>size(chosen)))chosen=next;
    }
    memo.set(used,chosen);return chosen;
  }
  const mask=best(c.locked);return hand.map((id,i)=>id===dora&&(mask&(1<<i))?i:-1).filter(i=>i>=0);
}
export function displayRole(hand,meld=[]) {
  return `${evaluate(hand).name}${hasSequencePair(hand)?' / 平和':''}${hasHonitsu(hand,meld)?' / ホンイツ':''}`;
}
export function bonus(hand,dora,enabled=true,meld=[]) {
  if(!enabled) return {base:1,dora:0,multiplier:1,names:[]};
  const e=evaluate(hand), names=[]; let base=1;
  const award=(name,multiplier)=>{if(multiplier>base){base=multiplier;names.length=0;}if(multiplier===base)names.push(name);};
  if(hasSequencePair(hand))award('平和',1);
  const hasHonor=hand.some(id=>id>=27), allHonor=hand.every(id=>id>=27);
  if(hand.every(id=>!isOutside(id))) award('タンヤオ',2);
  if(hasHonitsu(hand,meld))award('ホンイツ',2);
  if(!allHonor && hasSequencePair(hand) && completePartition(hand,g=>g.tiles.some(isOutside),meld)) award(hasHonor?'チャンタ':'純チャン',hasHonor?2:3);
  const counts=new Map();hand.forEach(id=>counts.set(id,(counts.get(id)||0)+1));
  const pairGroups=[...counts].filter(([,n])=>n>=2).map(([id])=>id);
  if([2,6].includes(e.rank) && pairGroups.length===2 && pairGroups.every(id=>id<27) && pairGroups[0]%9===pairGroups[1]%9) award(e.rank===2?'同数2ペア':'同数フルハウス',3);
  if(e.rank===9) award('5カード',3);
  if(e.rank===10) award('国士無双',6);
  if(allHonor) award('字一色',4);
  // Every tile belongs to a group: 發 pair + souzu triple/run, or 發 triple + souzu pair.
  const greenDragons=hand.filter(id=>id===32).length;
  const souzu=hand.filter(id=>id>=9&&id<18).sort((a,b)=>a-b);
  const greenPair=greenDragons===3&&souzu.length===2&&souzu[0]===souzu[1];
  const greenTriple=greenDragons===2&&souzu.length===3&&(souzu.every(id=>id===souzu[0])||(souzu[1]===souzu[0]+1&&souzu[2]===souzu[0]+2));
  if(greenPair||greenTriple) award('緑一色',4);
  if(e.rank===6 && hand.every(id=>id>=31)) award('小三元',5);
  if(e.rank===6 && hand.every(id=>id>=27&&id<=30)) award('小四喜',5);
  const n=groupedDoraIndices(hand,dora,meld).length;
  return {base,dora:n,multiplier:base+n,names};
}
export function makeWall(random=Math.random) {
  const wall=Array.from({length:136},(_,i)=>Math.floor(i/4));
  for(let i=wall.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));[wall[i],wall[j]]=[wall[j],wall[i]];}
  return wall;
}
export function nextDora(indicator) {
  if(indicator<27) return Math.floor(indicator/9)*9+(indicator%9+1)%9;
  if(indicator<31) return 27+(indicator-27+1)%4;
  return 31+(indicator-31+1)%3;
}
export function callOptions(hand,discard,isNext) {
  const options=[];
  const same=hand.map((id,i)=>id===discard?i:-1).filter(i=>i>=0);
  if(same.length>=2) options.push({type:'ポン',indices:same.slice(0,2)});
  if(isNext && discard<27) for(let start=discard-2;start<=discard;start++) {
    if(start<0||start+2>=27||Math.floor(start/9)!==Math.floor((start+2)/9)) continue;
    const need=[start,start+1,start+2].filter(id=>id!==discard), indices=need.map(id=>hand.indexOf(id));
    if(indices.every(i=>i>=0)) options.push({type:'チー',indices});
  }
  return options;
}
export function ronCandidate(hand,discard,threshold='straight',locked=[]) {
  let best=null; const pool=[...hand,discard],original=evaluate(hand),alreadyComplete=hasSequencePair(hand);
  for(let i=0;i<5;i++) {
    if(locked.includes(i)) continue;
    const candidate=pool.filter((_,j)=>i!==j), e=evaluate(candidate);
    const sequencePair=hasSequencePair(candidate);
    const improves=compare(e,original)>0||(!alreadyComplete&&sequencePair&&e.rank>=original.rank);
    if(!canWin(candidate)||(threshold==='straight'&&!improves))continue;
    if(!best||compare(e,best.evaluation)>0) best={hand:candidate,evaluation:e,drop:i};
  }
  return best;
}
export function settlement(players,winner,payers,dora,initiated,hand=players[winner].hand,dealer=0) {
  const b=bonus(hand,dora,initiated,players[winner].meld||[]),stake=players[winner].bet,baseAmount=stake*b.multiplier;
  const winnerIsDealer=dealer===winner,dealerMultiplier=winnerIsDealer?1.5:1,amount=baseAmount*dealerMultiplier;
  const mode=payers.length===3?'tsumo':'ron';
  const splitDealer=mode==='tsumo'&&dealer!==null&&!winnerIsDealer;
  const payments=payers.map(payer=>{
    const share=splitDealer?(payer===dealer?'1/2':'1/4'):mode==='tsumo'?'1/3':'全額';
    const requested=splitDealer?amount*(payer===dealer?0.5:0.25):mode==='tsumo'?amount/payers.length:amount;
    const cap=Math.max(0,Number(players[payer].bet)||0),paid=Math.min(requested,cap);
    return {payer,amount:paid,requested,cap,capped:paid<requested,share,isDealer:payer===dealer};
  });
  const total=payments.reduce((sum,payment)=>sum+payment.amount,0);
  const deltas=players.map(()=>0);
  for(const payment of payments) {deltas[payment.payer]-=payment.amount;deltas[winner]+=payment.amount;}
  return {deltas,amount,total,payments,bonus:b,stake,baseAmount,dealerMultiplier,winnerIsDealer,dealer,mode,initiated};
}
export function probabilities() {
  const choose=(n,k)=>{let r=1;for(let i=1;i<=k;i++)r=r*(n-i+1)/i;return Math.round(r);};
  const total=choose(136,5), royal=15*4**5, straight=5*12**5+3*4**5, flush=3*choose(36,5)+choose(16,5)+choose(12,5);
  const kokushi=8**3*16*12;
  return {total,royal,straight,flush,kokushi,straightOnly:straight-royal,flushOnly:flush-royal};
}
