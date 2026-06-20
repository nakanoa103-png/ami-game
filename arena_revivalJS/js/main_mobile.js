// main_mobile.js — スマホ専用ゲームループ（方向接触判定版）

const LOGI_W = 320, LOGI_H = 240, SCALE = 2;

// ── スマホ専用バランス定数 ───────────────────────────────
const LOOK_AWAY_CHANCE  = 0.008;   // 毎フレームのよそ見開始確率
const LOOK_AWAY_FRAMES  = 90;      // よそ見継続フレーム数
const SAME_LINE_TOL     = 0.55;    // 「同じ行/列」判定の許容（×TILE）
const KNOCKBACK_DIST        = 14;  // 敵を弾く距離(px)
const PLAYER_KNOCKBACK_DIST = 20;  // 被弾時に自分が反対方向へ飛ぶ距離(px)
const BOOTS_MAX_STACK   = 4;       // ③ブーツ加速の上限（壁抜け防止）
const CHARGE_AVOID_RANGE = 4 * 16; // 正面突撃回避を始める距離(px)
const CHARGE_AVOID_WIDTH = 1.2 * 16;// 「剣の延長線上」とみなす横幅(px)

let canvas, ctx, logi, lctx;
let tilemap, player, wave;
let keys     = {};
let prevKeys = {};
let state    = 'playing';
let lastTs   = 0;

// ── 向き矢印描画（▲を向いている方向に回転）─────────────────
function drawFacingArrow(ctx, cx, cy, facing, color) {
    const [fx, fy] = facing;
    // ▲がデフォルトで上向きなのでatan2+90°でUP=[0,-1]→回転なし
    const angle = Math.atan2(fy, fx) + Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-3.5, 2);
    ctx.lineTo(3.5,  2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ── 初期化 ─────────────────────────────────────────────
function init() {
    canvas = document.getElementById('screen');
    canvas.width  = LOGI_W * SCALE;
    canvas.height = LOGI_H * SCALE;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    logi = document.createElement('canvas');
    logi.width  = LOGI_W;
    logi.height = LOGI_H;
    lctx = logi.getContext('2d');
    lctx.imageSmoothingEnabled = false;

    window.addEventListener('keydown', e => {
        if (!prevKeys[e.code] && (e.code === 'KeyP' || e.code === 'Escape')) {
            if (state === 'playing') state = 'paused';
            else if (state === 'paused') state = 'playing';
        }
        keys[e.code]     = true;
        prevKeys[e.code] = true;
    });
    window.addEventListener('keyup', e => {
        keys[e.code]     = false;
        prevKeys[e.code] = false;
    });

    assets.load('player',     'assets/images/player.png',     S.PLAYER_COL);
    assets.load('enemy',      'assets/images/enemy.png',      S.RED);
    assets.load('guard',      'assets/images/enemy.png',      '#8B0000');
    assets.load('wall',       'assets/images/wall.png',       S.WALL);
    assets.load('floor',      'assets/images/floor.png',      S.FLOOR);
    assets.load('potion',     'assets/images/potion.png',     '#00CC66');
    assets.load('armor',      'assets/images/armor.png',      '#4488FF');
    assets.load('boots',      'assets/images/boots.png',      '#00BBFF');
    assets.load('sword',      'assets/images/sword.png',      '#FFFFFF');

    initTouchControls();
    _resetGame();

    canvas.addEventListener('touchstart', e => {
        if (state === 'gameover') { e.preventDefault(); _resetGame(); }
    }, { passive: false });

    requestAnimationFrame(loop);
}

function initTouchControls() {
    const ui = document.getElementById('touch-ui');
    if (ui) ui.style.display = 'flex';
    const hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';

    const moveMap = {
        'dpad-up':    'ArrowUp',
        'dpad-down':  'ArrowDown',
        'dpad-left':  'ArrowLeft',
        'dpad-right': 'ArrowRight',
    };
    for (const id in moveMap) {
        const code = moveMap[id];
        const btn  = document.getElementById(id);
        if (!btn) continue;
        btn.addEventListener('touchstart',  e => { e.preventDefault(); keys[code] = true;  }, { passive: false });
        btn.addEventListener('touchend',    e => { e.preventDefault(); keys[code] = false; }, { passive: false });
        btn.addEventListener('touchcancel', e => { e.preventDefault(); keys[code] = false; }, { passive: false });
    }

    let pauseDown = false;
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('touchstart', e => {
            e.preventDefault();
            if (!pauseDown) {
                pauseDown = true;
                if (state === 'playing') state = 'paused';
                else if (state === 'paused') state = 'playing';
            }
        }, { passive: false });
        pauseBtn.addEventListener('touchend',    e => { e.preventDefault(); pauseDown = false; }, { passive: false });
        pauseBtn.addEventListener('touchcancel', e => { e.preventDefault(); pauseDown = false; }, { passive: false });
    }
}

