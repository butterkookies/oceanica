# Architectural & Creative Decisions

| Date | Decision | Rationale |
| :--- | :--- | :--- |
| 2026-11-13 | Shared single Koota ECS world for `sandbox` and `realistic` modes | Avoids maintaining split simulation engines; switching modes simply toggles rule enforcement in `ecosystemSystem.ts`. |
| 2026-11-13 | Distance-constrained 12-joint 3D spine chain (`movementSystem.ts`) | Eliminates stiff single-pivot fish rotation and naturally projects matching Side & Top tank views. |
| 2026-11-13 | Data-driven species & epiphyte catalogs (`src/registry/species.ts`, `src/registry/decor.ts`) | Enables drop-in custom fish morphs and non-rooted plants (`Anubias`, `Java Fern`) that fit digging coldwater fish + whimsical `Underwater Cactus`. |
| 2026-11-13 | Fullscreen `PixelArtPass.tsx` depth + Bayer dithering shader | Quick experiment to pixelate 3D geometry while keeping 3D spine curves intact. |
| 2026-11-14 | Asset-first pivot to **Crisp 2.5D Studio Ghibli Cel-Gouache** (`public/assets/sprites/`) | User disliked initial procedural/pixel 3D visuals; generated cohesive `Ponyo`-style multi-growth, multi-angle, multi-action RGBA sheets and verified animations before editing `src/`. |
| 2026-11-14 | Canonical `-X` (nose-left) `256 × 176` atlas packing with exterior flood-fill decontamination | Preserves pure white scales/bellies and translucent fins without cream paper halos over pale turquoise pond backdrops. |
