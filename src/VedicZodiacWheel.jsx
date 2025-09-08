'use client';

import React, { useEffect, useState } from 'react';
import * as Astronomy from 'astronomy-engine';

/* =============================================================
   Vedic Zodiac Wheel — FULL VERSION (client-safe, no useMemo)
   - ASC + Equal-House cusps (with lat/lon inputs)
   - Sidereal/tropical toggle with ayanamsha presets
   - Planets (incl. optional outers) + mean nodes
   - Aspect lines with toggles + orb
   - Devanagari/English sign labels; inside/outside toggle
   - Retrograde markers (℞) via +/-12h sampling
   - CSV export, Copy CSV, PNG export
   - ErrorBoundary to prevent white screens
   ============================================================= */

/* ------------------------------ Error Boundary ------------------------------ */
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(e, info){ console.error('ErrorBoundary caught:', e, info); }
  render(){
    if (this.state.error) {
      return (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
          <h2 className="font-bold mb-2">Render error</h2>
          <pre className="text-xs whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------ Helpers & Constants ------------------------------ */
const DEG2RAD = Math.PI / 180;
function norm360(d){ let x = d % 360; if (x < 0) x += 360; return x; }

const SIGNS = [
  { name: 'Aries',       short: '\u092e\u0947\u0937' },
  { name: 'Taurus',      short: '\u0935\u0943\u0937\u092d' },
  { name: 'Gemini',      short: '\u092e\u093f\u0925\u0941\u0928' },
  { name: 'Cancer',      short: '\u0915\u0930\u094d\u0915' },
  { name: 'Leo',         short: '\u0938\u093f\u0902\u0939' },
  { name: 'Virgo',       short: '\u0915\u0928\u094d\u092f\u093e' },
  { name: 'Libra',       short: '\u0924\u0941\u0932\u093e' },
  { name: 'Scorpio',     short: '\u0935\u0943\u0936\u094d\u091a\u093f\u0915' },
  { name: 'Sagittarius', short: '\u0927\u0928\u0941' },
  { name: 'Capricorn',   short: '\u092e\u0915\u0930' },
  { name: 'Aquarius',    short: '\u0915\u0941\u0902\u092d' },
  { name: 'Pisces',      short: '\u092e\u0940\u0928' }
];

const NAKSHATRAS = [
  { en: 'Ashwini',           dev: '\u0905\u0936\u094d\u0935\u093f\u0928\u0940' },
  { en: 'Bharani',           dev: '\u092d\u0930\u0923\u0940' },
  { en: 'Krittika',          dev: '\u0915\u0943\u0924\u094d\u0924\u093f\u0915\u093e' },
  { en: 'Rohini',            dev: '\u0930\u094b\u0939\u093f\u0923\u0940' },
  { en: 'Mrigashira',        dev: '\u092e\u0943\u0917\u0936\u0940\u0930\u094d\u0937\u093e' },
  { en: 'Ardra',             dev: '\u0906\u0930\u094d\u0926\u094d\u0930\u093e' },
  { en: 'Punarvasu',         dev: '\u092a\u0941\u0928\u0930\u094d\u0935\u0938\u0941' },
  { en: 'Pushya',            dev: '\u092a\u0941\u0937\u094d\u092f' },
  { en: 'Ashlesha',          dev: '\u0906\u0936\u094d\u0932\u0947\u0937\u093e' },
  { en: 'Magha',             dev: '\u092e\u0918\u093e' },
  { en: 'Purva Phalguni',    dev: '\u092a\u0942\u0930\u094d\u0935\u092b\u0932\u094d\u0917\u0941\u0928\u0940' },
  { en: 'Uttara Phalguni',   dev: '\u0909\u0924\u094d\u0924\u0930\u092b\u0932\u094d\u0917\u0941\u0928\u0940' },
  { en: 'Hasta',             dev: '\u0939\u0938\u094d\u0924' },
  { en: 'Chitra',            dev: '\u091a\u093f\u0924\u094d\u0930\u093e' },
  { en: 'Swati',             dev: '\u0938\u094d\u0935\u093e\u0924\u0940' },
  { en: 'Vishakha',          dev: '\u0935\u093f\u0936\u093e\u0916\u093e' },
  { en: 'Anuradha',          dev: '\u0905\u0928\u0941\u0930\u093e\u0927\u093e' },
  { en: 'Jyeshtha',          dev: '\u091c\u094d\u092f\u0947\u0937\u094d\u0920\u093e' },
  { en: 'Mula',              dev: '\u092e\u0942\u0932\u093e' },
  { en: 'Purva Ashadha',     dev: '\u092a\u0942\u0930\u094d\u0935\u093e\u0937\u093e\u0922\u093c\u093e' },
  { en: 'Uttara Ashadha',    dev: '\u0909\u0924\u094d\u0924\u0930\u093e\u0937\u093e\u0922\u093c\u093e' },
  { en: 'Shravana',          dev: '\u0936\u094d\u0930\u0935\u0923' },
  { en: 'Dhanishta',         dev: '\u0927\u0928\u093f\u0937\u094d\u091f\u093e' },
  { en: 'Shatabhisha',       dev: '\u0936\u0924\u092d\u093f\u0937\u093e' },
  { en: 'Purva Bhadrapada',  dev: '\u092a\u0942\u0930\u094d\u0935\u092d\u093e\u0926\u094d\u0930\u092a\u0926\u093e' },
  { en: 'Uttara Bhadrapada', dev: '\u0909\u0924\u094d\u0924\u0930\u092d\u093e\u0926\u094d\u0930\u092a\u0926\u093e' },
  { en: 'Revati',            dev: '\u0930\u0947\u0935\u0924\u0940' }
];

const NAK_SIZE = 360/27;       // 13°20′
const PADA_SIZE = NAK_SIZE/4;  // 3°20′

function nakshatraOf(siderealLon){
  const lon = norm360(siderealLon);
  const idx = Math.floor(lon/NAK_SIZE);
  const within = lon - idx*NAK_SIZE;
  const pada = Math.floor(within/PADA_SIZE) + 1;
  const item = NAKSHATRAS[idx];
  return { index: idx, name: item.en, dev: item.dev, pada };
}

function zodiacBreakdown(longitudeDeg){
  const lon = norm360(longitudeDeg);
  const signIndex = Math.floor(lon/30);
  const inSign = lon % 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign-d)*60);
  return { signIndex, sign: SIGNS[signIndex].name, signGlyph: SIGNS[signIndex].short, deg:d, min:m, raw:lon };
}

// Mean lunar node (Meeus) — tropical
function meanLunarNodeLongitude(date){
  const JD = date.getTime()/86400000 + 2440587.5;
  const T = (JD - 2451545.0)/36525.0;
  const omega = 125.04455501 - 1934.13626197*T + 0.0020762*T*T + (T*T*T)/467410 - (T*T*T*T)/60616000;
  return norm360(omega);
}

/* ------------------------------ ASC & Houses ------------------------------ */
function lstRadians(date, longitudeDeg){
  try{
    const sth = Astronomy.SiderealTime(date); // hours
    let lstDeg = sth*15 + (Number(longitudeDeg)||0);
    lstDeg = ((lstDeg%360)+360)%360; return lstDeg*DEG2RAD;
  }catch{ return 0; }
}

function computeAscendantDeg(date, latitudeDeg, longitudeDeg){
  // Robust numeric solution: find the ecliptic longitude (λ) on the horizon (alt≈0) with azimuth ≈ 90° (rising)
  const φ = Math.max(-89.9999, Math.min(89.9999, Number(latitudeDeg)||0)) * DEG2RAD; // rad
  const θ = lstRadians(date, Number(longitudeDeg)||0); // local sidereal angle in radians (east longitudes positive)

  // true obliquity (of-date)
  let epsDeg = 23.4392911; // fallback
  try {
    const tilt = Astronomy.EarthTilt(date) || {};
    epsDeg = Number.isFinite(tilt.obliq) ? tilt.obliq : (Number.isFinite(tilt.obl) ? tilt.obl : (Number.isFinite(tilt.eps) ? tilt.eps : epsDeg));
  } catch {}
  const ε = epsDeg * DEG2RAD;

  // helper: given ecliptic longitude (deg), return alt (rad) and az (deg)
  function altAzFromLambda(lambdaDeg){
    const λ = lambdaDeg * DEG2RAD;
    const sinλ = Math.sin(λ), cosλ = Math.cos(λ);
    const cosε = Math.cos(ε), sinε = Math.sin(ε);
    // Equatorial from ecliptic (β=0):
    const α = Math.atan2(sinλ * cosε, cosλ); // RA
    const δ = Math.asin(sinλ * sinε);        // Dec
    // Hour angle (normalize to -π..π for stability)
    let H = θ - α; H = Math.atan2(Math.sin(H), Math.cos(H));
    const sinφ = Math.sin(φ), cosφ = Math.cos(φ);
    const sinδ = Math.sin(δ), cosδ = Math.cos(δ);
    const sinAlt = sinφ * sinδ + cosφ * cosδ * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosAlt = Math.max(1e-12, Math.sqrt(Math.max(0, 1 - sinAlt*sinAlt))); // avoid division by 0
    const sinAz = -Math.sin(H) * cosδ / cosAlt;
    const cosAz = (sinδ - sinAlt * sinφ) / (cosAlt * cosφ);
    let A = Math.atan2(sinAz, cosAz) / DEG2RAD; // deg
    A = ((A % 360) + 360) % 360; // 0..360
    return { alt, az: A };
  }

  // Scan 0..360° to find horizon crossings (alt sign changes), then bisect to refine
  const roots = [];
  let prev = altAzFromLambda(0), prevAlt = prev.alt;
  const step = 5; // degrees
  for (let L = step; L <= 360; L += step) {
    const cur = altAzFromLambda(L); const curAlt = cur.alt;
    if ((prevAlt <= 0 && curAlt >= 0) || (prevAlt >= 0 && curAlt <= 0)) {
      // bracket [L-step, L]
      let a = L - step, b = L, fa = altAzFromLambda(a).alt, fb = altAzFromLambda(b).alt;
      for (let k = 0; k < 30; k++) { // bisection
        const m = 0.5 * (a + b); const fm = altAzFromLambda(m).alt;
        if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      }
      const mid = 0.5 * (a + b); const atMid = altAzFromLambda(mid);
      roots.push({ lambda: mid, az: atMid.az });
    }
    prevAlt = curAlt;
  }

  // Choose the EASTERN intersection (az ~ 90°)
  if (roots.length === 0) return 0; // fallback
  roots.sort((r1, r2) => Math.abs(r1.az - 90) - Math.abs(r2.az - 90));
  return ((roots[0].lambda % 360) + 360) % 360;
}

function equalHouseCusps(ascDeg){
  const base = Number.isFinite(+ascDeg) ? +ascDeg : 0;
  const out = []; for(let i=0;i<12;i++) out.push(norm360(base+30*i));
  return out;
}

/* ------------------------------ Ephemeris ------------------------------ */
const BODIES = [
  { key: 'Sun',     body: Astronomy.Body.Sun,     color: '#ffb703' },
  { key: 'Moon',    body: Astronomy.Body.Moon,    color: '#8ecae6' },
  { key: 'Mercury', body: Astronomy.Body.Mercury, color: '#adb5bd' },
  { key: 'Venus',   body: Astronomy.Body.Venus,   color: '#ffafcc' },
  { key: 'Mars',    body: Astronomy.Body.Mars,    color: '#e63946' },
  { key: 'Jupiter', body: Astronomy.Body.Jupiter, color: '#ffd166' },
  { key: 'Saturn',  body: Astronomy.Body.Saturn,  color: '#cdb4db' },
  { key: 'Uranus',  body: Astronomy.Body.Uranus,  color: '#94d2bd', optional: true },
  { key: 'Neptune', body: Astronomy.Body.Neptune, color: '#90caf9', optional: true },
  { key: 'Pluto',   body: Astronomy.Body.Pluto,   color: '#bfb8da', optional: true }
];

// Two-letter abbreviations for compact planet labels
const ABBR = {
  'Sun': 'Su', 'Moon': 'Mo', 'Mercury': 'Me', 'Venus': 'Ve', 'Mars': 'Ma', 'Jupiter': 'Ju', 'Saturn': 'Sa',
  'Uranus': 'Ur', 'Neptune': 'Ne', 'Pluto': 'Pl',
  'Rahu (Mean)': 'Ra', 'Ketu (Mean)': 'Ke',
  'Rahu (True – TBD)': 'Ra', 'Ketu (True – TBD)': 'Ke'
};

function planetLongitudes(date, useMeanNode){
  const results = [];
  for (const item of BODIES) {
    const vec = Astronomy.GeoVector(item.body, date, true);
    const ecl = Astronomy.Ecliptic(vec); // ecliptic-of-date
    results.push({ key: item.key, color: item.color, body: item.body, elon: norm360(ecl.elon), optional: !!item.optional });
  }
  const rahu = meanLunarNodeLongitude(date);
  const ketu = norm360(rahu + 180);
  results.push({ key: useMeanNode ? 'Rahu (Mean)' : 'Rahu (True – TBD)', color: '#2a9d8f', elon: rahu, isNode: true });
  results.push({ key: useMeanNode ? 'Ketu (Mean)' : 'Ketu (True – TBD)', color: '#264653', elon: ketu, isNode: true });
  return results;
}

/* ------------------------------ Collisions ------------------------------ */
function resolveCollisions(points, minSepDeg = 6){
  const sorted = [...points].sort((a,b)=>a.lon-b.lon);
  for(let i=1;i<sorted.length;i++){
    const prev = sorted[i-1], cur = sorted[i];
    const gap = Math.abs(norm360(cur.lon - prev.lon));
    if(gap < minSepDeg) cur._bump = (prev._bump || 0) + 1;
  }
  if(sorted.length>1){
    const first = sorted[0], last = sorted[sorted.length-1];
    const wrapGap = Math.abs(norm360(first.lon + 360 - last.lon));
    if(wrapGap < minSepDeg) first._bump = (last._bump || 0) + 1;
  }
  return points;
}

/* ------------------------------ SVG helpers ------------------------------ */
function angleToXY(angleDeg, r, cx, cy){ const a=(0-angleDeg)*DEG2RAD; return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) }; }

