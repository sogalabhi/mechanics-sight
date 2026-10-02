# UX inventory (revamp step 1)

Source: `frontend/src` at commit 7cd0837 plus working tree. Visibility: **A** = always visible, **S** = appears on selection or interaction, **H** = hidden behind a menu or toggle.

## Shell (`App.tsx`, `App.module.css`)
Desktop grid: top bar / palette (184px) / canvas / inspector (300px) / status bar. At 1099px or less the palette shrinks to 56px. At 699px or less (phone) the palette is replaced by a floating "+ Add" button and a bottom sheet.

## Controls

| # | Item | File | Vis. | Where | Notes |
|---|---|---|---|---|---|
| 1 | Brand title | TopBar | A | top bar | |
| 2 | Length field | TopBar | A | top bar | **Duplicate** of "Beam Length" in the Inspector |
| 3 | Undo / Redo | TopBar | A | top bar | |
| 4 | Examples select | TopBar | A | top bar | Primary entry point, but buried in a dropdown |
| 5 | Share link | TopBar | A | top bar | |
| 6 | Download report | TopBar | A | top bar | Disabled until a result exists |
| 7 | View menu (8 items) | ViewMenu | H | top bar dropdown | Reactions, guides, calculus tangent, deflection, stress, AFD, dock HUD, Virtual saw, Reset |
| 8 | Theme select | TopBar | A | top bar | Rarely used; belongs in an overflow menu |
| 9 | Palette (supports, loads) | Palette | A | left | Drag or click to add |
| 10 | Phone: burger, drawer | TopBar | A (phone) | top bar | Contains all of 2, 4-8 |
| 11 | Phone: "+ Add" button and sheet | AddSheet | A (phone) | floating, bottom-right | Hidden while an item is selected |
| 12 | Hint line "Drag supports and loads · ..." | CanvasStack | A | above beam | Static text, permanent clutter |
| 13 | Banner (errors) | Banner | S | top of canvas | |
| 14 | Beam with supports, loads, reactions | BeamView | A | canvas | Selectable, draggable |
| 15 | Crosshair and hover/pin HUD | Crosshair | S | over beam and diagrams | |
| 16 | Axial diagram (AFD) | DiagramPanel | S | canvas | Auto-shown only if axial force is non-zero |
| 17 | SFD, BMD | DiagramPanel | A (when solved) | canvas | |
| 18 | Elastic curve | ElasticCurvePanel | A (when solved) | canvas | Needs material and section for physical values |
| 19 | Bending stress panel | StressPanel | A (when solved) | canvas | |
| 20 | Empty-state card | EmptyDiagramState | A (when no result) | canvas | Add cantilever or try example |
| 21 | **Integration card** | IntegrationCard | S | **floats over canvas** (z 40) | Appears on drag-selecting a range. Dockable to the sidebar |
| 22 | **Virtual Saw card** | VirtualSawCard | S | **floats over canvas** (z 45), top-right, 460px | Opens via the `S` key or the View menu. Dockable |
| 23 | Dock/Float toggle | both cards, ViewMenu | H | | One global preference, set in three places |
| 24 | Inspector, no selection ("Beam Properties") | Inspector | A | right | Length, counts, hint |
| 25 | Inspector, item selected | Inspector | S | right (phone: bottom sheet) | Position, magnitude, direction, from-right toggle, delete |
| 26 | Material & section | PhysicalProperties | A | right | Select inputs, tables, buttons |
| 27 | Results: reactions, extremes, zero shear | Results | A (when solved) | right | Rows are click-to-pin |
| 28 | Results: deflection, bending stress, shear stress | Results | S | right | Rows are click-to-pin |
| 29 | Canonical card | CanonicalCard | S | right, inside Results | Indeterminate beams only |
| 30 | Working panel (Show/Hide working) | WorkingPanel | H | bottom of Results | Method select, step list with maths |
| 31 | Status bar (x, V, M) | StatusBar | A | bottom | Duplicates the crosshair readout |
| 32 | Sign convention popover | SignConvention | H | status bar | Popover opens upward |
| 33 | Keyboard: Esc, S, undo/redo | CanvasStack, useShortcuts | H | | Undiscoverable except via the hint line |

## Problems found

1. **Two cards float over the beam and diagrams** (#21, #22). This is what the revamp must eliminate. The dock preference partly works around it, but the default is floating.
2. **The right pane is a long stack, not contextual.** Inspector, Material & section, and Results (with Working) are always stacked. On a phone, Results and Material sit above the canvas pane's content.
3. **Duplicates:** beam length (#2, #24), cursor values (#15, #31), dock toggle (#23).
4. **Eight view toggles live in a dropdown** (#7). Several belong with the view they control (e.g. deflection and stress panel toggles belong on those panels' headers).
5. **Selection state is spread over the store but not unified.** `selectedId`, `pinnedX`, `hoverX`, `sawCutX` and `integrationRange` are already central in `store.ts`, so step 4 is smaller than expected. Missing: selected fibre/y for the stress view, which is probably local to the stress and saw components.
6. **The hint line is permanent** (#12) and the Esc, S and drag-range gestures are otherwise undiscoverable (#33).
7. **First-run path** is the empty-state card plus an Examples dropdown. It's not "Try an example" / "Start a beam" as in step 6 of the plan.
8. **Test coverage:** only `e2e/drag.spec.ts` exists. The revamp needs the golden-case Playwright tests (plan step 8) before big moves.

## Proposed placement (input to step 2)

- **Top bar:** brand, Examples, Undo/Redo, Share, Report, one overflow menu (theme, reset, display toggles that are not tied to a panel).
- **Left:** palette (unchanged; phone keeps the Add sheet).
- **Centre:** beam plus diagram stack. Nothing floats here. Per-panel toggles go in each panel's header.
- **Right pane, contextual tabs or sections:** Inspector (when an item is selected) → Section cut (Virtual Saw and Integration, replacing both floating cards) → Results → Material & section → Working.
- **Status bar:** keep, and drop what the pane makes redundant.
