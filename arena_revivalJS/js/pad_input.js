// pad_input.js — スライド式バーチャルパッドを共有の keys[] に流し込む「追加入力経路」
// 戦闘・視界・囲みAI・ゲームループには一切触れない。keyboard と同じ受け皿(keys)を共有する。
(() => {
    // ── デバッグ表示フラグ（後で false にすれば中心/スティック描画オフ。Vキーでもトグル）──
    let PAD_DEBUG = true;

    // ── パッド調整パラメータ（pad_test.html と同一ロジック）──
    const MAX_R        = 70;   // 最大半径(px)
    const DEAD         = 16;   // デッドゾーン(px)
    const SWITCH_RATIO = 1.4;  // ヒステリシス(切替に必要な比=大小2しきい値)

    const zone = document.getElementById('pad-zone');
    const fx   = document.getElementById('pad-fx');
    if (!zone || !fx) return;
    const fxc = fx.getContext('2d');

    let FW = 0, FH = 0;
    function resizeFx() {
        const dpr = window.devicePixelRatio || 1;
        FW = window.innerWidth; FH = window.innerHeight;
        fx.width = FW * dpr; fx.height = FH * dpr;
        fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resizeFx); resizeFx();

    const pad = { active: false, cx: 0, cy: 0, sx: 0, sy: 0 };
    let axis = 'H';            // ヒステリシス用の現在主軸
    let padHeldKey = null;     // パッドが今押している仮想キー
    const KEYOF = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };

    // 4方向スナップ＋シュミットトリガ（pad_test.html と同一）
    function snapDir(vx, vy) {
        const m = Math.hypot(vx, vy);
        if (m < DEAD) return null;
        const ax = Math.abs(vx), ay = Math.abs(vy);
        if (axis === 'H') { if (ay > ax * SWITCH_RATIO) axis = 'V'; }
        else              { if (ax > ay * SWITCH_RATIO) axis = 'H'; }
        if (axis === 'H') return vx >= 0 ? 'R' : 'L';
        else              return vy >= 0 ? 'D' : 'U';
    }

    // padDir を共有 keys[] へ（仮想十字キー: 既存の handleInput がそのまま読む）
    function applyToKeys(dir) {
        const newKey = dir ? KEYOF[dir] : null;
        if (newKey === padHeldKey) return;
        if (padHeldKey) keys[padHeldKey] = false;   // 古いキーを離す
        if (newKey)     keys[newKey]     = true;    // 新しいキーを押す
        padHeldKey = newKey;
    }

    const rel = (clientX, clientY) => {
        const r = fx.getBoundingClientRect();
        return [clientX - r.left, clientY - r.top];
    };
    function padStart(x, y) { pad.active = true; pad.cx = x; pad.cy = y; pad.sx = x; pad.sy = y; }
    function padMove(x, y)  { if (pad.active) { pad.sx = x; pad.sy = y; } }
    function padEnd()       { pad.active = false; applyToKeys(null); }

    // ② タッチ（画面下半分=#pad-zone のみ反応。上半分のゲーム画面は隠れない）
    zone.addEventListener('touchstart',  e => { e.preventDefault(); const t = e.changedTouches[0]; const [x,y] = rel(t.clientX, t.clientY); padStart(x, y); }, { passive: false });
    zone.addEventListener('touchmove',   e => { e.preventDefault(); const t = e.changedTouches[0]; const [x,y] = rel(t.clientX, t.clientY); padMove(x, y); }, { passive: false });
    zone.addEventListener('touchend',    e => { e.preventDefault(); padEnd(); }, { passive: false });
    zone.addEventListener('touchcancel', e => { e.preventDefault(); padEnd(); }, { passive: false });

    // ③ マウスドラッグ（PC確認用・②と同挙動）
    zone.addEventListener('mousedown', e => { const [x,y] = rel(e.clientX, e.clientY); padStart(x, y); });
    window.addEventListener('mousemove', e => { const [x,y] = rel(e.clientX, e.clientY); padMove(x, y); });
    window.addEventListener('mouseup',   () => padEnd());

    // デバッグ表示トグル（Vキー）
    window.addEventListener('keydown', e => { if (e.code === 'KeyV') PAD_DEBUG = !PAD_DEBUG; });

    // 入力処理＋デバッグ描画（ゲームループとは独立した自前ループ）
    function tick() {
        requestAnimationFrame(tick);

        let vx = 0, vy = 0;
        if (pad.active) {
            vx = pad.sx - pad.cx; vy = pad.sy - pad.cy;
            const m = Math.hypot(vx, vy);
            if (m > MAX_R) { vx = vx / m * MAX_R; vy = vy / m * MAX_R; }
        }
        applyToKeys(pad.active ? snapDir(vx, vy) : null);

        fxc.clearRect(0, 0, FW, FH);
        if (PAD_DEBUG && pad.active) {
            fxc.strokeStyle = 'rgba(255,255,255,0.25)'; fxc.lineWidth = 2;
            fxc.beginPath(); fxc.arc(pad.cx, pad.cy, MAX_R, 0, 7); fxc.stroke();      // 外周
            fxc.strokeStyle = 'rgba(255,120,120,0.4)';
            fxc.beginPath(); fxc.arc(pad.cx, pad.cy, DEAD, 0, 7); fxc.stroke();       // デッドゾーン
            fxc.fillStyle = 'rgba(255,255,255,0.5)';
            fxc.beginPath(); fxc.arc(pad.cx, pad.cy, 5, 0, 7); fxc.fill();            // 中心
            const sx = pad.cx + vx, sy = pad.cy + vy;
            fxc.strokeStyle = 'rgba(120,255,180,0.7)'; fxc.lineWidth = 3;
            fxc.beginPath(); fxc.moveTo(pad.cx, pad.cy); fxc.lineTo(sx, sy); fxc.stroke();
            fxc.fillStyle = '#5f8';
            fxc.beginPath(); fxc.arc(sx, sy, 16, 0, 7); fxc.fill();                   // スティック
        }
    }
    requestAnimationFrame(tick);
})();
