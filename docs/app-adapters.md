# Bring real UI into a film

The kit supplies motion and rendering. A product demonstration needs authentic UI material and a small adapter for the states shown in the film.

## Choose the source

| Material | Approach | What to account for |
|---|---|---|
| React or web UI source | Reuse components and styles; wrap them in frame-driven state | Product dependencies may need local stubs |
| Screenshots or exported layers | Animate the supplied image or layers with the camera | Only captured states are available |
| Screen recording | Trim and frame the recording; add surrounding copy | The recorded cursor and timing constrain edits |
| Native app without reusable web views | Capture states or record the actual workflow | A hand-built recreation is an approximation |

Prefer a small, documented component dependency graph over importing the whole live application. Record the source version. Replace account, network, clock, and event dependencies with local demonstration state while preserving the actual visual behavior.

## Adapter inputs

Expose what the scene uses: text, caret visibility, selected option, active tab, expanded menu, enabled toggle, hover target, pressed target, result data, and dialog visibility. Derive those values from time. Seeking directly to the Save frame must show the correct selection even when preceding frames were never rendered.

If a component only reads a prop during initialization, use a controlled wrapper or remount it with a key for the discrete state. Avoid replaying browser events through timers. Use a deterministic caret when blink timing matters.

Keep a geometry map for control centers and important text origins. Measure the styled component at its intended layout. Recheck after copy or style changes. Popovers using a viewport portal and dialogs using the browser top layer may need a film-only inline adapter so they follow the camera.

## Typography and styles

Scope imported product CSS so it does not reset the film's headings. Preserve the app's UI font size and proportions; use the camera to make details readable. Load fonts and styles before taking measurements. A field measured before its CSS arrives can retain the wrong height on a direct frame seek.

Put shipped assets under `public/` and use `staticFile` or the kit's local asset helper. Preserve actual logo vectors. Brand-specific settings and adapter code belong with the project, not inside shared motion components.

## Real behavior and staged data

Use fictional names, requests, replies, and sample files when appropriate. Record these as demonstration data. Do not imply a live result or successful verification when the scene only depicts an illustrative state.

Make product claims from its implementation or supplied documentation. A permission setting, encrypted connection, or local folder selector does not automatically establish a broader security guarantee. If a scene simplifies several actual controls into one visual, document that adaptation and keep the meaning accurate.

## Integration check

Render before and after each state change, plus the click frame. Confirm that the cursor tip intersects the target, hover/press/selection appear in order, labels fit, and direct seeking gives the right state. Then review a short encoded sequence with the camera motion. Rendered demonstrations should not send requests to production accounts.
