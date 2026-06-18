// item.js — アイテム基底クラス + 各種アイテム

class Item {
    constructor(tileX, tileY, imgKey) {
        this.rect    = new Rect(tileX * S.TILE, tileY * S.TILE, S.TILE, S.TILE);
        this._img    = imgKey;
        this.active  = true;
    }

    checkPickup(player) {
        if (!this.active) return;
        if (this.rect.collides(player.rect)) {
            this.onPickup(player);
            this.active = false;
        }
    }

    onPickup(player) {}   // サブクラスで上書き

    draw(ctx) {
        if (this.active) assets.draw(ctx, this._img, this.rect.x, this.rect.y);
    }
}

class Potion extends Item {
    constructor(tileX, tileY) { super(tileX, tileY, 'potion'); }
    onPickup(player) { player.hp = player.hpMax; }
}

class Armor extends Item {
    constructor(tileX, tileY) { super(tileX, tileY, 'armor'); }
    onPickup(player) { player.armorCharges += randInt(5, 10); }
}

class SwordPowerup extends Item {
    constructor(tileX, tileY) { super(tileX, tileY, 'sword_item'); }
    onPickup(player) { player.swordCharges += randInt(5, 10); }
}

class Boots extends Item {
    constructor(tileX, tileY) { super(tileX, tileY, 'boots'); }
    onPickup(player) { player.hasBoots = true; }
}