/* ------------------------------ Wheel Component ------------------------------ */
function Wheel({
  date, ayanamshaDeg, useSidereal,
  showOuterPlanets, showNakshatraGrid,
  showAspects, aspectOrb, enabledAspects, useMeanNode,
  labelsOutside = true, showDevanagari = true,
  lat, lon
}){
  const planets = planetLongitudes(date, useMeanNode);
  const filtered = planets.filter(p => showOuterPlanets || !p.optional);
  const points = filtered.map(p => ({ ...p, lon: useSidereal ? norm360(p.elon - ayanamshaDeg) : p.elon }));

  const ascTropical = computeAscendantDeg(date, lat, lon);
  const ascToUse = useSidereal ? norm360(ascTropical - ayanamshaDeg) : ascTropical;
  const houseCusps = equalHouseCusps(ascToUse);

  const size = 740; const cx = size/2, cy = size/2; const outer = 320, inner = 250;

  function hasAspect(a,b){
    const ang = Math.min(norm360(a-b), norm360(b-a));
    return Object.keys(enabledAspects).filter(k=>enabledAspects[+k]).map(k=>parseFloat(k)).some(target => Math.abs(ang - target) <= aspectOrb);
  }

  // CSV rows for export/copy
  const csvRows = [[ 'Body', 'Rasi', 'Nakshatra', 'Longitude' ]];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <svg width={size} height={size} className="rounded-2xl shadow border bg-white">
        <defs>
          <radialGradient id="wheelBg" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width={size} height={size} fill="url(#wheelBg)" />

        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={outer} fill="#fff" stroke="#0f172a" strokeWidth={2} />

        {/* 12 sign grid + labels (optionally outside) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30; const p = angleToXY(angle, outer, cx, cy);
          const mid = angle + 15; const labelR = labelsOutside ? (outer + 42) : (outer + 34); const m = angleToXY(mid, labelR, cx, cy);
          const textToShow = showDevanagari ? SIGNS[i].short : SIGNS[i].name;
          return (
            <g key={`grid-${i}`}>
              <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#94a3b8" strokeWidth={1} />
              <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-700" style={{ fontSize: 16, fontWeight: 700 }}>{textToShow}</text>
            </g>
          );
        })}

        {/* Nakshatra grid */}
        {showNakshatraGrid && (
          <g>
            {Array.from({ length: 27 }).map((_, i) => {
              const angle = i * (360/27); const p1 = angleToXY(angle, outer, cx, cy); const p2 = angleToXY(angle, outer-22, cx, cy);
              return <line key={`nak-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#f59e0b" strokeWidth={1} opacity={0.8} />;
            })}
            {Array.from({ length: 108 }).map((_, i) => {
              const angle = i * (360/108); const p1 = angleToXY(angle, outer, cx, cy); const p2 = angleToXY(angle, outer-12, cx, cy);
              return <line key={`pada-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fbbf24" strokeWidth={0.8} opacity={0.7} />;
            })}
          </g>
        )}

        {/* 5° ticks */}
        {Array.from({ length: 72 }).map((_, i) => {
          const angle = i * 5; const p1 = angleToXY(angle, outer, cx, cy); const p2 = angleToXY(angle, outer - (i % 6 === 0 ? 18 : 10), cx, cy);
          return <line key={`tick-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#cbd5e1" strokeWidth={i % 6 === 0 ? 1.5 : 1} />;
        })}

        {/* Inner ring */}
        <circle cx={cx} cy={cy} r={inner} fill="none" stroke="#e2e8f0" strokeWidth={1} />

        {/* House cusps + ASC glyph */}
        
        {(() => {
  const ascAngle = houseCusps[0];
  const p = angleToXY(ascAngle, outer, cx, cy);
  const pos = angleToXY(ascAngle, outer + 18, cx, cy);
  return (
    <>
      <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#0ea5e9" strokeWidth={2} opacity={0.95} />
      <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="fill-sky-600" style={{ fontSize: 14, fontWeight: 800 }}>ASC</text>
    </>
  );
})()}

        {/* Aspect lines */}
        {showAspects && points.map((a,i) => points.slice(i+1).map((b,j) => {
          const ang = Math.min(norm360(a.lon - b.lon), norm360(b.lon - a.lon));
          const enabled = Object.keys(enabledAspects).filter(k=>enabledAspects[+k]).map(k=>parseFloat(k));
          if (!enabled.some(t => Math.abs(ang - t) <= aspectOrb)) return null;
          const pa = angleToXY(a.lon, inner, cx, cy); const pb = angleToXY(b.lon, inner, cx, cy);
          return <line key={`asp-${i}-${j}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#64748b" strokeWidth={1} opacity={0.6} />;
        }))}

        {/* Planet markers */}
        {resolveCollisions(points.map(p=>({ ...p })), 6).map((p) => {
          const pos = angleToXY(p.lon, inner, cx, cy); const label = zodiacBreakdown(p.lon);
          const bump = (p._bump || 0); const stem = 22 + bump*14; const textY = 28 + bump*14;
          let retro = false; try {
            if (p.body && !p.isNode && p.key !== 'Sun' && p.key !== 'Moon') {
              const dtm = new Date(date.getTime() - 12*3600000); const dtp = new Date(date.getTime() + 12*3600000);
              const prev = Astronomy.Ecliptic(Astronomy.GeoVector(p.body, dtm, true)).elon;
              const next = Astronomy.Ecliptic(Astronomy.GeoVector(p.body, dtp, true)).elon;
              let delta = norm360(next - prev); if (delta > 180) delta -= 360; retro = delta < 0;
            }
          } catch {}
          return (
            <g key={`p-${p.key}`}>
              <circle cx={pos.x} cy={pos.y} r={7} fill={p.color} stroke="#0f172a" strokeWidth={1} />
              <line x1={pos.x} y1={pos.y} x2={pos.x} y2={pos.y - stem} stroke={p.color} strokeWidth={1} />
              <text x={pos.x} y={pos.y - textY} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 12, fontWeight: 700 }}>{(ABBR[p.key] || p.key.slice(0,2))}{retro ? " ℞" : ""}</text>
              <text x={pos.x} y={pos.y - (textY - 14)} textAnchor="middle" className="fill-slate-600" style={{ fontSize: 11 }}>{`${label.deg}°${String(label.min).padStart(2,'0')}′`}</text>
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r={4} fill="#0f172a" />
      </svg>

      {/* Side panel: placements + actions */}
      <div className="min-w-[360px] max-w-[520px]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-800">Placements</h2>
          <div className="flex gap-2">
            <button onClick={() => {
              try {
                const rows = csvRows || [];
                const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a');
                a.href = url; a.download = 'placements.csv'; a.click(); URL.revokeObjectURL(url);
              } catch { alert('CSV export failed'); }
            }} className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100">Export CSV</button>
            <button onClick={async () => {
              try { const rows = csvRows || []; const tsv = rows.map(r => r.join('\t')).join('\n'); await navigator.clipboard.writeText(tsv); alert('Copied placements to clipboard.'); }
              catch { alert('Copy failed.'); }
            }} className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100">Copy CSV</button>
            <button onClick={() => {
              try {
                const svg = document.querySelector('svg'); if (!svg) return;
                const xml = new XMLSerializer().serializeToString(svg);
                const svg64 = btoa(unescape(encodeURIComponent(xml)));
                const image64 = 'data:image/svg+xml;base64,' + svg64; const img = new Image();
                img.onload = function(){
                  const canvas = document.createElement('canvas');
                  const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
                  canvas.width = vb ? vb.width : (svg.width && svg.width.baseVal ? svg.width.baseVal.value : 740);
                  canvas.height = vb ? vb.height : (svg.height && svg.height.baseVal ? svg.height.baseVal.value : 740);
                  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0);
                  const link = document.createElement('a'); link.download = 'vedic-wheel.png'; link.href = canvas.toDataURL('image/png'); link.click();
                };
                img.src = image64;
              } catch { alert('PNG export failed'); }
            }} className="text-xs border rounded px-2 py-1 bg-slate-50 hover:bg-slate-100">Export PNG</button>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-3">{new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'medium' }).format(date)}</p>

        <table className="w-full text-sm border-separate border-spacing-y-1">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-1">Body</th>
              <th className="pb-1">Rasi (राशि)</th>
              <th className="pb-1">Nakshatra</th>
              <th className="pb-1">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {/* Ascendant row */}
            {(() => {
              const z = zodiacBreakdown(ascToUse); const sidLon = norm360(ascTropical - ayanamshaDeg); const nk = nakshatraOf(sidLon);
              csvRows.push(['Ascendant', `${z.sign} ${z.deg}°${String(z.min).padStart(2,'0')}′`, `${nk.name} (p${nk.pada})`, `${z.raw.toFixed(3)}°`]);
              return (
                <tr className="bg-slate-100">
                  <td className="px-2 py-1 font-semibold" style={{ color: '#0ea5e9' }}>Ascendant</td>
                  <td className="px-2 py-1">{z.sign} {z.deg}°{String(z.min).padStart(2,'0')}′</td>
                  <td className="px-2 py-1">{nk.dev} (pada {nk.pada})</td>
                  <td className="px-2 py-1">{z.raw.toFixed(3)}°</td>
                </tr>
              );
            })()}

            {/* Planet rows */}
            {points.map((p) => {
              const z = zodiacBreakdown(p.lon); const sidLon = norm360(p.elon - ayanamshaDeg); const nk = nakshatraOf(sidLon);
              csvRows.push([p.key, `${z.sign} ${z.deg}°${String(z.min).padStart(2,'0')}′`, `${nk.name} (p${nk.pada})`, `${z.raw.toFixed(3)}°`]);
              return (
                <tr key={`row-${p.key}`} className="bg-slate-50">
                  <td className="px-2 py-1 font-semibold" style={{ color: p.color }}>{p.key}</td>
                  <td className="px-2 py-1">{z.sign} {z.deg}°{String(z.min).padStart(2,'0')}′</td>
                  <td className="px-2 py-1">{nk.dev} (pada {nk.pada})</td>
                  <td className="px-2 py-1">{z.raw.toFixed(3)}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 text-xs text-slate-500 leading-relaxed space-y-2">
          <p>Mode: <span className="font-semibold">{useSidereal ? 'Sidereal (ayanāṁśa applied)' : 'Tropical (no ayanāṁśa)'}</span> • Nodes: <span className="font-semibold">{useMeanNode ? 'Mean' : 'True (TBD)'}</span></p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Page Component ------------------------------ */
export default function VedicZodiacWheel(){
  const [whenIso, setWhenIso] = useState(() => { const now=new Date(); const pad=n=>String(n).padStart(2,'0'); return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`; });
  const [useSidereal, setUseSidereal] = useState(true);
  const [ayanamsha, setAyanamsha] = useState(24.1);
  const [showOuterPlanets, setShowOuterPlanets] = useState(true);
  const [showNakshatraGrid, setShowNakshatraGrid] = useState(true);
  const [useMeanNode, setUseMeanNode] = useState(true);
  const [showAspects, setShowAspects] = useState(true);
  const [aspectOrb, setAspectOrb] = useState(6);
  const [enabledAspects, setEnabledAspects] = useState({ 0: true, 60: false, 90: true, 120: true, 180: true });
  const [labelsOutside, setLabelsOutside] = useState(true);
  const [showDevanagari, setShowDevanagari] = useState(true);
  const [lat, setLat] = useState(26.4499);
  const [lon, setLon] = useState(80.3319);

  const baseDate = new Date(whenIso);
  const [offsetHours, setOffsetHours] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepHours, setStepHours] = useState(6);
  const [rangeDays, setRangeDays] = useState(90);
  const [tickMs, setTickMs] = useState(200);
  const date = new Date(baseDate.getTime() + offsetHours*3600000);

  useEffect(() => {
    if(!isPlaying) return; const id = setInterval(() => {
      setOffsetHours(h => { const limit = rangeDays*24; const next = h + stepHours; if(next > limit) return -limit; if(next < -limit) return limit; return next; });
    }, tickMs); return () => clearInterval(id);
  }, [isPlaying, stepHours, tickMs, rangeDays]);

  const AY_PRESETS = [
    { name: 'Lahiri (Chitra)', val: 24.10 },
    { name: 'Raman', val: 22.50 },
    { name: 'Krishnamurti', val: 23.86 },
    { name: 'Fagan/Bradley (Western sidereal)', val: 24.42 }
  ];

  return (
    <ErrorBoundary>
      <div className="p-4 lg:p-6 font-sans text-slate-800">
        <h1 className="text-2xl font-extrabold mb-2">Vedic Zodiac Wheel — Earth-Centered (JS full)</h1>
        <p className="text-slate-600 mb-4">Sidereal option, outer planets, 27 nakshatra grid, aspects, retrograde, ASC + equal houses, overlap-safe labels, PNG/CSV export, and UI toggles.</p>

        {/* Date & Ayanamsha */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Date & Time</span>
            <input type="datetime-local" value={whenIso} onChange={(e)=>setWhenIso(e.target.value)} className="border rounded-lg px-3 py-2"/>
          </label>
          <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={useSidereal} onChange={e=>setUseSidereal(e.target.checked)}/> Sidereal (apply ayanāṁśa)</label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Ayanāṁśa (°)</span>
            <input type="number" step="0.001" value={ayanamsha} onChange={(e)=>setAyanamsha(parseFloat(e.target.value||'0'))} className="border rounded-lg px-3 py-2 w-28"/>
          </label>
          <div className="flex gap-2 mt-6 flex-wrap">
            {AY_PRESETS.map(p => (
              <button key={p.name} onClick={()=>setAyanamsha(p.val)} className="text-xs border rounded-full px-3 py-1 bg-slate-50 hover:bg-slate-100">{p.name}</button>
            ))}
          </div>
          {/* Location */}
          <div className="flex gap-3 items-end mt-2">
            <label className="text-sm"><span className="block text-slate-600 mb-1">Latitude (°)</span>
              <input type="number" step="0.0001" value={lat} onChange={e=>setLat(parseFloat(e.target.value||'0'))} className="border rounded-lg px-3 py-2 w-32"/>
            </label>
            <label className="text-sm"><span className="block text-slate-600 mb-1">Longitude (°E)</span>
              <input type="number" step="0.0001" value={lon} onChange={e=>setLon(parseFloat(e.target.value||'0'))} className="border rounded-lg px-3 py-2 w-32"/>
            </label>
          </div>
        </div>

        {/* Time scrubbing */}
        <div className="mb-4 p-3 bg-slate-50 rounded-xl border">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>setOffsetHours(h=>h-stepHours)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">◀︎</button>
            <button onClick={()=>setIsPlaying(p=>!p)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">{isPlaying?'Pause':'Play'}</button>
            <button onClick={()=>setOffsetHours(h=>h+stepHours)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">▶︎</button>
            <button onClick={()=>setOffsetHours(0)} className="px-2 py-1 text-sm border rounded hover:bg-slate-100">Reset</button>
            <span className="mx-2 text-slate-600 text-sm">Step</span>
            <select value={stepHours} onChange={e=>setStepHours(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">{[1,3,6,12,24].map(h=> <option key={h} value={h}>{h}h</option>)}</select>
            <span className="mx-2 text-slate-600 text-sm">Range</span>
            <select value={rangeDays} onChange={e=>setRangeDays(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">{[30,90,180,365].map(d=> <option key={d} value={d}>{d}d</option>)}</select>
            <span className="mx-2 text-slate-600 text-sm">Speed</span>
            <select value={tickMs} onChange={e=>setTickMs(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">
              <option value={50}>fast</option><option value={200}>normal</option><option value={500}>slow</option>
            </select>
          </div>
          <input type="range" min={-rangeDays*24} max={rangeDays*24} step={1} value={offsetHours} onChange={e=>setOffsetHours(parseInt(e.target.value))} className="w-full mt-3"/>
          <div className="text-xs text-slate-600 mt-1">Base: {new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(baseDate)} • Offset: {offsetHours}h • Showing: {new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date)}</div>
        </div>

        {/* Feature toggles */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={showOuterPlanets} onChange={e=>setShowOuterPlanets(e.target.checked)}/> Show Uranus/Neptune/Pluto</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showNakshatraGrid} onChange={e=>setShowNakshatraGrid(e.target.checked)}/> Show Nakshatra grid</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showAspects} onChange={e=>setShowAspects(e.target.checked)}/> Show aspects</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={useMeanNode} onChange={e=>setUseMeanNode(e.target.checked)}/> Mean node Rahu/Ketu (True node coming soon)</label>
          {showAspects && (<>
            <span className="text-slate-500">Aspects:</span>
            {[0,60,90,120,180].map(a=> (
              <label key={`asp-${a}`} className="flex items-center gap-1">
                <input type="checkbox" checked={!!enabledAspects[a]} onChange={()=>setEnabledAspects(prev=>({ ...prev, [a]: !prev[a] }))}/> {a}°
              </label>
            ))}
            <label className="flex items-center gap-2">Orb <input type="number" min={0} max={10} step={0.5} value={aspectOrb} onChange={e=>setAspectOrb(parseFloat(e.target.value||'0'))} className="border rounded px-2 py-1 w-20"/>°</label>
          </>)}
        </div>

        {/* UI toggles */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={labelsOutside} onChange={e=>setLabelsOutside(e.target.checked)}/> Zodiac labels outside</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showDevanagari} onChange={e=>setShowDevanagari(e.target.checked)}/> Show Devanagari rāśi</label>
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
          labelsOutside={labelsOutside}
          showDevanagari={showDevanagari}
          lat={lat}
          lon={lon}
        />
      </div>
    </ErrorBoundary>
  );
}
