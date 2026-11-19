const fmt=n=>n.toLocaleString('ja-JP');
export function scoreFormula(result) {
  if(!result.payments)return '';
  const b=result.bonus;
  const formula=`${fmt(result.stake)}点 ×（役${b.base}＋ドラ${b.dora}）${result.winnerIsDealer?' × 親1.5':''} ＝ ${fmt(result.amount)}点`;
  return result.total<result.amount?`${formula}（各人の賭け点上限後：${fmt(result.total)}点）`:formula;
}
export function paymentSummary(result,players) {
  if(!result.payments)return '';
  return result.payments.map(p=>`${players[p.payer].name}${p.isDealer?'（親）':''}：${fmt(p.amount)}点`).join(' ／ ');
}
export function scoreDetails(result,players) {
  if(!result.payments)return '';
  const b=result.bonus,rows=[
    ['勝者の賭け点',`${fmt(result.stake)}点`],
    ['役倍率',`${b.names.join('・')||'役の加算なし'}：×${b.base}`],
    ['ドラ（組に含む牌）',`${b.dora}枚：＋${b.dora}`],
    ['合計倍率',`${b.base} ＋ ${b.dora} ＝ ×${b.multiplier}`],
    ['基準額',`${fmt(result.stake)} × ${b.multiplier} ＝ ${fmt(result.baseAmount)}点`],
    ['親の加算',result.winnerIsDealer?`${fmt(result.baseAmount)} × 1.5 ＝ ${fmt(result.amount)}点`:'子の勝ち：×1'],
    ['賭け点による上限',`各支払者は自分の賭け点まで`],
    ['受取総額',`${fmt(result.total)}点${result.mode==='tsumo'?'を3人で分担':'を1人が全額負担'}`]
  ];
  const split=result.mode==='tsumo'?(result.winnerIsDealer?'親のツモ：子3人で均等に分担':'子のツモ：親が総額の半分、子2人が4分の1ずつ'):result.mode==='retaliation'?'返り討ち：ツモまたは勝負の宣言者が全額を支払う':'ロン：振込者が全額を支払う';
  return `<section class="score-breakdown"><h3>得点の内訳</h3><p class="score-formula">${scoreFormula(result)}</p><dl>${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>${!result.initiated?'<p class="score-note">返り討ちは役・ドラの倍率を1として計算。親が勝った場合は親1.5倍を適用します。</p>':''}<h4>誰が何点払う？</h4><p class="score-note">${split}。各人の支払いは本人の賭け点までです。</p><ul class="payment-list">${result.payments.map(p=>`<li><span>${players[p.payer].name}（${p.isDealer?'親':'子'}）</span><small>${p.share==='全額'?'全額':`総額の${p.share}`}${p.capped?`・上限${fmt(p.cap)}点`:''}</small><b>−${fmt(p.amount)}点</b></li>`).join('')}</ul><div class="score-total"><span>${players[result.winner].name}の受取合計</span><strong>＋${fmt(result.total)}点</strong></div></section>`;
}
