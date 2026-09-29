# UI / UX Design — Phase 1.5 and 1.6

This is the detailed design for the web app: layout, drawing symbols, interactions, diagrams and the React structure. It extends `plan.md` Section 11. Where the two disagree, this file wins for UI matters.

---

## 1. Design direction

**The app should look like an engineering drawing, not a marketing page.** The reference points are a well-drawn textbook figure (Hibbeler, Gere), a drafting sheet, and the calm, dense feel of a CAD or structural-analysis tool.

Principles:
- **Ink on paper.** The beam, supports and dimensions are drawn in ink (near black). Colour is used only where it carries meaning: applied loads, reactions, the SFD and the BMD.
- **Hairlines, not cards.** Panels are separated by 1px rules. There are no floating cards with big shadows.
- **Standard symbols, drawn to fixed rules.** Every symbol has exact geometry (Section 4). Nothing is an icon-font stand-in.
- **Numbers are first-class.** A monospace font with tabular figures, a true minus sign (−), units always shown, and fixed decimals.
- **Dense and left-aligned.** Information sits where an engineer expects it. There is no centred hero area and no illustration.

Explicitly **not** allowed (the generic "AI-generated" look):
- gradients, glassmorphism, glowing borders, large drop shadows
- purple/indigo default palettes
- emoji in the UI
- rounded-2xl pill-shaped everything
- marketing copy ("Unleash the power of…")
- empty-state illustrations
- animated number counters, or bouncy or morphing transitions on data

### 1.1 Typography
- UI: **IBM Plex Sans** 13px base (12px for dense tables, 11px uppercase letter-spaced for panel titles).
- Numbers, coordinates, magnitudes: **IBM Plex Mono** 12px with `font-variant-numeric: tabular-nums`.
- Self-hosted via `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`. No external font requests.

### 1.2 Colour tokens (`styles/tokens.css`)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | `#FAFAF8` | `#111315` | Canvas background |
| `--panel` | `#FFFFFF` | `#181B1E` | Side panels, beam fill |
| `--ink` | `#1B1F24` | `#E4E7EA` | Beam, supports, dimensions, text |
| `--ink-2` | `#5B636E` | `#9AA3AE` | Secondary text, axis labels |
| `--rule` | `#D8DCE1` | `#2B3035` | Panel separators, axes |
| `--grid` | `#EDEFF1` | `#1D2125` | Diagram grid lines |
| `--load` | `#B42318` | `#F97066` | Applied loads (forces, couples, distributed) |
| `--reaction` | `#175CD3` | `#53B1FD` | Solved reactions |
| `--shear` | `#0E7490` | `#22B8CF` | SFD curve and fill |
| `--moment` | `#2F6F3E` | `#5FC27E` | BMD curve and fill |
| `--select` | `#175CD3` | `#53B1FD` | Selection outline, handles, focus ring |
| `--danger` | `#B42318` | `#F97066` | Invalid ghost, error banner |
| `--warn` | `#B54708` | `#FDB022` | Indeterminate (unsupported) badge |

Dark mode follows `prefers-color-scheme`, and there is a manual toggle in the ⋯ menu (`data-theme` on `<html>`).

### 1.3 Spacing and shape
- 4px spacing grid. Border radius 4px on inputs and buttons, 0 on panels.
- Borders 1px `--rule`. Focus ring: 2px `--select` with a 1px offset.
- Default stroke widths in drawings: beam and supports 1.5px, hatching 1px, arrows 1.5px, dimensions 1px, diagram curves 1.75px.
- All strokes use `vector-effect: non-scaling-stroke` and are aligned to half pixels, so hairlines stay crisp.

---

## 2. Layout

