/* ============================================================
   ADU Compass — shared property map module (Leaflet)
   Satellite view of the user's parcel with a to-scale,
   draggable + rotatable ADU footprint and 4-ft setback guide.
   Free tiles (Esri World Imagery) + free geocoding (Nominatim)
   — no API key required. Swap in the Google Maps JS API by
   providing a key if preferred; the interface is identical.
   ============================================================ */

const AduMap = (() => {
  const FT = 0.3048; // feet → meters

  // San Mateo County bias for geocoding
  const VIEWBOX = "-122.60,37.75,-122.05,37.05";
  const DEFAULT_CENTER = [37.5522, -122.3080]; // San Mateo
  const SETBACK_FT = 4;

  // Graceful fallback if the Leaflet CDN is unreachable (offline, blocked network)
  function createFallback(cfg) {
    const el = typeof cfg.container === "string" ? document.getElementById(cfg.container) : cfg.container;
    if (el) {
      el.style.cssText += ";display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;background:#e8e8e2;color:#55584f;font-size:.9rem;min-height:320px";
      el.innerHTML = "<div><b>Map unavailable offline.</b><br>The interactive lot visualizer needs an internet connection to load map tiles.<br>Check your connection and reload.</div>";
    }
    const noop = () => {};
    return { map: null, geocode: async () => { throw new Error("Map unavailable offline."); },
             setPlan: noop, setRotation: noop, clear: noop, invalidate: noop };
  }

  function create(cfg) {
    if (typeof L === "undefined") return createFallback(cfg);
    const accent = cfg.accent || "#2a78d6";
    const map = L.map(cfg.container, {
      center: cfg.center || DEFAULT_CENTER,
      zoom: 13, zoomControl: true, attributionControl: true
    });

    const sat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 21, maxNativeZoom: 19, attribution: "Imagery © Esri" });
    const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
    sat.addTo(map);
    L.control.layers({ "Satellite": sat, "Street map": street }, null,
      { position: "bottomright" }).addTo(map);

    const state = {
      dims: cfg.dims || [24, 25],       // [width ft, depth ft]
      label: cfg.label || "1 Bedroom · 600 sq ft",
      rotation: 0,
      marker: null, poly: null, setbackPoly: null,
      homePin: null
    };

    function rectLatLngs(center, wFt, dFt, deg) {
      const lat = center.lat, lng = center.lng;
      const mPerDegLat = 111320;
      const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
      const hw = (wFt * FT) / 2, hd = (dFt * FT) / 2;
      const rad = deg * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => {
        const rx = x * cos - y * sin, ry = x * sin + y * cos;
        return [lat + ry / mPerDegLat, lng + rx / mPerDegLng];
      });
    }

    function redraw() {
      if (!state.marker) return;
      const c = state.marker.getLatLng();
      const [w, d] = state.dims;
      const fp = rectLatLngs(c, w, d, state.rotation);
      const sb = rectLatLngs(c, w + SETBACK_FT * 2, d + SETBACK_FT * 2, state.rotation);
      if (state.poly) { state.poly.setLatLngs(fp); } else {
        state.poly = L.polygon(fp, {
          color: accent, weight: 2, fillColor: accent, fillOpacity: 0.38
        }).addTo(map);
      }
      if (state.setbackPoly) { state.setbackPoly.setLatLngs(sb); } else {
        state.setbackPoly = L.polygon(sb, {
          color: "#ffffff", weight: 1.5, dashArray: "6 5", fill: false, opacity: 0.9
        }).addTo(map);
      }
      state.poly.bindTooltip(
        `${state.label}<br>${w}′ × ${d}′ &nbsp;·&nbsp; dashed line = 4-ft setback clearance`,
        { direction: "top", sticky: true });
      if (cfg.onPlace) cfg.onPlace({ center: c, dims: state.dims });
    }

    function place(latlng) {
      if (!state.marker) {
        state.marker = L.marker(latlng, {
          draggable: true,
          title: "Drag to reposition your ADU"
        }).addTo(map);
        state.marker.on("drag", redraw);
      } else {
        state.marker.setLatLng(latlng);
      }
      redraw();
    }

    map.on("click", e => place(e.latlng));

    async function geocode(q) {
      const query = /ca|california/i.test(q) ? q : q + ", San Mateo County, CA";
      const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1" +
        "&viewbox=" + VIEWBOX + "&q=" + encodeURIComponent(query);
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      const hits = await res.json();
      if (!hits.length) throw new Error("Address not found — try adding the city name.");
      const { lat, lon, display_name } = hits[0];
      const ll = L.latLng(+lat, +lon);
      map.setView(ll, 20);
      if (state.homePin) map.removeLayer(state.homePin);
      state.homePin = L.circleMarker(ll, {
        radius: 7, color: "#fff", weight: 2, fillColor: accent, fillOpacity: 1
      }).addTo(map).bindTooltip("Your property", { direction: "top" });
      // drop the footprint just north-east of the pin so it's visible immediately
      place(L.latLng(ll.lat + 0.00008, ll.lng + 0.00010));
      return display_name;
    }

    return {
      map,
      geocode,
      setPlan(dimsFt, label) {
        state.dims = dimsFt; state.label = label;
        redraw();
      },
      setRotation(deg) { state.rotation = +deg; redraw(); },
      clear() {
        [state.poly, state.setbackPoly, state.marker].forEach(l => l && map.removeLayer(l));
        state.poly = state.setbackPoly = state.marker = null;
      },
      invalidate() { setTimeout(() => map.invalidateSize(), 60); }
    };
  }

  return { create };
})();