function _resetGame() {
    tilemap = new TileMap();
    player  = new PlayerMobile(tilemap);
    wave    = new WaveManagerMobile(tilemap);
    state   = 'playing';
}

// ── ゲームループ ───────────────────────────────────────
function loop(ts) {
    requestAnimationFrame(loop);
    const dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) return;

    if (state === 'playing') {
        update();
    } else if (state === 'gameover') {
        if (keys['Enter']) { keys['Enter'] = false; _resetGame(); }
    }
    draw();
}

function update() {
    player.handleInput(keys);
    player.update();
    wave.update(player);
    if (player.isDead) state = 'gameover';
}

// ── 描画 ───────────────────────────────────────────────
function draw() {
    lctx.fillStyle = S.BLACK;
    lctx.fillRect(0, 0, LOGI_W, LOGI_H);

    tilemap.draw(lctx);
    wave.draw(lctx);
    player.draw(lctx);

    drawHUD(lctx);

    if (wave.isBanner)         drawBanner(lctx);
    if (state === 'paused')    drawPause(lctx);
    if (state === 'gameover')  drawGameOver(lctx);

    ctx.drawImage(logi, 0, 0, LOGI_W * SCALE, LOGI_H * SCALE);
}

function drawHUD(c) {
    const p = player;
    const barW = 50, barH = 6, bx = 4, by = 4;
    c.fillStyle = '#333';
    c.fillRect(bx, by, barW, barH);
    c.fillStyle = '#E02020';
    c.fillRect(bx, by, Math.round(barW * p.hp / p.hpMax), barH);
    c.strokeStyle = '#FFF'; c.lineWidth = 1;
    c.strokeRect(bx, by, barW, barH);

    c.fillStyle = '#FFF';
    c.font = '8px monospace';
    c.textAlign = 'left';
    c.fillText(`HP ${p.hp}/${p.hpMax}`, bx, by + barH + 8);

    c.textAlign = 'right';
    c.fillText(`WAVE ${wave.waveNum}  KILL ${wave.kills}`, LOGI_W - 4, 10);

    // 操作ヒント（小さめ）
    c.fillStyle = '#555';
    c.textAlign = 'center';
    c.font = '6px monospace';
    c.fillText('向きを合わせて接触→攻撃', LOGI_W / 2, LOGI_H - 3);

    c.fillStyle = '#FFD700';
    c.textAlign = 'left';
    c.font = '8px monospace';
    let bx2 = 4, by2 = LOGI_H - 13;
    if (p.armorCharges > 0) { c.fillText(`DEF×${p.armorCharges}`, bx2, by2); bx2 += 38; }
    if (p.hasBoots)          { c.fillText('SPD↑',  bx2, by2); }
}

function drawBanner(c) {
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(0, LOGI_H / 2 - 14, LOGI_W, 28);
    c.fillStyle = '#FFFF00';
    c.font = '16px monospace';
    c.textAlign = 'center';
    c.fillText(`WAVE ${wave.waveNum}`, LOGI_W / 2, LOGI_H / 2 + 6);
}

function drawPause(c) {
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(0, LOGI_H / 2 - 18, LOGI_W, 36);
    c.fillStyle = '#AADDFF';
    c.font = '16px monospace';
    c.textAlign = 'center';
    c.fillText('PAUSE', LOGI_W / 2, LOGI_H / 2);
    c.fillStyle = '#FFF';
    c.font = '8px monospace';
    c.fillText('P / ESC to resume', LOGI_W / 2, LOGI_H / 2 + 12);
}

function drawGameOver(c) {
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(0, 0, LOGI_W, LOGI_H);
    c.fillStyle = '#FF4444';
    c.font = '20px monospace';
    c.textAlign = 'center';
    c.fillText('GAME OVER', LOGI_W / 2, LOGI_H / 2 - 12);
    c.fillStyle = '#FFF';
    c.font = '8px monospace';
    c.fillText('ENTER / TAP to retry', LOGI_W / 2, LOGI_H / 2 + 8);
    c.fillText(`WAVE ${wave.waveNum}  KILL ${wave.kills}`, LOGI_W / 2, LOGI_H / 2 + 20);
}

window.addEventListener('DOMContentLoaded', init);