### 2.1 Desktop (≥ 1100px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Mechanics Sight │ Length [ 6.000 ] m │ ↶ ↷ │ Examples ▾ │ Share │ ⋯               │ 48px
├────────────┬───────────────────────────────────────────────────┬─────────────────┤
│ PALETTE    │ BEAM                                              │ INSPECTOR       │
│            │        10 kN                                      │ Point load      │
│ SUPPORTS   │          │      2 kN/m                            │ Position        │
│  △ Pin     │          ▼   ┌┬┬┬┬┬┬┬┬┐                           │  (•) from left  │
│  ⊙ Roller  │  ▕════════════════════════════════▏               │  [ 3.000 ] m    │
│  ▯ Fixed   │  △                               ⊙                │ Direction       │
│            │  ├── 3.000 ──┼──── 3.000 ────────┤                │  [↓ Down|↑ Up]  │
│ LOADS      │  ├──────────── L = 6.000 m ──────┤                │ Magnitude       │
│  ↓ Point   │───────────────────────────────────────────────────│  [ 10.000 ] kN  │
│  ↺ Moment  │ SHEAR FORCE  V (kN)                               │ ─────────────── │
│  ▭ UDL     │   +5 ┌──────┐                                     │ RESULTS         │
│  ◺ UVL     │   0 ─┘      │      ┌─                             │ ● Determinate   │
│  ⏢ Trapez. │             └──────┘ −5                           │ Reactions       │
│            │───────────────────────────────────────────────────│  s1  Fy +5.000  │
│            │ BENDING MOMENT  M (kN·m) · sagging +              │  s2  Fy +5.000  │
│            │            ╱╲ 15.000                              │ Extremes        │
│            │   0 ──────╱──╲──────                              │  M max +15.000  │
│            │                                                   │    at 3.000 m   │
├────────────┴───────────────────────────────────────────────────┴─────────────────┤
│ x = 2.350 m    V = +5.000 kN    M = +11.750 kN·m          Sign convention ⓘ      │ 28px
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Palette** is 184px wide, the **Inspector/Results** column is 300px, and the canvas fills the rest.
- **All three canvas panels (beam, SFD, BMD) share one x-scale and one 64px left gutter**, so x lines up exactly across them. The gutter holds the y-axis ticks for the diagrams, and is empty in the beam panel.
- Canvas heights: beam panel 260px, SFD 190px, BMD 190px. If the window is taller, the diagrams grow and the beam panel stays fixed.
- Panel titles are uppercase 11px letter-spaced `--ink-2` text at the top-left of each panel, for example "SHEAR FORCE V (kN)".

### 2.2 Narrower screens
- **700–1099px:** the Inspector/Results column becomes a right-hand drawer, opened when something is selected or from a "Results" tab. The palette collapses to a 56px icon rail with tooltips.
- **< 700px (phone):** the palette moves to a bottom toolbar. The diagrams are stacked full width, and the inspector is a bottom sheet. Drag works through pointer events; a tap on a palette item adds it at the beam's midpoint.
- The layout never scrolls horizontally. The canvas redraws on resize using a `ResizeObserver`.

### 2.3 Beam panel, vertical zones (from the top)

| Zone | Height | Contents |
|---|---|---|
| Load zone | 120px | Point loads, couples and distributed loads, stacked in lanes (4.6) |
| Beam | 10px | The beam rectangle |
| Support zone | 40px | Support symbols, reaction arrows (results overlay) |
| Dimension zone | 60px | Chain dimensions and the overall-length dimension with its drag handle |

Horizontal padding inside the plot area is 48px on each side. That leaves room for fixed-wall hatching and labels at x = 0 and x = L.

---

## 3. Shared x-scale

- `xScale = scaleLinear().domain([0, L]).range([gutter + 48, width − 48])`
- It comes from a React context (`<XScaleProvider>`), which the beam view, both diagrams, the crosshair and the drag layer all read.
- When L changes, the scale changes: the beam keeps its on-screen width and the contents rescale. This is the expected behaviour for a drawing. It also means the right end of the beam stays under the pointer while you drag it (Section 6.4 describes how).

---

## 4. Drawing symbols (exact geometry)

All symbols are React components that return an SVG `<g>`. Coordinates are in px, with the origin at the attachment point. **The beam centreline is y = 0 and y increases downward** (SVG convention). The beam's top face is y = −5 and its bottom face is y = +5.

