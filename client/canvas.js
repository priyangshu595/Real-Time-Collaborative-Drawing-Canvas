/// client/canvas.js — all-linear rendering to keep tabs identical

class CanvasManager {
  constructor(canvasEl, cursorLayer) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.cursorLayer = cursorLayer;

    this.isDrawing = false;
    this.currentStroke = null;
    this.operations = [];
    this.userId = null;
    this.opActive = new Map();
    this.remoteStrokes = new Map();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setUser(userId, color) {
    this.userId = userId;
    this.userColor = color;
  }


  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // set backing buffer to device pixels
    this.canvas.width  = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    // scale so drawing commands use CSS pixels (1 unit == 1 CSS pixel)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rebuild();
  }

  startLocalStroke(tool, color, width, x, y) {
    this.isDrawing = true;
    this.currentStroke = {
      id: this._generateId(),
      userId: this.userId,
      tool, color, width,
      points: [{ x, y, t: Date.now() }],
      partial: true
    };
    // draw a dot to show the start
    this._drawDot(this.currentStroke, this.currentStroke.points[0]);
  }

  addPointToLocal(x, y) {
    if (!this.isDrawing || !this.currentStroke) return;
    const pts = this.currentStroke.points;
    const last = pts[pts.length - 1];
    const dx = x - last.x, dy = y - last.y;
    if (dx*dx + dy*dy < 4) return; // ignore tiny moves
    pts.push({ x, y, t: Date.now() });
    this._drawSegmentLinear(this.currentStroke, pts[pts.length-2], pts[pts.length-1]);
  }

  endLocalStroke() {
    if (!this.currentStroke) return null;
    this.currentStroke.partial = false;
    const finished = this.currentStroke;
    this.currentStroke = null;
    return finished;
  }

  // ===== Low-level drawing helpers (LINEAR ONLY) =====
  _prepCtx(stroke) {
    const c = this.ctx;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = stroke.color;
    c.lineWidth = stroke.width;
    c.globalCompositeOperation = (stroke.tool === 'eraser') ? 'destination-out' : 'source-over';
  }

  _drawDot(stroke, p) {
    const c = this.ctx;
    this._prepCtx(stroke);
    c.beginPath();
    c.arc(p.x, p.y, Math.max(1, stroke.width/2), 0, Math.PI*2);
    if (stroke.tool === 'eraser') c.fill(); else { c.fillStyle = stroke.color; c.fill(); }
    c.globalCompositeOperation = 'source-over';
  }

  _drawSegmentLinear(stroke, p0, p1) {
    const c = this.ctx;
    this._prepCtx(stroke);
    c.beginPath();
    c.moveTo(p0.x, p0.y);
    c.lineTo(p1.x, p1.y);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
  }

  _drawWholeStrokeLinear(stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;
    if (pts.length === 1) { this._drawDot(stroke, pts[0]); return; }
    for (let i = 1; i < pts.length; i++) this._drawSegmentLinear(stroke, pts[i-1], pts[i]);
  }
  // ===================================================

  // Convert incoming stroke (may be normalized) to absolute canvas pixels
  _absStroke(stroke) {
    if (!stroke) return null;
    // use CSS pixel dims (bounding rect) — points kept in CSS pixels
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const points = (stroke.points || []).map(p => {
      if (typeof p.xPct === 'number' && typeof p.yPct === 'number')
        return { x: p.xPct * w, y: p.yPct * h, t: p.t };
      if (typeof p.x === 'number' && typeof p.y === 'number')
        return { x: p.x, y: p.y, t: p.t };
      return null;
    }).filter(Boolean);

    return { id: stroke.id, userId: stroke.userId, tool: stroke.tool, color: stroke.color, width: stroke.width, partial: !!stroke.partial, points };
  }

  // Remote partials: append and draw new linear segments only
  applyRemotePartial(strokeNet) {
    const stroke = this._absStroke(strokeNet);
    if (!stroke || !stroke.id) return;

    let temp = this.remoteStrokes.get(stroke.id);
    if (!temp) {
      temp = { id: stroke.id, userId: stroke.userId, tool: stroke.tool, color: stroke.color, width: stroke.width, points: [] };
      this.remoteStrokes.set(stroke.id, temp);
    }
    const pts = temp.points;
    const startLen = pts.length;
    const incoming = stroke.points || [];
    if (!incoming.length) return;

    // If we have no existing points, just copy but draw once (dot or segments).
    if (startLen === 0) {
      for (const p of incoming) {
        // avoid exact duplicates
        const last = pts[pts.length - 1];
        if (last && last.x === p.x && last.y === p.y && last.t === p.t) continue;
        pts.push(p);
      }
      if (pts.length === 1) { this._drawDot(temp, pts[0]); return; }
      for (let i = 1; i < pts.length; i++) this._drawSegmentLinear(temp, pts[i-1], pts[i]);
      return;
    }

    // startLen > 0: append only new points (use timestamp as heuristic)
    const lastTime = pts[startLen - 1].t || 0;
    for (const p of incoming) {
      if (typeof p.t === 'number' && p.t <= lastTime) continue;
      // also skip exact coordinate duplicates just in case
      const last = pts[pts.length - 1];
      if (last && last.x === p.x && last.y === p.y && last.t === p.t) continue;

      // push and draw the connecting segment from previous last -> new point
      pts.push(p);
      const idx = pts.length - 1;
      if (idx >= 1) this._drawSegmentLinear(temp, pts[idx - 1], pts[idx]);
      else this._drawDot(temp, pts[idx]);
    }
  }

  // Final authoritative stroke
  commitRemoteStroke(opEntry) {
    if (!opEntry || opEntry.type !== 'stroke' || !opEntry.op) return;
    const stroke = this._absStroke(opEntry.op);
    if (!stroke) return;
    if (this.remoteStrokes.has(stroke.id)) this.remoteStrokes.delete(stroke.id);
    this._drawWholeStrokeLinear(stroke);
  }

  rebuild() {
    const ops = Array.isArray(this.operations) ? this.operations : [];
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';

    this.opActive = new Map();
    for (const e of ops) {
      if (e.type === 'stroke' && e.op && e.op.id) this.opActive.set(e.op.id, true);
      else if (e.type === 'undo' && e.refId) this.opActive.set(e.refId, false);
      else if (e.type === 'redo' && e.refId) this.opActive.set(e.refId, true);
    }

    for (const e of ops) {
      if (e.type === 'stroke' && e.op) {
        const s = this._absStroke(e.op) || e.op;
        if (this.opActive.get(s.id) !== false) this._drawWholeStrokeLinear(s);
      }
    }

    for (const [, temp] of this.remoteStrokes.entries()) {
      if (!temp.points || temp.points.length === 0) continue;
      if (temp.points.length === 1) this._drawDot(temp, temp.points[0]);
      else for (let i = 1; i < temp.points.length; i++) this._drawSegmentLinear(temp, temp.points[i-1], temp.points[i]);
    }
  }

  applyRemoteOp(opEntry) {
    this.operations.push(opEntry);
    if (opEntry.type === 'stroke' && opEntry.op) this.commitRemoteStroke(opEntry);
    else this.rebuild();
  }

  setOperations(ops) { this.operations = ops || []; this.rebuild(); }

  _generateId(){ return 'op_' + Math.random().toString(36).slice(2, 11); }
}

window.CanvasManager = CanvasManager;