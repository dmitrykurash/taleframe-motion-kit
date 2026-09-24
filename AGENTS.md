# Working in Taleframe

For launches, app demos, and motion reels, read [.agents/skills/taleframe-motion-kit/SKILL.md](.agents/skills/taleframe-motion-kit/SKILL.md). If your tool does not discover local skills, read that file directly. Rendering does not require a specific coding-agent service.

Every film follows [film language](docs/film-language.md) unless the brief says otherwise: a launch film, not a keynote; read the requested style and commit to it; type shots and UI shots take turns (no captions over UI unless required or requested); big kinetic typography; hard cuts first, and designed transitions only with a reason.

- Read the brief and relevant example before editing. Put new-project content and UI adapters in their own files; keep shared components brand-neutral.
- Use the actual app's source, screenshots, or recordings for product demonstrations. Sample UI in the starter is illustrative. Do not invent a feature or claim that the app cannot support.
- Derive visible state from frame time. Keep camera, cursor, hover, click, UI selection, transition, and effect timing consistent during direct frame seeks.
- Keep assets and imports portable. A clean clone must not need a neighboring checkout or a path on the author's computer.
- Follow the user's scope and requested review points. Continue authorized work through delivery without adding blanket approval gates.
- For code changes, run `npm run check`. For films, inspect representative stills and action/transition frames, render the master, derive its preview, verify the encoded file, and inspect frames from that file.
- Keep credentials, account data, dependency folders, and temporary render caches out of version control. Record asset and product-source provenance where it matters.

The [README](README.md) has a copy-paste starting prompt. [Quick start](docs/quick-start.md) lists commands; [components](docs/components.md) maps the reusable API; [transitions](docs/transitions.md) and [effects](docs/effects.md) describe their supported settings.
