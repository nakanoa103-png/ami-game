// script.js
document.addEventListener('DOMContentLoaded', () => {
    // Game State
    let capacities = []; // e.g., [10, 7, 3]
    let currentVols = []; // e.g., [10, 0, 0]
    let targetVol = 0;

    // UI State
    let selectedJugIndex = null;
    let isGameOver = false;
    let shortestPath = null; // Stored from BFS
    let madeVolumes = new Set();
    let optimalVolumes = new Set();
    let reachableVolumes = new Set();

    // DOM Elements
    const jugsContainer = document.getElementById('jugs-container');
    const targetValueEl = document.getElementById('target-value');
    const targetStatusEl = document.getElementById('target-status');
    const messageBox = document.getElementById('game-message');
    const btnNewGame = document.getElementById('btn-new-game');
    const btnHint = document.getElementById('btn-hint');
    const btnNextMove = document.getElementById('btn-next-move');
    const btnCustomGame = document.getElementById('btn-custom-game');
    const inputCap1 = document.getElementById('input-cap1');
    const inputCap2 = document.getElementById('input-cap2');
    const inputCap3 = document.getElementById('input-cap3');
    const inputTarget = document.getElementById('input-target');

    // Initialize Game
    function initGame() {
        isGameOver = false;
        selectedJugIndex = null;
        hideMessage();

        // 1. Generate Classic "Divide into Two" puzzle (A = B + C, Target = A / 2)
        let c = Math.floor(Math.random() * 4) + 2; // 2 to 5
        let b = c + Math.floor(Math.random() * 4) + 2; // c+2 to c+5
        if ((b + c) % 2 !== 0) { b++; } // Ensure A is even
        let a = b + c;

        capacities = [a, b, c];
        currentVols = [a, 0, 0]; // Start with largest full
        targetVol = a / 2;

        // Ensure we find the shortest path based on the new winning condition
        shortestPath = solveBFS(capacities, currentVols, targetVol);

        // Initialize tracking
        madeVolumes = new Set();
        currentVols.forEach(v => { if (v > 0) madeVolumes.add(v); });
        
        reachableVolumes = new Set();
        const allStates = bfsAllReachable(capacities, currentVols);
        allStates.forEach(stateStr => {
            stateStr.split(',').forEach(v => {
                const val = Number(v);
                if (val > 0 && val < capacities[0]) {
                    reachableVolumes.add(val);
                }
            });
        });

        optimalVolumes = new Set();
        if (shortestPath) {
            shortestPath.forEach(stateStr => {
                stateStr.split(',').forEach(v => {
                    const val = Number(v);
                    if (val > 0 && val !== targetVol && val !== capacities[0]) optimalVolumes.add(val);
                });
            });
        }

        // 4. Render UI
        renderUI();
    }

    // Render Jugs and UI
    function renderUI() {
        targetValueEl.textContent = `${targetVol} 升`;
        jugsContainer.innerHTML = '';

        let mode = 'normal';
        if (isGameOver) {
            mode = 'win';
        } else if (currentVols.includes(targetVol)) {
            mode = 'target';
        } else if (shortestPath && shortestPath.length > 1) {
            const nextStateVals = shortestPath[1].split(',').map(Number);
            if (nextStateVals.includes(targetVol)) {
                mode = 'chance';
            }
        }

        const maxCap = capacities[0];

        capacities.forEach((cap, index) => {
            const vol = currentVols[index];
            const heightPercent = (cap / maxCap) * 100; // Relative height of the jug itself
            const liquidPercent = (vol / cap) * 100; // Relative height of liquid inside
            const emptySpace = cap - vol;

            let extraClass = '';
            // 勝った時は全部の色を変える
            if (mode === 'win' && vol > 0) extraClass = ' win';
            // 目標量ができた時はそのマスだけ色を変える
            else if (mode === 'target' && vol === targetVol) extraClass = ' target';
            // 次で目標量ができるチャンスの時は全部の色を変える
            else if (mode === 'chance' && vol > 0) extraClass = ' chance';

            const wrapper = document.createElement('div');
            wrapper.className = 'jug-wrapper';
            if (index === selectedJugIndex) {
                wrapper.classList.add('selected');
            }
            // Make height strictly proportional so that the same volume has the exact same visual height
            const visualHeightPixels = 300 * (cap / maxCap); // strictly proportional to capacity

            wrapper.innerHTML = `
                <div class="jug" style="height: ${visualHeightPixels}px;">
                    <div class="empty-text" style="position: absolute; top: 0; left: 0; width: 100%; height: ${100 - liquidPercent}%; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); font-weight: bold; font-size: 1.5rem; z-index: 1; pointer-events: none;">
                        ${emptySpace > 0 ? emptySpace : ''}
                    </div>
                    <div class="liquid${extraClass}" style="height: ${liquidPercent}%">
                        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.5rem; text-shadow: 1px 1px 3px rgba(0,0,0,0.8); z-index: 2; position: relative; pointer-events: none;">
                            ${vol > 0 ? vol : ''}
                        </div>
                    </div>
                </div>
                <div class="jug-label">マス ${index + 1}</div>
                <div class="jug-capacity-info">${vol} / ${cap} 升</div>
            `;

            wrapper.addEventListener('click', () => handleJugClick(index));
            jugsContainer.appendChild(wrapper);
        });

        // Add volume tracker to the container (not inside the jumping wrapper)
        let trackerHTML = `<div class="volume-tracker"><div class="tracker-title">未達成</div>`;
        
        // Show only reachable volumes
        let hasUnmade = false;
        const sortedReachable = Array.from(reachableVolumes).sort((a,b) => a - b);
        
        // Ensure max volume is not in the unmade list
        const maxV = capacities[0];

        for (let v of sortedReachable) {
            if (v === targetVol || v === maxV) continue;

            const isMade = madeVolumes.has(v);
            const isImportant = optimalVolumes.has(v);
            
            if (!isMade || isImportant) {
                let classMap = 'vol-item';
                let badge = '';
                if (isMade) {
                    classMap += ' made';
                }
                if (isImportant && isMade) {
                    classMap += ' important';
                    badge = '<span class="vol-badge">重要</span>';
                }
                
                trackerHTML += `<div class="${classMap}"><span>${v} 升</span>${badge}</div>`;
                hasUnmade = true;
            }
        }
        if (!hasUnmade) trackerHTML += `<div style="font-size:0.7rem; color:var(--secondary-color);">全て作成済！</div>`;
        trackerHTML += `</div>`;
        
        // Insert the tracker into jugsContainer safely without destroying event listeners
        jugsContainer.insertAdjacentHTML('beforeend', trackerHTML);

        // Update target status label
        targetStatusEl.className = 'target-status';
        if (mode === 'win') {
            targetStatusEl.textContent = '🎉 完成！';
            targetStatusEl.classList.add('show', 'win');
        } else if (mode === 'target' || mode === 'chance') {
            targetStatusEl.textContent = '🌟 チャンス (あと1手)';
            targetStatusEl.classList.add('show', 'chance');
        } else {
            targetStatusEl.classList.remove('show');
        }
    }

    // Handle Jug Click (Selecting Source and Destination)
    function handleJugClick(index) {
        if (isGameOver) return;

        if (selectedJugIndex === null) {
            // Select Source
            if (currentVols[index] > 0) {
                selectedJugIndex = index;
                renderUI();
            } else {
                showMessage('空のマスからは注げません。', 'message-info');
            }
        } else {
            // Select Destination
            if (selectedJugIndex === index) {
                // Deselect
                selectedJugIndex = null;
                renderUI();
                hideMessage();
            } else {
                // Attempt Pour
                pour(selectedJugIndex, index);
                selectedJugIndex = null;
                checkWinCondition();
                updateGuide();
                renderUI();
            }
        }
    }

    // Guide Message Logic
    function updateGuide() {
        if (isGameOver) return; // すでにクリアしている場合は何もしない
        
        const hasTarget = currentVols.includes(targetVol);
        
        if (hasTarget) {
            showMessage('💡 目標量を持ったマスができました！あとは残りの油を別のマスにまとめて完成させましょう。', 'message-warning');
        } else if (shortestPath && shortestPath.length > 1) {
            // Check if the next optimal state contains the target volume
            const nextStateVals = shortestPath[1].split(',').map(Number);
            if (nextStateVals.includes(targetVol)) {
                showMessage('🌟 目標値達成チャンス！次の一手で目標量のマスが完成します！', 'message-success');
            }
        }
    }

    // Pour Logic
    function pour(fromIdx, toIdx) {
        const amountToPour = Math.min(
            currentVols[fromIdx],
            capacities[toIdx] - currentVols[toIdx]
        );

        if (amountToPour > 0) {
            currentVols[fromIdx] -= amountToPour;
            currentVols[toIdx] += amountToPour;

        // Track newly made volumes
        currentVols.forEach(v => {
            if (v > 0) madeVolumes.add(v);
        });

        // Recalculate hints from new state
        shortestPath = solveBFS(capacities, currentVols, targetVol);
        
        // Dynamic reachable reachableVolumes update might be unneeded since capacity doesn't change, 
        // but here we just update optimal path logic.
        
        // Re-eval optimal volumes from the new shortest path
        optimalVolumes = new Set();
            if (shortestPath) {
                shortestPath.forEach(stateStr => {
                    stateStr.split(',').forEach(v => {
                        const val = Number(v);
                        if (val > 0 && val !== targetVol && val !== capacities[0]) optimalVolumes.add(val);
                    });
                });
            }

            hideMessage();
        } else {
            showMessage('移動先がいっぱいです。', 'message-info');
        }
    }

    // Winning Logic Helper
    function isWinningState(state, target, totalVol) {
        // If the target is exactly half the total starting volume, 
        // the rule is to divide it into TWO equal parts (e.g. 5 & 5).
        if (target * 2 === totalVol) {
            return state.filter(v => v === target).length === 2;
        }
        // Otherwise, just having the target in any one jug is enough (for custom mode targets)
        return state.includes(target);
    }

    // Win Check
    function checkWinCondition() {
        if (isWinningState(currentVols, targetVol, capacities[0])) {
            isGameOver = true;
            if (targetVol * 2 === capacities[0]) {
                showMessage(`見事！ ${targetVol}升と${targetVol}升に二等分できました！クリア！`, 'message-success');
            } else {
                showMessage(`クリア！ ${targetVol}升を作ることができました！`, 'message-success');
            }
        }
    }

    // Next Move Button (Exact answer)
    btnNextMove.addEventListener('click', () => {
        if (isGameOver) return;

        if (shortestPath === null) {
            showMessage('この問題は解けないようです（到達不可能）。新しいゲームをお試しください。', 'message-error');
        } else {
            if (shortestPath.length > 1) {
                // Path string format: "a,b,c" -> Need to find which jug changed
                const currentStateStr = currentVols.join(',');
                let nextStateStr = shortestPath[1]; // Index 0 is current state

                // If the user deviated and BFS recalculated, shortestPath[0] is current, [1] is next
                const current = currentVols;
                const next = nextStateStr.split(',').map(Number);

                let from = -1, to = -1;
                for (let i = 0; i < 3; i++) {
                    if (current[i] > next[i]) from = i + 1;
                    if (current[i] < next[i]) to = i + 1;
                }

                showMessage(`ズバリ解答：マス ${from} から マス ${to} へ注ぎましょう。（残り ${shortestPath.length - 1} 手）`, 'message-info');
            } else {
                showMessage('目標はすでに達成されています。', 'message-info');
            }
        }
    });

    // Hint Button (Conceptual hint)
    btnHint.addEventListener('click', () => {
        if (isGameOver) return;

        if (shortestPath === null) {
            showMessage('ヒント：どうやらこの問題は解けないようです...', 'message-warning');
        } else {
            if (shortestPath.length > 1) {
                // Target-capable jugs
                let capableJugs = [];
                for (let i = 0; i < 3; i++) {
                    if (capacities[i] >= targetVol) capableJugs.push(`マス${i + 1}`);
                }
                const jugsStr = capableJugs.join('や');

                let hints = [
                    `<b>考え方1</b>：最短であと <strong>${shortestPath.length - 1}</strong> 手で完成します。手数を逆算してみましょう。`,
                    `<b>考え方2</b>：目標量以上の容量を持つマス（${jugsStr}のどれか）の中で、最終的に ${targetVol} 升ができあがります。`,
                    `<b>考え方3</b>：大きいマスから小さいマスへ油を移すことで生まれる「容量の差（引き算）」を使って、目的の量を作り出すのがコツです。`,
                    `<b>考え方4</b>：マスに別のマスを注いで目標値になれば完成です。（目標値 ＝ Ａ ＋ Ｂ）`,
                    `<b>考え方5</b>：別のマスの空き容量へ注いで減った結果が目標値になれば完成です。（目標値 ＝ Ａ － Ｂの空き容量）`,
                    `<b>考え方6</b>：次の一手を聞く前に、まずは自分で予想してから確認すると実力がつきますよ！`,
                    `<b>考え方7</b>：満タンのマスには注げませんし、一つ前の状態に戻しても意味がありません。実は選べる「意味のある一手」はそんなに多くないのです。`,
                    `<b>考え方8</b>：<strong>★クリアの鍵！</strong> まだ一度も作っていない数字（量）を作るように動かすのが一番の近道です。右上のリストを埋めていきましょう！`
                ];

                let randomHint = hints[Math.floor(Math.random() * hints.length)];

                showMessage(`💡 ${randomHint}<br><br><small style="color:var(--text-muted); font-weight:normal;">※どこに注げばいいか直接的な答えを知りたい場合は「次の一手を聞く」を押してください。</small>`, 'message-info');
            } else {
                showMessage('目標はすでに達成されています。', 'message-info');
            }
        }
    });

    // Custom Game Initialization
    function initCustomGame() {
        const c1 = parseInt(inputCap1.value);
        const c2 = parseInt(inputCap2.value);
        const c3 = parseInt(inputCap3.value);
        const tgt = parseInt(inputTarget.value);

        if (isNaN(c1) || isNaN(c2) || isNaN(c3) || isNaN(tgt) || c1 <= 0 || c2 <= 0 || c3 <= 0 || tgt <= 0) {
            showMessage('すべての値に正の整数を入力してください。', 'message-error');
            return;
        }

        const caps = [c1, c2, c3].sort((x, y) => y - x); // Sort descending

        isGameOver = false;
        selectedJugIndex = null;
        hideMessage();

        capacities = [...caps];
        currentVols = [caps[0], 0, 0];
        targetVol = tgt;

        shortestPath = solveBFS(capacities, currentVols, targetVol);

        // Initialize tracking
        madeVolumes = new Set();
        currentVols.forEach(v => { if (v > 0) madeVolumes.add(v); });
        
        reachableVolumes = new Set();
        const allStates = bfsAllReachable(capacities, currentVols);
        allStates.forEach(stateStr => {
            stateStr.split(',').forEach(v => {
                const val = Number(v);
                if (val > 0 && val < capacities[0]) {
                    reachableVolumes.add(val);
                }
            });
        });

        optimalVolumes = new Set();
        if (shortestPath) {
            shortestPath.forEach(stateStr => {
                stateStr.split(',').forEach(v => {
                    const val = Number(v);
                    if (val > 0 && val !== targetVol && val !== capacities[0]) optimalVolumes.add(val);
                });
            });
        }

        renderUI();
    }

    // New Game Button
    btnNewGame.addEventListener('click', initGame);
    btnCustomGame.addEventListener('click', initCustomGame);

    // Messages
    function showMessage(text, type) {
        messageBox.innerHTML = text;
        messageBox.className = `message-box ${type}`;
    }

    function hideMessage() {
        messageBox.className = 'message-box hidden';
    }

    // --- Graph Algorithms (BFS) ---

    // Find all reachable states from a given start state
    function bfsAllReachable(caps, startNode) {
        const startStr = startNode.join(',');
        const visited = new Set();
        const queue = [startNode];
        visited.add(startStr);

        while (queue.length > 0) {
            const curr = queue.shift();

            // Try all 6 possible pours (0->1, 0->2, 1->0, 1->2, 2->0, 2->1)
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (i !== j) {
                        const nextState = [...curr];
                        const amount = Math.min(curr[i], caps[j] - curr[j]);
                        if (amount > 0) {
                            nextState[i] -= amount;
                            nextState[j] += amount;
                            const nextStr = nextState.join(',');
                            if (!visited.has(nextStr)) {
                                visited.add(nextStr);
                                queue.push(nextState);
                            }
                        }
                    }
                }
            }
        }
        return visited;
    }

    // Find shortest path to a target volume. Returns array of state strings or null.
    function solveBFS(caps, startNode, target) {
        if (isWinningState(startNode, target, caps[0])) return [startNode.join(',')];

        const startStr = startNode.join(',');
        const visited = new Set();
        // Queue stores objects: { state: [a,b,c], path: ["a,b,c"] }
        const queue = [{ state: startNode, path: [startStr] }];
        visited.add(startStr);

        while (queue.length > 0) {
            const { state: curr, path } = queue.shift();

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (i !== j) {
                        const nextState = [...curr];
                        const amount = Math.min(curr[i], caps[j] - curr[j]);
                        if (amount > 0) {
                            nextState[i] -= amount;
                            nextState[j] += amount;
                            const nextStr = nextState.join(',');

                            if (isWinningState(nextState, target, caps[0])) {
                                return [...path, nextStr];
                            }

                            if (!visited.has(nextStr)) {
                                visited.add(nextStr);
                                queue.push({ state: nextState, path: [...path, nextStr] });
                            }
                        }
                    }
                }
            }
        }
        return null; // Unreachable
    }

    // Start
    initGame();
});
