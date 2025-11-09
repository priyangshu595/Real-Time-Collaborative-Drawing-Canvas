// rooms.js - simple in-memory room for single shared canvas
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rooms = {};

function ensureDataDir() {
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function loadRoomHistory(roomId) {
  const dir = ensureDataDir();
  const filePath = path.join(dir, `${roomId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error('[rooms] Failed to load history for', roomId, err);
  }
  return [];
}

export function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: {},
      history: loadRoomHistory(roomId),
      nextSeq: 1
    };
    console.log(`[rooms] Created room "${roomId}" with ${rooms[roomId].history.length} saved strokes`);
  }
  return rooms[roomId];
}

export function getRoom(roomId) {
  return rooms[roomId];
}
