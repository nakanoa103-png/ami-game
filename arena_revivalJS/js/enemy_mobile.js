// enemy_mobile.js — よそ見AI付き敵（スマホ専用）

class EnemyMobile {
    constructor(tileX, tileY, tilemap) {
        this.tilemap = tilemap;
        this.rect    = new Rect(tileX * S.TILE, tileY * S.TILE, S.TILE, S.TILE);
        this.facing  = [0, 1];
        this.alive   = true;
        this.hp      = 3;
        this.invincible    = 0;
        this._waveNum      = 1;
        this._lookAwayTimer = 0;
        this._lookAwayDir   = [1, 0];
    }

    // ウェーブが進むほどよそ見が減る
    get _lookAwayChance() {
        return Math.max(LOOK_AWAY_CHANCE - this._waveNum * 0.0005, 0.002);
    }

    update(playerRect, playerFacing) {
        if (!this.alive) return;
        if (this.invincible > 0) this.invincible--;

        this._move(playerRect, playerFacing);
        this._updateFacing(playerRect);
    }

    _move(playerRect, playerFacing) {
        const pcx = playerRect.centerX, pcy = playerRect.centerY;
        const dx = pcx - this.rect.centerX;
        const dy = pcy - this.rect.centerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;

        let mvx = dx / dist, mvy = dy / dist;   // 既定: まっすぐ接近（不意打ち狙い）

        // 正面突撃回避: プレイヤーが自分の方を向いている（剣の延長線上）なら横へずれる
        if (playerFacing) {
            const [pfx, pfy] = playerFacing;
            const rx = this.rect.centerX - pcx;   // プレイヤーから見た相対位置
            const ry = this.rect.centerY - pcy;
            const forward = rx * pfx + ry * pfy;  // 正面方向の距離（正=前方）
            const perpx = -pfy, perpy = pfx;      // 正面に直交する軸
            const lateral = rx * perpx + ry * perpy; // 横ずれ量（符号付き）

            const inDanger = forward > 0
                && forward < CHARGE_AVOID_RANGE
                && Math.abs(lateral) < CHARGE_AVOID_WIDTH;

            if (inDanger) {
                // 真正面に近いほど左右どちらに逃げるか安定させる
                let side = lateral >= 0 ? 1 : -1;
                if (Math.abs(lateral) < 1) side = (Math.floor(this.rect.x) % 2 === 0) ? 1 : -1;
                // 横移動を主体に、少しだけ接近を混ぜる
                mvx = perpx * side + (dx / dist) * 0.35;
                mvy = perpy * side + (dy / dist) * 0.35;
                const m = Math.hypot(mvx, mvy) || 1;
                mvx /= m; mvy /= m;
            }
        }

        const spd = S.ENEMY_SPEED;
        const nx = this.rect.x + mvx * spd;
        const ny = this.rect.y + mvy * spd;
        if (!this.tilemap.isWallRect(new Rect(nx, this.rect.y, S.TILE, S.TILE))) this.rect.x = nx;
        if (!this.tilemap.isWallRect(new Rect(this.rect.x, ny, S.TILE, S.TILE))) this.rect.y = ny;
    }

    _updateFacing(playerRect) {
        if (this._lookAwayTimer > 0) {
            this._lookAwayTimer--;
            this.facing = this._lookAwayDir;
            return;
        }

        // プレイヤー方向を向く
        const dx = playerRect.centerX - this.rect.centerX;
        const dy = playerRect.centerY - this.rect.centerY;
        if (Math.abs(dx) >= Math.abs(dy)) {
            this.facing = dx >= 0 ? [1, 0] : [-1, 0];
        } else {
            this.facing = dy >= 0 ? [0, 1] : [0, -1];
        }

        // ランダムによそ見
        if (Math.random() < this._lookAwayChance) {
            this._lookAwayTimer = LOOK_AWAY_FRAMES;
            const all = [[1,0],[-1,0],[0,1],[0,-1]];
            const others = all.filter(([fx,fy]) => !(fx===this.facing[0] && fy===this.facing[1]));
            this._lookAwayDir = others[Math.floor(Math.random() * others.length)];
        }
    }

    takeHit() {
        if (this.invincible > 0) return false;
        this.hp--;
        this.invincible = 20;
        if (this.hp <= 0) this.alive = false;
        return true;
    }

    // pushDir 方向へ弾き飛ばす（壁で停止）
    knockback(pushDir, distance = KNOCKBACK_DIST) {
        const [dx, dy] = pushDir;
        for (let i = 0; i < distance; i++) {
            const nx = this.rect.x + dx;
            const ny = this.rect.y + dy;
            if (this.tilemap.isWallRect(new Rect(nx, ny, S.TILE, S.TILE))) break;
            this.rect.x = nx;
            this.rect.y = ny;
        }
    }

    // ① 押し合い用: 軸ごとに壁判定して少しずらす
    pushAway(dx, dy) {
        const nx = this.rect.x + dx;
        const ny = this.rect.y + dy;
        if (!this.tilemap.isWallRect(new Rect(nx, this.rect.y, S.TILE, S.TILE))) this.rect.x = nx;
        if (!this.tilemap.isWallRect(new Rect(this.rect.x, ny, S.TILE, S.TILE))) this.rect.y = ny;
    }

    draw(ctx) {
        if (!this.alive) return;
        if (this.invincible === 0 || Math.floor(this.invincible / 3) % 2 !== 0) {
            assets.draw(ctx, 'enemy', this.rect.x, this.rect.y);
        }
        drawFacingArrow(ctx, this.rect.centerX, this.rect.y - 5, this.facing, '#FF4444');
    }
}

class GuardEnemyMobile extends EnemyMobile {
    constructor(tileX, tileY, tilemap, homePos) {
        super(tileX, tileY, tilemap);
        this.homePos = homePos;
    }
    draw(ctx) {
        if (!this.alive) return;
        if (this.invincible === 0 || Math.floor(this.invincible / 3) % 2 !== 0) {
            assets.draw(ctx, 'guard', this.rect.x, this.rect.y);
        }
        drawFacingArrow(ctx, this.rect.centerX, this.rect.y - 5, this.facing, '#FF9944');
    }
}
