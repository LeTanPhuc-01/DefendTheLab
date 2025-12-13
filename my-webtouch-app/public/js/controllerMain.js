import { WebTouchController, TouchpadModule, VirtualKeyboardModule } from 'webtouch-sdk';

class OCRController extends WebTouchController {

    // 1. Setup the UI when connected
    buildUI(container, client, store) {
        this.container = container;
        this.client = client;
        this.activeModules = [];

        // Default to MENU mode
        this.switchMode('MENU');
    }

    // 2. Listen for Mode Changes from Kiosk
    onAppEvent(eventName, payload) {
        console.log("Controller received App Event:", eventName, payload); // DEBUG LOG
        if (eventName === 'set_controller_mode') {
            console.log("Switching Mode to:", payload.mode);
            this.switchMode(payload.mode);
        }
    }

    switchMode(mode) {
        // Cleanup
        this.container.innerHTML = '';
        this.activeModules = [];

        if (mode === 'MENU') {
            this.renderMenuMode();
        } else if (mode === 'GAME') {
            this.renderGameMode();
        }
    }

    renderMenuMode() {
        console.log("Rendering MENU Mode");
        // 1. Touchpad
        const touchpad = new TouchpadModule({
            controllerClient: this.client,
            parent: this.container,
        });
        this.activeModules.push(touchpad);

        // 2. Keyboard
        const keyboard = new VirtualKeyboardModule({
            controllerClient: this.client,
            parent: this.container,
        });
        this.activeModules.push(keyboard);
    }

    renderGameMode() {
        console.log("Rendering GAME Mode (OCR)");

        // Create Canvas UI
        this.container.innerHTML = `
            <div style="position: absolute; top: 20px; width: 100%; text-align: center; color: #4ade80; font-family: sans-serif; pointer-events: none;">
                Draw a digit (0-9)
            </div>
            <canvas id="drawingCanvas" width="300" height="300" 
                style="background: white; touch-action: none; border: 2px solid #4ade80; border-radius: 8px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            </canvas>
        `;

        this.initOCRLogic();
    }

    // --- OCR Logic ---
    initOCRLogic() {
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let isDrawing = false;
        let recognitionTimer = null;
        const FADE_DURATION = 1000;
        const clientReference = this.client;

        // Setup Canvas
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 15;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Listeners
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        // Listeners - Mouse (for testing on desktop)
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            // Handle both touch and mouse events
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const x = clientX - rect.left;
            const y = clientY - rect.top;

            // Calculate scale factor (Internal Resolution / Visual Size)
            const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
            const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

            return {
                x: x * scaleX,
                y: y * scaleY
            };
        }

        function startDrawing(e) {
            e.preventDefault();
            if (recognitionTimer) {
                clearTimeout(recognitionTimer);
                recognitionTimer = null;
            }
            isDrawing = true;
            const { x, y } = getPos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
        }

