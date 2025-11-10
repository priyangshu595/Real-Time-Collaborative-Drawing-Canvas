# 🎨 Collaborative Canvas

A real-time collaborative drawing application that lets multiple users draw together on a shared canvas. Built with Vanilla JavaScript, HTML5 Canvas, and Socket.io.

## 🌐 Live Demo

🚀 Try the app here: [Collaborative Canvas on Render](https://real-time-collaborative-drawing-canvas-qnar.onrender.com/)
> 🖥️ Open this link in multiple browser tabs to test real-time collaboration.

## 🌟 Features

✅ Real-time Drawing Sync - See others draw in real-time  
✅ Multi-User Rooms - Create or join drawing sessions  
✅ Drawing Tools - Brush, eraser with size control  
✅ Color Selection - Full RGB color picker  
✅ User Indicators - See where others are drawing  
✅ Global Undo/Redo - Changes reflect across all users  
✅ Theme Toggle - Dark/Light mode support  
✅ Touch Support - Works on tablets/touch devices  

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [System Components](#system-components)
- [Usage Examples](#usage-examples)
- [Technical Details](#technical-details)
- [Testing](#testing)
- [Project Structure](#project-structure)

## 🚀 Installation

### Prerequisites

- Node.js 14 or higher
- npm (Node package manager)
- Modern web browser

### Setup

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

4. Access the application:
   - Open http://localhost:3000
   - Enter room name when prompted

## ⚡ Quick Start

```bash
# 1. Clone and install
git clone https://github.com/yourusername/collaborative-canvas.git
cd collaborative-canvas
npm install

# 2. Start server
npm start

# 3. Open in multiple browsers
http://localhost:3000

# 4. Enter same room name to collaborate
# 5. Start drawing!
```

## 🏗️ Architecture

### System Components

```
┌─────────────────────┐      ┌──────────────────┐
│  Browser Client 1   │      │ Browser Client 2  │
│  - Canvas          │      │ - Canvas         │
│  - Socket.io Client│      │ - Socket.io Client│
└────────┬────────────┘      └────────┬─────────┘
         │                            │
         │        WebSocket           │
         │                            │
         ▼                            ▼
┌────────────────────────────────────────┐
│            Socket.io Server            │
│     - Room Management                  │
│     - Event Broadcasting               │
│     - User Tracking                    │
└────────────────────────────────────────┘
```

### Data Flow

1. User draws on local canvas
2. Points normalized to percentages
3. Sent via WebSocket
4. Server broadcasts to room
5. Other clients render in real-time

## 💻 Usage Examples

### Basic Drawing

```javascript
// Start drawing
canvas.addEventListener('pointerdown', startDrawing);

// Continue stroke
canvas.addEventListener('pointermove', draw);

// End stroke
canvas.addEventListener('pointerup', endDrawing);
```

### Room Management

```javascript
// Join drawing room
Network.join('roomName', 'userName');

// Send stroke update
Network.emit('stroke:partial', strokeData);

// Receive updates
Network.on('stroke:partial', handleStroke);
```

## 🔧 Technical Details

### Canvas Optimization

- Device pixel ratio aware
- Throttled network updates
- Linear interpolation
- Incremental stroke streaming

### Conflict Resolution

- Last-writer-wins for strokes
- Global operation ordering
- Server-side room management

## 🧪 Testing

### Multi-User Testing

1. Open multiple browser windows
2. Join same room
3. Test concurrent drawing
4. Verify synchronization

### Performance Testing

- Test with 5+ users
- Rapid stroke creation
- Large continuous strokes
- Cross-browser compatibility

## 📁 Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html      # Main HTML
│   ├── styles.css      # Styling
│   ├── main.js         # Entry point
│   ├── canvas.js       # Canvas logic
│   └── network.js      # Socket.io client
├── server/
│   ├── index.js        # Server entry
│   └── rooms.js        # Room management
├── package.json        # Dependencies
└── README.md          # Documentation
```

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