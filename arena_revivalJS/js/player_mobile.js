// player_mobile.js — 方向接触判定版プレイヤー（スマホ専用）

// sword.png は刃先が右上向き → facing に応じて回転
const SWORD_ROT_M = {
    '1,0':   0,            // RIGHT
    '-1,0':  Math.PI,      // LEFT
    '0,-1': -Math.PI / 2,  // UP
    '0,1':   Math.PI / 2,  // DOWN
};

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
        this.bootsCount   = 0;   // ③ 複数取得で加速
    }

    // ③ ブーツは重ねるほど速くなる（上限あり：壁抜け防止）
    get moveSpeed() {
        const bonus = Math.min(this.bootsCount, BOOTS_MAX_STACK) * S.BOOTS_SPEED_BONUS;
        return S.PLAYER_SPEED + bonus;
    }
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

    // pushDir = 弾き飛ばされる向き（敵が自分を向いている向き = enemy.facing）
    takeDamage(amount = 1, pushDir = null) {
        if (this.invincible > 0) return false;
        if (this.armorCharges > 0) {
            this.armorCharges--;
            this._applyHitEffect(pushDir);
            return true;
        }
        this.hp -= amount;
        this._applyHitEffect(pushDir);
        return true;
    }

    _applyHitEffect(pushDir) {
        this.invincible = this._invincibleTime;
        this.stunTimer  = 15;
        if (pushDir) this.knockback(pushDir, KNOCKBACK_DIST);
    }

    // pushDir 方向へそのまま移動（弾かれる向きを渡す）
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

    draw(ctx) {
        if (this.invincible === 0 || Math.floor(this.invincible / 4) % 2 !== 0) {
            assets.draw(ctx, 'player', this.rect.x, this.rect.y);
        }
        // ▲ではなく「1キャラ前に剣」を表示
        const [fx, fy] = this.facing;
        const cx = this.rect.centerX + fx * S.TILE;
        const cy = this.rect.centerY + fy * S.TILE;
        const angle = SWORD_ROT_M[fx + ',' + fy] || 0;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const img = assets.get('sword');
        if (img) {
            ctx.drawImage(img, -S.TILE / 2, -S.TILE / 2, S.TILE, S.TILE);
        } else {
            ctx.fillStyle = '#dddddd';
            ctx.fillRect(-S.TILE / 2, -2, S.TILE, 4);
        }
        ctx.restore();
    }
}
