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

    update(playerRect) {
        if (!this.alive) return;
        if (this.invincible > 0) this.invincible--;

        this._move(playerRect);
        this._updateFacing(playerRect);
    }

    _move(playerRect) {
        const dx = playerRect.centerX - this.rect.centerX;
        const dy = playerRect.centerY - this.rect.centerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;

        const spd = S.ENEMY_SPEED;
        const nx = this.rect.x + (dx / dist) * spd;
        const ny = this.rect.y + (dy / dist) * spd;
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
