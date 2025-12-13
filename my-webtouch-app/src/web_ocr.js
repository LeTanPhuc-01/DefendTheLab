// --- Configuration & Globals ---
// Ensure your HTML canvas ID matches this (currently 'drawingCanvas')
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const predictionEl = document.getElementById('prediction');
const confidenceEl = document.getElementById('confidence');

const FADE_DURATION = 1000;
let recognitionTimer = null;
let isDrawing = false;

// --- Initialization ---
resetCanvas();

// Attach Event Listeners
if (canvas) {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', stopDrawing);
} else {
    console.error("Canvas element 'drawingCanvas' not found!");
}

// --- Drawing Functions ---

function resetCanvas() {
    ctx.fillStyle = "white"; // White background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black"; // Black ink
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
}

// --- In web_ocr.js (REPLACE the existing getPos function) ---

function getPos(e) {
    // 1. Get the boundary box of the canvas element (the visual, REM-based size).
    const rect = canvas.getBoundingClientRect();
    
    // 2. Get the raw client coordinates (mouse or touch).
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // 3. Calculate the position relative to the canvas's visual top-left corner.
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // 4. CRITICAL STEP: Calculate the scale factor (Internal Resolution / Visual Size).
    // This scales the visual mouse position (x, y) back to the internal 960x150 coordinate system.
    
    // Safety check for division by zero (shouldn't happen, but good practice)
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    
    /* // DEBUGGING TIP: Uncomment to see the scale factor 
    // If scaleX is not 1.0, a scaling issue exists.
    // console.log(`Scale: ${scaleX.toFixed(2)}x, Visual Size: ${rect.width}px, Internal Size: ${canvas.width}px`); 
    */
    
    // 5. Apply the scaling factor to the coordinates.
    return { 
        x: x * scaleX, 
        y: y * scaleY
    };
}

function startDrawing(e) {
    if (recognitionTimer) {
        clearTimeout(recognitionTimer);
        recognitionTimer = null;
    }
    canvas.classList.remove("fading");
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        ctx.beginPath();
        
        // Visual feedback
        canvas.classList.add("fading");
        
        // Start Timer
        recognitionTimer = setTimeout(() => {
            processMultiDigit().then(() => {
                // We handle canvas reset/fade removal only AFTER processing is done
                resetCanvas();
                canvas.classList.remove("fading");
            });
        }, FADE_DURATION);
    }
}

function clearCanvas() {
    resetCanvas();
    if(predictionEl) predictionEl.innerText = "-";
    if(confidenceEl) confidenceEl.innerText = "Confidence: 0%";
}

// --- CORE LOGIC: Segmentation + Backend Calls ---

