// Convert a local stroke to network-safe normalized copy (use canvas pixel size)
// client/main.js
(function(){
  const canvasEl = document.getElementById('drawingCanvas');
  const cursorLayer = document.getElementById('cursorLayer');
  const manager = new CanvasManager(canvasEl, cursorLayer);
  window.manager = manager;

  // layout canvas to fill
  function fitCanvas(){
    canvasEl.style.width = '100%';
    canvasEl.style.height = (window.innerHeight - document.querySelector('header').offsetHeight - document.querySelector('footer').offsetHeight) + 'px';
    manager.resize();
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  const userName = 'User' + Math.floor(Math.random() * 1000);

// 🆕 Ask user to join or create a room
const roomId = prompt('Enter a room name (e.g. "team1", "projectA"):', 'main') || 'main';

Network.join(roomId, userName);

console.log(`🟢 Joined room: ${roomId} as ${userName}`);

  // serialize / deserialize using canvas pixel dims
  function serializeStrokeForNetwork(stroke) {
    if (!stroke) return null;
  const rect = canvasEl.getBoundingClientRect(); // CSS pixels
  const w = rect.width || 1, h = rect.height || 1;
  return {
    id: stroke.id,
    userId: stroke.userId,
    tool: stroke.tool,
    color: stroke.color,
    width: stroke.width,
    text: stroke.text || undefined,         // NEW
    imageSrc: stroke.imageSrc || undefined, // NEW (data URL)
    partial: !!stroke.partial,
    points: (stroke.points || []).map(p => ({ xPct: (p.x / w), yPct: (p.y / h), t: p.t }))
    };
  }

  function deserializeStrokeFromNetwork(netStroke) {
    if (!netStroke) return null;
  const rect = canvasEl.getBoundingClientRect(); // CSS pixels
  const w = rect.width || 1, h = rect.height || 1;
  return {
    id: netStroke.id,
    userId: netStroke.userId,
    tool: netStroke.tool,
    color: netStroke.color,
    width: netStroke.width,
    text: netStroke.text || undefined,          // NEW
    imageSrc: netStroke.imageSrc || undefined,  // NEW
    partial: !!netStroke.partial,
    points: (netStroke.points || []).map(p => {
      if (typeof p.xPct === 'number' && typeof p.yPct === 'number') return { x: p.xPct * w, y: p.yPct * h, t: p.t };
      if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y, t: p.t };
      return null;
    }).filter(Boolean)
    };
  }

  // full_state
  Network.on('full_state', (state) => {
    manager.setUser(state.youId || 'anonymous', state.youColor || '#000');
    const ops = (state.operations || []).map(op => {
      if (op && op.type === 'stroke' && op.op) return { ...op, op: deserializeStrokeFromNetwork(op.op) || op.op };
      return op;
    });
    manager.setOperations(ops);
    updateUserList(state.users || []);
  });

  Network.on('user_list', users => updateUserList(users || []));
  const usersById = new Map();
  function updateUserList(users){ const el = document.getElementById('userList');
  // rebuild registry
  usersById.clear();
  for (const u of (users || [])) usersById.set(u.id || u.socketId || u.sid || u.name, u);

  el.innerHTML = (users || []).map(u => {
    const color = u.color || '#444';
    return `<span class="user-badge"><span class="dot" style="background:${color}"></span>${u.name || u.id}</span>`;
  }).join('');

  // clean up any cursor DOM for users no longer present
  const layer = document.getElementById('cursorLayer');
  Array.from(layer.querySelectorAll('[data-socket]')).forEach(node => {
    const sid = node.getAttribute('data-socket');
    if (!usersById.has(sid)) node.remove();
  }); }

  // op:new
  Network.on('op:new', (opEntry) => {
    if (opEntry && opEntry.type === 'stroke' && opEntry.op) {
      const abs = deserializeStrokeFromNetwork(opEntry.op);
      manager.applyRemoteOp({ ...opEntry, op: abs });
    } else manager.applyRemoteOp(opEntry);
  });

  // stroke:partial
  Network.on('stroke:partial', (payload) => {
    if (!payload) return;
    let strokePayload = null;
    if (Array.isArray(payload)) {
      const first = payload[0];
      strokePayload = first && (first.stroke || first);
    } else if (payload && payload.stroke) strokePayload = payload.stroke;
    else strokePayload = payload;
    if (!strokePayload) return;
    const abs = deserializeStrokeFromNetwork(strokePayload);
    if (abs) manager.applyRemotePartial(abs);
  });

  const cursorState = new Map(); // socketId -> { xPct, yPct, ts }
  Network.on('cursor', ({ socketId, x, y, xPct, yPct }) => {
  // server may send {x,y} or {xPct,yPct}; normalize to xPct/yPct
  const rect = canvasEl.getBoundingClientRect();
  let nx = typeof xPct === 'number' ? xPct : (typeof x === 'number' ? x/rect.width : null);
  let ny = typeof yPct === 'number' ? yPct : (typeof y === 'number' ? y/rect.height : null);
  if (nx==null || ny==null) return;

  cursorState.set(socketId, { xPct: nx, yPct: ny, ts: Date.now() });
  renderCursors();
});

function renderCursors() {
  const layer = document.getElementById('cursorLayer');
  const rect = layer.getBoundingClientRect();
  const now = Date.now();
  const STALE_MS = 3000;

  for (const [sid, cur] of cursorState) {
    if (now - cur.ts > STALE_MS) { // stale, remove
      cursorState.delete(sid);
      const stale = layer.querySelector(`.cursor-indicator[data-socket="${sid}"]`);
      if (stale) stale.remove();
      continue;
    }
    if (sid === (window.socket && window.socket.id)) continue; // hide my own indicator

    const user = usersById.get(sid) || {};
    const color = user.color || '#0ea5e9';
    const name = user.name || sid.slice(0,5);

    const idSel = `.cursor-indicator[data-socket="${sid}"]`;
    let node = layer.querySelector(idSel);
    if (!node) {
      node = document.createElement('div');
      node.className = 'cursor-indicator';
      node.setAttribute('data-socket', sid);
      node.innerHTML = `
        <span class="cursor-dot"></span>
        <span class="cursor-name"></span>
      `;
      layer.appendChild(node);
    }

    const dot = node.querySelector('.cursor-dot');
    const label = node.querySelector('.cursor-name');

    dot.style.background = color;
    label.textContent = name;

    const left = cur.xPct * rect.width;
    const top  = cur.yPct * rect.height;
    node.style.left = `${left}px`;
    node.style.top  = `${top}px`;
  }
}

// clean up a user's cursor when they disconnect via user_list
Network.on('user_list', (users) => {
  updateUserList(users || []);
  renderCursors();
});

  // toolbar
  let tool = 'brush';
  document.getElementById('brushBtn').onclick = () => tool='brush';
  document.getElementById('eraserBtn').onclick = () => tool='eraser';
  document.getElementById('undoBtn').onclick = () => Network.emitUndo(roomId);
  document.getElementById('redoBtn').onclick = () => Network.emitRedo(roomId);
  const colorPicker = document.getElementById('colorPicker');
  const widthInput = document.getElementById('width');

  // THEME TOGGLE -----------------
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Load saved theme (default dark)
const savedTheme = localStorage.getItem('theme') || 'dark';
document.body.classList.toggle('light', savedTheme === 'light');
updateThemeButton();

themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const mode = document.body.classList.contains('light') ? 'light' : 'dark';
  localStorage.setItem('theme', mode);
  updateThemeButton();
});

