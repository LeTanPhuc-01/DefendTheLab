// examples/whiteboard/public/js/app/drawingUtils.js
//
// Canvas utilities for the whiteboard demo.
// These are WebTouch-agnostic: they only know about
// canvas, context, and the whiteboard state shape.

/**
 * Resize the canvas to match its display size (HiDPI aware),
 * then call the provided redraw function.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} state
 * @param {Function} [redrawAllFn] - function()
 */
export function resizeCanvasToDisplaySize(canvas, ctx, state, redrawAllFn) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  if (typeof redrawAllFn === 'function') {
    redrawAllFn();
  }
}

/**
 * Main Rendering Loop.
 * Clears the canvas, applies the camera transform, and draws
 * all strokes, text, and remote cursors.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {Object} state - The Board State (strokes, texts, viewport)
 * @param {Map} cursorMap - The SDK's Map of connected controllers
 */
export function redrawAll(ctx, canvas, state, cursorMap) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // 1. Reset Context to Screen Space to clear
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  // 2. Apply Camera Transform (Move the World)
  // We translate by the viewport offset so strokes stick to the "ground"
  ctx.translate(state.viewportX, state.viewportY);

  // 3. Draw World Content

  // A. Committed Strokes
  for (const stroke of state.strokes) {
    drawStrokePath(ctx, stroke);
  }

  // B. Active Strokes (Currently being drawn by users)
  for (const stroke of state.activeStrokes.values()) {
    drawStrokePath(ctx, stroke);
  }

  // C. Committed Text
  for (const text of state.texts) {
    drawTextObject(ctx, text, false);
  }

  // D. Active Text (Being edited by specific users)
  // In Multi-User mode, active text is attached to the User Object
  if (cursorMap) {
    cursorMap.forEach((user) => {
      if (user.data && user.data.activeText) {
        drawTextObject(ctx, user.data.activeText, true);
      }
    });
  }

  // 4. Draw Cursors (UI Overlay)
  // We reset the transform to Screen Space so cursors "float" above the board
  // and aren't affected by the viewport camera (optional, but standard for UIs).
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (cursorMap) {
    cursorMap.forEach((user) => {
      drawUserCursor(ctx, user);
    });
  }
}

/**
 * Draw a single stroke path.
 */
export function drawStrokePath(ctx, stroke) {
  if (!stroke || !stroke.points || stroke.points.length === 0) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = stroke.lineWidth;
  ctx.strokeStyle = stroke.color;

  // Eraser Logic:
  // 'destination-out' cuts through the canvas (transparency).
  // Assuming the canvas sits on a white HTML background, this looks like erasing.
  if (stroke.mode === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.beginPath();
  
  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);
  
  for (const p of rest) {
    ctx.lineTo(p.x, p.y);
  }
  
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a text object.
 * @param {boolean} isActive - If true, draws a dashed selection box.
 */
export function drawTextObject(ctx, textObj, isActive = false) {
  if (!textObj || typeof textObj.content !== 'string') return;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = textObj.color || '#000000';
  
  const fontSize = textObj.fontSize || 20;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';

  // Draw the text
  ctx.fillText(textObj.content + (isActive ? '|' : ''), textObj.x, textObj.y);

  // Draw selection box if editing
  if (isActive) {
    const metrics = ctx.measureText(textObj.content + '|');
    const width = metrics.width;
    const height = fontSize;

    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(textObj.x - 4, textObj.y - 4, width + 8, height + 8);
  }

  ctx.restore();
}

/**
 * Draw the remote user's cursor.
 * @param {Object} user - The SDK User Object
 */
export function drawUserCursor(ctx, user) {
  // Guard against uninitialized users
  if (typeof user.x !== 'number' || typeof user.y !== 'number') return;

  ctx.save();
  ctx.translate(user.x, user.y);

  // 1. The Cursor Ring
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  
  // Use the user's selected color (stored in .data by the App)
  const color = (user.data && user.data.color) ? user.data.color : '#000000';
  
  ctx.fillStyle = color;
  ctx.fill();
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. The Tool Label (e.g. "PEN", "PAN")
  const toolName = (user.data && user.data.tool) ? user.data.tool.toUpperCase() : '';
  
  if (toolName) {
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Draw label below cursor
    ctx.fillText(toolName, 0, 18);
  }

  ctx.restore();
}