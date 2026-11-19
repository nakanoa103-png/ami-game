export class MatchSeries {
  constructor(limit=3) {
    const n=Number(limit);
    this.limit=Number.isFinite(n)&&n>=1?Math.min(99,Math.floor(n)):3;
    this.matches=[];this.totals=[0,0,0,0];this.recorded=new WeakSet();
  }
  get completed(){return this.matches.length;}
  get finished(){return this.completed>=this.limit;}
  record(table){
    if(!table.matchResult||this.finished||this.recorded.has(table))return false;
    const scores=table.players.map(p=>p.score);
    scores.forEach((score,i)=>this.totals[i]+=score);
    this.matches.push({scores,rankings:table.matchResult.rankings.map(p=>({...p}))});
    this.recorded.add(table);return true;
  }
  standings(players){
    const rows=players.map((p,i)=>({i,name:p.name,score:this.totals[i]})).sort((a,b)=>b.score-a.score||a.i-b.i);
    rows.forEach((p,j)=>{p.rank=j&&p.score===rows[j-1].score?rows[j-1].rank:j+1;});return rows;
  }
}
