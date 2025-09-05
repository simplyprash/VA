import React, { useEffect, useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";

// ---------- Helpers ----------
const DEG2RAD = Math.PI / 180;
function norm360(d) { let x = d % 360; if (x < 0) x += 360; return x; }

// Zodiac labels in Devanagari (safe \uXXXX escapes)
const SIGNS = [
  { name: "Aries",       short: "\u092e\u0947\u0937" },       // मेष
  { name: "Taurus",      short: "\u0935\u0943\u0937\u092d" }, // वृषभ
  { name: "Gemini",      short: "\u092e\u093f\u0925\u0941\u0928" }, // मिथुन
  { name: "Cancer",      short: "\u0915\u0930\u094d\u0915" }, // कर्क
  { name: "Leo",         short: "\u0938\u093f\u0902\u0939" }, // सिंह
  { name: "Virgo",       short: "\u0915\u0928\u094d\u092f\u093e" }, // कन्या
  { name: "Libra",       short: "\u0924\u0941\u0932\u093e" }, // तुला
  { name: "Scorpio",     short: "\u0935\u0943\u0936\u094d\u091a\u093f\u0915" }, // वृश्चिक
  { name: "Sagittarius", short: "\u0927\u0928\u0941" },       // धनु
  { name: "Capricorn",   short: "\u092e\u0915\u0930" },       // मकर
  { name: "Aquarius",    short: "\u0915\u0941\u0902\u092d" }, // कुंभ
  { name: "Pisces",      short: "\u092e\u0940\u0928" }        // मीन
];

// 27 Nakshatras (English + Devanagari in safe escapes)
const NAKSHATRAS = [
  { en: "Ashwini",           dev: "\u0905\u0936\u094d\u0935\u093f\u0928\u0940" },
  { en: "Bharani",           dev: "\u092d\u0930\u0923\u0940" },
  { en: "Krittika",          dev: "\u0915\u0943\u0924\u094d\u0924\u093f\u0915\u093e" },
  { en: "Rohini",            dev: "\u0930\u094b\u0939\u093f\u0923\u0940" },
  { en: "Mrigashira",        dev: "\u092e\u0943\u0917\u0936\u0940\u0930\u094d\u0937\u093e" },
  { en: "Ardra",             dev: "\u0906\u0930\u094d\u0926\u094d\u0930\u093e" },
  { en: "Punarvasu",         dev: "\u092a\u0941\u0928\u0930\u094d\u0935\u0938\u0941" },
  { en: "Pushya",            dev: "\u092a\u0941\u0937\u094d\u092f" },
  { en: "Ashlesha",          dev: "\u0906\u0936\u094d\u0932\u0947\u0937\u093e" },
  { en: "Magha",             dev: "\u092e\u0918\u093e" },
  { en: "Purva Phalguni",    dev: "\u092a\u0942\u0930\u094d\u0935\u092b\u0932\u094d\u0917\u0941\u0928\u0940" },
  { en: "Uttara Phalguni",   dev: "\u0909\u0924\u094d\u0924\u0930\u092b\u0932\u094d\u0917\u0941\u0928\u0940" },
  { en: "Hasta",             dev: "\u0939\u0938\u094d\u0924" },
  { en: "Chitra",            dev: "\u091a\u093f\u0924\u094d\u0930\u093e" },
  { en: "Swati",             dev: "\u0938\u094d\u0935\u093e\u0924\u0940" },
  { en: "Vishakha",          dev: "\u0935\u093f\u0936\u093e\u0916\u093e" },
  { en: "Anuradha",          dev: "\u0905\u0928\u0941\u0930\u093e\u0927\u093e" },
  { en: "Jyeshtha",          dev: "\u091c\u094d\u092f\u0947\u0937\u094d\u0920\u093e" },
  { en: "Mula",              dev: "\u092e\u0942\u0932\u093e" },
  { en: "Purva Ashadha",     dev: "\u092a\u0942\u0930\u094d\u0935\u093e\u0937\u093e\u0922\u093c\u093e" },
  { en: "Uttara Ashadha",    dev: "\u0909\u0924\u094d\u0924\u0930\u093e\u0937\u093e\u0922\u093c\u093e" },
  { en: "Shravana",          dev: "\u0936\u094d\u0930\u0935\u0923" },
  { en: "Dhanishta",         dev: "\u0927\u0928\u093f\u0937\u094d\u091f\u093e" },
  { en: "Shatabhisha",       dev: "\u0936\u0924\u092d\u093f\u0937\u093e" },
  { en: "Purva Bhadrapada",  dev: "\u092a\u0942\u0930\u094d\u0935\u092d\u093e\u0926\u094d\u0930\u092a\u0926\u093e" },
  { en: "Uttara Bhadrapada", dev: "\u0909\u0924\u094d\u0924\u0930\u092d\u093e\u0926\u094d\u0930\u092a\u0926\u093e" },
  { en: "Revati",            dev: "\u0930\u0947\u0935\u0924\u0940" }
];
const RASI_DEV = "\u0930\u093e\u0936\u093f";
const NAK_SIZE = 360/27;       // 13°20′ per nakshatra
const PADA_SIZE = NAK_SIZE/4;  // 3°20′ per pada
function nakshatraOf(siderealLon) {
  const lon = norm360(siderealLon);
  const idx = Math.floor(lon / NAK_SIZE);
  const within = lon - idx * NAK_SIZE;
  const pada = Math.floor(within / PADA_SIZE) + 1; // 1..4
  const item = NAKSHATRAS[idx];
  return { index: idx, name: item.en, dev: item.dev, pada };
}

function zodiacBreakdown(longitudeDeg) {
  const lon = norm360(longitudeDeg);
  const signIndex = Math.floor(lon / 30);
  const inSign = lon % 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign - d) * 60);
  return { signIndex, sign: SIGNS[signIndex].name, signGlyph: SIGNS[signIndex].short, deg: d, min: m, raw: lon };
}

