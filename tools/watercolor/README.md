# Watercolor still tool

Use this tool to turn a still into a watercolor background. Run `npm run watercolor -- public/demo/landscape-a.svg out/painted.png --width 1920 --height 1080 --blur 2` from the repository root. Run `npm run watercolor -- --help` for all settings. See [effects](../../docs/effects.md) for the real-time component and other looks.

`watercolor.mjs` validates input, bundles a dedicated one-frame composition, renders a PNG, and writes its settings sidecar. `watercolor.tsx` performs pre-blur before calling the paint renderer with pigment disabled and fixed time.

`paint/` is a self-contained snapshot of Taleframe's paint stage, captured on 2026-09-23. Six rendering modules retain the original algorithm and shaders; only type-only imports point to a small local `types.ts`. Byte hashes and source context are recorded in [PROVENANCE.json](PROVENANCE.json). The optional real-time effects component uses its own newer snapshot.

The package does not import the Taleframe editor, the larger compositor, or any absolute local paths. Separate pigment and prepared-frame types remain in the original renderer to keep its structure intact; the still entry point does not activate those optional stages.
