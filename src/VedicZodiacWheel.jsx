import React, { useEffect, useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";

/**
 * Vedic Zodiac Wheel — Interactive Planet Viewer (v2)
 * ------------------------------------------------------
 * Enhancements vs v1:
 *  - Optional outer planets (Uranus/Neptune/Pluto)
 *  - 27 Nakshatra grid with pada ticks (3°20′)
 *  - Aspect lines (0, 60, 90, 120, 180) with adjustable orb
 *  - Export PNG of the SVG wheel
 *  - Node mode toggle (Mean nodes supported; True node placeholder)
 */

// ---------- Helpers ----------
const DEG2RAD = Math.PI / 180;
function norm360(d) { let x = d % 360; if (x < 0) x += 360; return x; }

const SIGNS = [
  { name: "Aries", short: "♈︎" },
  { name: "Taurus", short: "♉︎" },
  { name: "Gemini", short: "♊︎" },
  { name: "Cancer", short: "♋︎" },
  { name: "Leo", short: "♌︎" },
  { name: "Virgo", short: "♍︎" },
  { name: "Libra", short: "♎︎" },
  { name: "Scorpio", short: "♏︎" },
  { name: "Sagittarius", short: "♐︎" },
  { name: "Capricorn", short: "♑︎" },
  { name: "Aquarius", short: "♒︎" },
  { name: "Pisces", short: "♓︎" }
];

function zodiacBreakdown(longitudeDeg) {
  const lon = norm360(longitudeDeg);
  const signIndex = Math.floor(lon / 30);
  const inSign = lon % 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign - d) * 60);
  return { signIndex, sign: SIGNS[signIndex].name, signGlyph: SIGNS[signIndex].short, deg: d, min: m, raw: lon };
}

// Mean lunar ascending node (Rahu) – degrees, true ecliptic of date (tropical)
function meanLunarNodeLongitude(date) {
  const JD = (date.getTime() / 86400000) + 2440587.5; // Unix epoch to JD
  const T = (JD - 2451545.0) / 36525.0; // Julian centuries from J2000
  const omega = 125.04455501 - 1934.13626197 * T + 0.0020762 * T * T + (T * T * T) / 467410 - (T * T * T * T) / 60616000;
  return norm360(omega);
}

// Planets
const BODIES = [
  { key: "Sun", body: Astronomy.Body.Sun, color: "#ffb703" },
  { key: "Moon", body: Astronomy.Body.Moon, color: "#8ecae6" },
  { key: "Mercury", body: Astronomy.Body.Mercury, color: "#adb5bd" },
  { key: "Venus", body: Astronomy.Body.Venus, color: "#ffafcc" },
  { key: "Mars", body: Astronomy.Body.Mars, color: "#e63946" },
  { key: "Jupiter", body: Astronomy.Body.Jupiter, color: "#ffd166" },
  { key: "Saturn", body: Astronomy.Body.Saturn, color: "#cdb4db" },
  { key: "Uranus", body: Astronomy.Body.Uranus, color: "#94d2bd", optional: true },
  { key: "Neptune", body: Astronomy.Body.Neptune, color: "#90caf9", optional: true },
  { key: "Pluto", body: Astronomy.Body.Pluto, color: "#bfb8da", optional: true }
];

function usePlanetLongitudes(date, useMeanNode) {
  return useMemo(() => {
    const results = [];
    for (const item of BODIES) {
      const vec = Astronomy.GeoVector(item.body, date, true);
      const ecl = Astronomy.Ecliptic(vec); // true ecliptic-of-date
      results.push({ key: item.key, color: item.color, elon: norm360(ecl.elon), optional: !!item.optional });
    }
    const rahu = meanLunarNodeLongitude(date);
    const ketu = norm360(rahu + 180);
    results.push({ key: useMeanNode ? "Rahu (Mean)" : "Rahu (True – TBD)", color: "#2a9d8f", elon: rahu, isNode: true });
    results.push({ key: useMeanNode ? "Ketu (Mean)" : "Ketu (True – TBD)", color: "#264653", elon: ketu, isNode: true });
    return results;
  }, [date, useMeanNode]);
}