// Mean lunar node (Meeus) — tropical
function meanLunarNodeLongitude(date) {
  const JD = (date.getTime() / 86400000) + 2440587.5;
  const T = (JD - 2451545.0) / 36525.0;
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

function Wheel({ date, ayanamshaDeg, useSidereal, showOuterPlanets, showNakshatraGrid, showAspects, aspectOrb, enabledAspects, useMeanNode, observer, showAsc, showHouses }) {
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
    const a = (0 - angleDeg) * DEG2RAD;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const hasAspect = (a, b) => {
    const ang = Math.min(norm360(a - b), norm360(b - a));
    return Object.keys(enabledAspects)
      .filter(k => enabledAspects[k])
      .map(k => parseFloat(k))
      .some(target => Math.abs(ang - target) <= aspectOrb);
  };

  // Ascendant & whole-sign houses
  const eps = Astronomy.Tilt(date).eps; // obliquity in deg
  function raDecFromLambda(lambdaDeg) {
    const epsRad = eps * DEG2RAD; const lam = lambdaDeg * DEG2RAD;
    const sinlam = Math.sin(lam), coslam = Math.cos(lam);
    const coseps = Math.cos(epsRad), sineps = Math.sin(epsRad);
    const dec = Math.asin(sinlam * sineps) / DEG2RAD; // deg
    const ra = Math.atan2(sinlam * coseps, coslam) / (15 * Math.PI/180); // hours
    return { ra, dec };
  }
  function ascendantLongitude(date, obs) {
    let bestLam = 0, bestScore = 1e9, bestAzErr = 1e9;
    for (let lam=0; lam<360; lam+=5) {
      const { ra, dec } = raDecFromLambda(lam);
      const h = Astronomy.Horizon(date, { latitude: obs.lat, longitude: obs.lon, height: obs.elev }, ra, dec, 'normal');
      const score = Math.abs(h.alt);
      const azErr = Math.abs((h.az||0) - 90);
      if (h.az>45 && h.az<135 && (score < bestScore || (Math.abs(score-bestScore)<0.01 && azErr < bestAzErr))) { bestScore = score; bestAzErr = azErr; bestLam = lam; }
    }
    // refine
    let lam = bestLam; let step = 1;
    for (let iter=0; iter<3; iter++) {
      let localBest = lam, localScore = 1e9;
      for (let x=lam-5; x<=lam+5; x+=step) {
        const { ra, dec } = raDecFromLambda(norm360(x));
        const h = Astronomy.Horizon(date, { latitude: obs.lat, longitude: obs.lon, height: obs.elev }, ra, dec, 'normal');
        const score = Math.abs(h.alt) + 0.01*Math.abs((h.az||0)-90);
        if (score < localScore) { localScore = score; localBest = norm360(x); }
      }
      lam = localBest; step /= 5;
    }
    return norm360(lam);
  }
  const ascLon = ascendantLongitude(date, observer);
  const ascSignStart = Math.floor(ascLon/30)*30;
  const houseCusps = Array.from({length:12}, (_,i)=> norm360(ascSignStart + i*30));

  // label clustering to reduce overlap
  function computeLabelLevels(pts, thresholdDeg = 3) {
    if (!pts || pts.length === 0) return new Map();
    const arr = pts.map((p, i) => ({ i, lon: p.lon })).sort((a, b) => a.lon - b.lon);
    const groups = [];
    let group = [arr[0]];
    for (let k = 1; k < arr.length; k++) {
      const prev = arr[k - 1];
      const curr = arr[k];
      if (curr.lon - prev.lon <= thresholdDeg) group.push(curr);
      else { groups.push(group); group = [curr]; }
    }
    groups.push(group);
    const first = arr[0], last = arr[arr.length - 1];
    if ((first.lon + 360 - last.lon) <= thresholdDeg && groups.length > 1) {
      const tail = groups.pop();
      groups[0] = tail.concat(groups[0]);
    }
    const map = new Map();
    groups.forEach(g => g.forEach((e, idx) => map.set(e.i, idx)));
    return map;
  }
  const labelLevels = computeLabelLevels(points, 3);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <svg width={size} height={size} className="rounded-2xl shadow border bg-white">
        <defs>
          <radialGradient id="wheelBg" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width={size} height={size} fill="url(#wheelBg)"/>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={outer} fill="#fff" stroke="#0f172a" strokeWidth={2} />

        {/* 12 sign wedges grid with external labels */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30;
          const p = angleToXY(angle, outer);
          const mid = angle + 15;
          const m = angleToXY(mid, outer + 34);
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

        {/* Houses (whole sign) */}
        {showHouses && houseCusps.map((ang,idx)=>{
          const p = angleToXY(ang, outer);
          return <line key={`house-${idx}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth={1} />
        })}

        {/* Ascendant */}
        {showAsc && (()=>{ const p = angleToXY(ascLon, outer); return <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1d4ed8" strokeWidth={2} /> })()}

        {/* Aspect lines */}
        {showAspects && points.map((a,i) => (
          points.slice(i+1).map((b,j) => {
            if (!hasAspect(a.lon, b.lon)) return null;
            const pa = angleToXY(a.lon, inner);
            const pb = angleToXY(b.lon, inner);
            return <line key={`asp-${i}-${j}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#64748b" strokeWidth={1} opacity={0.6} />
          })
        ))}

        {/* Planet markers with de-overlapped labels */}
        {points.map((p, idx) => {
          const pos = angleToXY(p.lon, inner);
          const lvl = labelLevels.get(idx) || 0;
          const lab = angleToXY(p.lon, inner + 26 + lvl * 14);
          const label = zodiacBreakdown(p.lon);
          return (
            <g key={`p-${p.key}`}>
              <circle cx={pos.x} cy={pos.y} r={7} fill={p.color} stroke="#0f172a" strokeWidth={1} filter="url(#softGlow)" />
              <line x1={pos.x} y1={pos.y} x2={lab.x} y2={lab.y} stroke={p.color} strokeWidth={1} />
              <text x={lab.x} y={lab.y - 4} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 12, fontWeight: 700 }}>{p.key}</text>
              <text x={lab.x} y={lab.y + 10} textAnchor="middle" className="fill-slate-600" style={{ fontSize: 11 }}>{`${label.deg}°${label.min.toString().padStart(2, "0")}′`}</text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={4} fill="#0f172a" />
      </svg>

      {/* Listing + controls */}
      <div className="min-w-[360px] max-w-[520px]">
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
              <th className="pb-1">Rasi ({RASI_DEV})</th>
              <th className="pb-1">Nakshatra</th>
              <th className="pb-1">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const z = zodiacBreakdown(p.lon);
              const sidLon = norm360(p.elon - ayanamshaDeg); // sidereal lon for nakshatra
              const nk = nakshatraOf(sidLon);
              return (
                <tr key={`row-${p.key}`} className="bg-slate-50">
                  <td className="px-2 py-1 font-semibold" style={{ color: p.color }}>{p.key}</td>
                  <td className="px-2 py-1">{z.signGlyph} {z.sign} {z.deg}°{z.min.toString().padStart(2, "0")}′</td>
                  <td className="px-2 py-1">{nk.dev} (pada {nk.pada})</td>
                  <td className="px-2 py-1">{z.raw.toFixed(3)}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

  // Place & TZ
  const [observer, setObserver] = useState({ lat: 19.0760, lon: 72.8777, elev: 0, label: 'Mumbai, IN' });
  const [tzOffset, setTzOffset] = useState(5.5); // hours offset from UTC
  const [showAsc, setShowAsc] = useState(true);
  const [showHouses, setShowHouses] = useState(true);

  function parseLocalIsoToUtcMs(iso, offsetHours) {
    const [d, t] = iso.split('T');
    const [Y, M, D] = d.split('-').map(Number);
    const [h, m] = t.split(':').map(Number);
    return Date.UTC(Y, M - 1, D, h, m) - offsetHours * 3600000;
  }
  const baseUtcMs = useMemo(() => parseLocalIsoToUtcMs(whenIso, tzOffset), [whenIso, tzOffset]);
  const baseDate = useMemo(() => new Date(baseUtcMs), [baseUtcMs]);

  const [offsetHours, setOffsetHours] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepHours, setStepHours] = useState(6);
  const [rangeDays, setRangeDays] = useState(90);
  const [tickMs, setTickMs] = useState(200);

  const date = useMemo(() => new Date(baseUtcMs + offsetHours * 3600000), [baseUtcMs, offsetHours]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setOffsetHours(h => {
        const limit = rangeDays * 24;
        const next = h + stepHours;
        if (next > limit) return -limit;
        if (next < -limit) return limit;
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [isPlaying, stepHours, tickMs, rangeDays]);

  // expose setters for inline controls
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
      <h1 className="text-2xl font-extrabold mb-2">Vedic Zodiac Wheel — Earth-Centered (v2.4)</h1>
      <p className="text-slate-600 mb-4">Place & UTC offset, Ascendant line, whole-sign houses, de-overlapped labels, nakshatra table, aspects, PNG export, and time scroller.</p>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Date & Time (local for chosen UTC offset)</span>
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

      {/* Place & Timezone */}
      <div className="mb-4 p-3 bg-slate-50 rounded-xl border">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Latitude</span>
            <input type="number" step="0.0001" value={observer.lat} onChange={(e)=>setObserver(o=>({...o, lat: parseFloat(e.target.value||"0")}))} className="border rounded px-2 py-1 w-36" />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Longitude</span>
            <input type="number" step="0.0001" value={observer.lon} onChange={(e)=>setObserver(o=>({...o, lon: parseFloat(e.target.value||"0")}))} className="border rounded px-2 py-1 w-36" />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Elevation (m)</span>
            <input type="number" step="1" value={observer.elev} onChange={(e)=>setObserver(o=>({...o, elev: parseFloat(e.target.value||"0")}))} className="border rounded px-2 py-1 w-32" />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">UTC Offset (hrs)</span>
            <input type="number" step="0.25" value={tzOffset} onChange={(e)=>setTzOffset(parseFloat(e.target.value||"0"))} className="border rounded px-2 py-1 w-32" />
          </label>
          <div className="flex gap-2 mt-6">
            <button className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100" onClick={()=>{ setObserver({lat:19.0760, lon:72.8777, elev:0, label:'Mumbai, IN'}); setTzOffset(5.5); }}>Mumbai</button>
            <button className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100" onClick={()=>{ setObserver({lat:40.7128, lon:-74.0060, elev:10, label:'New York, US'}); setTzOffset(-4); }}>New York</button>
            <button className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100" onClick={()=>{ setObserver({lat:51.5072, lon:-0.1276, elev:15, label:'London, UK'}); setTzOffset(1); }}>London</button>
            <button className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100" onClick={()=>{ if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(pos => { setObserver(o=>({...o, lat: pos.coords.latitude, lon: pos.coords.longitude, label:'My location'})); }); } }}>Use my location</button>
          </div>
          <div className="ml-auto flex gap-4 mt-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={showAsc} onChange={(e)=>setShowAsc(e.target.checked)} /> Show Ascendant</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showHouses} onChange={(e)=>setShowHouses(e.target.checked)} /> Whole-sign houses</label>
          </div>
        </div>
      </div>

      {/* Time scroller */}
      <div className="mb-4 p-3 bg-slate-50 rounded-xl border">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setOffsetHours(h => h - stepHours)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">◀︎</button>
          <button onClick={() => setIsPlaying(p => !p)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">{isPlaying ? "Pause" : "Play"}</button>
          <button onClick={() => setOffsetHours(h => h + stepHours)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">▶︎</button>
          <button onClick={() => setOffsetHours(0)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">Reset</button>
          <span className="mx-2 text-slate-600 text-sm">Step</span>
          <select value={stepHours} onChange={(e)=>setStepHours(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">
            {[1,3,6,12,24].map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
          <span className="mx-2 text-slate-600 text-sm">Range</span>
          <select value={rangeDays} onChange={(e)=>setRangeDays(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">
            {[30,90,180,365].map(d => <option key={d} value={d}>{d}d</option>)}
          </select>
          <span className="mx-2 text-slate-600 text-sm">Speed</span>
          <select value={tickMs} onChange={(e)=>setTickMs(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">
            <option value={50}>fast</option>
            <option value={200}>normal</option>
            <option value={500}>slow</option>
          </select>
        </div>
        <input type="range" min={-rangeDays*24} max={rangeDays*24} step={1} value={offsetHours} onChange={(e)=>setOffsetHours(parseInt(e.target.value))} className="w-full mt-3" />
        <div className="text-xs text-slate-600 mt-1">
          Base: {new Date(baseUtcMs + tzOffset*3600000).toLocaleString(undefined,{ dateStyle: "medium", timeStyle: "short"})} •
          {" "}Offset: {offsetHours}h •
          {" "}Showing: {new Date(baseUtcMs + (offsetHours + tzOffset)*3600000).toLocaleString(undefined,{ dateStyle: "medium", timeStyle: "short"})} •
          {" "}UTC{tzOffset>=0?'+':''}{tzOffset}h
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
        observer={observer}
        showAsc={showAsc}
        showHouses={showHouses}
      />

      <div className="mt-6 text-xs text-slate-500">
        <p>Tip: Set ayanāṁśa to <span className="font-semibold">0°</span> to view tropical placements. For Vedic use, keep Sidereal on and pick your preferred ayanāṁśa value.</p>
      </div>
    </div>
  );
}
