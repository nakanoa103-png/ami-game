// settings.js — 全定数

const S = {
    // 画面
    LOGICAL_W: 320,
    LOGICAL_H: 240,
    SCREEN_W:  640,
    SCREEN_H:  480,
    FPS:       60,
    TILE:      16,

    // 色（CSS 文字列）
    BLACK:      '#000000',
    WHITE:      '#ffffff',
    RED:        'rgb(200,50,50)',
    FLOOR:      'rgb(40,40,40)',
    WALL:       'rgb(60,60,90)',
    PLAYER_COL: 'rgb(255,255,255)',
    GREEN:      'rgb(50,200,50)',
    YELLOW:     'rgb(220,200,50)',
    GRAY:       'rgb(100,100,100)',

    // プレイヤー
    PLAYER_SPEED:    2,
    PLAYER_HP:       5,
    INVINCIBLE_TIME: 90,

    // 攻撃
    ATTACK_DURATION: 12,
    ATTACK_REACH:    12,

    // 敵
    ENEMY_HP:          3,
    ENEMY_SPEED:       0.6,
    ENEMY_HIT_COOLDOWN:20,
    ENEMY_KNOCKBACK:   16,
    GUARD_AGGRO_DIST:  5,

    // ウェーブ
    WAVE_BANNER_FRAMES:     90,
    WAVE_CLEAR_WAIT_FRAMES: 120,
    SPAWN_MIN_DIST:         5,
    ENEMIES_BASE:           2,
    WAVE_HEAL:              2,

    // アイテム
    ITEM_APPEAR_CHANCE: 0.5,
    BOOTS_SPEED_BONUS:  1,
};
