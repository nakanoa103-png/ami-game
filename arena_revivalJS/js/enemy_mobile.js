// enemy_mobile.js — 4方向直線視界＋状態遷移＋囲みAI（スマホ専用）

const EST = { UNAWARE: 0, CHASING: 1, SEARCHING: 2 };

// 囲みスロット分散用のカウンタ（敵生成ごとに別の角度を割り当てる）
let _surroundCounter = 0;

class EnemyMobile {
    constructor(tileX, tileY, tilemap) {
        this.tilemap = tilemap;
        this.rect    = new Rect(tileX * S.TILE, tileY * S.TILE, S.TILE, S.TILE);
        this.facing  = [0, 1];
        this.alive   = true;
        this.hp      = 3;
        this.invincible = 0;
        this._waveNum   = 1;

        this.state      = EST.UNAWARE;
        this._kyoroTimer  = randInt(KYORO_MIN, KYORO_MAX);
        this._patrolDir   = [[1,0],[-1,0],[0,1],[0,-1]][randInt(0,3)];
        this._lastSeen    = null;   // [px, py]
        this._loseTimer   = 0;
        this._searchTimer = 0;

        // 囲みスロット: 背後中心 ±SURROUND_ARC を黄金角で分散
        this._surroundFrac = ((_surroundCounter++ * 0.61803398875) % 1);

        this._lungeTimer  = 0;
        this._circleTimer = randInt(CIRCLE_FRAMES_MIN, CIRCLE_FRAMES_MAX);
    }

    // ── 視界: 向いている方向の一直線のみ。壁で遮断、最大VISION_RANGE ──
    _canSeePlayer(playerRect) {
        const [fx, fy] = this.facing;
        if (fx === 0 && fy === 0) return false;
        const T = S.TILE;
        let col = Math.floor(this.rect.centerX / T);
        let row = Math.floor(this.rect.centerY / T);
        const pcol = Math.floor(playerRect.centerX / T);
        const prow = Math.floor(playerRect.centerY / T);
        for (let i = 1; i <= VISION_RANGE; i++) {
            col += fx; row += fy;
            // 壁タイルで視線終了（奥は見えない）
            if (this.tilemap.isWall(col * T, row * T)) return false;
            if (col === pcol && row === prow) return true;   // 発見
        }
        return false;
    }

    update(playerRect, playerFacing) {
        if (!this.alive) return;
        if (this.invincible > 0) this.invincible--;

        if      (this.state === EST.UNAWARE)   this._updateUnaware(playerRect);
        else if (this.state === EST.CHASING)   this._updateChasing(playerRect, playerFacing);
        else                                   this._updateSearching(playerRect);
    }

    // ── 未発見: キョロキョロ＋ゆるく巡回。視界に入れば発見 ──
    _updateUnaware(playerRect) {
        if (--this._kyoroTimer <= 0) {
            this.facing     = [[1,0],[-1,0],[0,1],[0,-1]][randInt(0,3)];
            this._patrolDir = this.facing;
            this._kyoroTimer = randInt(KYORO_MIN, KYORO_MAX);
        }
        if (this._canSeePlayer(playerRect)) { this._toChasing(playerRect); return; }
        // ゆるく巡回（壁にぶつかったら次のキョロで方向転換）
        if (!this._step(this._patrolDir[0], this._patrolDir[1], S.ENEMY_SPEED * PATROL_SPEED)) {
            this._kyoroTimer = 0;
        }
    }

    // ── 発見: 必ず囲み（側面/背後へ回り込み）。正面には突っ込まない ──
    _updateChasing(playerRect, playerFacing) {
        const pcx = playerRect.centerX, pcy = playerRect.centerY;
        const ex = this.rect.centerX, ey = this.rect.centerY;
        const dist = Math.hypot(pcx - ex, pcy - ey);

        // 【視線固定】移動と無関係に顔は常にプレイヤーへ
        this._faceToward(pcx, pcy);

        // 【壁遮蔽】敵→プレイヤー直線が壁で遮られていなければ記憶更新、遮られ続けたら見失い
        if (!this._lineBlocked(playerRect)) {
            this._loseTimer = LOSE_FRAMES;
            this._lastSeen  = [pcx, pcy];
        } else if (--this._loseTimer <= 0) {
            this._toSearching(); return;
        }

        // 目標角度: プレイヤー背後を中心に ±SURROUND_ARC（正面は含まない）
        const [pfx, pfy] = playerFacing || [0, 1];
        const backAngle   = Math.atan2(-pfy, -pfx);
        const targetAngle = backAngle + (this._surroundFrac - 0.5) * 2 * SURROUND_ARC;

        // プレイヤー周りの現在角度と、目標角度との差
        const curAngle = Math.atan2(ey - pcy, ex - pcx);
        let diff = targetAngle - curAngle;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;

        const inDir = this._unit(pcx - ex, pcy - ey);     // プレイヤーへ（内向き）
        const sign  = diff >= 0 ? 1 : -1;
        const tanx  = -(-inDir[1]) * sign, tany = (-inDir[0]) * sign; // 接線（目標角へ回す向き）
        const aligned = Math.abs(diff) < ALIGN_TOL;

        let mvx, mvy;
        if (this._lungeTimer > 0) {
            // 突進: 整列した側面/背後から内へ詰める（=攻撃チャンス、正面からではない）
            this._lungeTimer--;
            mvx = inDir[0]; mvy = inDir[1];
        } else if (aligned && dist < FLANK_RANGE && --this._circleTimer <= 0) {
            // 囲み位置に着いたら時々踏み込む
            this._lungeTimer  = LUNGE_FRAMES;
            this._circleTimer = randInt(CIRCLE_FRAMES_MIN, CIRCLE_FRAMES_MAX);
            mvx = inDir[0]; mvy = inDir[1];
        } else {
            // 整列前は接線で回り込み、整列後は間合い(SURROUND_RADIUS)を保つ
            let radial;
            if      (!aligned)                 radial =  0.15;   // 回り込み優先
            else if (dist > SURROUND_RADIUS)   radial =  0.6;    // 間合いまで寄る
            else                               radial = -0.15;   // 近すぎたら少し引く
            mvx = tanx * (1 - Math.abs(radial)) + inDir[0] * radial;
            mvy = tany * (1 - Math.abs(radial)) + inDir[1] * radial;
            const m = Math.hypot(mvx, mvy) || 1; mvx /= m; mvy /= m;
        }
        this._step(mvx, mvy, S.ENEMY_SPEED);
    }