        function draw(e) {
            if (!isDrawing) return;
            e.preventDefault();
            const { x, y } = getPos(e);
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        function stopDrawing() {
            isDrawing = false;
            recognitionTimer = setTimeout(() => {
                processMultiDigit().then(() => {
                    // Reset canvas after processing
                    ctx.fillStyle = "white";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                });
            }, FADE_DURATION);
        }

        // --- Core Processing Logic ---
        async function processMultiDigit() {
            // 1. Rescale wide input to square buffer
            const bufferCanvas = document.createElement('canvas');
            const BUFFER_SIZE = 280;
            bufferCanvas.width = BUFFER_SIZE;
            bufferCanvas.height = BUFFER_SIZE;
            const bufferCtx = bufferCanvas.getContext('2d');

            bufferCtx.fillStyle = "white";
            bufferCtx.fillRect(0, 0, BUFFER_SIZE, BUFFER_SIZE);

            // Draw the user's drawing onto the square buffer
            bufferCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, BUFFER_SIZE, BUFFER_SIZE);

            // 2. Process the square buffer
            let imgData = bufferCtx.getImageData(0, 0, BUFFER_SIZE, BUFFER_SIZE);
            let grayscaleImg = imageDataToGrayscale(imgData);
            const segments = segmentImageHorizontal(grayscaleImg);

            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                const bbox = getBoundingRectangle(grayscaleImg, 0.01, seg.minX, seg.maxX);
                const trans = centerImage(grayscaleImg, bbox);

                const tempCanvas = document.createElement("canvas");
                tempCanvas.width = 280;
                tempCanvas.height = 280;
                const tempCtx = tempCanvas.getContext("2d");

                tempCtx.fillStyle = "white";
                tempCtx.fillRect(0, 0, 280, 280);

                const brW = bbox.maxX + 1 - bbox.minX;
                const brH = bbox.maxY + 1 - bbox.minY;
                const scaling = 190 / (brW > brH ? brW : brH);

                tempCtx.translate(140, 140);
                tempCtx.scale(scaling, scaling);
                tempCtx.translate(-140, -140);
                tempCtx.translate(trans.transX, trans.transY);

                // Draw from the BUFFER canvas, not the original wide canvas
                tempCtx.drawImage(
                    bufferCanvas,
                    bbox.minX, 0, (bbox.maxX - bbox.minX), BUFFER_SIZE,
                    bbox.minX, 0, (bbox.maxX - bbox.minX), 280
                );

                const digitBase64 = tempCanvas.toDataURL('image/png');

                try {
                    const pythonUrl = `http://${window.location.hostname}:5000/predict`;
                    const response = await fetch(pythonUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: digitBase64 })
                    });
                    const data = await response.json();
                    console.log("OCR Result:", data);

                    if (data.digit !== undefined && clientReference) {
                        clientReference.sendCustomEvent({
                            eventName: 'digit_recognized',
                            payload: {
                                digit: data.digit,
                                confidence: data.confidence
                            }
                        });
                    }
                } catch (err) {
                    console.error("OCR Failed:", err);
                }
            }
        }

        // --- Helpers ---
        function imageDataToGrayscale(imgData) {
            let grayscale = [];
            for (let y = 0; y < imgData.height; y++) {
                grayscale[y] = [];
                for (let x = 0; x < imgData.width; x++) {
                    let offset = (y * imgData.width + x) * 4;
                    grayscale[y][x] = imgData.data[offset] / 255.0;
                }
            }
            return grayscale;
        }

        function segmentImageHorizontal(img) {
            const rows = img.length;
            const cols = img[0].length;
            const histogram = new Array(cols).fill(0);

            for (let x = 0; x < cols; x++) {
                for (let y = 0; y < rows; y++) {
                    if (img[y][x] < 0.99) histogram[x]++;
                }
            }

            const segments = [];
            let inSegment = false;
            let startX = 0;

            for (let x = 0; x < cols; x++) {
                if (histogram[x] > 0) {
                    if (!inSegment) { inSegment = true; startX = x; }
                } else {
                    if (inSegment) {
                        inSegment = false;
                        segments.push({ minX: startX, maxX: x - 1 });
                    }
                }
            }
            if (inSegment) segments.push({ minX: startX, maxX: cols - 1 });
            return segments.length > 0 ? segments : [{ minX: 0, maxX: cols - 1 }];
        }

        function getBoundingRectangle(img, threshold, minX_limit, maxX_limit) {
            let rows = img.length;
            let minX = maxX_limit, minY = rows, maxX = -1, maxY = -1;

            for (let y = 0; y < rows; y++) {
                for (let x = minX_limit; x <= maxX_limit; x++) {
                    if (img[y][x] < threshold) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX === -1) return { minX: minX_limit, maxX: maxX_limit, minY: 0, maxY: rows - 1 };
            return { minX, maxX, minY, maxY };
        }

        function centerImage(img, bbox) {
            let meanX = 0, meanY = 0, sumPixels = 0;
            for (let y = bbox.minY; y <= bbox.maxY; y++) {
                for (let x = bbox.minX; x <= bbox.maxX; x++) {
                    let pixel = 1 - img[y][x];
                    sumPixels += pixel;
                    meanY += y * pixel;
                    meanX += x * pixel;
                }
            }
            if (sumPixels === 0) return { transX: 0, transY: 0 };
            meanX /= sumPixels;
            meanY /= sumPixels;
            return {
                transX: Math.round(img[0].length / 2 - meanX),
                transY: Math.round(img.length / 2 - meanY)
            };
        }
    }
}

// Start the Controller
new OCRController('#controller-app');