document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pcb-background');
    const ctx = canvas.getContext('2d');

    // --- CONFIGURATION ---
    const config = {
        gridSize: 20,
        traceWidth: 2,
        viaRadius: 3,
        pulseRadius: 2.5,
        traceColor: 'rgba(137, 180, 250, 0.1)',
        pulseColor: '#89b4fa',
        pulseGlowColor: 'rgba(137, 180, 250, 0.4)',
        traceAttempts: 800,
        maxTraceLength: 40,
        minTraceLength: 4,
        straightChance: 0.95, // << Increased to further encourage straight lines
        pulseDensityRatio: 10,
        minPulseCount: 5,
        baseSpeed: 0.3,
        hoverSpeed: 1.0,
        hoverDistance: 80,
    };

    let grid, traces = [], pulses = [], mouse = { x: null, y: null };
    let cols, rows;

    // --- MOUSE TRACKING ---
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseout', () => { mouse.x = null; mouse.y = null; });

    // --- GENERATION LOGIC ---
    function createPattern() {
        cols = Math.ceil(canvas.width / config.gridSize);
        rows = Math.ceil(canvas.height / config.gridSize);
        grid = Array(cols).fill(null).map(() => Array(rows).fill(false));
        traces = [];

        for (let i = 0; i < config.traceAttempts; i++) {
            generateTrace();
        }
    }
    
    function isBufferClear(x, y) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const checkX = x + i;
                const checkY = y + j;
                if (checkX >= 0 && checkX < cols && checkY >= 0 && checkY < rows) {
                    if (grid[checkX][checkY]) return false;
                }
            }
        }
        return true;
    }

    function commitPathToGrid(path) {
        path.forEach(p => {
            if (p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows) {
                grid[p.x][p.y] = true;
            }
        });
    }

    // --- GENERATE TRACE (REWRITTEN LOGIC) ---
    function generateTrace() {
        const startX = Math.floor(Math.random() * cols);
        const startY = Math.floor(Math.random() * rows);
        
        if (!isBufferClear(startX, startY)) return;

        const path = [{ x: startX, y: startY }];
        const pathPoints = new Set([`${startX},${startY}`]);
        let current = { x: startX, y: startY };
        
        const dirs = [ {x:0, y:-1}, {x:1, y:-1}, {x:1, y:0}, {x:1, y:1}, {x:0, y:1}, {x:-1, y:1}, {x:-1, y:0}, {x:-1, y:-1} ];
        let currentDirIndex = Math.floor(Math.random() * 8);

        for (let i = 0; i < config.maxTraceLength; i++) {
            let moveMade = false;

            // First, decide if we should TRY to go straight
            if (Math.random() < config.straightChance) {
                const straightDir = dirs[currentDirIndex];
                const next = { x: current.x + straightDir.x, y: current.y + straightDir.y };
                const nextKey = `${next.x},${next.y}`;

                if (next.x >= 0 && next.x < cols && next.y >= 0 && next.y < rows && isBufferClear(next.x, next.y) && !pathPoints.has(nextKey)) {
                    path.push(next);
                    pathPoints.add(nextKey);
                    current = next;
                    // Direction doesn't change, so no need to update currentDirIndex
                    moveMade = true;
                }
            }

            // If we didn't go straight (either by chance or because it was blocked), consider turning.
            if (!moveMade) {
                const rightDir = dirs[(currentDirIndex + 1) % 8];
                const leftDir = dirs[(currentDirIndex + 7) % 8];
                
                const validTurns = [];
                
                // Check right turn
                const nextRight = { x: current.x + rightDir.x, y: current.y + rightDir.y };
                const nextRightKey = `${nextRight.x},${nextRight.y}`;
                if (nextRight.x >= 0 && nextRight.x < cols && nextRight.y >= 0 && nextRight.y < rows && isBufferClear(nextRight.x, nextRight.y) && !pathPoints.has(nextRightKey)) {
                    validTurns.push({ next: nextRight, key: nextRightKey, index: (currentDirIndex + 1) % 8 });
                }

                // Check left turn
                const nextLeft = { x: current.x + leftDir.x, y: current.y + leftDir.y };
                const nextLeftKey = `${nextLeft.x},${nextLeft.y}`;
                 if (nextLeft.x >= 0 && nextLeft.x < cols && nextLeft.y >= 0 && nextLeft.y < rows && isBufferClear(nextLeft.x, nextLeft.y) && !pathPoints.has(nextLeftKey)) {
                    validTurns.push({ next: nextLeft, key: nextLeftKey, index: (currentDirIndex + 7) % 8 });
                }

                if (validTurns.length > 0) {
                    const chosenTurn = validTurns[Math.floor(Math.random() * validTurns.length)];
                    path.push(chosenTurn.next);
                    pathPoints.add(chosenTurn.key);
                    current = chosenTurn.next;
                    currentDirIndex = chosenTurn.index; // Update direction after turning
                    moveMade = true;
                }
            }
            
            // If no move was possible (straight or turn), the trace is blocked and must end.
            if (!moveMade) break;
        }

        if (path.length >= config.minTraceLength) {
            traces.push(path);
            commitPathToGrid(path);
        }
    }

    // --- PULSE MANAGEMENT ---
    function createPulses() {
        pulses = [];
        const pulseCount = Math.max(config.minPulseCount, Math.floor(traces.length / config.pulseDensityRatio));
        for (let i = 0; i < pulseCount; i++) {
            spawnPulse();
        }
    }

    function spawnPulse() {
        if (traces.length === 0) return;
        const trace = traces[Math.floor(Math.random() * traces.length)];
        pulses.push({ trace, segment: 0, progress: 0 });
    }

    // --- DRAWING & ANIMATION ---
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = config.traceWidth;
        ctx.strokeStyle = config.traceColor;
        ctx.fillStyle = config.traceColor;

        traces.forEach(path => {
            ctx.beginPath();
            ctx.moveTo(path[0].x * config.gridSize, path[0].y * config.gridSize);
            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(path[i].x * config.gridSize, path[i].y * config.gridSize);
            }
            ctx.stroke();

            const start = path[0];
            const end = path[path.length - 1];
            ctx.beginPath();
            ctx.arc(start.x * config.gridSize, start.y * config.gridSize, config.viaRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(end.x * config.gridSize, end.y * config.gridSize, config.viaRadius, 0, Math.PI * 2);
            ctx.fill();
        });

        pulses.forEach((pulse, index) => {
            if (!pulse.trace || pulse.trace.length < 2) {
                pulses.splice(index, 1);
                spawnPulse();
                return;
            }
            
            const startNode = pulse.trace[pulse.segment];
            const endNode = pulse.trace[pulse.segment + 1];

            const startX = startNode.x * config.gridSize;
            const startY = startNode.y * config.gridSize;
            const endX = endNode.x * config.gridSize;
            const endY = endNode.y * config.gridSize;

            const pX = startX + (endX - startX) * pulse.progress;
            const pY = startY + (endY - startY) * pulse.progress;

            let speed = config.baseSpeed;
            if (mouse.x !== null) {
                const dist = Math.sqrt(Math.pow(pX - mouse.x, 2) + Math.pow(pY - mouse.y, 2));
                if (dist < config.hoverDistance) speed = config.hoverSpeed;
            }

            const segmentLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            if (segmentLength > 0) pulse.progress += speed / segmentLength;

            if (pulse.progress >= 1) {
                pulse.progress = 0;
                pulse.segment++;
                if (pulse.segment >= pulse.trace.length - 1) {
                    pulses.splice(index, 1);
                    spawnPulse();
                    return;
                }
            }
            
            const glow = ctx.createRadialGradient(pX, pY, 0, pX, pY, config.pulseRadius * 5);
            glow.addColorStop(0, config.pulseGlowColor);
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(pX, pY, config.pulseRadius * 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = config.pulseColor;
            ctx.beginPath();
            ctx.arc(pX, pY, config.pulseRadius, 0, Math.PI * 2);
            ctx.fill();
        });

        requestAnimationFrame(animate);
    }

    // --- INITIALIZATION AND RESIZE ---
    function setup() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        createPattern();
        createPulses();
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(setup, 250);
    });

    setup();
    animate();
});