Every symbol takes the same state prop: `default | hover | selected | ghost | invalid`.
- `hover`: the stroke gets 0.5px thicker.
- `selected`: the stroke turns `--select`, and handles appear.
- `ghost`: 55% opacity (used while dragging from the palette).
- `invalid`: `--danger` stroke, 55% opacity.

### 4.1 Hatching (shared helper)
The standard drafting sign for "fixed to the ground": short parallel strokes at 45°, 1px, `--ink`.
- `<Hatch x1 y1 x2 y2 side="below|left|right" spacing={6} length={7} />`
- The strokes are drawn as explicit `<line>`s, not an SVG `<pattern>`, so they stay crisp and line up with the ground line's ends.

### 4.2 Beam
- A rectangle from x = 0 to x = L (in scale px), y from −5 to +5, filled `--panel`, with a 1.5px `--ink` stroke.
- When the beam is selected or hovered near its right end, a **length handle** appears: a 10×10 square outline centred at the right end on the centreline.

### 4.3 Pin (hinged) support
Placed below the beam, with its apex touching the beam's bottom face.

```
        ○            ← pin: circle r = 3 at (0, 5), fill --paper, stroke --ink
       ╱ ╲
      ╱   ╲          ← triangle: apex (0, 5), base corners (±12, 25)
     ╱_____╲
  ─────────────      ← ground line: (−18, 25) → (18, 25)
  ╱╱╱╱╱╱╱╱╱╱╱╱       ← hatch below: from (x, 25) to (x − 6, 31), x = −15 … 18, step 6
```

### 4.4 Roller support

```
       ╱ ╲           ← triangle: apex (0, 5), base corners (±12, 18)
      ╱___╲
      ○   ○          ← rollers: circles r = 3.5 at (−6, 21.5) and (6, 21.5)
  ─────────────      ← ground line at y = 25, from −18 to 18
  ╱╱╱╱╱╱╱╱╱╱╱╱       ← hatch below, as for the pin
```

The triangle with rollers on a hatched ground is the textbook form. It makes clear that the roller rolls on something fixed.

### 4.5 Fixed support
Allowed only at x = 0 or x = L. It is drawn as a wall that the beam is built into.

At the left end (the right end is its mirror image):
```
  ╲│
  ╲│
  ╲│══════════      ← wall: vertical line at x = 0 from y = −24 to y = +24, stroke 2px
  ╲│                ← hatch on the outside: from (0, y) to (−7, y + 7), y = −24 … 18, step 6
  ╲│
```

The beam rectangle starts exactly at the wall line.

### 4.6 Point load
- The arrow has a **fixed length (48px)**, and its size does not depend on the magnitude. The number is in the label. Arrows scaled to magnitude mislead when loads differ a lot, and textbooks don't scale them either.
- **Downward** (magnitude < 0): the shaft runs from (0, −53) to (0, −5), so the tip touches the beam's top face.
- **Upward** (magnitude > 0): drawn in the load zone too. The tail sits on the beam's top face (0, −5), and the head is at (0, −53), pointing up. This keeps every applied load above the beam, so loads never collide with support symbols.
- Arrowhead: a filled triangle 9px long and 8px wide, `--load`.
- Label: at the tail end (above the arrow), mono 12px `--load`, for example `10 kN` (magnitude only, since the arrow shows the direction).
- A small hit area 16px wide covers the whole arrow, to make grabbing easy.

### 4.7 Couple (applied moment)
- A small dot (r = 2) on the beam centreline marks the point of application.
- The arc has radius 16, centred on the dot, and runs **240° with the gap at the bottom** (from 210° to −30°, measured anticlockwise from +x), so it never overlaps a support below.
- An arrowhead at one end of the arc shows the sense:
  - **Anticlockwise** (magnitude > 0): the head is at the right end, pointing up and then left around the top.
  - **Clockwise** (magnitude < 0): the head is at the left end.
- Label above the arc: `12 kN·m`.

### 4.8 Distributed loads (UDL, UVL and trapezoidal: one component)
They are drawn the way a textbook draws them: a load profile on top, with a row of arrows down to the beam.

