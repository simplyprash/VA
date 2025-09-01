import React, { useEffect, useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";

/**
 * Vedic Zodiac Wheel — Interactive Planet Viewer
 * ------------------------------------------------
 * • Earth at center, 12 zodiac signs as background grid (tropical by default)
 * • Choose date/time; shows geocentric ecliptic longitudes for Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn
 * • Also computes mean lunar nodes: Rahu (ascending) & Ketu (descending = Rahu + 180°)
 * • Optional sidereal view via ayanāṁśa offset (you can pick Lahiri, etc., by entering the offset).
 *
 * Notes
 * - Longitudes are true ecliptic-of-date (ECT) from Astronomy Engine, then optionally shifted by ayanāṁśa.
 * - For Vedic/sidereal, toggle "Sidereal" and set ayanāṁśa (e.g., Lahiri ≈ 24.1° in 2025).  
 * - Rahu/Ketu use mean node formula (Meeus-style polynomial). Many jyotiṣa softwares offer both mean & true nodes.
 */

// ---------- Helpers ----------
const TAU = Math.PI * 2;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function norm360(d) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function fmtDMS(deg) {
  const d = Math.floor(deg);
  const mFloat = (deg - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${d}° ${m.toString().padStart(2, "0")}′ ${s.toString().padStart(2, "0")}″`;
}

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
  return {
    signIndex,
    sign: SIGNS[signIndex].name,
    signGlyph: SIGNS[signIndex].short,
    deg: d,
    min: m,
    raw: lon
  };
}

/** Mean lunar ascending node (Rahu) – degrees, true ecliptic of date (tropical). 
 *  Source: Meeus-style polynomial (approx). Accurate to a few arcminutes for most modern dates.
 */
function meanLunarNodeLongitude(date) {
  // Julian centuries T from J2000
  const JD = (date.getTime() / 86400000) + 2440587.5; // Unix epoch to JD
  const T = (JD - 2451545.0) / 36525.0;
  // Mean longitude of the lunar ascending node Ω (deg) – IAU 1980/Meeus
  const omega = 125.04455501 - 1934.13626197 * T + 0.0020762 * T * T + (T * T * T) / 467410 - (T * T * T * T) / 60616000;
  return norm360(omega);
}

// Astronomy Engine bodies we care about
const BODIES = [
  { key: "Sun", body: Astronomy.Body.Sun, color: "#ffb703" },
  { key: "Moon", body: Astronomy.Body.Moon, color: "#8ecae6" },
  { key: "Mercury", body: Astronomy.Body.Mercury, color: "#adb5bd" },
  { key: "Venus", body: Astronomy.Body.Venus, color: "#ffafcc" },
  { key: "Mars", body: Astronomy.Body.Mars, color: "#e63946" },
  { key: "Jupiter", body: Astronomy.Body.Jupiter, color: "#ffd166" },
  { key: "Saturn", body: Astronomy.Body.Saturn, color: "#cdb4db" }
];

function usePlanetLongitudes(date) {
  return useMemo(() => {
    const results = [];
    for (const item of BODIES) {
      // Geocentric vector of body at given time (aberration true)
      const vec = Astronomy.GeoVector(item.body, date, true);
      // Convert to true ecliptic-of-date spherical coords
      const ecl = Astronomy.Ecliptic(vec);
      results.push({ key: item.key, color: item.color, elon: norm360(ecl.elon) });
    }
    // Rahu/Ketu (mean nodes)
    const rahu = meanLunarNodeLongitude(date);
    const ketu = norm360(rahu + 180);
    results.push({ key: "Rahu (Mean)", color: "#2a9d8f", elon: rahu });
    results.push({ key: "Ketu (Mean)", color: "#264653", elon: ketu });
    return results;
  }, [date]);
}

function Wheel({ date, ayanamshaDeg, useSidereal }) {
  const planets = usePlanetLongitudes(date);

  const points = planets.map(p => {
    const lon = useSidereal ? norm360(p.elon - ayanamshaDeg) : p.elon;
    return { ...p, lon };
  });

  // SVG geometry
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const outer = 300;
  const inner = 230; // where planet markers sit

  function angleToXY(angleDeg, r) {
    const a = (90 - angleDeg) * DEG2RAD; // 0° at Aries (to the right), rotate so 0° Aries is at 3 o'clock -> here we use 0° at 0° Aries pointing right, but SVG 0° is to the right; use 90-offset to put 0° at top if desired.
    // For wheel styling, put 0° Aries at the right (3 o'clock). If you prefer 0° at top, change to a = (-angleDeg) * DEG2RAD;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <svg width={size} height={size} className="rounded-2xl shadow border bg-white">
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={outer} fill="#fff" stroke="#0f172a" strokeWidth={2} />

        {/* 12 sign wedges grid */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30;
          const { x, y } = angleToXY(angle, outer);
          return (
            <g key={`grid-${i}`}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#94a3b8" strokeWidth={1} />
              {/* Sign labels at mid-arc */}
              {(() => {
                const mid = angle + 15;
                const p = angleToXY(mid, outer - 24);
                return (
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-700" style={{ fontSize: 16, fontWeight: 700 }}>
                    {SIGNS[i].short}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* 5° minor ticks */}
        {Array.from({ length: 72 }).map((_, i) => {
          const angle = i * 5;
          const p1 = angleToXY(angle, outer);
          const p2 = angleToXY(angle, outer - (i % 6 === 0 ? 18 : 10));
          return <line key={`tick-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#cbd5e1" strokeWidth={i % 6 === 0 ? 1.5 : 1} />;
        })}

        {/* Inner ring for planets */}
        <circle cx={cx} cy={cy} r={inner} fill="none" stroke="#e2e8f0" strokeWidth={1} />

        {/* Planet markers */}
        {points.map((p, idx) => {
          const pos = angleToXY(p.lon, inner);
          const label = zodiacBreakdown(p.lon);
          return (
            <g key={`p-${p.key}`}> 
              <circle cx={pos.x} cy={pos.y} r={7} fill={p.color} stroke="#0f172a" strokeWidth={1} />
              {/* leader line */}
              <line x1={pos.x} y1={pos.y} x2={pos.x} y2={pos.y - 22} stroke={p.color} strokeWidth={1} />
              {/* text label slightly above */}
              <text x={pos.x} y={pos.y - 28} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 12, fontWeight: 700 }}>
                {p.key}
              </text>
              <text x={pos.x} y={pos.y - 14} textAnchor="middle" className="fill-slate-600" style={{ fontSize: 11 }}>
                {label.signGlyph} {label.deg}°{label.min.toString().padStart(2, "0")}′
              </text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={4} fill="#0f172a" />
      </svg>

      {/* Listing */}
      <div className="min-w-[320px] max-w-[420px]">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Placements</h2>
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

        <div className="mt-4 text-xs text-slate-500 leading-relaxed">
          <p>Mode: <span className="font-semibold">{useSidereal ? "Sidereal (ayanāṁśa applied)" : "Tropical (no ayanāṁśa)"}</span></p>
          <p>Engine: Astronomy Engine (geocentric true ecliptic-of-date). Rahu/Ketu = mean nodes.</p>
        </div>
      </div>
    </div>
  );
}