function Wheel({ date, ayanamshaDeg, useSidereal, showOuterPlanets, showNakshatraGrid, showAspects, aspectOrb, enabledAspects, useMeanNode }) {
  const planets = usePlanetLongitudes(date, useMeanNode);
  const filtered = planets.filter(p => showOuterPlanets || !p.optional);
  const points = filtered.map(p => ({ ...p, lon: useSidereal ? norm360(p.elon - ayanamshaDeg) : p.elon }));

  // SVG geometry
  const size = 740;
  const cx = size / 2, cy = size / 2;
  const outer = 320;   // outer radius
  const inner = 250;   // planet ring

  const angleToXY = (angleDeg, r) => {
    // 0° Aries at right (3 o'clock)
    const a = (0 - angleDeg) * DEG2RAD; // rotate so 0° at +x axis
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  // Aspect helper
  const hasAspect = (a, b) => {
    const ang = Math.min(norm360(a - b), norm360(b - a));
    return Object.keys(enabledAspects)
      .filter(k => enabledAspects[k])
      .map(k => parseFloat(k))
      .some(target => Math.abs(ang - target) <= aspectOrb);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <svg width={size} height={size} className="rounded-2xl shadow border bg-white">
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={outer} fill="#fff" stroke="#0f172a" strokeWidth={2} />

        {/* 12 sign wedges grid */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30;
          const p = angleToXY(angle, outer);
          const mid = angle + 15;
          const m = angleToXY(mid, outer - 24);
          return (
            <g key={`grid-${i}`}>
              <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#94a3b8" strokeWidth={1} />
              <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-700" style={{ fontSize: 16, fontWeight: 700 }}>
                {SIGNS[i].short}
              </text>
            </g>
          );
        })}

        {/* Nakshatra grid (27) + padas (optional) */}
        {showNakshatraGrid && (
          <g>
            {Array.from({ length: 27 }).map((_, i) => {
              const angle = i * (360/27);
              const p1 = angleToXY(angle, outer);
              const p2 = angleToXY(angle, outer - 22);
              return <line key={`nak-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#f59e0b" strokeWidth={1} opacity={0.8} />;
            })}
            {Array.from({ length: 108 }).map((_, i) => {
              const angle = i * (360/108);
              const p1 = angleToXY(angle, outer);
              const p2 = angleToXY(angle, outer - 12);
              return <line key={`pada-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fbbf24" strokeWidth={0.8} opacity={0.7} />;
            })}
          </g>
        )}

        {/* 5° minor ticks */}
        {Array.from({ length: 72 }).map((_, i) => {
          const angle = i * 5;
          const p1 = angleToXY(angle, outer);
          const p2 = angleToXY(angle, outer - (i % 6 === 0 ? 18 : 10));
          return <line key={`tick-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#cbd5e1" strokeWidth={i % 6 === 0 ? 1.5 : 1} />;
        })}

        {/* Inner ring for planets */}
        <circle cx={cx} cy={cy} r={inner} fill="none" stroke="#e2e8f0" strokeWidth={1} />

        {/* Aspect lines */}
        {showAspects && points.map((a,i) => (
          points.slice(i+1).map((b,j) => {
            if (!hasAspect(a.lon, b.lon)) return null;
            const pa = angleToXY(a.lon, inner);
            const pb = angleToXY(b.lon, inner);
            return <line key={`asp-${i}-${j}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#64748b" strokeWidth={1} opacity={0.6} />
          })
        ))}

        {/* Planet markers */}
        {points.map((p) => {
          const pos = angleToXY(p.lon, inner);
          const label = zodiacBreakdown(p.lon);
          return (
            <g key={`p-${p.key}`}>
              <circle cx={pos.x} cy={pos.y} r={7} fill={p.color} stroke="#0f172a" strokeWidth={1} />
              <line x1={pos.x} y1={pos.y} x2={pos.x} y2={pos.y - 22} stroke={p.color} strokeWidth={1} />
              <text x={pos.x} y={pos.y - 28} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 12, fontWeight: 700 }}>{p.key}</text>
              <text x={pos.x} y={pos.y - 14} textAnchor="middle" className="fill-slate-600" style={{ fontSize: 11 }}>
                {label.signGlyph} {label.deg}°{label.min.toString().padStart(2, "0")}′
              </text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={4} fill="#0f172a" />
      </svg>

      {/* Listing + controls */}
      <div className="min-w-[360px] max-w-[500px]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-800">Placements</h2>
          <button
            onClick={() => {
              const svg = document.querySelector('svg');
              const xml = new XMLSerializer().serializeToString(svg);
              const svg64 = btoa(unescape(encodeURIComponent(xml)));
              const image64 = 'data:image/svg+xml;base64,' + svg64;
              const img = new Image();
              img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = svg.viewBox.baseVal.width || svg.width.baseVal.value;
                canvas.height = svg.viewBox.baseVal.height || svg.height.baseVal.value;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0,0,canvas.width,canvas.height);
                ctx.drawImage(img,0,0);
                const link = document.createElement('a');
                link.download = 'vedic-wheel.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
              };
              img.src = image64;
            }}
            className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100">
            Export PNG
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-3">{new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "medium" }).format(date)}</p>

        <table className="w-full text-sm border-separate border-spacing-y-1">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-1">Body</th>
              <th className="pb-1">Zodiac</th>
              <th className="pb-1">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const z = zodiacBreakdown(p.lon);
              return (
                <tr key={`row-${p.key}`} className="bg-slate-50">
                  <td className="px-2 py-1 font-semibold" style={{ color: p.color }}>{p.key}</td>
                  <td className="px-2 py-1">{z.signGlyph} {z.sign} {z.deg}°{z.min.toString().padStart(2, "0")}′</td>
                  <td className="px-2 py-1">{z.raw.toFixed(3)}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 text-xs text-slate-500 leading-relaxed space-y-2">
          <p>Mode: <span className="font-semibold">{useSidereal ? "Sidereal (ayanāṁśa applied)" : "Tropical (no ayanāṁśa)"}</span> • Nodes: <span className="font-semibold">{useMeanNode?"Mean":"True (TBD)"}</span></p>
          <p>Engine: Astronomy Engine (geocentric true ecliptic-of-date). Rahu/Ketu currently use mean node formula; true node to be added.</p>

          {/* Feature toggles */}
          <div className="pt-2 border-t">
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showOuterPlanets} onChange={(e)=>window.setShowOuter(e.target.checked)} /> Show Uranus/Neptune/Pluto</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showNakshatraGrid} onChange={(e)=>window.setShowNak(e.target.checked)} /> Nakshatra grid</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showAspects} onChange={(e)=>window.setShowAsp(e.target.checked)} /> Aspects</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={useMeanNode} onChange={(e)=>window.setNodeMode(e.target.checked)} /> Mean node (true TBD)</label>
              {showAspects && (
                <>
                  <span className="text-slate-500">Aspects:</span>
                  {[0,60,90,120,180].map(a => (
                    <label key={`asp-${a}`} className="flex items-center gap-1">
                      <input type="checkbox" checked={!!enabledAspects[a]} onChange={() => window.toggleAspect(a)} />{a}°
                    </label>
                  ))}
                  <label className="flex items-center gap-2">
                    Orb <input type="number" min={0} max={10} step={0.5} value={aspectOrb} onChange={(e)=>window.setOrb(parseFloat(e.target.value||"0"))} className="border rounded px-2 py-1 w-20" />°
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VedicZodiacWheel() {
  const [whenIso, setWhenIso] = useState(() => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [useSidereal, setUseSidereal] = useState(true);
  const [ayanamsha, setAyanamsha] = useState(24.1);
  const [showOuterPlanets, setShowOuterPlanets] = useState(true);
  const [showNakshatraGrid, setShowNakshatraGrid] = useState(true);
  const [useMeanNode, setUseMeanNode] = useState(true);
  const [showAspects, setShowAspects] = useState(true);
  const [aspectOrb, setAspectOrb] = useState(6);
  const [enabledAspects, setEnabledAspects] = useState({ 0: true, 60: false, 90: true, 120: true, 180: true });

  const date = useMemo(() => new Date(whenIso), [whenIso]);

  // expose small setters so the inline table controls work without prop-drilling deeply
  useEffect(() => {
    window.setShowOuter = setShowOuterPlanets;
    window.setShowNak = setShowNakshatraGrid;
    window.setShowAsp = setShowAspects;
    window.setNodeMode = setUseMeanNode;
    window.setOrb = setAspectOrb;
    window.toggleAspect = (a) => setEnabledAspects(prev => ({ ...prev, [a]: !prev[a] }));
    return () => {
      delete window.setShowOuter; delete window.setShowNak; delete window.setShowAsp; delete window.setNodeMode; delete window.setOrb; delete window.toggleAspect;
    };
  }, []);

  const AY_PRESETS = [
    { name: "Lahiri (Chitra)", val: 24.10 },
    { name: "Raman", val: 22.50 },
    { name: "Krishnamurti", val: 23.86 },
    { name: "Fagan/Bradley (Western sidereal)", val: 24.42 }
  ];

  return (
    <div className="p-4 lg:p-6 font-sans text-slate-800">
      <h1 className="text-2xl font-extrabold mb-2">Vedic Zodiac Wheel — Earth‑Centered</h1>
      <p className="text-slate-600 mb-4">Pick a date/time. Toggle sidereal and set your ayanāṁśa. Extras: outer planets, 27 nakshatra grid, aspects, PNG export.</p>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Date & Time</span>
          <input type="datetime-local" value={whenIso} onChange={(e) => setWhenIso(e.target.value)} className="border rounded-lg px-3 py-2" />
        </label>

        <label className="flex items-center gap-2 text-sm mt-6">
          <input type="checkbox" checked={useSidereal} onChange={(e) => setUseSidereal(e.target.checked)} />
          Sidereal (apply ayanāṁśa)
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Ayanāṁśa (°)</span>
          <input type="number" step="0.001" value={ayanamsha} onChange={(e) => setAyanamsha(parseFloat(e.target.value || "0"))} className="border rounded-lg px-3 py-2 w-28" />
        </label>

        <div className="flex gap-2 mt-6 flex-wrap">
          {AY_PRESETS.map((p) => (
            <button key={p.name} onClick={() => setAyanamsha(p.val)} className="text-xs border rounded-full px-3 py-1 bg-slate-50 hover:bg-slate-100">
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={showOuterPlanets} onChange={(e)=>setShowOuterPlanets(e.target.checked)} /> Show Uranus/Neptune/Pluto</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showNakshatraGrid} onChange={(e)=>setShowNakshatraGrid(e.target.checked)} /> Show Nakshatra grid</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showAspects} onChange={(e)=>setShowAspects(e.target.checked)} /> Show aspects</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={useMeanNode} onChange={(e)=>setUseMeanNode(e.target.checked)} /> Mean node Rahu/Ketu (True node coming soon)</label>
        {showAspects && (
          <>
            <span className="text-slate-500">Aspects:</span>
            {[0,60,90,120,180].map(a => (
              <label key={`asp-${a}`} className="flex items-center gap-1">
                <input type="checkbox" checked={!!enabledAspects[a]} onChange={() => setEnabledAspects(prev=>({...prev, [a]: !prev[a]}))} />{a}°
              </label>
            ))}
            <label className="flex items-center gap-2">
              Orb
              <input type="number" min={0} max={10} step={0.5} value={aspectOrb} onChange={(e)=>setAspectOrb(parseFloat(e.target.value||"0"))} className="border rounded px-2 py-1 w-20" />°
            </label>
          </>
        )}
      </div>

      <Wheel 
        date={date}
        ayanamshaDeg={ayanamsha}
        useSidereal={useSidereal}
        showOuterPlanets={showOuterPlanets}
        showNakshatraGrid={showNakshatraGrid}
        showAspects={showAspects}
        aspectOrb={aspectOrb}
        enabledAspects={enabledAspects}
        useMeanNode={useMeanNode}
      />

      <div className="mt-6 text-xs text-slate-500">
        <p>Tip: Set ayanāṁśa to <span className="font-semibold">0°</span> to view tropical placements. For Vedic use, keep Sidereal on and pick your preferred ayanāṁśa value.</p>
      </div>
    </div>
  );
}