```
            3 kN/m
  2 kN/m      ┌─┐        ← labels: one at each end for UVL or trapezoidal, one centred for a UDL
  ┌───────────┘ │        ← profile top line, 1.5px --load
  │ ↓  ↓  ↓  ↓  ↓│        ← arrows every ~18px, always including both ends
  └─────────────┘        ← sits on the beam top face (y = −5)
```

- **Profile:** the polygon (xs, −5) → (xs, −5 − h₁) → (xe, −5 − h₂) → (xe, −5). The top edge is a 1.5px `--load` line, the side edges are 1px, and the fill is `--load` at 8% opacity.
- **Heights:** h = 10 + 34·|w| / w_max, where w_max is the largest |w| over *all* distributed loads on the beam. Loads can then be compared by eye. At an end where w = 0 the height is 0, which gives a proper triangle for a UVL.
- **Arrows:** n = max(2, round(width / 18) + 1) arrows, spaced evenly with the first and last at the ends. Each runs from the top line down to the beam, with a 6px head. An arrow is left out where the local height is under 8px (near a triangle's point).
- **Upward distributed loads** follow the point-load rule: the profile sits above the beam, and the arrows start at the beam and point up.
- **Labels:**
  - UDL: one label centred above the profile, for example `2 kN/m`.
  - UVL or trapezoidal: one label above each end. A zero end has no label.
- **Name in the inspector:** the name follows from the values: "UDL" when w₁ = w₂, "UVL" when one end is 0, "Trapezoidal" otherwise.

### 4.9 Lanes (overlapping loads)
- **Distributed loads** are packed into lanes: sort by start, then place each load in the lowest lane where it doesn't overlap an existing load. Lane k is lifted by the tallest profile of the lanes below it, plus 14px.
- **Point loads and couples** are drawn in front of the distributed loads. If two labels would overlap horizontally, the later one moves up by 14px.
- If the stack is taller than the 120px load zone, the load zone grows. The panel never clips a load.

### 4.10 Reactions (results overlay)
- Reactions are drawn in `--reaction`, below the support symbols. They are on by default and can be switched off with "Show reactions" in the Results panel.
- **Vertical reaction:** an arrow 36px long below the support's hatching, pointing up for a positive reaction and down for a negative one. The label reads `5.000 kN`.
- **Moment reaction** (fixed support): an arc of radius 18 beside the wall on the beam side, with its label.
- Horizontal reactions are drawn only when they are not zero, which never happens in Phase 1.
- Reactions are **never** confused with applied loads: they have a different colour and sit below the beam.

### 4.11 Dimension chain
It follows the drafting convention.
- **Extension lines:** thin 1px `--ink-2` lines. They start 4px below the support zone and end 4px past their dimension line.
- **Chain dimension line** at y = +70: 45° tick marks at every *key point*: 0, L, supports, point loads, couples, and the ends of distributed loads.
  - The length of each segment is written centred above the line, in mono 11px, for example `3.000`.
  - Segments narrower than 28px show their text only on hover.
- **Overall dimension line** at y = +92: arrowheads at both ends, labelled `L = 6.000 m`. Its **right end is the length drag handle** (6.4).

### 4.12 Internal hinge (Phase 2, designed now, not built)
In textbooks there are two different things called a "hinge":
- A **hinged support** is the pin support in 4.3: triangle, ground line and hatching.
- An **internal hinge** is a joint *inside* the beam, drawn as an open circle, r = 4, on the centreline. The beam rectangle is broken on either side of it.

---

## 5. Palette

- Two groups: **Supports** (Pin, Roller, Fixed) and **Loads** (Point load, Moment, UDL, UVL, Trapezoidal).
- Each entry is 36px tall: a 28×28 preview on the left, and the name in 13px on the right.
- **Previews are the real symbol components**, drawn small in the same style, not a separate icon set.
- An entry is dragged onto the beam (Section 6.1). A click or Enter adds the item at a sensible default spot and selects it. That also makes the palette usable from the keyboard.
- Default values when an item is added:

| Item | Default |
|---|---|
| Pin, roller | At the drop position |
| Fixed | The nearest beam end (it snaps there) |
| Point load | 10 kN downward |
| Moment | 10 kN·m anticlockwise |
| UDL | 5 kN/m downward, 2 m wide, centred on the drop point (clamped to the beam) |
| UVL | 0 → 5 kN/m downward over 2 m |
| Trapezoidal | 2 → 5 kN/m downward over 2 m |

- After a drop, the new item is selected, and the inspector's magnitude field is focused with its text selected, so the next keystroke replaces the value.

---

## 6. Interactions

### 6.1 Drag from the palette
- It uses **pointer events**, not HTML5 drag and drop, so it works the same with a mouse, a pen or touch, and we fully control the ghost.
- **Pointer down + 4px move:** a ghost of the real symbol follows the pointer.
- **Over the beam panel:** the ghost jumps onto the beam line (its y is fixed), and x follows the pointer with snapping (6.3). A dashed vertical guide line runs through all three panels at the ghost's x, with an `x = 2.350 m` pill above the pointer.
- **Invalid positions** show the ghost in the `invalid` state, with a tooltip giving the reason:
  - a support dropped where another support already is: "A support is already at 3.000 m"
  - a fixed support away from an end, when the pointer is more than 12% of L from both ends: "Fixed supports go at a beam end". Inside that distance, the ghost snaps to the end.
- **Drop on a valid spot** adds the item (one undo step) and selects it. **Drop outside the beam panel, or Esc,** cancels.

### 6.2 Moving and resizing items
- **Point items** (supports, point loads, couples) can be dragged anywhere on the symbol. Movement is along x only.
- **Distributed loads:**
  - dragging the body moves the whole load
  - dragging one of the two square end handles (8×8, on the beam top face) resizes it
  - a load can't be resized to less than 1 mm, and an end handle can't cross the other end
- A fixed support can't be dragged away from its end, but it can be moved to the other end. The drag shows the invalid ghost in between.
- **Live update:** while dragging, the symbol moves instantly from `draft`, and the diagrams update through the throttled API (plan Section 11: 80 ms throttle, sequence numbers and `AbortController`).
- **Commit on release.** One drag is one undo step.

### 6.3 Snapping (from the plan, with its visual feedback)
- **Snap to key points first.** These are 0, L, supports, and load positions and ends. The snap applies when the pointer is within 8px. The target point shows a small 6px ring in `--select`, and the guide line becomes solid.
- **Otherwise snap to the grid.** The grid step is a 1-2-5 value close to L/100, never less than 1 mm. The current step is shown in the status bar ("grid 0.05 m").
- **Hold Alt** to turn snapping off. Positions are still rounded to 1 mm.

### 6.4 Changing the beam length (live)
The length can be changed two ways:
- **Typing** in the top bar's `Length` field. It commits on Enter or blur, and Up/Down arrows step by the grid.
- **Dragging the length handle** at the right end of the overall dimension line.

While the handle is dragged, the scale is held fixed, so the handle stays under the pointer. The scale re-fits when the pointer is released.

**Anchoring rule** (what happens to items when L changes):
- Items at x = L (within tolerance) are **anchored to the right end** and move with it. That covers a roller at L, a load at L, a distributed load ending at L (it stretches), and a fixed support at L.
- All other items keep their absolute x.
- L can't be made smaller than the right-most non-anchored position + 0.1 m. The handle stops there, and a tooltip says why.
- L is kept within 0.1–1000 m (the API limit).

### 6.5 Selection and keyboard

| Action | Keys |
|---|---|
| Select | Click the item. Tab / Shift+Tab move through items in x order |
| Deselect | Esc, or a click on empty canvas |
| Move the selected item by one grid step (×10 with Shift) | ← / → |
| Delete | Delete or Backspace |
| Undo / redo | Ctrl/⌘ + Z, and Ctrl/⌘ + Shift + Z or Ctrl + Y |
| Duplicate at the next free grid spot | Ctrl/⌘ + D |
| Unpin the crosshair | Esc |

Every symbol can take keyboard focus, and has an accessible name such as "Pin support at 0.000 m" or "Point load 10 kN down at 3.000 m".

### 6.6 Inspector (right column, top)
It shows the selected item, or a short hint when nothing is selected.
- **Header:** the symbol preview, the type name ("Point load", or "UVL" worked out from the values), and a delete button.
- **Position:** a segmented control "from left | from right" and a number field in m. "From right" converts to x from the left before the value is stored (plan Section 11).
- **Direction:**
  - a segmented control `↓ Down | ↑ Up` for forces and distributed loads
  - `↺ Anticlockwise | ↻ Clockwise` for couples
- **Magnitude:** always entered as a **positive** number with its unit (kN, kN·m, kN/m). The sign comes from the direction control.
- **Distributed loads:** start, end, w at start, w at end. A "Uniform" checkbox ties the two intensities together (turning it on copies the start value to the end).
- **Number fields:**
  - commit on Enter or blur; Esc goes back to the old value
  - Up/Down arrows step by the grid (for positions) or by 1 (for magnitudes)
  - an invalid value gets a red border and an inline message, and is not stored
  - there is no expression parser in Phase 1.5

### 6.7 Results (right column, below the inspector)
- **Status badge** (from `classification`):

| Classification | Badge text | Style |
|---|---|---|
| Determinate | "Determinate" | neutral |
| Indeterminate, axial only | "Indeterminate · degree 1 (axial) — solved" | info, with a tooltip explaining H = 0 |
| Indeterminate in bending | "Indeterminate · degree n (bending) — Phase 4" | warn |
| Unstable | "Unstable — {reason}" | danger |

- **Reactions table:** support id (with a small support symbol), Fx, Fy, M, in right-aligned mono.
- **Extremes:** max sagging M, max hogging M, max +V and max −V, each with its x. **Clicking a row pins the crosshair** at that x.
- **Zero-shear points:** a list of x values; clicking one also pins the crosshair.
- **Warnings** from the API (for example the pin–pin note), shown as quiet `--ink-2` text.
- A **"Values table"** button opens a dialog with V and M at every critical point (left and right). This doubles as the accessible alternative to the diagrams.

### 6.8 Errors and empty states
- **First load:** a 6 m beam with no supports. The canvas shows one line of `--ink-2` text in the support zone: "Drag a support from the palette onto the beam." There is no illustration.
- **Unstable or indeterminate beam:** a thin banner across the top of the canvas (danger or warn colour) with the message. The diagrams keep the last good result, drawn at 35% opacity with a "Not up to date" label. If there has never been a good result, the axes are empty and show the same message.
- **Solver unreachable:** the banner reads "Can't reach the solver — retrying…". It retries after 1, 2 and 4 s, then waits for the next change.
- **Invalid input from the backend** (which should be rare, since the frontend checks first): the banner shows the message and the field is highlighted if `loc` points to it.

### 6.9 Top bar
- **App name:** "Mechanics Sight", in plain text with no logo mark.
- **Length field** (6.4).
- **Undo / redo** icon buttons, with shortcut tooltips.
- **Examples menu:** the 12 hand-solved cases, bundled from `shared/fixtures`, with readable names such as "Simply supported, central point load". Picking one replaces the beam and is one undo step.
- **Share:** copies the URL with the beam in the hash (plan Section 11) and shows a small "Link copied" toast.
- **⋯ menu:** theme (System / Light / Dark), "Show critical-point guides", "Show reactions", "Reset beam", and "About / sign convention".

### 6.10 Status bar
- It shows the crosshair readout: `x = 2.350 m   V = +5.000 kN   M = +11.750 kN·m`.
- At a jump it shows both sides: `V = +5.000 / −5.000 kN`.
- It also shows the grid step, and a "Sign convention ⓘ" button that opens a popover with the rules from `docs/SIGN_CONVENTIONS.md`, including a small sketch.

---

## 7. Diagrams (SFD and BMD)

### 7.1 Panel anatomy
- **Title:**
  - "SHEAR FORCE V (kN)"
  - "BENDING MOMENT M (kN·m) · sagging +". The sign convention is stated on the panel itself.
- **Y-axis:** in the 64px gutter, with 4–6 "nice" ticks (`d3-scale` `.nice()`) in mono 11px. The domain is [min(0, min value), max(0, max value)], padded by 12%. If every value is 0, it is [−1, 1] with only the 0 tick labelled.
- **Zero line:** 1px `--ink`. Other grid lines are 1px `--grid`, horizontal only.
- **Positive values are plotted upward** for both diagrams. The BMD plots sagging upward, which matches the rule written in its title.

### 7.2 Curve
- Built from the segment polynomials, evaluated with Horner's method, at about one point per 2px of width per segment. Each segment's exact end points are always included.
- **Jumps** are vertical segments in the same stroke, running from the left value to the right value.
- **Fill:** the area between the curve and the zero line in the diagram colour at 14% opacity.
- **Sign markers:** a "+" or "−" in 12px `--ink-2` at the middle of the largest positive and the largest negative region, in the textbook style.

### 7.3 Annotations
- **Values at critical points:**
  - V at both sides of each jump
  - M at supports, at couples (both sides) and at the extremes
- **Extremes:** a 4px filled dot, plus a label such as `M max = 15.000 kN·m` with a short leader line. Max hogging is labelled the same way. Max ±V is labelled on the SFD.
- **Zero-shear points:** a small open circle on the SFD's zero line, labelled `x = 3.464`. A faint dashed line drops from it to the BMD's peak, which shows the "M is largest where V = 0" link.
- **Label collisions:** labels are placed in priority order: extremes, then support values, then the rest. A label that would come within 36px horizontally of an already-placed label in the same band is hidden, and shown on hover.
- **Critical-point guides** (switchable, on by default): faint dashed vertical lines at every critical point, running through all three panels.

### 7.4 Hover and crosshair
- **One vertical crosshair runs through the beam, SFD and BMD panels.** On each curve there is a 4px dot at the crosshair, with a value pill next to it, for example `V = +5.000 kN`.
- **Snap to jumps:** within 6px of a critical point, the crosshair snaps to it and the pills show both sides, `V⁻ = +5.000 / V⁺ = −5.000`.
- **Click** pins the crosshair (drawn solid) and **Esc** unpins it. The status bar always shows the readout.
- The crosshair is drawn on its own SVG layer, so moving the mouse never re-renders the curves.

### 7.5 Motion
- Data changes are instant, with no tweening of curves. An engineering diagram should never show values that don't exist.
- The only transitions are 120ms fades (dimming, the error banner, toasts). All motion is turned off under `prefers-reduced-motion`.

### 7.6 Number formatting (`math/format.ts`, one place)
- Positions: 3 decimals (mm), for example `3.000 m`.
- Forces and moments: 3 decimals in results and the status bar, and up to 3 significant decimals with trailing zeros removed in the drawing labels (`10 kN`, `2.5 kN/m`).
- A true minus sign `−` (U+2212). An explicit `+` in the results and the status bar, but not in the drawing labels (the arrows show the direction there).
- A thin space (U+2009) between a number and its unit.

---

## 8. React architecture

### 8.1 Dependencies
| Purpose | Library |
|---|---|
| Framework and build | React 19, Vite, TypeScript `strict` |
| State | `zustand` |
| Scales, ticks, paths | `d3-scale`, `d3-shape` (only these two d3 modules) |
| Accessible menus, popovers, tooltips, dialogs | `@radix-ui/react-*` primitives (unstyled, styled by us) |
| Chrome icons (undo, redo, share, trash, ⋯) | `lucide-react` |
| Fonts | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` |
| Share links | `lz-string` |
| Styling | CSS Modules + `tokens.css` custom properties |

There is no Tailwind and no pre-styled component kit (MUI, shadcn, Chakra), because those give exactly the generic look we want to avoid. Radix supplies accessibility and behaviour only; all the visuals are ours.

### 8.2 Folder structure

```
frontend/src/
  main.tsx, App.tsx
  api/
    schema.d.ts            # generated from shared/openapi.json
    client.ts              # analyze(): fetch + AbortController + sequence numbers + throttle
  model/
    types.ts               # BeamInput etc., re-exported from schema.d.ts
    actions.ts             # addItem, moveItem, resizeLoad, setLength (with anchoring), …
    ids.ts                 # crypto.randomUUID()
    share.ts, migrate.ts   # URL hash encode/decode, schema_version migrations
    examples.ts            # the bundled hand-solved fixtures
  store/
    store.ts               # zustand: model{beam, history}, draft, result, ui
  math/
    poly.ts                # Horner, evaluate a segment, sample a result
    snap.ts                # key-point snapping, 1-2-5 grid, mm rounding
    format.ts              # every number format in the app
    lanes.ts               # lane packing for distributed loads
    labels.ts              # label collision placement
  drawing/                 # pure SVG components (Section 4)
    Hatch.tsx, Arrow.tsx, Beam.tsx
    PinSupport.tsx, RollerSupport.tsx, FixedSupport.tsx
    PointLoad.tsx, Couple.tsx, DistributedLoad.tsx
    Reaction.tsx, DimensionChain.tsx
  canvas/
    XScaleContext.tsx
    BeamView.tsx           # draws the model with the drawing/ components
    Handles.tsx            # selection and resize handles, the length handle
    DragLayer.tsx          # ghost, guide line, x pill, snap ring
    useDrag.ts             # pointer-event drag state machine
  diagrams/
    DiagramPanel.tsx, YAxis.tsx, Curve.tsx, Annotations.tsx, Crosshair.tsx
  panels/
    TopBar.tsx, Palette.tsx, Inspector.tsx, Results.tsx, StatusBar.tsx, Banner.tsx
  ui/                      # small in-house controls
    Button.tsx, IconButton.tsx, NumberField.tsx, Segmented.tsx, Menu.tsx, Toast.tsx
  dev/
    SymbolGallery.tsx      # every symbol in every state and size (dev-only route #/symbols)
  styles/
    tokens.css, global.css
```

### 8.3 Rules
- **Drawing components are pure.** They take pixel positions, directions, labels and a state, and return a `<g>`. They never read the store. The palette previews, the canvas, the drag ghost and the gallery all use them.
- **Only `api/client.ts` talks to the backend.** Only `math/poly.ts` evaluates polynomials. The frontend never does mechanics (plan Section 11).
- **Every model change goes through `model/actions.ts`,** as pure functions (beam in, beam out). That makes them easy to unit-test and gives undo for free.
- The store follows plan Section 11: `beam`, `history`, `draft`, `result`, `ui`. UI-only state never goes into `beam`.

---

## 9. Testing

- **Vitest:**
  - `poly`, `snap`, `format`, `lanes`, `labels`
  - the anchoring rule in `setLength`
  - share-link round trips
  - the contract fixtures (evaluating each `output` against its `checks`)
- **Playwright:**
  - drag from the palette onto the beam, including snapping to a support
  - an invalid drop (a support on a support)
  - dragging a fixed support away from its end
  - live length change with anchoring
  - undo after a drag (one step)
  - the error banner for two rollers
  - hover snapping at a jump showing both values
- **Visual regression:** a Playwright screenshot of `#/symbols` in light and dark. Any change to a symbol's drawing then shows up as a diff to review.

---

## 10. Build order

Drag and drop stays in M7, as the plan says. It is designed here so that M6 builds the right foundations for it.

| Step | Contents | Review point |
|---|---|---|
| **M6a** | Vite scaffold, tokens, fonts, all `drawing/` components, `#/symbols` gallery | **You review the symbols before anything else is built** |
| M6b | The beam view from state, the dimension chain, palette click-to-add, the inspector, the length field | Can build any hand case with clicks and typing |
| M6c | API client, SFD/BMD panels, annotations, crosshair, results panel | Diagrams match `plots/` for all 12 cases |
| M6d | Undo/redo, share links, examples menu, error states, dark mode, responsive layouts | M6 done |
| M7 | Drag from the palette, move and resize, the length handle with anchoring, snapping visuals, live updates, Playwright | M7 done |
