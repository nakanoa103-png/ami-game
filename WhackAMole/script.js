document.addEventListener('DOMContentLoaded', () => {
    const holes = document.querySelectorAll('.hole');
    const scoreDisplay = document.getElementById('score');
    const timeDisplay = document.getElementById('time');
    const startBtn = document.getElementById('start-btn');
    const highScoreDisplay = document.getElementById('highscore'); // NEW
    const comboDisplay = document.getElementById('combo-display'); // NEW

    let score = 0;
    let timeRemaining = 30;
    let isPlaying = false;
    let countdownTimer = null;
    let moleTimers = []; // Track timeouts to clear them if game ends

    // Advanced Features variables
    let highScore = parseInt(localStorage.getItem('moleHighScore')) || 0;
    highScoreDisplay.textContent = highScore;
    
    let combo = 0;
    let comboTimer = null;
    const activeMoles = new Map(); // O(1) hash map for hit detection

    // Speeds in ms (Fast, Medium, Slow)
    const SPEEDS = [500, 1000, 1500];

    function startGame() {
        if (isPlaying) return;
        
        score = 0;
        timeRemaining = 30;
        isPlaying = true;
        scoreDisplay.textContent = score;
        timeDisplay.textContent = timeRemaining;
        startBtn.disabled = true;
        startBtn.textContent = 'プレイ中...';
        startBtn.style.opacity = '0.7';

        // Clear any existing active moles
        holes.forEach(hole => hole.classList.remove('up', 'hit', 'hammer-strike'));
        moleTimers.forEach(timer => clearTimeout(timer));
        moleTimers = [];

        activeMoles.clear();
        combo = 0;
        clearTimeout(comboTimer);
        comboDisplay.classList.remove('show');

        // Start countdown
        countdownTimer = setInterval(() => {
            timeRemaining--;
            timeDisplay.textContent = timeRemaining;
            
            if (timeRemaining <= 0) {
                endGame();
            }
        }, 1000);

        // Start popping moles
        popMole();
    }

    function endGame() {
        isPlaying = false;
        clearInterval(countdownTimer);
        moleTimers.forEach(timer => clearTimeout(timer));
        moleTimers = [];
        holes.forEach(hole => hole.classList.remove('up', 'hit'));

        startBtn.disabled = false;
        startBtn.textContent = 'もう一度プレイ';
        startBtn.style.opacity = '1';

        // Handle High Score
        let message = `ゲーム終了！あなたのスコアは ${score} 点でした！🐹`;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('moleHighScore', highScore.toString());
            highScoreDisplay.textContent = highScore;
            message = `🎉新記録達成！🎉\nあなたのスコアは ${score} 点でした！🐹`;
        }

        // Give a slight delay before showing alert so the UI updates
        setTimeout(() => {
            alert(message);
        }, 100);
    }

    function popMole() {
        if (!isPlaying) return;

        // Decide how many moles pop up at once (usually 1, sometimes 2)
        const numMoles = Math.random() < 0.2 ? 2 : 1; 

        for (let i = 0; i < numMoles; i++) {
            // Pick a random hole that isn't already up
            let randomHole;
            let idx;
            let attempts = 0;
            do {
                idx = Math.floor(Math.random() * holes.length);
                randomHole = holes[idx];
                attempts++;
            } while (activeMoles.has(idx) && attempts < 10); // O(1) Check

            if (randomHole && !activeMoles.has(idx)) {
                // Difficulty adjustment: Slower if score < 15 and remaining time <= 15
                let speedClass;
                if (timeRemaining <= 15 && score < 15) {
                    const easySpeeds = [1000, 1500, 2000]; // Slowed down
                    speedClass = easySpeeds[Math.floor(Math.random() * easySpeeds.length)];
                } else {
                    speedClass = SPEEDS[Math.floor(Math.random() * SPEEDS.length)];
                }
                
                // Reset emoji to normal
                randomHole.querySelector('.mole').textContent = '🐹';

                // Pop it up
                activeMoles.set(idx, true); // Create Hash Map Entry
                randomHole.classList.add('up');
                randomHole.classList.remove('hit');

                // Set timer to drop it back down if not hit
                const timer = setTimeout(() => {
                    randomHole.classList.remove('up');
                    activeMoles.delete(idx); // Clear Hash Map Entry
                }, speedClass);
                
                moleTimers.push(timer);
            }
        }

        // Schedule next pop
        if (isPlaying) {
            let nextPopDelay = Math.random() * 800 + 400; // between 400ms and 1200ms
            if (timeRemaining <= 15 && score < 15) {
                nextPopDelay = Math.random() * 1000 + 800; // Slower pop rate to give players a chance
            }
            const popTimer = setTimeout(popMole, nextPopDelay);
            moleTimers.push(popTimer);
        }
    }

    function whack(event) {
        if (!isPlaying) return;
        
        const hole = event.currentTarget;
        const idx = parseInt(hole.getAttribute('data-index'));

        // O(1) Hash Map check instead of DOM classList check
        if (activeMoles.has(idx)) {
            // Combo Management
            combo++;
            clearTimeout(comboTimer);
            
            // Show Combo UI if combo > 1
            if (combo > 1) {
                comboDisplay.textContent = `${combo} COMBO!`;
                comboDisplay.classList.add('show');
                
                // Slightly scale up text based on combo for impact
                const scale = Math.min(1 + (combo * 0.05), 2);
                comboDisplay.style.transform = `translate(-50%, -50%) scale(${scale})`;
            }

            comboTimer = setTimeout(() => {
                combo = 0;
                comboDisplay.classList.remove('show');
                comboDisplay.style.transform = `translate(-50%, -50%) scale(0)`;
            }, 1500);

            // Score Calculation with Combo Multiplier (rounded up)
            const points = Math.ceil(1 * (1 + (combo - 1) * 0.1));
            score += points;
            
            scoreDisplay.textContent = score;
            
            // Change emoji to dizzy
            hole.querySelector('.mole').textContent = '😵';
            
            activeMoles.delete(idx); // Update hash map
            hole.classList.remove('up');
            hole.classList.add('hit'); // visual feedback
            
            // Note: hit class gets cleared on next pop for that hole
        }
    }

    // Add event listeners to holes
    holes.forEach(hole => {
        // We listen on mousedown for a faster, more responsive feel than click
        hole.addEventListener('mousedown', whack);
        // Also support touch for mobile
        hole.addEventListener('touchstart', (e) => {
            e.preventDefault(); // prevent double firing with mousedown
            whack(e);
        });
    });

    startBtn.addEventListener('click', startGame);

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (!isPlaying) return;
        const keyMap = {
            'KeyQ': 0, 'KeyW': 1, 'KeyE': 2,
            'KeyA': 3, 'KeyS': 4, 'KeyD': 5,
            'KeyZ': 6, 'KeyX': 7, 'KeyC': 8,
            'Numpad7': 0, 'Numpad8': 1, 'Numpad9': 2,
            'Numpad4': 3, 'Numpad5': 4, 'Numpad6': 5,
            'Numpad1': 6, 'Numpad2': 7, 'Numpad3': 8,
            'Digit7': 0, 'Digit8': 1, 'Digit9': 2,
            'Digit4': 3, 'Digit5': 4, 'Digit6': 5,
            'Digit1': 6, 'Digit2': 7, 'Digit3': 8,
            'q': 0, 'w': 1, 'e': 2,
            'a': 3, 's': 4, 'd': 5,
            'z': 6, 'x': 7, 'c': 8,
            '7': 0, '8': 1, '9': 2,
            '4': 3, '5': 4, '6': 5,
            '1': 6, '2': 7, '3': 8
        };
        const code = e.code || (e.key ? e.key.toLowerCase() : '');
        if (code in keyMap) {
            e.preventDefault(); // Prevent default browser actions (like scrolling or typing)
            const index = keyMap[code];
            const hole = holes[index];
            
            // Visual feedback specifically on the hole for keyboard users
            hole.classList.add('hammer-strike');
            setTimeout(() => {
                hole.classList.remove('hammer-strike');
            }, 100);

            // Also keep visual feedback for global hammer
            document.body.classList.add('hammer-down');
            setTimeout(() => {
                document.body.classList.remove('hammer-down');
            }, 100);

            // Simulate the whack if the mole is up
            if (activeMoles.has(index)) {
                whack({ currentTarget: hole });
            }
        }
    });

    // Hammer animation logic for cursor
    document.body.addEventListener('mousedown', () => {
        document.body.classList.add('hammer-down');
    });
    document.body.addEventListener('mouseup', () => {
        document.body.classList.remove('hammer-down');
    });
    document.body.addEventListener('mouseleave', () => {
        document.body.classList.remove('hammer-down');
    });
});
