// main.js — ゲームループ・HUD・初期化

const LOGI_W = 320, LOGI_H = 240, SCALE = 2;

let canvas, ctx, logi, lctx;
let tilemap, player, wave;
let keys   = {};
let state  = 'playing';   // 'playing' | 'paused' | 'gameover'
let lastTs = 0;

// ─── 初期化 ──────────────────────────────────────────────────────────────────

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
        const wasDown = keys[e.code];
        keys[e.code] = true;
        if (e.code === 'Space') e.preventDefault();
        // キーリピートを無視してトグル（wasDown=trueは長押しリピート）
        if (!wasDown && (e.code === 'KeyP' || e.code === 'Escape')) {
            if (state === 'playing')       state = 'paused';
            else if (state === 'paused')   state = 'playing';
        }
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });

    // 画像読み込み
    assets.load('player',    'assets/images/player.png',    S.PLAYER_COL);
    assets.load('enemy',     'assets/images/enemy.png',     S.RED);
    assets.load('guard',     'assets/images/enemy.png',     '#8B0000');
    assets.load('wall',      'assets/images/wall.png',      S.WALL);
    assets.load('floor',     'assets/images/floor.png',     S.FLOOR);
    assets.load('potion',    'assets/images/potion.png',    '#00CC66');
    assets.load('armor',     'assets/images/armor.png',     '#4488FF');
    assets.load('boots',     'assets/images/boots.png',     '#00BBFF');
    assets.load('sword_item','assets/images/sword_item.png','#AAAAAA');
    assets.load('sword',     'assets/images/sword.png',     '#FFFFFF');

    _resetGame();
    initTouchControls();

    // ゲームオーバー中のタップでリトライ
    canvas.addEventListener('touchstart', e => {
        if (state === 'gameover') { e.preventDefault(); _resetGame(); }
    }, { passive: false });

    requestAnimationFrame(loop);
}

function initTouchControls() {
    if (!('ontouchstart' in window)) return;

    // タッチ端末ならボタンを表示
    document.getElementById('touch-ui').style.display = 'flex';
    document.getElementById('hint').style.display = 'none';

    const btnMap = {
        'dpad-up':    'ArrowUp',
        'dpad-down':  'ArrowDown',
        'dpad-left':  'ArrowLeft',
        'dpad-right': 'ArrowRight',
        'attack-btn': 'Space',
    };

    for (const [id, code] of Object.entries(btnMap)) {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart',  e => { e.preventDefault(); keys[code] = true;  }, { passive: false });
        btn.addEventListener('touchend',    e => { e.preventDefault(); keys[code] = false; }, { passive: false });
        btn.addEventListener('touchcancel', e => { e.preventDefault(); keys[code] = false; }, { passive: false });
    }

    // ポーズボタン（トグル、リピートなし）
    let pauseDown = false;
    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (!pauseDown) {
            pauseDown = true;
            if (state === 'playing')     state = 'paused';
            else if (state === 'paused') state = 'playing';
        }
    }, { passive: false });
    pauseBtn.addEventListener('touchend',    e => { e.preventDefault(); pauseDown = false; }, { passive: false });
    pauseBtn.addEventListener('touchcancel', e => { e.preventDefault(); pauseDown = false; }, { passive: false });
}

function _resetGame() {
    tilemap = new TileMap();
    player  = new Player(tilemap);
    wave    = new WaveManager(tilemap);
    state   = 'playing';
}

// ─── ゲームループ ─────────────────────────────────────────────────────────────

function loop(ts) {
    requestAnimationFrame(loop);
    const dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) return;   // タブ非アクティブ等でのスパイクを無視

    if (state === 'playing') {
        update();
    } else if (state === 'gameover') {
        if (keys['Enter']) {
            keys['Enter'] = false;
            _resetGame();
        }
    }
    // paused: update をスキップして描画だけ続ける
    draw();
}

function update() {
    player.handleInput(keys);
    player.update();
    wave.update(player);

    if (player.isDead) state = 'gameover';
}

// ─── 描画 ─────────────────────────────────────────────────────────────────────

function draw() {
    // ロジカルキャンバスに描画
    lctx.fillStyle = S.BLACK;
    lctx.fillRect(0, 0, LOGI_W, LOGI_H);

    tilemap.draw(lctx);
    wave.draw(lctx);
    player.draw(lctx);

    drawHUD(lctx);

    if (wave.isBanner) drawBanner(lctx);
    if (state === 'paused')   drawPause(lctx);
    if (state === 'gameover') drawGameOver(lctx);

    // 2x スケールアップ
    ctx.drawImage(logi, 0, 0, LOGI_W * SCALE, LOGI_H * SCALE);
}

function drawHUD(c) {
    const p = player;

    // HP バー（左）
    const barW = 50, barH = 6;
    const bx = 4, by = 4;
    c.fillStyle = '#333';
    c.fillRect(bx, by, barW, barH);
    c.fillStyle = '#E02020';
    c.fillRect(bx, by, Math.round(barW * p.hp / p.hpMax), barH);
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 1;
    c.strokeRect(bx, by, barW, barH);

    c.fillStyle = '#FFFFFF';
    c.font = '8px monospace';
    c.textAlign = 'left';
    c.fillText(`HP ${p.hp}/${p.hpMax}`, bx, by + barH + 8);

    // WAVE / KILL（右）
    c.textAlign = 'right';
    c.fillText(`WAVE ${wave.waveNum}  KILL ${wave.kills}`, LOGI_W - 4, 10);

    // パワーアップバッジ（黄）
    c.fillStyle = '#FFD700';
    c.textAlign = 'left';
    let bx2 = 4, by2 = LOGI_H - 10;
    if (p.armorCharges > 0) {
        c.fillText(`DEF×${p.armorCharges}`, bx2, by2);
        bx2 += 38;
    }
    if (p.swordCharges > 0) {
        c.fillText(`ATK×${p.swordCharges}`, bx2, by2);
        bx2 += 38;
    }
    if (p.hasBoots) {
        c.fillText('SPD↑', bx2, by2);
    }
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
    c.fillText('PAUSE', LOGI_W / 2, LOGI_H / 2 + 0);
    c.fillStyle = '#FFFFFF';
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
    c.fillStyle = '#FFFFFF';
    c.font = '8px monospace';
    c.fillText('ENTER / TAP to retry', LOGI_W / 2, LOGI_H / 2 + 8);
    c.fillText(`WAVE ${wave.waveNum}  KILL ${wave.kills}`, LOGI_W / 2, LOGI_H / 2 + 20);
}

window.addEventListener('DOMContentLoaded', init);
