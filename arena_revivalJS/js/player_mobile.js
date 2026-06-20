// player_mobile.js — 方向接触判定版プレイヤー（スマホ専用）

class PlayerMobile {
    constructor(tilemap) {
        this.tilemap = tilemap;
        this.rect    = new Rect(2 * S.TILE, 2 * S.TILE, S.TILE, S.TILE);
        this.facing  = [0, 1];  // DOWN

        this.hp    = 8;
        this.hpMax = 8;

        this.invincible      = 0;
        this.stunTimer       = 0;
        this._invincibleTime = 90;

        this.armorCharges = 0;
        this.hasBoots     = false;
    }

    get moveSpeed() { return S.PLAYER_SPEED + (this.hasBoots ? S.BOOTS_SPEED_BONUS : 0); }
    get isDead()    { return this.hp <= 0; }

    handleInput(keys) {
        if (this.stunTimer > 0) return;
        const spd = this.moveSpeed;
        let dx = 0, dy = 0;

        if      (keys['ArrowLeft']  || keys['KeyA']) { dx = -spd; this.facing = [-1, 0]; }
        else if (keys['ArrowRight'] || keys['KeyD']) { dx =  spd; this.facing = [1,  0]; }
        if      (keys['ArrowUp']    || keys['KeyW']) { dy = -spd; this.facing = [0, -1]; }
        else if (keys['ArrowDown']  || keys['KeyS']) { dy =  spd; this.facing = [0,  1]; }

        if (dx !== 0) {
            const next = this.rect.move(dx, 0);
            if (!this.tilemap.isWallRect(next)) this.rect = next;
        }
        if (dy !== 0) {
            const next = this.rect.move(0, dy);
            if (!this.tilemap.isWallRect(next)) this.rect = next;
        }
    }

    update() {
        if (this.stunTimer  > 0) this.stunTimer--;
        if (this.invincible > 0) this.invincible--;
    }

    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.hpMax);
    }

    takeDamage(amount = 1, fromDir = null) {
        if (this.invincible > 0) return false;
        if (this.armorCharges > 0) {
            this.armorCharges--;
            this._applyHitEffect(fromDir);
            return true;
        }
        this.hp -= amount;
        this._applyHitEffect(fromDir);
        return true;
    }

    _applyHitEffect(fromDir) {
        this.invincible = this._invincibleTime;
        this.stunTimer  = 15;
        if (fromDir) this.knockback(fromDir, 10);
    }

    knockback(direction, distance = 8) {
        const [fdx, fdy] = direction;
        for (let i = 0; i < distance; i++) {
            const nx = this.rect.x - fdx;
            const ny = this.rect.y - fdy;
            if (this.tilemap.isWallRect(new Rect(nx, ny, S.TILE, S.TILE))) break;
            this.rect.x = nx;
            this.rect.y = ny;
        }
    }

    draw(ctx) {
        if (this.invincible === 0 || Math.floor(this.invincible / 4) % 2 !== 0) {
            assets.draw(ctx, 'player', this.rect.x, this.rect.y);
        }
        drawFacingArrow(ctx, this.rect.centerX, this.rect.y - 5, this.facing, '#00FF88');
    }
}
