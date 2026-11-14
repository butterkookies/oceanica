# Oceanica Project Memory

Live 2.5D / 3D Aquarium Simulator built with React 19, Vite, TypeScript, Three.js / React Three Fiber, and Koota ECS, paired with a Studio Ghibli cel-gouache dynamic sprite pipeline.

- **Repository:** `https://github.com/butterkookies/oceanica.git` (branch `main`)
- **Initial Code & Assets Commit:** `bfed42d` (`155` files)
- **Verification Baseline (2026-11-14):**
  - `npm test` (`vitest run`): **5 / 5** tests passed in `src/ecs/__tests__/simulation.test.ts`
  - `npm run build` (`tsc --noEmit && vite build`): exited `0` (`dist/` built in `2.53s`)

## Session Logs

| Session | Date (UTC+8) | Focus | Summary |
| :--- | :--- | :--- | :--- |
| [Session 01](./session-01-foundation-and-ecs-engine.md) | 2026-11-13 | Research, Dual-Mode Architecture & Core ECS/3D Scaffold | Compiled Koi, Betta, Goldfish, Snail, and epiphyte plant data; designed Koota ECS (`sandbox` vs `realistic`) and 12-joint spine kinematics; scaffolded app & tests. |
| [Session 02](./session-02-pixel-art-shader-and-tank-polish.md) | 2026-11-13 | Retro Pixel Art Post-Process & Persistence | Implemented `PixelArtPass.tsx` (`WebGLRenderTarget` + `DepthTexture`, ACES Filmic, depth silhouettes, 4×4 Bayer dithering), `Crisp`/`Chunky` toggle, and glass/algae polish. |
| [Session 03](./session-03-ghibli-assets-and-dynamic-sprites.md) | 2026-11-14 | Art Direction Pivot, Studio Ghibli Cel-Gouache Sprite Atlases & GitHub Push | Locked 2.5D Studio Ghibli sunlit conservatory art direction; built `build_sprite_atlases.py` and `atlas.json` (302 frames/parts across 10 RGBA sheets + 86 poses); verified animations in Chromium; pushed to `main`. |

## Project Tracking

- [Architectural Decisions](./decisions.md)
- [Milestones & Next Steps](./milestones.md)
