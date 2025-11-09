// websocket.js — simple socket.io client wrapper
(function(){
  const socket = io();
  window.socket = socket; // for debug

  const Network = {
    join(roomId, userName) { socket.emit('join', { roomId, userName }); },
    on(event,fn){ socket.on(event,fn); },
    emitCursor(roomId, u) { socket.emit('cursor',{roomId, xPct:u.x, yPct:u.y}); },
    emitStrokePartial(roomId, stroke) { socket.emit('stroke:partial',{roomId, stroke}); },
    emitStrokeFinal(roomId, stroke) { socket.emit('stroke:final',{roomId, stroke}); },
    emitUndo(roomId){ socket.emit('undo',{roomId}); },
    emitRedo(roomId){ socket.emit('redo',{roomId}); }
  };

  window.Network = Network;
})();