    // 敵→プレイヤーを結ぶ直線が壁タイルで遮られているか（顔の向きと無関係）
    _lineBlocked(playerRect) {
        const x0 = this.rect.centerX, y0 = this.rect.centerY;
        const x1 = playerRect.centerX, y1 = playerRect.centerY;
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.ceil(dist / (S.TILE / 4));   // 4pxごとに判定
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            if (this.tilemap.isWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
        }
        return false;
    }

    // ── 見失い: 最後に見た位置へ。再発見でChasing、時間切れでUnaware ──
    _updateSearching(playerRect) {
        if (this._canSeePlayer(playerRect)) { this._toChasing(playerRect); return; }
        if (--this._searchTimer <= 0 || !this._lastSeen) { this._toUnaware(); return; }

        const [lx, ly] = this._lastSeen;
        this._faceToward(lx, ly);
        const d = this._unit(lx - this.rect.centerX, ly - this.rect.centerY);
        this._step(d[0], d[1], S.ENEMY_SPEED * 0.8);
        if (Math.hypot(lx - this.rect.centerX, ly - this.rect.centerY) < S.TILE) this._toUnaware();
    }

    // ── 状態遷移 ──
    _toChasing(playerRect)  {
        this.state = EST.CHASING;
        this._loseTimer = LOSE_FRAMES;
        this._lastSeen  = [playerRect.centerX, playerRect.centerY];
    }
    _toSearching() { this.state = EST.SEARCHING; this._searchTimer = SEARCH_FRAMES; }
    _toUnaware()   { this.state = EST.UNAWARE; this._kyoroTimer = randInt(KYORO_MIN, KYORO_MAX); }

    // ── 移動補助: 軸ごとに壁判定。動けたら true ──
    _step(mvx, mvy, spd) {
        let moved = false;
        const nx = this.rect.x + mvx * spd;
        const ny = this.rect.y + mvy * spd;
        if (!this.tilemap.isWallRect(new Rect(nx, this.rect.y, S.TILE, S.TILE))) { this.rect.x = nx; if (mvx) moved = true; }
        if (!this.tilemap.isWallRect(new Rect(this.rect.x, ny, S.TILE, S.TILE))) { this.rect.y = ny; if (mvy) moved = true; }
        return moved;
    }

    _unit(x, y) {
        const d = Math.hypot(x, y);
        return d < 0.0001 ? [0, 0] : [x / d, y / d];
    }

    _faceToward(tx, ty) {
        const dx = tx - this.rect.centerX, dy = ty - this.rect.centerY;
        if (Math.abs(dx) >= Math.abs(dy)) this.facing = dx >= 0 ? [1, 0] : [-1, 0];
        else                              this.facing = dy >= 0 ? [0, 1] : [0, -1];
    }

    // ① 押し合い用
    pushAway(dx, dy) {
        const nx = this.rect.x + dx;
        const ny = this.rect.y + dy;
        if (!this.tilemap.isWallRect(new Rect(nx, this.rect.y, S.TILE, S.TILE))) this.rect.x = nx;
        if (!this.tilemap.isWallRect(new Rect(this.rect.x, ny, S.TILE, S.TILE))) this.rect.y = ny;
    }

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

    // attackerDir: 攻撃してきた方向（そちらを向く）/ seenPos: 攻撃者の位置
    takeHit(attackerDir = null, seenPos = null) {
        if (this.invincible > 0) return false;
        this.hp--;
        this.invincible = 20;
        if (this.hp <= 0) { this.alive = false; return true; }
        // 【被弾で即発見】視界判定と無関係に追跡へ。攻撃方向を向く
        this.state      = EST.CHASING;
        this._loseTimer = LOSE_FRAMES;
        if (attackerDir) this.facing   = attackerDir;
        if (seenPos)     this._lastSeen = seenPos;
        return true;
    }

    // 状態で向き矢印の色を変える（灰=未発見 / 赤=発見 / 黄=探索）
    _stateColor() {
        return this.state === EST.CHASING ? '#FF4444'
             : this.state === EST.SEARCHING ? '#FFCC44'
             : '#888888';
    }

    draw(ctx) {
        if (!this.alive) return;
        if (this.invincible === 0 || Math.floor(this.invincible / 3) % 2 !== 0) {
            assets.draw(ctx, 'enemy', this.rect.x, this.rect.y);
        }
        drawFacingArrow(ctx, this.rect.centerX, this.rect.y - 5, this.facing, this._stateColor());
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
        drawFacingArrow(ctx, this.rect.centerX, this.rect.y - 5, this.facing, this._stateColor());
    }
}