function updateThemeButton() {
  if (document.body.classList.contains('light')) {
    themeToggleBtn.textContent = '🌞 Light';
  } else {
    themeToggleBtn.textContent = '🌙 Dark';
  }
}
// --------------------------------

  // debug logging (non-destructive)
  if (!window._emitLogged && window.socket && window.socket.emit) {
    window._emitLogged = [];
    const _orig = window.socket.emit.bind(window.socket);
    window.socket.emit = function(ev, payload){ try{ console.debug('[emit]', ev, payload && (payload.stroke || payload)); } catch(e){} window._emitLogged.push([ev,payload]); return _orig(ev,payload); };
  }
  if (!window._recvLogged && window.socket && window.socket.onAny) {
    window._recvLogged = [];
    window.socket.onAny((ev,...args)=> { console.debug('[recv]', ev, args); window._recvLogged.push([ev,args]); });
  }

  // ---------- Robust pointer handlers ----------
  function getCanvasPos(e) {
    const rect = canvasEl.getBoundingClientRect();
    // CanvasManager scales the context by devicePixelRatio, so work in CSS pixels.
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function makeThrottledSender(intervalMs = 60) {
    let timer = null;
    return {
      schedule(fn) { if (timer) return; timer = setTimeout(()=>{ try{ fn(); } catch(e){ console.error(e);} timer = null; }, intervalMs); },
      flush(fn) { if (timer) { clearTimeout(timer); timer = null; } try{ fn(); } catch(e){ console.error(e); } }
    };
  }
  const _sender = makeThrottledSender(60);
  let isPointerDown = false;

  canvasEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isPointerDown = true;
    const pos = getCanvasPos(e);
    manager.startLocalStroke(tool, colorPicker.value, parseInt(widthInput.value, 10), pos.x, pos.y);
    if (manager.currentStroke) {
      const net = serializeStrokeForNetwork(manager.currentStroke);
      if (net) Network.emitStrokePartial(roomId, net);
    }
  });

  canvasEl.addEventListener('pointermove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const pctX = (e.clientX - rect.left) / rect.width;
    const pctY = (e.clientY - rect.top) / rect.height;
    Network.emitCursor(roomId, { x: pctX, y: pctY });

    if (!isPointerDown) return;
    const pos = getCanvasPos(e);
    manager.addPointToLocal(pos.x, pos.y);

    _sender.schedule(() => {
      if (manager.currentStroke) {
        const net = serializeStrokeForNetwork(manager.currentStroke);
        if (net) Network.emitStrokePartial(roomId, net);
      }
    });
  });

  function pointerUpHandler(e) {
    if (!isPointerDown) return;
    e.preventDefault();
    isPointerDown = false;
    const pos = getCanvasPos(e);
    manager.addPointToLocal(pos.x, pos.y);
    const finished = manager.endLocalStroke();
    _sender.flush(() => {});
    if (finished) {
      const net = serializeStrokeForNetwork(finished);
      if (net) Network.emitStrokeFinal(roomId, net);
    }
  }
  window.addEventListener('pointerup', pointerUpHandler);
  window.addEventListener('pointercancel', pointerUpHandler);
  // ---------------------------------------------

    // === Performance Metrics: FPS + Ping ===
  let fps = 0, frames = 0;
  let lastTime = performance.now();

  function fpsLoop(now) {
    frames++;
    if (now - lastTime >= 1000) {
      fps = frames;
      frames = 0;
      lastTime = now;
    }
    requestAnimationFrame(fpsLoop);
  }
  requestAnimationFrame(fpsLoop);

  let ping = 0;
  setInterval(() => {
    const start = Date.now();
    if (window.socket && window.socket.connected) {
      window.socket.emit('pingCheck');
      window.socket.once('pongCheck', () => {
        ping = Date.now() - start;
        const metricsEl = document.getElementById('metrics');
        if (metricsEl)
          metricsEl.innerText = `FPS: ${fps} | Ping: ${ping}ms`;
      });
    }
  }, 1000);
  // =======================================

})();