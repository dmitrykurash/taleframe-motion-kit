# Transition checks

The initial kit was checked on macOS with Chromium ANGLE on 24 September 2026.

- All 20 native transition shaders compiled and rendered at 1920 × 1080 in the gallery.
- The first and last frames of every shader matched the two source pictures exactly in a 320 × 180 GPU test.
- Rendering the same middle frame again after four out-of-order seeks produced identical pixels for every shader.
- The 20 gallery stills were inspected together: the pictures were upright, each effect rendered, and labels stayed above the transition.
- Unit checks cover the 20-module inventory, source hashes, parameter defaults and limits, frame evaluation, input errors, and image fit.

To repeat the checks:

```sh
npm run check
node tests/transitions-gpu.mjs
```

The second command writes full-resolution stills, an HTML review page, and the numeric GPU report into `out/transition-qa/`. The small GPU probe uses simple colored source pictures so endpoint and repeatability errors are easy to detect. Review the gallery stills as well; numerical checks do not replace looking at your final film.

These results establish the bundled snapshot’s behavior in this environment. Different GPU drivers may vary slightly in intermediate pixels. Check a short render on the machine that will export your film.
