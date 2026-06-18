// player.js — プレイヤークラス

const DIR = {
    DOWN:  [ 0,  1],
    UP:    [ 0, -1],
    LEFT:  [-1,  0],
    RIGHT: [ 1,  0],
};

// sword.png は刃先が右上向き → canvas では時計回りラジアンで回転
const SWORD_ROT = {
    '1,0':   0,             // RIGHT
    '-1,0':  Math.PI,       // LEFT
    '0,-1': -Math.PI / 2,   // UP
    '0,1':   Math.PI / 2,   // DOWN
};

class Player {
    constructor(tilemap) {
        this.tilemap = tilemap;
        this.rect    = new Rect(2 * S.TILE, 2 * S.TILE, S.TILE, S.TILE);
        this.facing  = DIR.DOWN;

        this.hp    = S.PLAYER_HP;
        this.hpMax = S.PLAYER_HP;

        this.invincible  = 0;
        this.stunTimer   = 0;
        this.attackTimer = 0;
        this.attackRect  = null;

        // パワーアップ
        this.armorCharges = 0;
        this.swordCharges = 0;
        this.hasBoots     = false;
    }

    get moveSpeed()    { return S.PLAYER_SPEED + (this.hasBoots ? S.BOOTS_SPEED_BONUS : 0); }
    get attackDamage() { return this.swordCharges > 0 ? 3 : 1; }
    get isDead()       { return this.hp <= 0; }

    handleInput(keys) {
        if (this.stunTimer > 0) return;   // 被弾直後は操作無効
        const spd = this.moveSpeed;
        let dx = 0, dy = 0;
        if (keys['ArrowLeft']  || keys['KeyA']) dx -= spd;
        if (keys['ArrowRight'] || keys['KeyD']) dx += spd;
        if (keys['ArrowUp']    || keys['KeyW']) dy -= spd;
        if (keys['ArrowDown']  || keys['KeyS']) dy += spd;

        if (dx !== 0) {
            const next = this.rect.move(dx, 0);
            if (!this.tilemap.isWallRect(next)) {
                this.rect = next;
                this.facing = dx > 0 ? DIR.RIGHT : DIR.LEFT;
            }
        }
        if (dy !== 0) {
            const next = this.rect.move(0, dy);
            if (!this.tilemap.isWallRect(next)) {
                this.rect = next;
                this.facing = dy > 0 ? DIR.DOWN : DIR.UP;
            }
        }
        if (keys['Space'] && this.attackTimer === 0) {
            this.attackTimer = S.ATTACK_DURATION;
        }
    }

    update() {
        if (this.stunTimer > 0) this.stunTimer--;
        if (this.attackTimer > 0) {
            this.attackTimer--;
            this.attackRect = this._makeAttackRect();
        } else {
            this.attackRect = null;
        }
        if (this.invincible > 0) this.invincible--;
    }

    onSwingHit() {
        if (this.swordCharges > 0) this.swordCharges--;
    }

    _makeAttackRect() {
        const [fdx, fdy] = this.facing;
        const w = fdy !== 0 ? S.TILE : S.ATTACK_REACH;
        const h = fdx !== 0 ? S.TILE : S.ATTACK_REACH;
        const x = this.rect.centerX - w / 2 + fdx * (S.TILE / 2 + S.ATTACK_REACH / 2);
        const y = this.rect.centerY - h / 2 + fdy * (S.TILE / 2 + S.ATTACK_REACH / 2);
        return new Rect(x, y, w, h);
    }

    knockback(direction, distance = 10) {
        const [fdx, fdy] = direction;
        for (let i = 0; i < distance; i++) {
            const nx = this.rect.x - fdx;
            const ny = this.rect.y - fdy;
            if (this.tilemap.isWallRect(new Rect(nx, ny, S.TILE, S.TILE))) break;
            this.rect.x = nx;
            this.rect.y = ny;
        }
    }

    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.hpMax);
    }

    takeDamage(amount = 1, fromDir = null) {
        if (this.invincible > 0) return;
        if (this.armorCharges > 0) {
            this.armorCharges--;
            this.invincible = S.INVINCIBLE_TIME;
            this.stunTimer   = 20;
            if (fromDir) this.knockback(fromDir, 14);
            return;
        }
        this.hp -= amount;
        this.invincible = S.INVINCIBLE_TIME;
        this.stunTimer   = 20;
        if (fromDir) this.knockback(fromDir, 14);
    }

    draw(ctx) {
        // 無敵中は点滅
        if (this.invincible === 0 || Math.floor(this.invincible / 4) % 2 !== 0) {
            assets.draw(ctx, 'player', this.rect.x, this.rect.y);
        }
        // 攻撃中: 向きに合わせて sword を回転描画
        if (this.attackRect) {
            const angle = SWORD_ROT[this.facing.join(',')] ?? 0;
            ctx.save();
            ctx.translate(this.attackRect.centerX, this.attackRect.centerY);
            ctx.rotate(angle);
            const img = assets.get('sword');
            if (img) ctx.drawImage(img, -S.TILE / 2, -S.TILE / 2, S.TILE, S.TILE);
            ctx.restore();
        }
    }
}