async function processMultiDigit() {
    // ----------------------------------------------------------------------
    // === FIX: RESCALE WIDE INPUT TO SQUARE BUFFER FOR OCR LOGIC ===
    // ----------------------------------------------------------------------
    const bufferCanvas = document.createElement('canvas');
    const BUFFER_SIZE = 280; // The size your segmentation and AI logic expects
    
    bufferCanvas.width = BUFFER_SIZE;
    bufferCanvas.height = BUFFER_SIZE;
    const bufferCtx = bufferCanvas.getContext('2d');
    
    // 1. Fill buffer with white background
    bufferCtx.fillStyle = "white";
    bufferCtx.fillRect(0, 0, BUFFER_SIZE, BUFFER_SIZE);
    
    // 2. Draw the user's wide 960x150 drawing onto the 280x280 buffer.
    // The browser engine handles the scaling, producing a square version of the drawing.
    bufferCtx.drawImage(
        canvas, 
        0, 0, canvas.width, canvas.height, // Source: Full actual drawing (960x150)
        0, 0, BUFFER_SIZE, BUFFER_SIZE     // Destination: Full square buffer (280x280)
    );
    
    // 3. Get image data from the rescaled, square buffer
    let imgData = bufferCtx.getImageData(0, 0, BUFFER_SIZE, BUFFER_SIZE);
    // ----------------------------------------------------------------------
    
    
    // 4. Now, the rest of the segmentation logic (which assumes square input) proceeds correctly
    let grayscaleImg = imageDataToGrayscale(imgData);
    const segments = segmentImageHorizontal(grayscaleImg);
    
    let finalDigits = "";
    let minConfidence = 100.0;
    let success = false;
    
    // 5. Loop through each segment
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        
        // Extract Bounding Box and Calculate Centering (Logic assumes 280x280 data)
        const bbox = getBoundingRectangle(grayscaleImg, 0.01, seg.minX, seg.maxX);
        const trans = centerImage(grayscaleImg, bbox);
        
        // Create a Temp Canvas for the final 280x280 single digit
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 280; 
        tempCanvas.height = 280; 
        const tempCtx = tempCanvas.getContext("2d");
        
        // Fill white background
        tempCtx.fillStyle = "white";
        tempCtx.fillRect(0, 0, 280, 280);
        
        // Apply Scaling and Centering transformations
        const brW = bbox.maxX + 1 - bbox.minX;
        const brH = bbox.maxY + 1 - bbox.minY;
        const scaling = 190 / (brW > brH ? brW : brH);
        
        tempCtx.translate(140, 140);
        tempCtx.scale(scaling, scaling);
        tempCtx.translate(-140, -140);
        tempCtx.translate(trans.transX, trans.transY);
        
        // FIX: Draw the square buffer onto the final temporary canvas.
        // We must draw the entire buffer, letting the transformations correctly position the segment.
        tempCtx.drawImage(
            bufferCanvas, // Source: The 280x280 square buffer
            0, 0, BUFFER_SIZE, BUFFER_SIZE, 
            0, 0, BUFFER_SIZE, BUFFER_SIZE 
        );
        
        // Get Base64 string of this single processed digit
        const digitBase64 = tempCanvas.toDataURL('image/png');
        
        // 6. Send to Python Backend
        try {
            const result = await sendToBackend(digitBase64);
            if (result && result.digit !== undefined) {
                finalDigits += result.digit;
                if (result.confidence < minConfidence) minConfidence = result.confidence;
                success = true;
            }
        } catch (err) {
            console.error("Backend error on segment " + i, err);
            finalDigits += "?";
        }
    }
    
    // ----------------------------------------------------------------------
    // --- INTEGRATION POINT ---
    // ----------------------------------------------------------------------
    
    if(predictionEl) predictionEl.innerText = finalDigits;
    if(confidenceEl) confidenceEl.innerText = `Confidence: ${(minConfidence * 100).toFixed(1)}%`;
    
    if (success && window.handleOCRInput) {
        window.handleOCRInput(finalDigits, minConfidence);
    }
    // ----------------------------------------------------------------------
}

// ----------------------------------------------------------------------
// === CRITICAL INTEGRATION POINT (Moved Outside Loop) ===
// ----------------------------------------------------------------------

// 1. Update UI (Only once, after all segments are processed)
if(predictionEl) predictionEl.innerText = finalDigits;
if(confidenceEl) confidenceEl.innerText = `Confidence: ${(minConfidence * 100).toFixed(1)}%`;

// 2. Dispatch the final result to the game (WorldScene)
if (success && window.handleOCRInput) {
    window.handleOCRInput(finalDigits, minConfidence);
}
// ----------------------------------------------------------------------

async function sendToBackend(base64Image) {
    const response = await fetch('http://localhost:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
    });
    return await response.json();
}

// --- Helpers ---

function segmentImageHorizontal(img) {
    const rows = img.length;
    const cols = img[0].length;
    const histogram = new Array(cols).fill(0);
    
    // Vertical Projection
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            // < 0.99 means it's not white (it's ink)
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
    // Safety check if segment was empty
    if (maxX === -1) return { minX: minX_limit, maxX: maxX_limit, minY: 0, maxY: rows-1 };
    
    return { minX, maxX, minY, maxY };
}

function centerImage(img, bbox) {
    let meanX = 0, meanY = 0, sumPixels = 0;
    
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
        for (let x = bbox.minX; x <= bbox.maxX; x++) {
            let pixel = 1 - img[y][x]; // Invert (0=white, 1=ink)
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

function imageDataToGrayscale(imgData) {
    let grayscale = [];
    for (let y = 0; y < imgData.height; y++) {
        grayscale[y] = [];
        for (let x = 0; x < imgData.width; x++) {
            let offset = (y * imgData.width + x) * 4;
            // Normalize: 255=white=1.0, 0=black=0.0
            // We just take the Red channel since it's B&W
            grayscale[y][x] = imgData.data[offset] / 255.0;
        }
    }
    return grayscale;
}