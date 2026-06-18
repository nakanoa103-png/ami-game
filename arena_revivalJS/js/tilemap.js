// tilemap.js — マップ定義・描画・壁判定

const MAP_DATA = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

class TileMap {
    isWall(x, y) {
        const col = Math.floor(x / S.TILE);
        const row = Math.floor(y / S.TILE);
        if (row < 0 || row >= MAP_DATA.length || col < 0 || col >= MAP_DATA[0].length) return true;
        return MAP_DATA[row][col] === 1;
    }

    isWallRect(rect) {
        return [
            [rect.left,      rect.top],
            [rect.right - 1, rect.top],
            [rect.left,      rect.bottom - 1],
            [rect.right - 1, rect.bottom - 1],
        ].some(([cx, cy]) => this.isWall(cx, cy));
    }

    getFloorTiles() {
        const tiles = [];
        for (let row = 0; row < MAP_DATA.length; row++)
            for (let col = 0; col < MAP_DATA[0].length; col++)
                if (MAP_DATA[row][col] === 0) tiles.push([col, row]);
        return tiles;
    }

    draw(ctx) {
        for (let row = 0; row < MAP_DATA.length; row++)
            for (let col = 0; col < MAP_DATA[0].length; col++)
                assets.draw(ctx, MAP_DATA[row][col] === 1 ? 'wall' : 'floor',
                            col * S.TILE, row * S.TILE);
    }
}
