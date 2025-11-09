import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRoom, getRoom } from './rooms.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '..', 'client')));

// --- helpers ---
function normalizeRoomId(id) {
  const rid = (id || 'main').toString().trim();
  // simple sanitize/limit
  return rid.slice(0, 64) || 'main';
}

function pickColor(room) {
  const palette = ['#e11d48','#0ea5e9','#10b981','#f59e0b','#7c3aed','#ef4444','#06b6d4'];
  const used = new Set(Object.values(room.users || {}).map(u => u.color));
  for (const c of palette) if (!used.has(c)) return c;
  return '#444';
}

function ensureDataDir() {
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveRoomHistory(roomId, history) {
  const dir = ensureDataDir();
  const filePath = path.join(dir, `${roomId}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('[server] Failed to save room history', roomId, err);
  }
}

function loadRoomHistory(roomId) {
  const dir = ensureDataDir();
  const filePath = path.join(dir, `${roomId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error('[server] Failed to load room history', roomId, err);
  }
  return [];
}

io.on('connection', (socket) => {
  console.log('[server] Client connected', socket.id);

  // ---- JOIN ----
  socket.on('join', ({ roomId, userName }) => {
    const rid = normalizeRoomId(roomId);
    const room = createRoom(rid); // ensure room exists (users, history, nextSeq)
    socket.join(rid);
    socket.roomId = rid;

    const user = {
      id: socket.id,
      name: userName || ('User' + Math.floor(Math.random() * 1000)),
      color: pickColor(room)
    };
    room.users[socket.id] = user;

    // send full state to this client
    socket.emit('full_state', {
      youId: socket.id,
      youColor: user.color,
      users: Object.values(room.users),
      operations: room.history
    });

    socket.on('pingCheck', () => socket.emit('pongCheck'));

    // broadcast updated user list to the room
    io.to(rid).emit('user_list', Object.values(room.users));
    console.log('[server] join ->', socket.id, 'room=', rid, 'users=', Object.keys(room.users).length);
  });

  // ---- CURSOR ----
  socket.on('cursor', ({ roomId, xPct, yPct }) => {
    const rid = socket.roomId || normalizeRoomId(roomId);
    if (!rid) return;
    socket.to(rid).emit('cursor', { socketId: socket.id, xPct, yPct });
  });

  // ---- PARTIAL STROKE ----
  socket.on('stroke:partial', (payload) => {
    const rid = socket.roomId;
    if (!rid) return;

    // normalize payload shape
    let stroke = null;
    if (!payload) return;
    if (Array.isArray(payload)) {
      const first = payload[0];
      stroke = first && (first.stroke || first);
    } else if (payload && payload.stroke) {
      stroke = payload.stroke;
    } else {
      stroke = payload;
    }

    // minimal validation / clamps
    if (!stroke || !stroke.id || !Array.isArray(stroke.points)) {
      console.log('[server] stroke:partial invalid from', socket.id);
      return;
    }
    if (typeof stroke.width !== 'number' || stroke.width <= 0) stroke.width = 4;
    stroke.width = Math.min(stroke.width, 60);
    if (stroke.points.length > 2000) stroke.points = stroke.points.slice(0, 2000);

    // forward to the room
    socket.to(rid).emit('stroke:partial', { stroke });
  });

  // ---- FINAL STROKE ----
  socket.on('stroke:final', (payload) => {
    const rid = socket.roomId;
    if (!rid) return;

    let stroke = null;
    if (!payload) return;
    if (Array.isArray(payload)) {
      const first = payload[0];
      stroke = first && (first.stroke || first);
    } else if (payload && payload.stroke) {
      stroke = payload.stroke;
    } else {
      stroke = payload;
    }

    if (!stroke || !stroke.id || !Array.isArray(stroke.points)) {
      console.log('[server] stroke:final invalid from', socket.id);
      return;
    }

    const room = getRoom(rid);
    if (!room) return;

    // ensure seq counter
    if (typeof room.nextSeq !== 'number') room.nextSeq = 1;

    const op = { seq: room.nextSeq++, type: 'stroke', op: stroke };
    room.history.push(op);
    saveRoomHistory(rid, room.history);
    io.to(rid).emit('op:new', op);

    console.log('[server] stroke:final stored seq=', op.seq, 'room=', rid, 'id=', stroke.id, 'pts=', stroke.points.length);
  });

  // ---- UNDO ----
  socket.on('undo', ({ roomId }) => {
    const rid = socket.roomId || normalizeRoomId(roomId);
    const room = getRoom(rid);
    if (!room) return;

    const undone = new Set();
    for (const o of room.history) {
      if (o.type === 'undo') undone.add(o.refId);
      if (o.type === 'redo') undone.delete(o.refId);
    }
    for (let i = room.history.length - 1; i >= 0; i--) {
      const e = room.history[i];
      if (e.type === 'stroke' && !undone.has(e.op.id)) {
        if (typeof room.nextSeq !== 'number') room.nextSeq = 1;
        const undoOp = { seq: room.nextSeq++, type: 'undo', refId: e.op.id, by: socket.id };
        room.history.push(undoOp);
        saveRoomHistory(rid, room.history);
        io.to(rid).emit('op:new', undoOp);
        console.log('[server] undo -> refId=', e.op.id, 'room=', rid);
        break;
      }
    }
  });

  // ---- REDO ----
  socket.on('redo', ({ roomId }) => {
    const rid = socket.roomId || normalizeRoomId(roomId);
    const room = getRoom(rid);
    if (!room) return;

    if (typeof room.nextSeq !== 'number') room.nextSeq = 1;

    for (let i = room.history.length - 1; i >= 0; i--) {
      const e = room.history[i];
      if (e.type === 'undo') {
        const redoOp = { seq: room.nextSeq++, type: 'redo', refId: e.refId, by: socket.id };
        room.history.push(redoOp);
        saveRoomHistory(rid, room.history);
        io.to(rid).emit('op:new', redoOp);
        console.log('[server] redo -> refId=', e.refId, 'room=', rid);
        break;
      }
    }
  });

  // ---- DISCONNECT ----
  socket.on('disconnect', () => {
    const rid = socket.roomId;
    if (!rid) return;
    const room = getRoom(rid);
    if (room && room.users[socket.id]) {
      delete room.users[socket.id];
      io.to(rid).emit('user_list', Object.values(room.users));
      console.log('[server] disconnect', socket.id, 'room=', rid);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('[server] listening on', PORT));