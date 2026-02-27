# SimpleCNC

**You don't need a pilot's license to engrave a wooden sign.**

Most CNC CAM software looks like it was designed by NASA engineers who got bored on a Sunday. 47 toolbars, 12 nested menus, a $500/year subscription, and a 200-page manual just to tell your router to cut a circle. You just wanted to engrave your cat's name on a cutting board. Why does it feel like you're programming a Mars rover?

SimpleCNC is the antidote. A 100% browser-based CAM tool for hobbyists who want to go from file to G-code without a PhD in mechanical engineering. No install. No account. No cloud. No tears.

## What it does

- **Import SVG** — Drop your 2D design, get engraving toolpaths. Bezier curves, arcs, the whole alphabet soup of SVG shapes.
- **Import STL** — Drop your 3D model, position/rotate/scale it visually, get 3D relief toolpaths via drop-cutter heightmap.
- **Configure your tool** — Flat end mill, ball nose, V-bit. Diameter, angle, feeds & speeds. That's it. No "advanced quantum milling parameters".
- **Preview in 3D** — See your toolpath before you burn a perfectly good piece of walnut.
- **Export G-code** — Download a `.gcode` file. Send it to your machine. Done.

Everything runs in your browser. Your files never leave your computer. The NSA doesn't need to know about your woodworking projects.

## Tech stack (for the curious)

| What | With what |
|------|-----------|
| UI | SvelteKit (static SPA) |
| 3D | Three.js |
| Polygon offset | Clipper2 |
| Heavy lifting | Web Workers |
| Tests | Vitest (214 unit tests) |
| Backend | lol |

## Getting started

```bash
git clone https://github.com/your-username/simplecnc.git
cd simplecnc
npm install
npm run dev
```

Open `http://localhost:5173`. Drop a file. Click buttons. Make sawdust.

## How it works

### SVG workflow (2D engraving)
1. Parse SVG shapes (paths, circles, rects, ellipses...)
2. Discretize curves into polylines (adaptive Bezier subdivision)
3. Offset paths by tool radius (so you don't cut ON the line)
4. Optimize travel order (nearest-neighbor, because life's too short for idle rapids)
5. Generate G-code

### STL workflow (3D relief)
1. Load STL mesh, let you position/rotate/scale it in the viewport
2. Drop-cutter algorithm: "drop" a virtual tool onto every triangle to build a heightmap
3. Zigzag raster across the heightmap
4. Generate G-code

### Supported tools
- **Flat end mill** — The sensible default
- **Ball nose** — For smooth 3D surfaces
- **V-bit** — For fine engraving and chamfers

## Roadmap / TODO

- [ ] Multi-pass depth support (roughing + finishing)
- [ ] Climb vs conventional milling option
- [ ] DXF import
- [ ] Tabs for cutouts (so your piece doesn't become a projectile)
- [ ] More toolpath strategies (spiral, contour-parallel)
- [ ] Undo/redo

## Contributing

Found a bug? Got an idea? Open an issue. PRs welcome.

Just keep it simple. The whole point is that this tool doesn't need 47 toolbars.

## License

MIT — Do whatever you want with it. Engrave the license text on a plaque if you feel like it.
