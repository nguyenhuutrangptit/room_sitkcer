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
            { id: 'sticker_1', name: 'Sticker 1', src: 'assets/sticker_1.png' },
            { id: 'sticker_5', name: 'Sticker 5', src: 'assets/sticker_5.png' },
            { id: 'sticker_4', name: 'Sticker 4', src: 'assets/sticker_4.png' },
            { id: 'sticker_2', name: 'Sticker 2', src: 'assets/sticker_2.png' },
            { id: 'sticker_13', name: 'Sticker 13', src: 'assets/sticker_13.png' },
            { id: 'sticker_3', name: 'Sticker 3', src: 'assets/sticker_3.png' },
            { id: 'sticker_8', name: 'Sticker 8', src: 'assets/sticker_8.png' },
            { id: 'sticker_6', name: 'Sticker 6', src: 'assets/sticker_6.png' },
            { id: 'sticker_10', name: 'Sticker 10', src: 'assets/sticker_10.png' },
            { id: 'sticker_18', name: 'Sticker 18', src: 'assets/sticker_18.png' },
            { id: 'sticker_21', name: 'Sticker 21', src: 'assets/sticker_21.png' },
            { id: 'sticker_15', name: 'Sticker 15', src: 'assets/sticker_15.png' },
            { id: 'sticker_14', name: 'Sticker 14', src: 'assets/sticker_14.png' },
            { id: 'sticker_16', name: 'Sticker 16', src: 'assets/sticker_16.png' },
            { id: 'sticker_7', name: 'Sticker 7', src: 'assets/sticker_7.png' },
            { id: 'sticker_9', name: 'Sticker 9', src: 'assets/sticker_9.png' },
            { id: 'sticker_12', name: 'Sticker 12', src: 'assets/sticker_12.png' },
            { id: 'sticker_11', name: 'Sticker 11', src: 'assets/sticker_11.png' },
            { id: 'sticker_20', name: 'Sticker 20', src: 'assets/sticker_20.png' },
            { id: 'sticker_19', name: 'Sticker 19', src: 'assets/sticker_19.png' },
            { id: 'sticker_17', name: 'Sticker 17', src: 'assets/sticker_17.png' },
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
    // AUTO CALIBRATION (DYNAMIC ENGINE)
    // ==========================================
    async function autoCalibrateStickers() {
        console.log('Start Dynamic Auto-Calibration...');
        const fullImg = new Image(); fullImg.src = LEVEL_DATA.roomFull;
        const bareImg = new Image(); bareImg.src = LEVEL_DATA.roomEmpty;
        await Promise.all([
            new Promise(r => { fullImg.onload = r; fullImg.onerror = r; }),
            new Promise(r => { bareImg.onload = r; bareImg.onerror = r; })
        ]);

        const W = fullImg.naturalWidth || 1024;
        const H = fullImg.naturalHeight || 1024;
        
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        ctx.drawImage(fullImg, 0, 0); const fullData = ctx.getImageData(0, 0, W, H).data;
        ctx.drawImage(bareImg, 0, 0); const bareData = ctx.getImageData(0, 0, W, H).data;
        
        const diffData = new Uint8Array(W * H * 3);
        for (let i = 0; i < W * H; i++) {
            diffData[i*3] = Math.abs(fullData[i*4] - bareData[i*4]);
            diffData[i*3+1] = Math.abs(fullData[i*4+1] - bareData[i*4+1]);
            diffData[i*3+2] = Math.abs(fullData[i*4+2] - bareData[i*4+2]);
        }

        const scale = 8;
        const sW = Math.floor(W / scale), sH = Math.floor(H / scale);
        const sDiffData = new Uint8Array(sW * sH * 3), sBareData = new Uint8Array(sW * sH * 3);
        for (let y = 0; y < sH; y++) {
            for (let x = 0; x < sW; x++) {
                const srcIdx = ((y * scale) * W + (x * scale));
                const dstIdx = y * sW + x;
                sDiffData[dstIdx*3] = diffData[srcIdx*3]; sDiffData[dstIdx*3+1] = diffData[srcIdx*3+1]; sDiffData[dstIdx*3+2] = diffData[srcIdx*3+2];
                sBareData[dstIdx*3] = bareData[srcIdx*4]; sBareData[dstIdx*3+1] = bareData[srcIdx*4+1]; sBareData[dstIdx*3+2] = bareData[srcIdx*4+2];
            }
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg);color:var(--text);display:flex;align-items:center;justify-content:center;z-index:99999;font-size:18px;font-family:sans-serif;flex-direction:column;';
        overlay.innerHTML = '<div style="font-size:24px;margin-bottom:15px">🛠️ Engine Auto-Calibrating...</div><div id="calib-progress">0%</div><div style="font-size:12px;opacity:0.6;margin-top:10px">Learning sticker positions from differences</div>';
        document.body.appendChild(overlay);

        for (let i=0; i<LEVEL_DATA.stickers.length; i++) {
            const sticker = LEVEL_DATA.stickers[i];
            document.getElementById('calib-progress').textContent = Math.round((i/LEVEL_DATA.stickers.length)*100) + '%';
            await new Promise(r => setTimeout(r, 10)); // Yield
            
            const cleanSrc = getCleanSrc(sticker.id);
            const img = new Image(); img.src = cleanSrc;
            await new Promise(r => img.onload = r);
            
            const w = img.naturalWidth, h = img.naturalHeight;
            if (w === 0) { sticker.target = {x:0,y:0,w:10,h:10}; continue; }
            
            canvas.width = w; canvas.height = h;
            ctx.clearRect(0,0,w,h); ctx.drawImage(img, 0, 0);
            const stData = ctx.getImageData(0, 0, w, h).data;
            
            const sw = Math.max(1, Math.floor(w / scale)), sh = Math.max(1, Math.floor(h / scale));
            const sStData = new Uint8Array(sw * sh * 4);
            for (let y = 0; y < sh; y++) {
                for (let x = 0; x < sw; x++) {
                    const srcIdx = ((y * scale) * w + (x * scale)) * 4, dstIdx = (y * sw + x) * 4;
                    sStData[dstIdx] = stData[srcIdx]; sStData[dstIdx+1] = stData[srcIdx+1];
                    sStData[dstIdx+2] = stData[srcIdx+2]; sStData[dstIdx+3] = stData[srcIdx+3];
                }
            }

            let bestErr = Infinity, bestX = 0, bestY = 0;
            for (let y = 0; y <= sH - sh; y++) {
                for (let x = 0; x <= sW - sw; x++) {
                    let err = 0, count = 0;
                    for (let sy = 0; sy < sh; sy+=2) {
                        for (let sx = 0; sx < sw; sx+=2) {
                            const alpha = sStData[(sy * sw + sx) * 4 + 3] / 255.0;
                            if (alpha < 0.5) continue;
                            const stIdx = (sy * sw + sx) * 4;
                            const bgIdx = ((y + sy) * sW + (x + sx)) * 3;
                            const expR = alpha * Math.abs(sStData[stIdx] - sBareData[bgIdx]);
                            const expG = alpha * Math.abs(sStData[stIdx+1] - sBareData[bgIdx+1]);
                            const expB = alpha * Math.abs(sStData[stIdx+2] - sBareData[bgIdx+2]);
                            err += Math.abs(expR - sDiffData[bgIdx]) + Math.abs(expG - sDiffData[bgIdx+1]) + Math.abs(expB - sDiffData[bgIdx+2]);
                            count++;
                        }
                    }
                    if (count > 0 && (err/count) < bestErr) { bestErr = err/count; bestX = x; bestY = y; }
                }
            }

            let hBestErr = Infinity, hBestX = bestX * scale, hBestY = bestY * scale, sr = scale;
            for (let y = Math.max(0, bestY * scale - sr); y <= Math.min(H - h, bestY * scale + sr); y++) {
                for (let x = Math.max(0, bestX * scale - sr); x <= Math.min(W - w, bestX * scale + sr); x++) {
                    let err = 0, count = 0;
                    for (let sy = 0; sy < h; sy+=4) {
                        for (let sx = 0; sx < w; sx+=4) {
                            const alpha = stData[(sy * w + sx) * 4 + 3] / 255.0;
                            if (alpha < 0.5) continue;
                            const stIdx = (sy * w + sx) * 4;
                            const bgIdx = ((y + sy) * W + (x + sx));
                            const expR = alpha * Math.abs(stData[stIdx] - bareData[bgIdx*4]);
                            const expG = alpha * Math.abs(stData[stIdx+1] - bareData[bgIdx*4+1]);
                            const expB = alpha * Math.abs(stData[stIdx+2] - bareData[bgIdx*4+2]);
                            err += Math.abs(expR - diffData[bgIdx*3]) + Math.abs(expG - diffData[bgIdx*3+1]) + Math.abs(expB - diffData[bgIdx*3+2]);
                            count++;
                        }
                    }
                    if (count > 0 && (err/count) < hBestErr) { hBestErr = err/count; hBestX = x; hBestY = y; }
                }
            }
            sticker.target = { x: (hBestX / W) * 100, y: (hBestY / H) * 100, w: (w / W) * 100, h: (h / H) * 100 };
        }
        overlay.remove();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function init() {
        elCounterTotal.textContent = state.totalStickers;

        await preloadAndCleanStickers();
        console.log('✅ All sticker backgrounds cleaned');
        
        await autoCalibrateStickers();
        console.log('✅ Dynamic auto-calibration complete');

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
        // Auto-sort by Y coordinate (far items first)
        const sorted = [...LEVEL_DATA.stickers].sort((a, b) => a.target.y - b.target.y);
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

        const trayRect = trayItem.getBoundingClientRect();
        state.dragStartPos = { x: trayRect.left + trayRect.width / 2, y: trayRect.top + trayRect.height / 2 };

        trayItem.classList.add('dragging');
        createTweezers(stickerData, pos);
        if (state.hintActive) toggleHint();
    }

    function onDragMove(e) {
        if (!state.isDragging || !state.currentDrag) return;
        e.preventDefault();
        const pos = getPointerPos(e);

        if (state.dragGhost) {
            state.dragGhost.style.left = pos.x + 'px';
            state.dragGhost.style.top = pos.y + 'px';
        }
        checkDropZoneProximity(pos);
    }

    function onDragEnd(e) {
        if (!state.isDragging || !state.currentDrag) return;
        const pos = e.changedTouches ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };

        const matchedZone = findMatchingDropZone(pos);
        if (matchedZone) {
            placeSticker(state.currentDrag, matchedZone);
        } else {
            returnToTray();
        }
        cleanupDrag();
    }

    function createTweezers(stickerData, pos) {
        const ghost = document.createElement('div');
        ghost.className = 'tweezers-drag';
        ghost.style.cssText = 'position:fixed; pointer-events:none; z-index:9999; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -80%);';
        
        const img = document.createElement('img');
        img.src = getCleanSrc(stickerData.id);
        img.style.maxHeight = '120px';
        img.style.filter = 'drop-shadow(2px 5px 5px rgba(0,0,0,0.3))';
        ghost.appendChild(img);

        const icon = document.createElement('div');
        icon.innerHTML = '🥢';
        icon.style.fontSize = '60px';
        icon.style.marginTop = '-30px';
        icon.style.transform = 'rotate(45deg)';
        ghost.appendChild(icon);

        ghost.style.left = pos.x + 'px';
        ghost.style.top = pos.y + 'px';
        document.body.appendChild(ghost);
        state.dragGhost = ghost;
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
