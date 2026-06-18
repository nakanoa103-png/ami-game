// assets.js — 画像ローダ。ファイルが無ければ単色矩形で代替

class AssetManager {
    constructor() {
        this._imgs = {};
    }

    // 単色矩形フォールバックを生成
    _fallback(color) {
        const c = document.createElement('canvas');
        c.width = S.TILE; c.height = S.TILE;
        c.getContext('2d').fillStyle = color;
        c.getContext('2d').fillRect(0, 0, S.TILE, S.TILE);
        return c;
    }

    // 非同期で読み込み。失敗時はフォールバックを維持
    load(name, path, fallbackColor) {
        this._imgs[name] = this._fallback(fallbackColor);   // 即座にフォールバックを登録
        const img = new Image();
        img.onload  = () => { this._imgs[name] = img; };
        img.onerror = () => { /* fallback のまま */ };
        img.src = path;
    }

    get(name) { return this._imgs[name]; }

    draw(ctx, name, x, y) {
        const img = this._imgs[name];
        if (img) ctx.drawImage(img, Math.round(x), Math.round(y), S.TILE, S.TILE);
    }
}

const assets = new AssetManager();
