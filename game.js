/* ============================================
   Room Sticker Game - JavaScript
   Drag & Drop engine with touch + mouse support
   Curved drag trail like reference game
   ============================================ */

(function () {
    'use strict';

    // ==========================================
    // LEVEL DATA CONFIGURATION
    // ==========================================
    // Positions are in % relative to the room image
    // Calibrated based on the empty café room layout:
    //   - The room is an isometric box
    //   - Left wall has shelves & counter
    //   - Right wall has window, shelves, armchair
    //   - Center has counter with display case
    //   - Front area has tables & chairs
    const LEVEL_DATA = {
        name: 'Cozy Cat Café',
        roomEmpty: 'assets/room_bare.png',
        roomFull: 'assets/room_full.png',
        stickers: [
            // Layer 1: Walls
            {
                id: 'menu',
                name: 'Menu Board',
                src: 'assets/sticker_menu.png',
                target: { x: 16, y: 10, w: 15, h: 18 },
                trayOrder: 0,
            },
            {
                id: 'plant',
                name: 'Hanging Plant',
                src: 'assets/sticker_plant.png',
                target: { x: 75, y: 4, w: 10, h: 24 },
                trayOrder: 1,
            },
            // Layer 2: Large Furniture
            {
                id: 'bar_counter',
                name: 'Coffee Bar',
                src: 'assets/sticker_bar_counter.png',
                target: { x: 36, y: 25, w: 38, h: 22 },
                trayOrder: 2,
            },
            {
                id: 'bookshelf',
                name: 'Bookshelf',
                src: 'assets/sticker_bookshelf.png',
                target: { x: 68, y: 24, w: 12, h: 18 },
                trayOrder: 3,
            },
            {
                id: 'armchair',
                name: 'Armchair',
                src: 'assets/sticker_armchair.png',
                target: { x: 66, y: 38, w: 16, h: 18 },
                trayOrder: 4,
            },
            // Layer 3: Counter Items
            {
                id: 'espresso',
                name: 'Espresso Machine',
                src: 'assets/sticker_espresso.png',
                target: { x: 24, y: 25, w: 12, h: 17 },
                trayOrder: 5,
            },
            {
                id: 'pastry',
                name: 'Pastry Display',
                src: 'assets/sticker_pastry.png',
                target: { x: 47, y: 24, w: 14, h: 18 },
                trayOrder: 6,
            },
            // Layer 4: Characters
            {
                id: 'barista',
                name: 'Cat Barista',
                src: 'assets/sticker_barista.png',
                target: { x: 35, y: 24, w: 14, h: 22 },
                trayOrder: 7,
            },
            {
                id: 'cat_reading',
                name: 'Reading Cat',
                src: 'assets/sticker_cat_reading.png',
                target: { x: 64, y: 38, w: 17, h: 22 },
                trayOrder: 8,
            },
        ],
    };

    // ==========================================
    // GAME STATE
    // ==========================================
    const state = {
        placedCount: 0,
        totalStickers: LEVEL_DATA.stickers.length,
        placedStickers: new Set(),
        isDragging: false,
        currentDrag: null,
        dragGhost: null,
        dragTrailSvg: null,
        dragStartPos: { x: 0, y: 0 },
        hintActive: false,
        cleanedSrcs: {}, // Cache of cleaned (transparent bg) sticker data URLs
    };

    // ==========================================
    // WHITE BACKGROUND REMOVAL (Canvas API)
    // ==========================================
    /**
     * Removes white/near-white background from an image,
     * producing a clean transparent PNG data URL.
     * Uses edge detection to preserve sticker content.
     */
    function removeWhiteBg(img) {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Threshold for "white" (adjustable)
        const WHITE_THRESHOLD = 245;
        const SOFT_EDGE_MIN = 225;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Fully white → fully transparent
            if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
                data[i + 3] = 0;
            }
            // Soft edge (near-white) → partial transparency for anti-aliasing
            else if (r >= SOFT_EDGE_MIN && g >= SOFT_EDGE_MIN && b >= SOFT_EDGE_MIN) {
                const brightness = (r + g + b) / 3;
                const alpha = Math.round(255 * (1 - (brightness - SOFT_EDGE_MIN) / (WHITE_THRESHOLD - SOFT_EDGE_MIN)));
                data[i + 3] = Math.min(data[i + 3], alpha);
            }
            // Also handle light gray backgrounds (checkerboard pattern from AI)
            // Checkerboard pixels alternate between ~204 and ~255
            else if (r >= 195 && g >= 195 && b >= 195 && r === g && g === b) {
                const alpha = Math.round(255 * (1 - (r - 195) / 60));
                data[i + 3] = Math.min(data[i + 3], alpha);
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    }

    /**
     * Preload all sticker images and clean their backgrounds.
     * Returns a Promise that resolves when all stickers are processed.
     */
    function preloadAndCleanStickers() {
        const promises = LEVEL_DATA.stickers.map((sticker) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        state.cleanedSrcs[sticker.id] = removeWhiteBg(img);
                    } catch (e) {
                        // Fallback: use original if Canvas fails (e.g., CORS)
                        console.warn(`Could not clean ${sticker.id}:`, e);
                        state.cleanedSrcs[sticker.id] = sticker.src;
                    }
                    resolve();
                };
                img.onerror = () => {
                    state.cleanedSrcs[sticker.id] = sticker.src;
                    resolve();
                };
                img.src = sticker.src;
            });
        });
        return Promise.all(promises);
    }

    /**
     * Get the cleaned (transparent) src for a sticker, or fallback to original
     */
    function getCleanSrc(stickerId) {
        return state.cleanedSrcs[stickerId] || LEVEL_DATA.stickers.find(s => s.id === stickerId)?.src;
    }

    // ==========================================
    // DOM REFERENCES
    // ==========================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elRoomWrapper = $('#room-wrapper');
    const elDropZones = $('#drop-zones');
    const elPlacedStickers = $('#placed-stickers');
    const elTrayScroll = $('#tray-scroll');
    const elCounterCurrent = $('#counter-current');
    const elCounterTotal = $('#counter-total');
    const elProgressBar = $('#progress-bar');
    const elProgressPercent = $('#progress-percent');
    const elCompletionOverlay = $('#completion-overlay');
    const elRoomFull = $('#room-full');
    const elBtnReplay = $('#btn-replay');
    const elBtnHint = $('#btn-hint');
    const elConfettiCanvas = $('#confetti-canvas');

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function init() {
        elCounterTotal.textContent = state.totalStickers;

        // Clean sticker backgrounds first
        await preloadAndCleanStickers();
        console.log('✅ All sticker backgrounds cleaned');

        createDropZones();
        createTrayStickers();
        bindEvents();
        setupDebugMode();
        updateUI();
    }

    // ==========================================
    // DEBUG MODE - Click room to get coordinates
    // ==========================================
    function setupDebugMode() {
        elRoomWrapper.addEventListener('dblclick', (e) => {
            const rect = elRoomWrapper.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
            const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
            console.log(`📍 Position: { x: ${x}, y: ${y} }`);

            // Visual indicator
            const dot = document.createElement('div');
            dot.style.cssText = `
                position: absolute; left: ${x}%; top: ${y}%;
                width: 8px; height: 8px; background: red; border-radius: 50%;
                transform: translate(-50%, -50%); z-index: 999;
                pointer-events: none;
            `;
            elRoomWrapper.appendChild(dot);
            setTimeout(() => dot.remove(), 3000);
        });
    }

    function createDropZones() {
        LEVEL_DATA.stickers.forEach((sticker) => {
            const zone = document.createElement('div');
            zone.className = 'drop-zone';
            zone.dataset.stickerId = sticker.id;
            zone.style.left = sticker.target.x + '%';
            zone.style.top = sticker.target.y + '%';
            zone.style.width = sticker.target.w + '%';
            zone.style.height = sticker.target.h + '%';

            // Silhouette image (hidden by default, shown on hint)
            const sil = document.createElement('img');
            sil.className = 'silhouette';
            sil.src = getCleanSrc(sticker.id);
            sil.alt = '';
            sil.draggable = false;
            zone.appendChild(sil);

            elDropZones.appendChild(zone);
        });
    }

    function createTrayStickers() {
        const sorted = [...LEVEL_DATA.stickers].sort((a, b) => a.trayOrder - b.trayOrder);
        sorted.forEach((sticker) => {
            const item = document.createElement('div');
            item.className = 'tray-sticker';
            item.dataset.stickerId = sticker.id;
            item.id = 'tray-' + sticker.id;

            const img = document.createElement('img');
            img.src = getCleanSrc(sticker.id);
            img.alt = sticker.name;
            img.draggable = false;
            item.appendChild(img);

            elTrayScroll.appendChild(item);
        });
    }

    // ==========================================
    // EVENT BINDING
    // ==========================================
    function bindEvents() {
        // Mouse events
        elTrayScroll.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);

        // Touch events
        elTrayScroll.addEventListener('touchstart', onDragStart, { passive: false });
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);

        // Buttons
        elBtnReplay.addEventListener('click', resetGame);
        elBtnHint.addEventListener('click', toggleHint);
    }

    // ==========================================
    // DRAG & DROP ENGINE
    // ==========================================
    function getPointerPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    function onDragStart(e) {
        const trayItem = e.target.closest('.tray-sticker');
        if (!trayItem || trayItem.classList.contains('placed')) return;

        e.preventDefault();
        const stickerId = trayItem.dataset.stickerId;
        const stickerData = LEVEL_DATA.stickers.find((s) => s.id === stickerId);
        if (!stickerData) return;

        const pos = getPointerPos(e);
        state.isDragging = true;
        state.currentDrag = { stickerId, stickerData, trayItem };

        // Calculate start position from center of tray item
        const trayRect = trayItem.getBoundingClientRect();
        state.dragStartPos = {
            x: trayRect.left + trayRect.width / 2,
            y: trayRect.top + trayRect.height / 2,
        };

        // Mark tray item as dragging
        trayItem.classList.add('dragging');

        // Create ghost
        createDragGhost(stickerData, pos);

        // Create curved trail SVG
        createDragTrail();
        updateDragTrail(pos);

        // Hide hint if active
        if (state.hintActive) toggleHint();
    }

    function onDragMove(e) {
        if (!state.isDragging || !state.currentDrag) return;
        e.preventDefault();

        const pos = getPointerPos(e);

        // Move ghost
        if (state.dragGhost) {
            const ghostW = state.dragGhost.offsetWidth;
            const ghostH = state.dragGhost.offsetHeight;
            state.dragGhost.style.left = (pos.x - ghostW / 2) + 'px';
            state.dragGhost.style.top = (pos.y - ghostH * 0.7) + 'px';
        }

        // Update curved trail
        updateDragTrail(pos);

        // Check proximity to drop zone
        checkDropZoneProximity(pos);
    }

    function onDragEnd(e) {
        if (!state.isDragging || !state.currentDrag) return;

        const pos = e.changedTouches
            ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
            : { x: e.clientX, y: e.clientY };

        const matchedZone = findMatchingDropZone(pos);

        if (matchedZone) {
            placeSticker(state.currentDrag, matchedZone);
        } else {
            returnToTray();
        }

        cleanupDrag();
    }

    function createDragGhost(stickerData, pos) {
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        const roomRect = elRoomWrapper.getBoundingClientRect();
        const ghostW = (stickerData.target.w / 100) * roomRect.width * 1.1;
        const ghostH = (stickerData.target.h / 100) * roomRect.height * 1.1;
        ghost.style.width = Math.max(ghostW, 60) + 'px';
        ghost.style.height = Math.max(ghostH, 60) + 'px';
        ghost.style.left = (pos.x - ghostW / 2) + 'px';
        ghost.style.top = (pos.y - ghostH * 0.7) + 'px';

        const img = document.createElement('img');
        img.src = getCleanSrc(stickerData.id);
        img.alt = stickerData.name;
        img.draggable = false;
        ghost.appendChild(img);

        document.body.appendChild(ghost);
        state.dragGhost = ghost;
    }

    // Curved trail like in the reference game
    function createDragTrail() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('drag-trail');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', '');
        svg.appendChild(path);
        document.body.appendChild(svg);
        state.dragTrailSvg = svg;
    }

    function updateDragTrail(pos) {
        if (!state.dragTrailSvg) return;
        const path = state.dragTrailSvg.querySelector('path');
        if (!path) return;

        const sx = state.dragStartPos.x;
        const sy = state.dragStartPos.y;
        const ex = pos.x;
        const ey = pos.y;

        // Create a smooth cubic bezier curve
        const midY = (sy + ey) / 2;
        const cpx1 = sx + (ex - sx) * 0.1;
        const cpy1 = sy - Math.abs(ey - sy) * 0.15;
        const cpx2 = ex - (ex - sx) * 0.1;
        const cpy2 = ey + Math.abs(ey - sy) * 0.1;

        const d = `M ${sx} ${sy} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${ex} ${ey}`;
        path.setAttribute('d', d);
    }

    function checkDropZoneProximity(pos) {
        const zones = $$('.drop-zone:not(.occupied)');
        zones.forEach((zone) => {
            const zoneId = zone.dataset.stickerId;
            if (zoneId === state.currentDrag.stickerId) {
                const rect = zone.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dist = Math.hypot(pos.x - cx, pos.y - cy);
                const threshold = Math.max(rect.width, rect.height) * 1.5;

                if (dist < threshold) {
                    zone.classList.add('highlight');
                } else {
                    zone.classList.remove('highlight');
                }
            } else {
                zone.classList.remove('highlight');
            }
        });
    }

    function findMatchingDropZone(pos) {
        const stickerId = state.currentDrag.stickerId;
        const zone = $(`.drop-zone[data-sticker-id="${stickerId}"]:not(.occupied)`);
        if (!zone) return null;

        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(pos.x - cx, pos.y - cy);
        // Generous snap distance
        const threshold = Math.max(rect.width, rect.height) * 2;

        return dist < threshold ? zone : null;
    }

    function placeSticker(dragData, zone) {
        const { stickerId, stickerData, trayItem } = dragData;

        // Mark zone as occupied
        zone.classList.add('occupied');
        zone.classList.remove('highlight', 'hint-active');

        // Place sticker image on room
        const placed = document.createElement('div');
        placed.className = 'placed-sticker';
        placed.style.left = stickerData.target.x + '%';
        placed.style.top = stickerData.target.y + '%';
        placed.style.width = stickerData.target.w + '%';
        placed.style.height = stickerData.target.h + '%';

        const img = document.createElement('img');
        img.src = getCleanSrc(stickerData.id);
        img.alt = stickerData.name;
        img.draggable = false;
        placed.appendChild(img);
        elPlacedStickers.appendChild(placed);

        // Mark tray item as placed
        trayItem.classList.remove('dragging');
        trayItem.classList.add('placed');

        // Visual effects
        spawnSparkles(zone);
        spawnGlowRing(zone);

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(30);

        // Update state
        state.placedStickers.add(stickerId);
        state.placedCount++;
        updateUI();

        // Check completion
        if (state.placedCount >= state.totalStickers) {
            setTimeout(onLevelComplete, 700);
        }
    }

    function returnToTray() {
        if (state.currentDrag && state.currentDrag.trayItem) {
            state.currentDrag.trayItem.classList.remove('dragging');
        }
    }

    function cleanupDrag() {
        if (state.dragGhost) {
            state.dragGhost.remove();
            state.dragGhost = null;
        }
        if (state.dragTrailSvg) {
            state.dragTrailSvg.remove();
            state.dragTrailSvg = null;
        }
        $$('.drop-zone.highlight').forEach((z) => z.classList.remove('highlight'));

        state.isDragging = false;
        state.currentDrag = null;
    }

    // ==========================================
    // UI UPDATES
    // ==========================================
    function updateUI() {
        elCounterCurrent.textContent = state.placedCount;
        const percent = Math.round((state.placedCount / state.totalStickers) * 100);
        elProgressBar.style.width = percent + '%';
        elProgressPercent.textContent = percent + '%';
    }

    // ==========================================
    // VISUAL EFFECTS
    // ==========================================
    function spawnSparkles(zone) {
        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const container = document.createElement('div');
        container.className = 'sparkle-burst';
        container.style.left = cx + 'px';
        container.style.top = cy + 'px';
        document.body.appendChild(container);

        const colors = ['#F5C842', '#F59E42', '#FF7EB3', '#7EC8F5', '#A8E6CF', '#FFD166'];
        for (let i = 0; i < 12; i++) {
            const spark = document.createElement('div');
            spark.className = 'sparkle';
            const angle = (Math.PI * 2 * i) / 12;
            const dist = 25 + Math.random() * 45;
            spark.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
            spark.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
            spark.style.background = colors[i % colors.length];
            const size = (4 + Math.random() * 6) + 'px';
            spark.style.width = size;
            spark.style.height = size;
            container.appendChild(spark);
        }

        setTimeout(() => container.remove(), 900);
    }

    function spawnGlowRing(zone) {
        const rect = zone.getBoundingClientRect();
        const ring = document.createElement('div');
        ring.className = 'place-glow';
        const size = Math.max(rect.width, rect.height);
        ring.style.width = size + 'px';
        ring.style.height = size + 'px';
        ring.style.left = (rect.left + rect.width / 2 - size / 2) + 'px';
        ring.style.top = (rect.top + rect.height / 2 - size / 2) + 'px';
        ring.style.position = 'fixed';
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 700);
    }

    // ==========================================
    // HINT SYSTEM
    // ==========================================
    function toggleHint() {
        state.hintActive = !state.hintActive;
        const zones = $$('.drop-zone:not(.occupied)');
        zones.forEach((zone) => {
            zone.classList.toggle('hint-active', state.hintActive);
        });
        elBtnHint.style.transform = state.hintActive ? 'scale(1.1)' : '';
    }

    // ==========================================
    // LEVEL COMPLETION
    // ==========================================
    function onLevelComplete() {
        // Show full room image with crossfade
        elRoomFull.classList.remove('hidden');
        void elRoomFull.offsetWidth;
        elRoomFull.classList.add('visible');

        // Fade out placed stickers + drop zones (full image replaces them)
        setTimeout(() => {
            elPlacedStickers.style.opacity = '0';
            elDropZones.style.opacity = '0';
        }, 400);

        // Show completion overlay
        setTimeout(() => {
            elCompletionOverlay.classList.remove('hidden');
            launchConfetti();
        }, 1200);
    }

    // ==========================================
    // CONFETTI ANIMATION
    // ==========================================
    function launchConfetti() {
        const canvas = elConfettiCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#F5C842', '#F59E42', '#FF7EB3', '#7EC8F5', '#A8E6CF', '#FFD166', '#EF476F', '#C4956A'];

        for (let i = 0; i < 150; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * 300,
                y: canvas.height * 0.5,
                vx: (Math.random() - 0.5) * 14,
                vy: -6 - Math.random() * 10,
                w: 5 + Math.random() * 7,
                h: 3 + Math.random() * 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 12,
                gravity: 0.12 + Math.random() * 0.1,
                opacity: 1,
            });
        }

        let frame = 0;
        const maxFrames = 200;

        function animate() {
            if (frame > maxFrames) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p) => {
                p.x += p.vx;
                p.vy += p.gravity;
                p.y += p.vy;
                p.vx *= 0.99;
                p.rotation += p.rotSpeed;
                p.opacity = Math.max(0, 1 - (frame / maxFrames) * 0.8);

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            frame++;
            requestAnimationFrame(animate);
        }

        animate();
    }

    // ==========================================
    // RESET GAME
    // ==========================================
    function resetGame() {
        state.placedCount = 0;
        state.placedStickers.clear();
        state.hintActive = false;

        elCompletionOverlay.classList.add('hidden');
        elRoomFull.classList.add('hidden');
        elRoomFull.classList.remove('visible');
        elPlacedStickers.style.opacity = '1';
        elDropZones.style.opacity = '1';
        elPlacedStickers.innerHTML = '';

        $$('.drop-zone').forEach((zone) => {
            zone.classList.remove('occupied', 'highlight', 'hint-active');
            const sil = zone.querySelector('.silhouette');
            if (sil) sil.style.display = '';
        });

        $$('.tray-sticker').forEach((item) => {
            item.classList.remove('placed', 'dragging');
        });

        updateUI();

        const ctx = elConfettiCanvas.getContext('2d');
        ctx.clearRect(0, 0, elConfettiCanvas.width, elConfettiCanvas.height);
    }

    // ==========================================
    // START
    // ==========================================
    document.addEventListener('DOMContentLoaded', init);
})();