export default function VedicZodiacWheel() {
  const [whenIso, setWhenIso] = useState(() => {
    // Default to now in local time, formatted for datetime-local input.
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return iso;
  });
  const [useSidereal, setUseSidereal] = useState(true);
  const [ayanamsha, setAyanamsha] = useState(24.1); // degrees; adjust as you prefer (e.g., Lahiri ~24.1° in 2025)

  const date = useMemo(() => new Date(whenIso), [whenIso]);

  // Quick presets for popular ayanāṁśas (approx for mid-2025)
  const AY_PRESETS = [
    { name: "Lahiri (Chitra)", val: 24.10 },
    { name: "Raman", val: 22.50 },
    { name: "Krishnamurti", val: 23.86 },
    { name: "Fagan/Bradley (Western sidereal)", val: 24.42 }
  ];

  return (
    <div className="p-4 lg:p-6 font-sans text-slate-800">
      <h1 className="text-2xl font-extrabold mb-2">Vedic Zodiac Wheel — Earth‑Centered</h1>
      <p className="text-slate-600 mb-4">Pick a date/time. Toggle sidereal and set your ayanāṁśa. The wheel shows planetary longitudes against the 12 sign grid.</p>

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

      <Wheel date={date} ayanamshaDeg={ayanamsha} useSidereal={useSidereal} />

      <div className="mt-6 text-xs text-slate-500">
        <p>
          Tip: Set ayanāṁśa to <span className="font-semibold">0°</span> to view tropical placements. For Vedic use, keep Sidereal on and pick your preferred ayanāṁśa value.
        </p>
      </div>
    </div>
  );
}
