# ADU Compass — San Mateo County

A homeowner-friendly website that explains the **entire ADU design-and-build process** for
San Mateo County — costs, timeline, size options, permits & regulations, property-tax impact,
rental revenue, and recommended local builders — with an interactive, address-based **lot
visualizer** that draws to-scale ADU footprints on a satellite view of your property.

Three complete, distinct website designs are included, all powered by the same data engine so
their numbers always agree.

## Quick start

No build step. Serve the repo root and open it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

(Or just open `index.html` directly — a local server is only needed for the map's geocoding
requests in some browsers.)

- **`index.html`** — design gallery + feature comparison
- **`design-1-pathway/`** — *The Pathway*: warm, guided, six-step-journey layout for first-timers
- **`design-2-command/`** — *Command Center*: SaaS-style dashboard with a live "Your ADU Plan" rail
- **`design-3-backyard/`** — *Backyard*: bold editorial scrollytelling in eight chapters

## What every design includes

| Feature | Details |
|---|---|
| Process guide | Six phases from feasibility to move-in, with realistic durations |
| Cost estimator | ADU type × size × finish × site conditions → all-in range + breakdown (construction, design, permits, utilities, contingency) |
| Timeline estimator | Phase-by-phase schedule that adapts to the chosen ADU type |
| Size options | Studio (400 sf) → 3-bed (1,200 sf) presets with real footprint dimensions |
| Permits & rules | California state-law guarantees plus all 21 San Mateo County jurisdictions with official links |
| Tax impact | Only the ADU is assessed (R&T §71) — added tax ≈ 1.15% of build cost/yr |
| Rental revenue | Q1-2026 Peninsula rents, net income after vacancy/expenses, payback years, value added |
| Lot visualizer | Address → satellite map, draggable/rotatable to-scale footprint, 4-ft setback guide |
| Local builders | Filterable directory: free county help (smcadu.org), prefab (Abodu, Villa, …), design-build (Acton, Hamilton Exteriors, aduScale, …), design & tools |

## Architecture

```
assets/adu-data.js   # single source of truth: cost/timeline/rent/tax models,
                     # city rules, state-law facts, builder directory, FAQ,
                     # and the ADU.estimate() engine
assets/adu-map.js    # reusable Leaflet map module: Esri satellite tiles,
                     # Nominatim geocoding, draggable+rotatable footprint,
                     # 4-ft setback overlay. No API key required.
design-*/index.html  # each design is a self-contained page (own CSS/JS)
                     # that consumes the shared modules
```

The map module is intentionally swappable: it exposes `create / geocode / setPlan /
setRotation`, so replacing Leaflet+Nominatim with the Google Maps JS API (if you have a key)
only touches `assets/adu-map.js`.

## Data sources

- [SMC ADU Resource Center](https://smcadu.org) (county-funded, free homeowner help)
- [San Mateo County Planning — ADUs](https://www.smcgov.org/planning/accessory-dwelling-units-adus)
- CA HCD ADU Handbook (state law: 800 sf by right, 4-ft setbacks, 60-day clock, fee exemptions)
- Published 2026 Bay Area/Peninsula builder pricing (Hamilton Exteriors, GatherADU, Acton ADU, Abodu)
  and Q1-2026 Peninsula rental market data

All figures are planning estimates, current as of mid-2026. They are not legal, tax, or
financial advice — homeowners should confirm rules with their city planning counter and get
multiple contractor bids.
