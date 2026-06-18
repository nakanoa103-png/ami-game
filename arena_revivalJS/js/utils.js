// utils.js — 共通ユーティリティ

class Rect {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
    }
    get left()    { return this.x; }
    get right()   { return this.x + this.w; }
    get top()     { return this.y; }
    get bottom()  { return this.y + this.h; }
    get centerX() { return this.x + this.w / 2; }
    get centerY() { return this.y + this.h / 2; }

    collides(other) {
        return this.left < other.right  && this.right  > other.left &&
               this.top  < other.bottom && this.bottom > other.top;
    }
    move(dx, dy)  { return new Rect(this.x + dx, this.y + dy, this.w, this.h); }
    copy()        { return new Rect(this.x, this.y, this.w, this.h); }
    shrink(px)    { return new Rect(this.x + px, this.y + px, this.w - px*2, this.h - px*2); }
}

// Python の random.randint(min, max) 相当（両端含む）
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fisher-Yates シャッフル（破壊的、配列を返す）
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
