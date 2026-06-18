// enemy.js — 通常敵 + ガード敵

class Enemy {
    constructor(tileX, tileY, tilemap) {
        this.tilemap     = tilemap;
        this.x           = tileX * S.TILE;
        this.y           = tileY * S.TILE;
        this.rect        = new Rect(this.x, this.y, S.TILE, S.TILE);
        this.hp          = S.ENEMY_HP;
        this.alive       = true;
        this.hitCooldown = 0;
        this._img        = 'enemy';   // assets のキー名
    }

    update(playerRect) {
        if (this.hitCooldown > 0) this.hitCooldown--;

        const cx = this.x + S.TILE / 2;
        const cy = this.y + S.TILE / 2;
        const dx = playerRect.centerX - cx;
        const dy = playerRect.centerY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;

        this._moveStep(dx / dist, dy / dist);
    }

    _moveStep(nx, ny) {
        const sx = nx * S.ENEMY_SPEED;
        const sy = ny * S.ENEMY_SPEED;

        const nx_ = this.x + sx;
        if (!this.tilemap.isWallRect(new Rect(Math.round(nx_), Math.round(this.y), S.TILE, S.TILE)))
            this.x = nx_;

        const ny_ = this.y + sy;
        if (!this.tilemap.isWallRect(new Rect(Math.round(this.x), Math.round(ny_), S.TILE, S.TILE)))
            this.y = ny_;

        this.rect.x = Math.round(this.x);
        this.rect.y = Math.round(this.y);
    }

    takeHit(attackRect, direction, damage = 1) {
        if (!this.alive || this.hitCooldown > 0) return false;
        if (!this.rect.collides(attackRect)) return false;
        this.hp -= damage;
        this.hitCooldown = S.ENEMY_HIT_COOLDOWN;
        this._applyKnockback(direction);
        if (this.hp <= 0) this.alive = false;
        return true;
    }

    _applyKnockback([fdx, fdy]) {
        for (let i = 0; i < S.ENEMY_KNOCKBACK; i++) {
            const nx = this.x + fdx;
            const ny = this.y + fdy;
            if (this.tilemap.isWallRect(new Rect(Math.round(nx), Math.round(ny), S.TILE, S.TILE))) break;
            this.x = nx;
            this.y = ny;
        }
        this.rect.x = Math.round(this.x);
        this.rect.y = Math.round(this.y);
    }

    checkContact(playerRect) {
        return this.alive && this.rect.shrink(4).collides(playerRect.shrink(4));
    }

    draw(ctx) {
        if (this.alive) assets.draw(ctx, this._img, this.rect.x, this.rect.y);
    }
}

class GuardEnemy extends Enemy {
    constructor(tileX, tileY, tilemap, homePos) {
        super(tileX, tileY, tilemap);
        this.homePos = homePos;   // [cx, cy] ピクセル座標
        this._img    = 'guard';
    }

    update(playerRect) {
        if (this.hitCooldown > 0) this.hitCooldown--;

        const cx = this.x + S.TILE / 2;
        const cy = this.y + S.TILE / 2;
        const aggroPx = S.GUARD_AGGRO_DIST * S.TILE;

        let tx, ty;
        if (Math.hypot(playerRect.centerX - cx, playerRect.centerY - cy) <= aggroPx) {
            // アグロ範囲内 → プレイヤーを追う
            tx = playerRect.centerX;
            ty = playerRect.centerY;
        } else {
            // 拠点へ戻る
            tx = this.homePos[0];
            ty = this.homePos[1];
            if (Math.hypot(tx - cx, ty - cy) < S.TILE / 2) return;
        }

        const dx = tx - cx;
        const dy = ty - cy;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        this._moveStep(dx / dist, dy / dist);
    }
}
