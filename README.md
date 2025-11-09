# 🖌️ Collaborative Canvas

A real-time collaborative drawing application built with Vanilla JavaScript, HTML5 Canvas, and Socket.io. Multiple users can draw together on the same canvas in real-time.

## ⚙️ Setup Instructions

1. Clone the repository:
```bash
git clone https://github.com/yourusername/collaborative-canvas.git
cd collaborative-canvas
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open in browser:
- Navigate to http://localhost:3000
- Enter a room name when prompted (e.g., "team1", "projectA")

## 👥 Testing with Multiple Users

1. Launch multiple browser tabs/windows pointing to http://localhost:3000
2. Enter the same room name in each tab to join the same drawing session
3. Test the following features:
   - Real-time drawing synchronization across tabs
   - User cursor positions shown as colored dots
   - Undo/Redo functionality (affects all users)
   - Different brush colors and sizes
   - Eraser tool
   - Theme toggle (dark/light mode)

## 🐛 Known Limitations & Bugs

1. **Performance Limitations**
   - Optimized for small-medium sessions (~10 users)
   - High concurrency may cause frame rate drops
   - Large stroke history can impact memory usage

2. **Missing Features**
   - No shape tools (rectangles, circles, etc.)
   - No layer system for drawing
   - No image export/import
   - No persistence (drawings lost on server restart)

3. **Security Considerations**
   - No user authentication
   - No access control for rooms
   - Anyone can join any room and modify drawings

4. **Browser Compatibility**
   - Requires modern browser with Canvas and Pointer Events support
   - Touch input behavior may vary across devices

## ⏱️ Development Time

Total project duration: 5-6 days
- Initial setup & core drawing: 2 days
- Real-time sync & Socket.io: 1.5 days
- UI/UX & tools implementation: 1 day
- Testing & bug fixes: 0.5-1 day

## 🛠️ Tech Stack

- Frontend: Vanilla JavaScript, HTML5 Canvas
- Backend: Node.js, Socket.io
- No external dependencies for drawing functionality