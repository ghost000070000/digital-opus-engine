# Getting Started with Digital Opus Engine

Digital Opus Engine is a zero-dependency HTML5/WebGL2 game engine that builds down to a single self-contained JavaScript file (`opus-engine.js`). One script tag. No npm, no bundler, no build step required for engine users.

## 5 Minutes to Spinning Cube

Create an empty folder, add a single HTML file `index.html`, and drop in `opus-engine.js`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>My First Opus Game</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0a0e1a; }
  #game { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<script src="opus-engine.js"></script>
<script>
  // 1. Create engine instance bound to the canvas
  const canvas = document.getElementById('game');
  const app = Opus.create(canvas);

  // 2. Build a cube mesh primitive
  const cubeMesh = Opus.Mesh.cube();

  // 3. Add a lit spinning entity
  const spinner = app.addEntity({
    mesh: cubeMesh,
    color: [0.35, 0.65, 0.95],
    position: new Opus.Vec3(0, 0, 0),
  });
  spinner.spin = 1.0; // Spin rate in rad/sec

  // 4. Hold Space to make a visible input-driven change
  app.onUpdate(() => {
    spinner.color = app.input.isDown('Space')
      ? [0.95, 0.4, 0.35]
      : [0.35, 0.65, 0.95];
  });
</script>
</body>
</html>
```

Serve the folder over HTTP, then open it in your browser. For example, from the folder run `python -m http.server 8180` and visit `http://localhost:8180/`. The engine has no server component, but this avoids browser-specific `file://` storage and security restrictions.

## Browser Requirements

- **WebGL2 Support**: Required for shaders, instanced rendering, VAOs, and depth textures. Supported by all modern desktop and mobile browsers (Chrome, Firefox, Safari, Edge).
- **Web Audio API**: Audio requires user activation (click/tap) before starting audio context due to browser autoplay policies. Use `app.hud.showTitleCard(...)` or listen for a click/tap event to call `app.audio.resume()`.
- **Local Files (`file://`) vs Local Server**: `file://` behavior varies by browser and is not promised. Use a static HTTP server for storage, audio, and consistent security behavior.
