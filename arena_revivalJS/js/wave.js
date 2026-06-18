// wave.js — ウェーブ管理

const WS = { CLEAR: 'clear', BANNER: 'banner', ACTIVE: 'active' };

class WaveManager {
    constructor(tilemap) {
        this.tilemap    = tilemap;
        this.waveNum    = 0;
        this.kills      = 0;   // 累計キル数
        this.enemies    = [];
        this.items      = [];
        this._state     = WS.CLEAR;
        this._timer     = 0;   // 0 で初回 update() 即スタート
        this._swingHit  = false;
        this._prevAlive = 0;   // 前フレームの生存数（キル差分計算用）
    }

    update(player) {
        if (this._state === WS.CLEAR) {
            if (this._timer <= 0) {
                this._startNextWave(player);
            } else {
                this._timer--;
            }
        } else if (this._state === WS.BANNER) {
            this._timer--;
            if (this._timer <= 0) this._state = WS.ACTIVE;
        } else {
            this._updateActive(player);
        }
    }

    _startNextWave(player) {
        this.waveNum++;
        this.enemies    = [];
        this.items      = [];
        this._swingHit  = false;

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
            else if (type === 'sword')  item = new SwordPowerup(ic, ir);
            else                        item = new Boots(ic, ir);
            this.items.push(item);
            this.enemies.push(new GuardEnemy(gc, gr, this.tilemap, homePos));
        }

        const normalCount = Math.max(0, S.ENEMIES_BASE + this.waveNum - 1 - itemTypes.length);
        for (let i = 0; i < normalCount && idx < floorAll.length; i++, idx++) {
            const [c, r] = floorAll[idx];
            this.enemies.push(new Enemy(c, r, this.tilemap));
        }

        this._prevAlive = this.enemies.length;
        this._state     = WS.BANNER;
        this._timer     = S.WAVE_BANNER_FRAMES;
    }

    _pickItemTypes() {
        const types = ['potion'];   // 毎回ポーションは出る
        if (this.waveNum >= 5 && Math.random() < S.ITEM_APPEAR_CHANCE) {
            const r = Math.random();
            if      (r < 0.45) types.push('armor');
            else if (r < 0.90) types.push('sword');
            else               types.push('boots');
        }
        return types;
    }

    _updateActive(player) {
        // 剣スイング: 1スイング1体ルール
        if (!player.attackRect) this._swingHit = false;

        for (const e of this.enemies) {
            e.update(player.rect);
            if (player.attackRect && !this._swingHit) {
                if (e.takeHit(player.attackRect, player.facing, player.attackDamage)) {
                    this._swingHit = true;
                    player.onSwingHit();
                }
            }
            if (e.checkContact(player.rect)) player.takeDamage();
        }

        // キル差分を累計に加算
        const aliveNow = this.enemies.filter(e => e.alive).length;
        this.kills += this._prevAlive - aliveNow;
        this._prevAlive = aliveNow;

        // アイテムピックアップ
        for (const item of this.items) item.checkPickup(player);

        // 全滅チェック
        if (this.enemies.every(e => !e.alive)) {
            player.heal(S.WAVE_HEAL);
            this._state = WS.CLEAR;
            this._timer = S.WAVE_CLEAR_WAIT_FRAMES;
        }
    }

    get isBanner() { return this._state === WS.BANNER; }
    get isActive()  { return this._state === WS.ACTIVE; }

    draw(ctx) {
        for (const item of this.items) item.draw(ctx);
        for (const e of this.enemies)  e.draw(ctx);
    }
}
