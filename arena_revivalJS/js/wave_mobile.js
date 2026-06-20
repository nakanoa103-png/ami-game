// wave_mobile.js — 方向接触判定版ウェーブ管理（スマホ専用）

const WS_M = { CLEAR: 'clear', BANNER: 'banner', ACTIVE: 'active' };

// 攻撃判定: attacker が target の方向を向いているか
// 「同じ行/列にいて、向いている側にいる」
function isFacingTarget(attacker, target) {
    const [fx, fy] = attacker.facing;
    const dx = target.rect.centerX - attacker.rect.centerX;
    const dy = target.rect.centerY - attacker.rect.centerY;
    const tol = S.TILE * SAME_LINE_TOL;

    if (fx !== 0) {
        // 左右向き: Y差が許容内 かつ 向いている側
        return Math.abs(dy) < tol && (fx > 0 ? dx > 0 : dx < 0);
    } else {
        // 上下向き: X差が許容内 かつ 向いている側
        return Math.abs(dx) < tol && (fy > 0 ? dy > 0 : dy < 0);
    }
}

class WaveManagerMobile {
    constructor(tilemap) {
        this.tilemap    = tilemap;
        this.waveNum    = 0;
        this.kills      = 0;
        this.enemies    = [];
        this.items      = [];
        this._state     = WS_M.CLEAR;
        this._timer     = 0;
        this._prevAlive = 0;
    }

    update(player) {
        if (this._state === WS_M.CLEAR) {
            if (this._timer <= 0) this._startNextWave(player);
            else                  this._timer--;
        } else if (this._state === WS_M.BANNER) {
            if (--this._timer <= 0) this._state = WS_M.ACTIVE;
        } else {
            this._updateActive(player);
        }
    }

    _startNextWave(player) {
        this.waveNum++;
        this.enemies = [];
        this.items   = [];

        const px = Math.floor(player.rect.x / S.TILE);
        const py = Math.floor(player.rect.y / S.TILE);
        const floorAll = shuffle(
            this.tilemap.getFloorTiles().filter(
                ([c, r]) => Math.hypot(c - px, r - py) >= S.SPAWN_MIN_DIST
            )
        );

        const itemTypes = this._pickItemTypes();
        let idx = 0;

        for (const type of itemTypes) {
            if (idx + 1 >= floorAll.length) break;
            const [ic, ir] = floorAll[idx++];
            const [gc, gr] = floorAll[idx++];
            const homePos  = [ic * S.TILE + S.TILE / 2, ir * S.TILE + S.TILE / 2];

            let item;
            if      (type === 'potion') item = new Potion(ic, ir);
            else if (type === 'armor')  item = new Armor(ic, ir);
            else                        item = new Boots(ic, ir);
            this.items.push(item);

            const g = new GuardEnemyMobile(gc, gr, this.tilemap, homePos);
            g._waveNum = this.waveNum;
            this.enemies.push(g);
        }

        const normalCount = Math.max(0, S.ENEMIES_BASE + this.waveNum - 1 - itemTypes.length);
        for (let i = 0; i < normalCount && idx < floorAll.length; i++, idx++) {
            const [c, r] = floorAll[idx];
            const e = new EnemyMobile(c, r, this.tilemap);
            e._waveNum = this.waveNum;
            this.enemies.push(e);
        }

        this._prevAlive = this.enemies.length;
        this._state     = WS_M.BANNER;
        this._timer     = S.WAVE_BANNER_FRAMES;
    }

    _pickItemTypes() {
        const types = ['potion'];
        if (this.waveNum >= 4 && Math.random() < S.ITEM_APPEAR_CHANCE) {
            types.push(Math.random() < 0.6 ? 'armor' : 'boots');
        }
        return types;
    }

    _updateActive(player) {
        for (const e of this.enemies) {
            e.update(player.rect);

            if (e.alive && e.rect.shrink(3).collides(player.rect.shrink(3))) {
                this._resolveContact(player, e);
            }
        }

        const aliveNow = this.enemies.filter(e => e.alive).length;
        this.kills += this._prevAlive - aliveNow;
        this._prevAlive = aliveNow;

        for (const item of this.items) item.checkPickup(player);

        if (this.enemies.every(e => !e.alive)) {
            player.heal(S.WAVE_HEAL);
            this._state = WS_M.CLEAR;
            this._timer = S.WAVE_CLEAR_WAIT_FRAMES;
        }
    }

    // 接触瞬間に両者の向きを同時判定して4分岐
    _resolveContact(player, enemy) {
        const playerHits = isFacingTarget(player, enemy);
        const enemyHits  = isFacingTarget(enemy,  player);

        if (playerHits) {
            enemy.takeHit();
        }
        if (enemyHits) {
            player.takeDamage(1, enemy.facing);
        }
        // 両方false → 横すれ違い、ノーダメージ
        // 両方true  → 正面衝突、相互ダメージ（それぞれ無敵時間で1回に絞られる）
    }

    get isBanner() { return this._state === WS_M.BANNER; }
    get isActive()  { return this._state === WS_M.ACTIVE; }

    draw(ctx) {
        for (const item of this.items) item.draw(ctx);
        for (const e    of this.enemies)  e.draw(ctx);
    }
}
