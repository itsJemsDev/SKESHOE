# Virtual Campus

A stylized, isometric 3D social campus built with Three.js, Vite, and a Node.js WebSocket presence server. Its connected districts include the central campus, commercial street, residences, recreation area, botanical garden, arts pavilion, and campus transit stop. Walk between eight landmarks, chat with other visitors, use emotes, and customize your avatar color.

## Run locally

```sh
npm install
npm run dev
```

Open the Vite address shown in the terminal (usually `http://localhost:5173`). The dev command starts the browser game and the local Node.js WebSocket server together. Open another browser tab at the same address to see live movement, chat, emotes, and campus interactions.

## Controls

- **WASD / arrow keys:** walk
- **Shift:** sprint
- **Space:** jump
- **Click or tap the ground:** walk to that spot
- **Drag:** orbit the camera; in free camera mode, drag to pan
- **Mouse wheel / touch pinch:** zoom
- **F:** cycle isometric, third-person, and free camera modes
- **M:** open the campus map
- **E:** interact when a zone prompt appears
- **Esc:** pause movement

The Node.js WebSocket server validates campus bounds and movement speed, limits chat and action rates, and relays temporary player presence. Offline sessions are labeled local mode and show no online players. Authentication, persistent accounts, voice, moderation, and production hosting are not included in this prototype.
