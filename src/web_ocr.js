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

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
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
    // 1. Get raw image data
    let imgData = ctx.getImageData(0, 0, 280, 280);
    
    // 2. Convert to grayscale/binary map to find segments
    let grayscaleImg = imageDataToGrayscale(imgData);
    
    // 3. Find vertical segments (digits)
    const segments = segmentImageHorizontal(grayscaleImg);
    
    let finalDigits = "";
    let minConfidence = 100.0;

    // 4. Loop through each segment
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        
        // Extract Bounding Box
        const bbox = getBoundingRectangle(grayscaleImg, 0.01, seg.minX, seg.maxX);
        
        // Calculate Centering
        const trans = centerImage(grayscaleImg, bbox);
        
        // Create a Temp Canvas for this single digit
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 280;
        tempCanvas.height = 280;
        const tempCtx = tempCanvas.getContext("2d");
        
        // Fill white background (important for training consistency)
        tempCtx.fillStyle = "white";
        tempCtx.fillRect(0, 0, 280, 280);
        
        // Scale and Center logic
        const brW = bbox.maxX + 1 - bbox.minX;
        const brH = bbox.maxY + 1 - bbox.minY;
        const scaling = 190 / (brW > brH ? brW : brH);

        tempCtx.translate(140, 140);
        tempCtx.scale(scaling, scaling);
        tempCtx.translate(-140, -140);
        tempCtx.translate(trans.transX, trans.transY);

        // Draw ONLY the slice from the main canvas
        tempCtx.drawImage(
            canvas, 
            bbox.minX, 0, (bbox.maxX - bbox.minX), 280, 
            bbox.minX, 0, (bbox.maxX - bbox.minX), 280
        );

        // Get Base64 string of this single processed digit
        const digitBase64 = tempCanvas.toDataURL('image/png');
        
        // 5. Send to Python Backend
        try {
            const result = await sendToBackend(digitBase64);
            if (result) {
                finalDigits += result.digit;
                if (result.confidence < minConfidence) minConfidence = result.confidence;
            }
        } catch (err) {
            console.error("Backend error on segment " + i, err);
            finalDigits += "?";
        }
    }
    
    // Update UI
    if(predictionEl) predictionEl.innerText = finalDigits;
    if(confidenceEl) confidenceEl.innerText = `Confidence: ${(minConfidence * 100).toFixed(1)}%`;
}

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