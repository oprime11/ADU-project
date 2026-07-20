/* ============================================================
   ADU Compass — shared data + estimation engine
   San Mateo County, CA · figures current as of mid-2026
   Sources: smcadu.org, smcgov.org, CA HCD ADU Handbook,
   published Bay Area builder pricing (Hamilton Exteriors,
   GatherADU, Acton ADU, Abodu) and Q1-2026 Peninsula rents.
   All figures are planning estimates — verify with your city.
   ============================================================ */

const ADU = (() => {

  /* ---------- ADU types ---------- */
  const TYPES = [
    {
      id: "detached", name: "Detached new-build",
      short: "A stand-alone backyard cottage built from the ground up.",
      costPerSf: [320, 480],           // construction only, standard finish
      buildMonths: [8, 12],
      minSf: 300, maxSf: 1200,
      pros: ["Most privacy & rental appeal", "Sized up to 1,200 sq ft in most cities", "Highest value-add"],
      cons: ["Highest total cost", "Longest construction", "Uses yard space"]
    },
    {
      id: "prefab", name: "Prefab / modular",
      short: "Factory-built unit craned or assembled on site (e.g. Abodu, Villa).",
      costPerSf: [300, 420],
      buildMonths: [3, 6],
      minSf: 300, maxSf: 1200,
      pros: ["Fastest — weeks on site, not months", "Fixed pricing common", "Less disruption"],
      cons: ["Fewer custom layouts", "Crane/site access required", "Site & utility work still needed"]
    },
    {
      id: "attached", name: "Attached addition",
      short: "A new unit added onto the existing house with its own entrance.",
      costPerSf: [300, 450],
      buildMonths: [6, 10],
      minSf: 300, maxSf: 1000,
      pros: ["Shares walls & utilities — can cost less", "Keeps yard open", "Good for family use"],
      cons: ["Construction disrupts the main house", "Less privacy", "Size tied to existing home in some cities"]
    },
    {
      id: "garage", name: "Garage conversion",
      short: "Your existing garage rebuilt as a legal dwelling.",
      costPerSf: [350, 500],
      buildMonths: [4, 6],
      minSf: 200, maxSf: 600,
      pros: ["Lowest total cost ($150K–$280K typical)", "No new footprint — setbacks don't apply", "No parking replacement required (state law)"],
      cons: ["Limited to garage size (~240–480 sq ft)", "You lose the garage", "Foundation/ceiling-height surprises possible"]
    },
    {
      id: "jadu", name: "Junior ADU (JADU)",
      short: "Up to 500 sq ft carved out of the existing house, with an efficiency kitchen.",
      costPerSf: [250, 400],
      buildMonths: [3, 5],
      minSf: 150, maxSf: 500,
      pros: ["Cheapest path to a legal unit", "Can share a bathroom with the house", "Can be combined with a full ADU on the same lot"],
      cons: ["Max 500 sq ft", "Owner must live on the property", "Shares the home's walls"]
    }
  ];

  /* ---------- size presets ---------- */
  const SIZES = [
    { sf: 400,  label: "Studio",        beds: "Studio · 1 bath", dims: [20, 20] },
    { sf: 600,  label: "1 Bedroom",     beds: "1 bed · 1 bath",  dims: [24, 25] },
    { sf: 800,  label: "2 Bedroom",     beds: "2 bed · 1 bath",  dims: [28, 28.5] },
    { sf: 1000, label: "2 Bed + Office",beds: "2 bed · 2 bath",  dims: [25, 40] },
    { sf: 1200, label: "3 Bedroom",     beds: "3 bed · 2 bath",  dims: [30, 40] }
  ];

  /* ---------- finish levels & site difficulty ---------- */
  const FINISHES = [
    { id: "essential", name: "Essential", mult: 0.85, blurb: "Durable builder-grade: LVP floors, stock cabinets, standard fixtures." },
    { id: "standard",  name: "Standard",  mult: 1.00, blurb: "Mid-range: quartz counters, tile bath, quality windows. Most popular." },
    { id: "premium",   name: "Premium",   mult: 1.20, blurb: "High-end: custom cabinetry, designer fixtures, upgraded façade." }
  ];
  const SITES = [
    { id: "easy",     name: "Simple site",   mult: 1.00, extra: 0,     blurb: "Flat lot, utilities nearby, easy access." },
    { id: "moderate", name: "Average site",  mult: 1.06, extra: 15000, blurb: "Some slope or a longer utility trench." },
    { id: "complex",  name: "Complex site",  mult: 1.15, extra: 35000, blurb: "Steep slope, mature trees, tight access, or panel upgrade." }
  ];

  /* ---------- rents (San Mateo County / Peninsula, Q1 2026) ---------- */
  const RENTS = [
    { maxSf: 499,  label: "Studio",    range: [2200, 2800] },
    { maxSf: 699,  label: "1 Bedroom", range: [2800, 3400] },
    { maxSf: 999,  label: "2 Bedroom", range: [3400, 4200] },
    { maxSf: 9999, label: "2–3 Bedroom", range: [3800, 4600] }
  ];

  const TAX_RATE = 0.0115;        // ≈ SMC blended ad-valorem rate
  const VACANCY  = 0.04;          // Peninsula vacancy is low
  const OPEX     = 0.10;          // insurance, maintenance, utilities share

  /* ---------- timeline phases ---------- */
  const PHASES = [
    { id: "learn",   name: "Learn & feasibility", months: [0.5, 2],
      blurb: "Confirm what your lot allows, set a budget, talk to the free SMC ADU Center, get a rough site check." },
    { id: "design",  name: "Design & engineering", months: [1.5, 4],
      blurb: "Floor plans, elevations, structural + Title-24 energy calcs. Pre-approved plan sets can cut this dramatically." },
    { id: "permit",  name: "Permitting", months: [1.5, 4],
      blurb: "Cities must act on a complete ADU application within 60 days (state law), but 1–2 correction rounds are normal." },
    { id: "bid",     name: "Bids & financing", months: [1, 2],
      blurb: "Collect 2–3 contractor bids, lock financing (HELOC, cash-out refi, renovation or ADU loan). Overlaps with permitting." },
    { id: "build",   name: "Construction", months: [4, 12],
      blurb: "Foundation → framing → rough-ins → finishes, with city inspections at each stage. Prefab compresses this to weeks on site." },
    { id: "movein",  name: "Final inspection & move-in", months: [0.5, 1],
      blurb: "Certificate of occupancy, utility activation, then rent it, house family, or move in." }
  ];

  /* ---------- California state-law baseline (what every SMC city must allow) ---------- */
  const STATE_LAW = [
    { t: "800 sq ft by right", d: "Every city must approve an ADU of at least 800 sq ft, 16 ft tall, with 4-ft side/rear setbacks — regardless of lot coverage or floor-area limits." },
    { t: "Up to 1,200 sq ft locally", d: "Local caps must be at least 850 sq ft (studio/1-bed) and 1,000 sq ft (2-bed+). Many San Mateo County cities allow up to 1,200 sq ft." },
    { t: "60-day decision clock", d: "ADU applications are ministerial — no public hearings — and the city must approve or deny within 60 days of a complete application." },
    { t: "4-ft setbacks", d: "Side and rear setbacks max out at 4 ft for new ADUs. Conversions of existing space (garage, basement) need no new setbacks at all." },
    { t: "No impact fees under 750 sq ft", d: "ADUs under 750 sq ft are exempt from development impact fees; larger units pay a proportional share. Under 500 sq ft also skips school fees." },
    { t: "Parking is easy", d: "No replacement parking when you convert a garage, and no ADU parking required within ½ mile of transit — which covers much of the county." },
    { t: "No owner-occupancy for ADUs", d: "You do not have to live on the property to rent a standard ADU (rentals must be 30+ days). JADUs do require owner-occupancy." },
    { t: "ADU + JADU together", d: "Single-family lots may add both one ADU and one JADU (up to 500 sq ft inside the house) — two rentable units on one lot." },
    { t: "Height up to 18–25 ft", d: "16 ft is the by-right floor; 18 ft applies near transit or with a 2-story main home, and attached ADUs may go to 25 ft in many cities." },
    { t: "Solar on new detached units", d: "Title 24 requires rooftop solar on newly constructed detached ADUs (not on conversions)." }
  ];

  /* ---------- jurisdictions (San Mateo County) ----------
     localNote values are typical local standards — always verify
     with the city planning counter before designing. */
  const CITIES = [
    { name: "Unincorporated San Mateo County", site: "https://www.smcgov.org/planning/accessory-dwelling-units-adus",
      note: "County ADU ordinance; free help via the SMC ADU Resource Center. Coastal zone parcels (e.g. near Half Moon Bay) add a coastal permit step." },
    { name: "Atherton", site: "https://www.ci.atherton.ca.us", note: "Large-lot town; generous siting but strict landscaping/screening standards." },
    { name: "Belmont", site: "https://www.belmont.gov", note: "Hillside lots common — budget for slope and drainage review." },
    { name: "Brisbane", site: "https://www.brisbaneca.org", note: "Small-town counter; call ahead for ADU handout." },
    { name: "Burlingame", site: "https://www.burlingame.org", note: "Active ADU program with clear checklists; strong rental market." },
    { name: "Colma", site: "https://www.colma.ca.gov", note: "Very small residential base; staff walk applicants through directly." },
    { name: "Daly City", site: "https://www.dalycity.org", note: "Many garage conversions; check legalization pathway for older unpermitted units." },
    { name: "East Palo Alto", site: "https://www.cityofepa.org", note: "ADU-friendly policies and below-market-rate incentive programs." },
    { name: "Foster City", site: "https://www.fostercity.org", note: "Lagoon setbacks and HOA rules can apply — check both." },
    { name: "Half Moon Bay", site: "https://www.half-moon-bay.ca.us", note: "Coastal zone: most parcels need a coastal development permit — add time." },
    { name: "Hillsborough", site: "https://www.hillsborough.net", note: "Design review culture; larger minimum lot sizes, generous ADU sizing." },
    { name: "Menlo Park", site: "https://menlopark.gov", note: "Publishes pre-approved ADU plan sets that shorten design and review." },
    { name: "Millbrae", site: "https://www.ci.millbrae.ca.us", note: "Transit-rich — most parcels qualify for zero-parking ADUs." },
    { name: "Pacifica", site: "https://www.cityofpacifica.org", note: "Coastal zone west of Highway 1; geotech review on bluff/slope lots." },
    { name: "Portola Valley", site: "https://www.portolavalley.net", note: "Geologic hazard mapping matters — start with a site constraints check." },
    { name: "Redwood City", site: "https://www.redwoodcity.org", note: "Streamlined ADU portal and handouts; home of prefab builder Abodu." },
    { name: "San Bruno", site: "https://www.sanbruno.ca.gov", note: "Standard state rules; check hillside overlay in western neighborhoods." },
    { name: "San Carlos", site: "https://www.cityofsancarlos.org", note: "Clear ADU guide; strong rents make ROI attractive." },
    { name: "San Mateo (city)", site: "https://www.cityofsanmateo.org", note: "Robust ADU page + FAQ; taxes: only the ADU is assessed, not your whole home." },
    { name: "South San Francisco", site: "https://www.ssf.net", note: "Active ADU program; check flood zone near Colma Creek." },
    { name: "Woodside", site: "https://www.woodsidetown.org", note: "Rural character rules and septic on some lots — feasibility check first." }
  ];

  /* ---------- recommended local pros ----------
     Examples drawn from leading Peninsula ADU providers.
     Listed for research convenience — not endorsements. Get 2–3 bids. */
  const PROS = [
    { name: "SMC ADU Resource Center", cat: "Free guidance", url: "https://smcadu.org",
      area: "All of San Mateo County",
      blurb: "County-backed, totally free: 1-on-1 consultations, workshops, standard plans, and calculators. Start here.", tag: "Free · start here" },
    { name: "Abodu", cat: "Prefab", url: "https://www.abodu.com",
      area: "HQ in Redwood City · Peninsula-wide",
      blurb: "Factory-built backyard homes installed by crane — as little as a few weeks on site. Fixed pricing, handles permits.", tag: "Prefab" },
    { name: "Villa", cat: "Prefab", url: "https://www.villahomes.com",
      area: "California-wide",
      blurb: "Prefab ADUs with strong financing support — good fit for budget-conscious, first-time builders.", tag: "Prefab" },
    { name: "Perpetual Homes", cat: "Prefab", url: "https://www.perpetualhomesadu.com",
      area: "San Mateo County & Bay Area",
      blurb: "Large family-owned prefab ADU builder; 2026 'Prefab ADU Development Company of the Year'.", tag: "Prefab" },
    { name: "Samara (Backyard)", cat: "Prefab", url: "https://www.samara.com",
      area: "California-wide",
      blurb: "Design-forward prefab units with all-in pricing, from the team that founded Airbnb's design studio.", tag: "Prefab" },
    { name: "Acton ADU", cat: "Design-build", url: "https://www.actonadu.com",
      area: "Peninsula & South Bay",
      blurb: "30+ years of Northern-California backyard homes; full design-permit-build under one roof.", tag: "Design-build" },
    { name: "Hamilton Exteriors", cat: "Design-build", url: "https://hamilton-exteriors.com/adu",
      area: "Bay Area",
      blurb: "ADU-focused general contractor; publishes transparent Bay Area cost guides ($80K–$375K by type).", tag: "Design-build" },
    { name: "aduScale", cat: "Design-build", url: "https://aduscale.com",
      area: "Peninsula",
      blurb: "Local design-build firm focused on streamlined, end-to-end ADU delivery.", tag: "Design-build" },
    { name: "GatherADU", cat: "Design & permitting", url: "https://www.gatheradu.com",
      area: "Bay Area",
      blurb: "Architecture and permitting specialists — useful if you want to bid construction separately.", tag: "Design" },
    { name: "Buildability", cat: "Feasibility tools", url: "https://buildability.io",
      area: "Online",
      blurb: "Property feasibility reports and owner-side project tools to sanity-check any bid you receive.", tag: "Tools" }
  ];

  /* ---------- FAQ ---------- */
  const FAQ = [
    { q: "Will building an ADU reassess my whole property?",
      a: "No. Under CA Revenue & Taxation Code §71, only the new ADU is assessed at market value — your home keeps its Prop 13 base. A $300K ADU adds roughly $3,400–$4,500/yr in property tax at SMC rates (~1.1–1.5% of the added value)." },
    { q: "Do I need to live on the property to rent the ADU?",
      a: "Not for a standard ADU — owner-occupancy requirements are prohibited by state law. A Junior ADU (JADU) does require the owner to live on site. All ADU rentals must be 30+ days." },
    { q: "How long does the whole thing really take?",
      a: "Plan on 9–16 months door to door for a stick-built unit: 1–2 months learning, 2–4 designing, 2–4 permitting, 4–12 building. Prefab compresses construction to weeks (still ~6–9 months overall with design and permits)." },
    { q: "What does financing look like?",
      a: "Most owners use home equity (HELOC or cash-out refinance), renovation loans (which count the future value), or builder financing on prefab units. The CalHFA ADU grant program has been funded intermittently — check current status." },
    { q: "Can I sell the ADU separately from my house?",
      a: "AB 1033 lets cities opt in to condo-style separate sales of ADUs. Adoption varies — ask your city's planning counter whether it has opted in." },
    { q: "Is an unpermitted unit a problem?",
      a: "Yes, but fixable: state law provides amnesty pathways for legalizing older unpermitted units, and several SMC cities run legalization programs. Legalizing protects you on insurance, financing, and resale." },
    { q: "What kills ADU budgets most often?",
      a: "Utility surprises (sewer depth, panel upgrades: $3.5K–$12K each), slope and drainage work, and change orders mid-build. A feasibility check and a 10%+ contingency are the antidotes." }
  ];

  /* ---------- estimation engine ---------- */
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function moneyK(n) { return "$" + Math.round(n / 1000) + "K"; }

  function rentFor(sf) {
    return RENTS.find(r => sf <= r.maxSf);
  }

  /**
   * estimate({ typeId, sf, finishId, siteId })
   * → full cost / timeline / revenue / tax picture
   */
  function estimate(opts) {
    const type   = TYPES.find(t => t.id === opts.typeId) || TYPES[0];
    const finish = FINISHES.find(f => f.id === opts.finishId) || FINISHES[1];
    const site   = SITES.find(s => s.id === opts.siteId) || SITES[0];
    const sf     = Math.min(Math.max(opts.sf || 600, type.minSf), type.maxSf);

    const cLow  = sf * type.costPerSf[0] * finish.mult * site.mult;
    const cHigh = sf * type.costPerSf[1] * finish.mult * site.mult;
    const cMid  = (cLow + cHigh) / 2;

    // soft costs
    const design  = Math.max(15000, cMid * 0.09);
    const impact  = sf < 750 ? 0 : 9000;
    const permits = 11000 + impact;                       // plan check, building permit, utility fees
    const siteUt  = 18000 + site.extra;                   // utility connections, grading, hookups
    const conting = (cMid + design + permits + siteUt) * 0.10;

    const isConversion = type.id === "garage" || type.id === "jadu";
    const siteUtAdj = isConversion ? siteUt * 0.55 : siteUt;

    const totalMid  = cMid + design + permits + siteUtAdj + conting;
    const spread    = (cHigh - cLow) / 2;
    const totalLow  = totalMid - spread - conting * 0.5;
    const totalHigh = totalMid + spread + conting * 0.5;

    // timeline
    const pre  = [3.5, 8];                                // learn+design+permit combined lo/hi
    const tl   = { low: pre[0] + type.buildMonths[0], high: pre[1] + type.buildMonths[1] };

    // revenue
    const rent = rentFor(sf);
    const rentMid = (rent.range[0] + rent.range[1]) / 2;
    const netMonthly = rentMid * (1 - VACANCY) * (1 - OPEX);
    const netAnnual  = netMonthly * 12;
    const payback = totalMid / netAnnual;

    // taxes & value
    const taxAnnual = totalMid * TAX_RATE;
    const valueAdd  = rentMid * 110;                      // income approach: 100–120× monthly rent

    return {
      type, finish, siteLevel: site, sf,
      cost: {
        low: totalLow, high: totalHigh, mid: totalMid,
        breakdown: [
          { label: "Construction",         v: cMid },
          { label: "Design & engineering", v: design },
          { label: "Permits & city fees",  v: permits },
          { label: "Site & utilities",     v: siteUtAdj },
          { label: "Contingency (10%)",    v: conting }
        ]
      },
      timeline: tl,
      rent: { band: rent, mid: rentMid, netMonthly, netAnnual },
      tax: { annual: taxAnnual, monthly: taxAnnual / 12, rate: TAX_RATE },
      paybackYears: payback,
      valueAdd
    };
  }

  return { TYPES, SIZES, FINISHES, SITES, RENTS, PHASES, STATE_LAW, CITIES, PROS, FAQ,
           TAX_RATE, estimate, money, moneyK, rentFor };
})();
