/*
  Splash.jsx — logo animation when the app opens (like Facebook / Instagram), plus the shared <Logo />.

  Usage (App.jsx):
    const [splash, setSplash] = useState(true);
    {splash && <Splash onDone={() => setSplash(false)} />}

  The app renders underneath while the splash plays, so it never delays loading.
  People who prefer reduced motion get a short, still version.
*/
import { useEffect, useState } from "react";

const AMBER = "#c97b3d";

// The paper-plane mark. Swap the two paths for your own logo SVG whenever you like.
export function Logo({ size = 30, word = true, fold = "#120f0a" }) {
  return (
    <span className="tz-logo" style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.3) }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 2 15 22l-4-9-9-4 20-7z" fill={AMBER} stroke={AMBER} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M22 2 11 13" fill="none" stroke={fold} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {word && (
        <span style={{ fontFamily: '"Iowan Old Style",Georgia,"Times New Roman",serif', fontWeight: 600, fontSize: Math.round(size * 0.8), letterSpacing: "-.01em", color: "#f4ede1" }}>
          Tranzle
        </span>
      )}
    </span>
  );
}

export default function Splash({ onDone, ms = 2300 }) {
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [out, setOut] = useState(false);

  useEffect(() => {
    const total = reduce ? 700 : ms;
    const t1 = setTimeout(() => setOut(true), total);
    const t2 = setTimeout(() => onDone && onDone(), total + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ms, reduce, onDone]);

  return (
    <div className={`tz-sp ${out ? "out" : ""} ${reduce ? "still" : ""}`} role="status" aria-label="Loading Tranzle">
      <style>{CSS}</style>
      <div className="tz-sp-in">
        <svg className="tz-sp-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path className="tz-sp-fill" d="M22 2 15 22l-4-9-9-4 20-7z" />
          <path className="tz-sp-line" pathLength="1" d="M22 2 15 22l-4-9-9-4 20-7z" />
          <path className="tz-sp-fold" pathLength="1" d="M22 2 11 13" />
        </svg>
        <div className="tz-sp-word">Tranzle</div>
        <div className="tz-sp-tag">Meet the world. Play together.</div>
      </div>
    </div>
  );
}

const CSS = `
.tz-sp{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;background:#0d0b08;transition:opacity .5s ease,visibility .5s}
.tz-sp.out{opacity:0;visibility:hidden}
.tz-sp-in{display:flex;flex-direction:column;align-items:center;gap:14px;padding:0 24px;text-align:center}
.tz-sp-mark{width:92px;height:92px;overflow:visible}
.tz-sp-line{fill:none;stroke:#c97b3d;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:tz-draw .95s .15s cubic-bezier(.65,0,.35,1) forwards}
.tz-sp-fill{fill:#c97b3d;opacity:0;animation:tz-fillin .4s .95s ease-out forwards}
.tz-sp-fold{fill:none;stroke:#0d0b08;stroke-width:1.4;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:tz-draw .35s 1.05s ease-out forwards}
.tz-sp-mark{animation:tz-lift .7s 1.2s cubic-bezier(.2,.8,.2,1) both}
.tz-sp-word{font-family:"Iowan Old Style",Georgia,"Times New Roman",serif;font-weight:600;font-size:38px;letter-spacing:-.01em;color:#f4ede1;opacity:0;transform:translateY(8px);animation:tz-up .55s 1.25s ease-out forwards}
.tz-sp-tag{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;color:#a39379;opacity:0;animation:tz-up .5s 1.55s ease-out forwards}
.tz-sp.still .tz-sp-line,.tz-sp.still .tz-sp-fold{animation:none;stroke-dashoffset:0}
.tz-sp.still .tz-sp-fill,.tz-sp.still .tz-sp-word,.tz-sp.still .tz-sp-tag{animation:none;opacity:1;transform:none}
.tz-sp.still .tz-sp-mark{animation:none}
@keyframes tz-draw{to{stroke-dashoffset:0}}
@keyframes tz-fillin{to{opacity:1}}
@keyframes tz-lift{from{transform:translate(0,0)}60%{transform:translate(3px,-5px) rotate(4deg)}to{transform:translate(0,-4px)}}
@keyframes tz-up{to{opacity:1;transform:none}}
`;
