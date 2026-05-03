const BOARD_SIZE = 9;

// Player enum
const PLAYERS = {
    P1: 'player1', // Bottom (moves up)
    P2: 'player2'  // Top (moves down)
};

// Piece Types Definition
const PIECE_TYPES = {
    INFANTRY: {
        name: '歩兵',
        maxHp: 3,
        attack: 3,
        defense: 1,
        symbol: '歩',
        image: '兵.png'
    },
    TREASURE: {
        name: '宝物',
        maxHp: 1,
        attack: 0,
        defense: 0,
        symbol: '宝',
        image: '宝.png'
    }
};

class Piece {
    constructor(type, player, x, y) {
        this.type = type;
        this.player = player;
        this.x = x;
        this.y = y;
        this.hp = type.maxHp;
        this.hasActed = false;
        this.isPromoted = false;
        this.displaySymbol = type.symbol;
    }

    getMovableTiles(board) {
        let moves = [];
        const dir = this.player === PLAYERS.P1 ? -1 : 1;
        
        if (this.type.name === '歩兵') {
            const ny = this.y + dir;
            if (ny >= 0 && ny < BOARD_SIZE) {
                moves.push({x: this.x, y: ny});
            }
            if (this.isPromoted) {
                // Backward
                const by = this.y - dir;
                if (by >= 0 && by < BOARD_SIZE) moves.push({x: this.x, y: by});
                // Left and Right
                if (this.x - 1 >= 0) moves.push({x: this.x - 1, y: this.y});
                if (this.x + 1 < BOARD_SIZE) moves.push({x: this.x + 1, y: this.y});
            }
        } else if (this.type.name === '宝物') {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = this.x + dx;
                    const ny = this.y + dy;
                    if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                        moves.push({x: nx, y: ny});
                    }
                }
            }
        }

        // ZOC Check (Zone of Control)
        let inZOC = false;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = this.x + dx;
                const ny = this.y + dy;
                if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                    const target = board[ny][nx];
                    // Enemy pieces with attack power > 0 project ZOC
                    if (target && target.player !== this.player && target.type.attack > 0) {
                        // Check if this enemy's ZOC is suppressed by 2 or more friendly pieces
                        let friendlyCount = 0;
                        for (let edy = -1; edy <= 1; edy++) {
                            for (let edx = -1; edx <= 1; edx++) {
                                if (edx === 0 && edy === 0) continue;
                                const fnx = nx + edx;
                                const fny = ny + edy;
                                if (fnx >= 0 && fnx < BOARD_SIZE && fny >= 0 && fny < BOARD_SIZE) {
                                    const fp = board[fny][fnx];
                                    if (fp && fp.player === this.player) {
                                        friendlyCount++;
                                    }
                                }
                            }
                        }
                        if (friendlyCount < 2) {
                            inZOC = true;
                            break; // Still caught in ZOC
                        }
                    }
                }
            }
            if (inZOC) break;
        }

        if (inZOC) {
            // If in ZOC, can only move to attack enemies
            moves = moves.filter(m => {
                const target = board[m.y][m.x];
                return target && target.player !== this.player;
            });
        }

        return moves;
    }
}

class Game {
    constructor() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.currentPlayer = PLAYERS.P1;
        this.selectedPiece = null;
        this.state = 'PLAYING';
        this.playMode = '1P'; // Default to 1P vs CPU

        this.initBoard();
        this.renderBoard();
        this.updateUI();
    }

    initBoard() {
        // Place P2 (Top) pieces
        this.board[0][4] = new Piece(PIECE_TYPES.TREASURE, PLAYERS.P2, 4, 0);
        for (let i = 0; i < BOARD_SIZE; i++) {
            this.board[2][i] = new Piece(PIECE_TYPES.INFANTRY, PLAYERS.P2, i, 2);
        }

        // Place P1 (Bottom) pieces
        this.board[8][4] = new Piece(PIECE_TYPES.TREASURE, PLAYERS.P1, 4, 8);
        for (let i = 0; i < BOARD_SIZE; i++) {
            this.board[6][i] = new Piece(PIECE_TYPES.INFANTRY, PLAYERS.P1, i, 6);
        }
    }

    renderBoard() {
        const boardEl = document.getElementById('game-board');
        boardEl.innerHTML = '';

        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.dataset.x = x;
                tile.dataset.y = y;

                if ((x + y) % 2 === 0) {
                    tile.style.background = 'var(--tile-color-2)';
                } else {
                    tile.style.background = 'var(--tile-color-1)';
                }

                // Visualize ZOC
                let isZOC = false;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                            const enemy = this.board[ny][nx];
                            if (enemy && enemy.player !== this.currentPlayer && enemy.type.attack > 0) {
                                let friendlyCount = 0;
                                for (let edy = -1; edy <= 1; edy++) {
                                    for (let edx = -1; edx <= 1; edx++) {
                                        if (edx === 0 && edy === 0) continue;
                                        const fnx = nx + edx;
                                        const fny = ny + edy;
                                        if (fnx >= 0 && fnx < BOARD_SIZE && fny >= 0 && fny < BOARD_SIZE) {
                                            const fp = this.board[fny][fnx];
                                            if (fp && fp.player === this.currentPlayer) friendlyCount++;
                                        }
                                    }
                                }
                                if (friendlyCount < 2) {
                                    isZOC = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (isZOC) break;
                }
                if (isZOC) tile.classList.add('zoc-tile');

                const piece = this.board[y][x];
                if (piece) {
                    const pieceEl = document.createElement('div');
                    const isActive = piece.player === this.currentPlayer;
                    pieceEl.className = `piece ${piece.player} ${isActive ? 'active-turn' : ''}`;
                    
                    let pieceContent = '';
                    if (piece.type.image) {
                        pieceContent = `<img src="${piece.type.image}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-bottom: 2px; border: 1px solid rgba(255,255,255,0.5);">`;
                        pieceContent += `<div style="font-size: 0.6rem; line-height: 1;">${piece.displaySymbol}</div>`;
                    } else {
                        pieceContent = piece.displaySymbol;
                    }

                    pieceEl.innerHTML = `
                        ${pieceContent}
                        <div class="hp-bar">
                            <div class="hp-fill" style="width: ${(piece.hp / piece.type.maxHp) * 100}%"></div>
                        </div>
                    `;
                    tile.appendChild(pieceEl);
                }

                tile.addEventListener('click', () => this.handleTileClick(x, y));
                boardEl.appendChild(tile);
            }
        }
    }

    handleTileClick(x, y) {
        if (this.state !== 'PLAYING') return;

        const targetPiece = this.board[y][x];

        if (this.selectedPiece) {
            const moves = this.selectedPiece.getMovableTiles(this.board);
            const isValidMove = moves.some(m => m.x === x && m.y === y);

            if (isValidMove) {
                if (targetPiece && targetPiece.player !== this.currentPlayer) {
                    this.executeCombat(this.selectedPiece, targetPiece, x, y);
                } else if (!targetPiece) {
                    this.movePiece(this.selectedPiece, x, y);
                }
            } else if (targetPiece && targetPiece.player === this.currentPlayer) {
                this.selectedPiece = targetPiece;
                this.renderHighlights();
                this.showUnitInfo(targetPiece);
                return;
            } else {
                this.selectedPiece = null;
            }
            
            this.renderHighlights();
            return;
        }

        if (targetPiece && targetPiece.player === this.currentPlayer) {
            this.selectedPiece = targetPiece;
            this.renderHighlights();
            this.showUnitInfo(targetPiece);
        } else if (targetPiece) {
            this.showUnitInfo(targetPiece);
        }
    }

    executeCombat(attacker, defender, defX, defY) {
        let damage = Math.max(1, attacker.type.attack - defender.type.defense);
        defender.hp -= damage;

        if (defender.hp <= 0) {
            if (defender.type.name === '宝物') {
                this.gameOver(attacker.player);
            }
            this.board[defY][defX] = null;
            this.movePiece(attacker, defX, defY);
        } else {
            this.endTurn();
        }
    }

    movePiece(piece, toX, toY) {
        this.board[piece.y][piece.x] = null;
        piece.x = toX;
        piece.y = toY;
        this.board[toY][toX] = piece;

        if (piece.type.name === '歩兵' && !piece.isPromoted) {
            if ((piece.player === PLAYERS.P1 && toY <= 2) || 
                (piece.player === PLAYERS.P2 && toY >= 6)) {
                piece.isPromoted = true;
                piece.displaySymbol = '歩+';
            }
        }

        this.endTurn();
    }

    endTurn() {
        this.selectedPiece = null;
        this.currentPlayer = this.currentPlayer === PLAYERS.P1 ? PLAYERS.P2 : PLAYERS.P1;
        this.updateUI();
        this.renderBoard();

        if (this.state === 'PLAYING' && this.playMode === '1P' && this.currentPlayer === PLAYERS.P2) {
            setTimeout(() => this.makeAIMove(), 500);
        }
    }

    makeAIMove() {
        if (this.state !== 'PLAYING' || this.currentPlayer !== PLAYERS.P2) return;

        let allMoves = [];
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                const piece = this.board[y][x];
                if (piece && piece.player === PLAYERS.P2) {
                    const moves = piece.getMovableTiles(this.board);
                    moves.forEach(m => {
                        allMoves.push({ piece, fromX: x, fromY: y, toX: m.x, toY: m.y });
                    });
                }
            }
        }

        if (allMoves.length === 0) {
            this.endTurn();
            return;
        }

        let bestMove = null;
        let bestScore = -Infinity;

        // Find Player 1's Treasure to calculate distance
        let p1TreasurePos = { x: 4, y: 8 }; // default fallback
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                const p = this.board[y][x];
                if (p && p.player === PLAYERS.P1 && p.type.name === '宝物') {
                    p1TreasurePos = { x, y };
                }
            }
        }

        allMoves.forEach(move => {
            let score = 0;
            const target = this.board[move.toY][move.toX];
            
            if (target && target.player === PLAYERS.P1) {
                if (target.type.name === '宝物') score += 10000;
                else score += 10;
            }
            
            // Score based on distance to enemy treasure
            if (move.piece.type.name === '宝物') {
                score -= 100; // Heavily discourage Treasure from moving
            } else {
                const currentDist = Math.abs(move.fromX - p1TreasurePos.x) + Math.abs(move.fromY - p1TreasurePos.y);
                const newDist = Math.abs(move.toX - p1TreasurePos.x) + Math.abs(move.toY - p1TreasurePos.y);
                
                // Positive score if it moves closer to the treasure
                score += (currentDist - newDist) * 3;
                
                // Slight forward bias just to encourage advancing if distances are equal
                score += (move.toY - move.fromY) * 0.1;
            }
            
            // Randomness
            score += Math.random();

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        });

        if (bestMove) {
            const piece = bestMove.piece;
            const target = this.board[bestMove.toY][bestMove.toX];

            this.selectedPiece = piece;
            this.renderHighlights();
            
            setTimeout(() => {
                if (target && target.player === PLAYERS.P1) {
                    this.executeCombat(piece, target, bestMove.toX, bestMove.toY);
                } else {
                    this.movePiece(piece, bestMove.toX, bestMove.toY);
                }
            }, 600);
        } else {
            this.endTurn();
        }
    }

    gameOver(winner) {
        this.state = 'GAME_OVER';
        const isP1Win = winner === PLAYERS.P1;
        const msg = isP1Win ? '🎊 青チーム勝利！敵の宝を奪いました！' : '💀 青チーム敗退...宝を奪われました。';
        
        const turnInfo = document.querySelector('.turn-info');
        turnInfo.innerHTML = msg;
        turnInfo.style.color = isP1Win ? '#60a5fa' : '#f87171';
        
        setTimeout(() => alert(msg), 100);
    }

    renderHighlights() {
        document.querySelectorAll('.tile').forEach(t => {
            t.classList.remove('highlight');
            t.classList.remove('attack-highlight');
        });

        if (this.selectedPiece) {
            const moves = this.selectedPiece.getMovableTiles(this.board);
            moves.forEach(m => {
                const index = m.y * BOARD_SIZE + m.x;
                const tile = document.querySelectorAll('.tile')[index];
                const targetPiece = this.board[m.y][m.x];
                
                if (targetPiece && targetPiece.player !== this.currentPlayer) {
                    tile.classList.add('attack-highlight');
                } else if (!targetPiece) {
                    tile.classList.add('highlight');
                }
            });
        }
    }

    showUnitInfo(piece) {
        const infoEl = document.getElementById('unit-info');
        if (!piece) {
            infoEl.innerHTML = '<p>駒を選択してください</p>';
            return;
        }

        infoEl.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; font-size: 1.1rem;">
                ${piece.player === PLAYERS.P1 ? '🔵 P1' : '🔴 P2'} - ${piece.isPromoted ? piece.type.name + ' (成)' : piece.type.name}
            </div>
            <div class="stat-row">
                <span class="stat-label">HP</span>
                <span class="stat-value" style="color: #4ade80;">${piece.hp} / ${piece.type.maxHp}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">攻撃力</span>
                <span class="stat-value" style="color: #f87171;">${piece.type.attack}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">防御力</span>
                <span class="stat-value" style="color: #60a5fa;">${piece.type.defense}</span>
            </div>
        `;
    }

    updateUI() {
        const turnInfo = document.querySelector('.turn-info');
        const appEl = document.getElementById('app');

        if (this.state === 'GAME_OVER') {
            turnInfo.textContent = 'Game Over';
            appEl.classList.remove('turn-p1', 'turn-p2');
            return;
        }
        
        appEl.classList.remove('turn-p1', 'turn-p2');
        if (this.currentPlayer === PLAYERS.P1) {
            turnInfo.textContent = '🔵 Player 1 のターン';
            turnInfo.style.color = '#60a5fa';
            appEl.classList.add('turn-p1');
        } else {
            turnInfo.textContent = '🔴 Player 2 のターン';
            turnInfo.style.color = '#f87171';
            appEl.classList.add('turn-p2');
        }

        if (!this.selectedPiece) {
            this.showUnitInfo(null);
        }
    }

    restart() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.currentPlayer = PLAYERS.P1;
        this.selectedPiece = null;
        this.state = 'PLAYING';
        document.getElementById('app').classList.remove('turn-p1', 'turn-p2');
        this.initBoard();
        this.renderBoard();
        this.updateUI();
    }
}

window.onload = () => {
    window.gameInstance = new Game();
};
