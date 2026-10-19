/* ==========================================================================
   EMBER SOLITAIRE — Artifact definitions + forged artwork
   Each artifact is drawn as layered SVG so heat can be revealed progressively
   along the object (pommel → grip → guard → blade …) with a gradient mask.
   Raster tier art can replace any tier: set ES.Manifest.artifacts[id][tier]
   to an image path and the same heat mask is applied to it with CSS.
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};

  const TIERS = ['Broken Imitation', 'Reforged', 'Tempered', 'Masterwork', 'Heroic', 'Mythic', 'Legendary'];
  const TIER_LORE = [
    'An imitation of something greater.',
    'Broken no longer. The true work begins.',
    'Heat gives shape. Discipline gives strength.',
    'Few craftsmen ever reach this point.',
    'A creation worthy of a name.',
    'The forge remembers what the world has forgotten.',
    'There is nothing left to imitate.'
  ];

  /* heatStops: y (in the 200×400 viewBox) reached at 0,20,40,60,80,100 % heat */
  const LIST = [
    { id: 'sword', name: 'Ember Blade', type: 'Blade', category: 'weapons', unlock: 0,
      work: ['Strengthen the blade.', 'Fold the steel once more.', 'Temper the edge in the quench.', 'Engrave the fuller.', 'Set the ember stone.', 'Wake the molten veins.', 'Let the blade remember fire.'],
      heatStops: [396, 356, 294, 268, 150, 12] },
    { id: 'shield', name: 'Cinder Aegis', type: 'Shield', category: 'artifacts', unlock: 0,
      work: ['Hammer out the dents.', 'Rivet a new rim.', 'Temper the face.', 'Raise the boss.', 'Inlay the ember crest.', 'Bind the ward-runes.', 'Let it hold back the dark.'],
      heatStops: [376, 318, 262, 190, 118, 34] },
    { id: 'hammer', name: 'Forgeheart', type: 'Hammer', category: 'weapons', unlock: 0,
      work: ['Seat the head.', 'Wrap the haft.', 'Harden the striking faces.', 'Chase the langets.', 'Set the heart-stone.', 'Open the molten core.', 'Strike as the forge strikes.'],
      heatStops: [392, 330, 250, 150, 98, 50] },
    { id: 'axe', name: 'Ashfang', type: 'Axe', category: 'weapons', unlock: 1,
      work: ['Grind out the notches.', 'Rehang the head.', 'Temper the beard.', 'Etch the cheek.', 'Set the fang-stone.', 'Let the edge smoulder.', 'Bite through the ash.'],
      heatStops: [392, 320, 240, 170, 110, 50] },
    { id: 'crown', name: 'Crown of the First Flame', type: 'Crown', category: 'relics', unlock: 2,
      work: ['Straighten the tines.', 'Close the band.', 'Polish the circlet.', 'Chase the filigree.', 'Seat the gems.', 'Kindle the inner ring.', 'Crown the first flame.'],
      heatStops: [322, 300, 270, 232, 186, 118] },
    { id: 'lantern', name: 'Eternal Ember', type: 'Lantern', category: 'relics', unlock: 3,
      work: ['Replace the cracked panes.', 'Rebuild the cage.', 'Temper the frame.', 'Gild the crown cap.', 'Set the ember wick.', 'Seal the undying flame.', 'Let it never go out.'],
      heatStops: [380, 330, 290, 230, 150, 50] }
  ];
  const CATEGORY_LABEL = { weapons: 'Weapons', artifacts: 'Artifacts', relics: 'Relics' };

  /* ---------- tier palettes ------------------------------------------------ */
  function palette(t) {
    const P = [
      { m: ['#1b1614', '#3d3430', '#6d5d52', '#40352f', '#1a1412'], trim: ['#3a2a20', '#6a4a33', '#8a6040'], grip: '#2a1b14', cold: '#1c0c07', edge: 'rgba(255,220,190,.10)', rust: true },
      { m: ['#16191c', '#3a4046', '#80888f', '#3d4349', '#15181b'], trim: ['#22262a', '#4a5057', '#6d747b'], grip: '#2b211b', cold: '#2a120a', edge: 'rgba(255,255,255,.18)' },
      { m: ['#1a1f24', '#4b545d', '#c3ccd4', '#56606a', '#1b2025'], trim: ['#4a2c14', '#8e5a2a', '#c58a4a'], grip: '#3a2519', cold: '#3a1509', edge: 'rgba(255,255,255,.45)' },
      { m: ['#1c2126', '#56606a', '#e2e8ee', '#606a74', '#1c2126'], trim: ['#6b4414', '#c9923e', '#f6d38a'], grip: '#2c1c14', cold: '#4a1a08', edge: 'rgba(255,255,255,.6)', fili: true },
      { m: ['#1c2126', '#5a6570', '#eef3f7', '#66717c', '#1c2126'], trim: ['#7a4c12', '#dca24a', '#ffe2a0'], grip: '#401611', cold: '#5a1d08', edge: 'rgba(255,255,255,.7)', fili: true, gem: '#c2281c' },
      { m: ['#0c0d0f', '#23272c', '#5c646d', '#262a2f', '#0b0c0e'], trim: ['#5c3810', '#b9832f', '#f0c46a'], grip: '#1c0f0c', cold: '#6a2008', edge: 'rgba(255,190,120,.55)', fili: true, gem: '#e0401c', veins: true },
      { m: ['#0d0e10', '#2a2d31', '#8a8f96', '#2d3035', '#0c0d0f'], trim: ['#8a5a18', '#f0b54c', '#fff0c8'], grip: '#1e100c', cold: '#8a2a08', edge: 'rgba(255,230,180,.85)', fili: true, gem: '#ff6a1c', veins: true, aura: true }
    ];
    return P[Math.max(0, Math.min(6, t))];
  }

  let UID = 0;
  function defs(u, pal) {
    const m = pal.m, tr = pal.trim;
    return `<defs>
      <linearGradient id="m${u}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${m[0]}"/><stop offset=".3" stop-color="${m[1]}"/><stop offset=".52" stop-color="${m[2]}"/><stop offset=".56" stop-color="${m[3]}"/><stop offset="1" stop-color="${m[4]}"/></linearGradient>
      <linearGradient id="mv${u}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${m[2]}"/><stop offset=".35" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[0]}"/></linearGradient>
      <radialGradient id="mr${u}" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="${m[2]}"/><stop offset=".45" stop-color="${m[1]}"/><stop offset="1" stop-color="${m[0]}"/></radialGradient>
      <linearGradient id="t${u}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${tr[2]}"/><stop offset=".45" stop-color="${tr[1]}"/><stop offset="1" stop-color="${tr[0]}"/></linearGradient>
      <linearGradient id="tv${u}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${tr[2]}"/><stop offset=".5" stop-color="${tr[1]}"/><stop offset="1" stop-color="${tr[0]}"/></linearGradient>
      <radialGradient id="g${u}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff3d6"/><stop offset=".25" stop-color="${pal.gem || '#a0301c'}"/><stop offset="1" stop-color="#2a0704"/></radialGradient>
      <linearGradient id="hg${u}" gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="0" y2="0">
        <stop class="h0" offset="0" stop-color="#fff"/><stop class="h1" offset="0" stop-color="#fff"/><stop class="h2" offset="0" stop-color="#000"/></linearGradient>
      <mask id="hm${u}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="300" height="500"><rect x="-50" y="-50" width="300" height="500" fill="url(#hg${u})"/></mask>
      <filter id="bl${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
      <filter id="bs${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
      <filter id="ht${u}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.5 0.95 0.18 0 0.16  0.2 0.4 0.08 0 0.01  0.03 0.06 0.01 0 0  0 0 0 1 0"/></filter>
      <linearGradient id="hot${u}" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#ffb347"/><stop offset=".6" stop-color="#ff7a1f"/><stop offset="1" stop-color="#ffd08a"/></linearGradient>
    </defs>`;
  }
  // an ember channel: cold groove always, hot copy masked by heat
  function channel(u, d, w, pal, extra) {
    return {
      cold: `<path d="${d}" fill="none" stroke="${pal.cold}" stroke-width="${w * 1.5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="${w * 0.6}" stroke-linecap="round"/>`,
      hot: `<path d="${d}" fill="none" stroke="#ff6a14" stroke-width="${w * 4}" stroke-linecap="round" filter="url(#bl${u})" opacity=".85"/>
            <path d="${d}" fill="none" stroke="url(#hot${u})" stroke-width="${w * 1.3}" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="${d}" fill="none" stroke="#fff1cf" stroke-width="${w * .45}" stroke-linecap="round" stroke-linejoin="round"/>${extra || ''}`
    };
  }
  function rustSpots(seed, box, n) {
    let s = '', a = seed;
    const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < n; i++) s += `<ellipse cx="${box[0] + r() * box[2]}" cy="${box[1] + r() * box[3]}" rx="${2 + r() * 7}" ry="${1.5 + r() * 4}" fill="#7a3a1a" opacity="${.25 + r() * .35}"/>`;
    return s;
  }
  function spade(cx, cy, s, fill, stroke) {
    const k = s / 100;
    return `<path transform="translate(${cx - 50 * k},${cy - 50 * k}) scale(${k})" d="M50 0C54 14 96 34 94 58C92 78 70 82 56 70C57 84 62 92 72 100H28C38 92 43 84 44 70C30 82 8 78 6 58C4 34 46 14 50 0Z" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${3 / k}"` : ''}/>`;
  }

  /* ---------- per-artifact drawings (viewBox 0 0 200 400) ------------------ */
  const ART = {};

  ART.sword = function (u, t, pal) {
    const broken = t === 0;
    const bladeFull = 'M82 272 L84 90 L100 16 L116 90 L118 272 Z';
    const bladeBroken = 'M82 272 L83.5 150 L90 142 L95 151 L101 138 L107 149 L112 140 L117 152 L118 272 Z';
    const blade = broken ? bladeBroken : bladeFull;
    const tipY = broken ? 146 : 30;
    const ch = channel(u, `M100 262 L100 ${broken ? 158 : 70}`, 4.2, pal);
    const core = channel(u, 'M100 386 L100 294', 2.2, pal);
    const cracks = broken ? `<path d="M92 250 L96 232 L91 214 M110 198 L106 180 L111 166" stroke="#0a0605" stroke-width="1.6" fill="none"/>` : '';
    const crackHot = broken ? channel(u, 'M92 250 L96 232 L91 214 M110 198 L106 180 L111 166', 1.4, pal).hot : '';
    let body = `
      <g class="art-body">
        <path d="${blade}" fill="url(#m${u})"/>
        <path d="${broken ? 'M100 272 L100 142' : 'M100 272 L100 16'}" stroke="${pal.edge}" stroke-width="1.2"/>
        <path d="${blade}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.4"/>
        <path d="M84 270 L${broken ? 84 : 85.5} ${broken ? 152 : 92}" stroke="${pal.edge}" stroke-width="1" opacity=".8"/>
        ${pal.rust ? rustSpots(7, [84, 150, 32, 118], 14) : ''}
        ${ch.cold}${cracks}
        ${t >= 5 ? '<path d="M92 250 L96 230 L93 214 L97 196 M108 240 L104 222 L108 204 L104 188 M92 170 L95 150 L92 130 M108 160 L105 140 L108 118" stroke="#3a1206" stroke-width="1.2" fill="none"/>' : ''}
        <!-- guard -->
        <path d="M40 276 Q52 268 66 274 L134 274 Q148 268 160 276 Q150 282 146 290 L54 290 Q50 282 40 276Z" fill="url(#t${u})" stroke="rgba(0,0,0,.6)" stroke-width="1.2"/>
        <rect x="88" y="268" width="24" height="26" rx="4" fill="url(#t${u})" stroke="rgba(0,0,0,.6)"/>
        ${pal.fili ? `<path d="M56 282 Q66 276 76 282 Q84 287 88 281 M144 282 Q134 276 124 282 Q116 287 112 281" stroke="${pal.trim[2]}" stroke-width="1.2" fill="none" opacity=".9"/>` : ''}
        ${pal.gem ? `<circle cx="100" cy="281" r="6.5" fill="url(#g${u})" stroke="${pal.trim[0]}" stroke-width="1.5"/>` : ''}
        <!-- grip -->
        <rect x="91" y="294" width="18" height="62" rx="5" fill="${pal.grip}"/>
        ${Array.from({ length: 8 }, (_, i) => `<path d="M91 ${298 + i * 7.5} L109 ${303 + i * 7.5}" stroke="${t >= 3 ? pal.trim[1] : 'rgba(0,0,0,.6)'}" stroke-width="${t >= 3 ? 1.1 : 1.6}" opacity=".85"/>`).join('')}
        <rect x="91" y="294" width="18" height="62" rx="5" fill="url(#m${u})" opacity=".18"/>
        <!-- pommel -->
        <rect x="93" y="354" width="14" height="8" rx="2" fill="url(#t${u})"/>
        <path d="M100 360 L114 374 L100 392 L86 374 Z" fill="url(#t${u})" stroke="rgba(0,0,0,.6)" stroke-width="1.2"/>
        ${pal.gem ? `<circle cx="100" cy="375" r="4.5" fill="url(#g${u})"/>` : ''}
      </g>`;
    const hot = `
      <path d="M100 360 L114 374 L100 392 L86 374 Z" fill="#ff7a1a" opacity=".45"/>
      ${core.hot}${ch.hot}${crackHot}
      ${t >= 6 ? `<path d="${blade}" fill="none" stroke="#ffd79a" stroke-width="1.6" opacity=".9"/>` : ''}`;
    return { body, hot, glowY: broken ? 220 : 180, tipY };
  };

  ART.shield = function (u, t, pal) {
    const broken = t === 0;
    const outline = 'M30 44 Q100 26 170 44 L170 212 Q166 300 100 372 Q34 300 30 212 Z';
    const inner = 'M42 56 Q100 40 158 56 L158 210 Q154 290 100 354 Q46 290 42 210 Z';
    const chip = broken ? `<path d="M170 44 L170 120 L150 106 L156 84 L138 70 L146 50 Z" fill="#050404"/>` : '';
    const ch = channel(u, 'M100 350 L100 196 M100 144 L100 58 M58 170 L74 170 M126 170 L142 170', 3.6, pal);
    let body = `<g class="art-body">
      <path d="${outline}" fill="url(#t${u})" stroke="rgba(0,0,0,.7)" stroke-width="2"/>
      <path d="${inner}" fill="url(#mr${u})"/>
      <path d="${inner}" fill="none" stroke="${pal.edge}" stroke-width="1.2"/>
      ${pal.rust ? rustSpots(3, [50, 70, 100, 230], 22) : ''}
      ${ch.cold}
      ${spade(100, 250, 58, 'rgba(0,0,0,.25)', t >= 2 ? pal.trim[1] : null)}
      ${pal.fili ? `<path d="M52 70 Q76 90 60 120 M148 70 Q124 90 140 120 M60 250 Q80 250 84 290 M140 250 Q120 250 116 290" stroke="${pal.trim[2]}" stroke-width="1.4" fill="none" opacity=".85"/>` : ''}
      ${Array.from({ length: 9 }, (_, i) => { const a = i / 8; const x = 36 + a * 128, y = 46 - Math.sin(a * Math.PI) * 13; return `<circle cx="${x}" cy="${y + 4}" r="2.6" fill="url(#tv${u})" stroke="rgba(0,0,0,.5)" stroke-width=".6"/>`; }).join('')}
      <circle cx="100" cy="170" r="27" fill="url(#t${u})" stroke="rgba(0,0,0,.6)" stroke-width="1.5"/>
      <circle cx="100" cy="170" r="19" fill="url(#mr${u})"/>
      ${pal.gem ? `<circle cx="100" cy="170" r="10" fill="url(#g${u})"/>` : ''}
      ${broken ? `<path d="M64 90 L80 128 L72 160 L90 200 M128 260 L118 300" stroke="#0a0605" stroke-width="2" fill="none"/>` : ''}
      ${chip}
    </g>`;
    const hot = `${ch.hot}
      ${broken ? channel(u, 'M64 90 L80 128 L72 160 L90 200 M128 260 L118 300', 1.5, pal).hot : ''}
      <circle cx="100" cy="170" r="27" fill="none" stroke="#ffb14a" stroke-width="3" filter="url(#bs${u})"/>
      ${t >= 6 ? `<path d="${outline}" fill="none" stroke="#ffd79a" stroke-width="2"/>` : ''}`;
    return { body, hot, glowY: 190 };
  };

  ART.hammer = function (u, t, pal) {
    const broken = t === 0;
    const head = broken ? 'M38 64 L162 64 L162 104 L150 110 L158 122 L162 136 L38 136 Z' : 'M38 64 L162 64 L162 136 L38 136 Z';
    const ch = channel(u, 'M100 380 L100 150 M52 100 L148 100', 3.8, pal);
    let body = `<g class="art-body">
      <rect x="93" y="120" width="14" height="262" rx="5" fill="${pal.grip}"/>
      <rect x="93" y="120" width="14" height="262" rx="5" fill="url(#m${u})" opacity=".25"/>
      ${Array.from({ length: 10 }, (_, i) => `<path d="M93 ${258 + i * 11} L107 ${264 + i * 11}" stroke="${t >= 3 ? pal.trim[1] : 'rgba(0,0,0,.55)'}" stroke-width="1.4"/>`).join('')}
      <rect x="89" y="372" width="22" height="18" rx="4" fill="url(#t${u})" stroke="rgba(0,0,0,.6)"/>
      <path d="${head}" fill="url(#mv${u})" stroke="rgba(0,0,0,.7)" stroke-width="2"/>
      <rect x="30" y="58" width="16" height="84" rx="3" fill="url(#m${u})" stroke="rgba(0,0,0,.6)"/>
      <rect x="154" y="58" width="16" height="84" rx="3" fill="url(#m${u})" stroke="rgba(0,0,0,.6)"/>
      <path d="M38 66 L162 66" stroke="${pal.edge}" stroke-width="1.5"/>
      ${pal.rust ? rustSpots(5, [44, 70, 110, 60], 16) : ''}
      <path d="M84 136 L116 136 L112 176 L88 176 Z" fill="url(#t${u})" stroke="rgba(0,0,0,.6)"/>
      ${ch.cold}
      ${pal.fili ? `<path d="M56 78 Q70 90 84 78 M116 78 Q130 90 144 78 M56 124 Q70 112 84 124 M116 124 Q130 112 144 124" stroke="${pal.trim[2]}" stroke-width="1.3" fill="none"/>` : ''}
      ${pal.gem ? `<path d="M100 88 L112 100 L100 112 L88 100 Z" fill="url(#g${u})" stroke="${pal.trim[1]}" stroke-width="1.5"/>` : ''}
      ${broken ? '<path d="M120 64 L114 92 L124 110 M92 382 L96 330" stroke="#0a0605" stroke-width="2" fill="none"/>' : ''}
    </g>`;
    const hot = `${ch.hot}
      ${broken ? channel(u, 'M120 64 L114 92 L124 110', 1.5, pal).hot : ''}
      ${t >= 6 ? `<path d="${head}" fill="none" stroke="#ffd79a" stroke-width="2"/>` : ''}`;
    return { body, hot, glowY: 110 };
  };

  ART.axe = function (u, t, pal) {
    const broken = t === 0;
    const blade = broken
      ? 'M106 66 Q140 60 170 40 Q160 70 164 96 L154 102 L162 112 Q158 130 172 170 Q140 150 106 150 Z'
      : 'M106 66 Q140 60 172 36 Q156 96 174 176 Q140 150 106 150 Z';
    const ch = channel(u, `M100 384 L100 70 M116 108 Q140 106 ${broken ? 150 : 158} ${broken ? 80 : 60} M116 118 Q144 126 160 158`, 3.4, pal);
    let body = `<g class="art-body">
      <rect x="94" y="52" width="12" height="336" rx="5" fill="${pal.grip}"/>
      <rect x="94" y="52" width="12" height="336" rx="5" fill="url(#m${u})" opacity=".22"/>
      ${Array.from({ length: 7 }, (_, i) => `<path d="M94 ${300 + i * 11} L106 ${306 + i * 11}" stroke="${t >= 3 ? pal.trim[1] : 'rgba(0,0,0,.55)'}" stroke-width="1.4"/>`).join('')}
      <path d="${blade}" fill="url(#m${u})" stroke="rgba(0,0,0,.7)" stroke-width="1.8"/>
      <path d="${broken ? 'M170 40 Q160 70 164 96' : 'M172 36 Q156 96 174 176'}" stroke="${pal.edge}" stroke-width="2.2" fill="none"/>
      <path d="M94 76 L60 92 L94 104 Z" fill="url(#mv${u})" stroke="rgba(0,0,0,.6)"/>
      <rect x="88" y="60" width="24" height="96" rx="4" fill="url(#t${u})" stroke="rgba(0,0,0,.6)"/>
      ${pal.rust ? rustSpots(9, [112, 70, 50, 80], 14) : ''}
      ${ch.cold}
      ${pal.fili ? '<path d="M120 80 Q134 90 128 104 Q140 112 150 100 M120 136 Q136 132 150 146" stroke="' + pal.trim[2] + '" stroke-width="1.2" fill="none"/>' : ''}
      ${pal.gem ? `<circle cx="100" cy="108" r="6" fill="url(#g${u})" stroke="${pal.trim[0]}" stroke-width="1.4"/>` : ''}
      <rect x="92" y="378" width="16" height="12" rx="3" fill="url(#t${u})"/>
      ${broken ? '<path d="M100 200 L96 240 L101 262" stroke="#0a0605" stroke-width="1.6" fill="none"/>' : ''}
    </g>`;
    const hot = `${ch.hot}
      ${broken ? channel(u, 'M100 200 L96 240 L101 262', 1.4, pal).hot : ''}
      ${t >= 6 ? `<path d="${blade}" fill="none" stroke="#ffd79a" stroke-width="1.8"/>` : ''}`;
    return { body, hot, glowY: 120 };
  };

  ART.crown = function (u, t, pal) {
    const broken = t === 0;
    const pts = broken
      ? 'M30 300 L30 222 L50 186 L58 236 L78 170 L88 232 L100 150 L112 234 L118 214 L126 236 L142 176 L150 236 L170 196 L170 300 Z'
      : 'M30 300 L30 214 L46 150 L62 226 L80 132 L92 222 L100 110 L108 222 L120 132 L138 226 L154 150 L170 214 L170 300 Z';
    const ch = channel(u, 'M40 280 Q100 292 160 280 M100 270 L100 150', 3.4, pal);
    let body = `<g class="art-body">
      <path d="${pts}" fill="url(#t${u})" stroke="rgba(0,0,0,.65)" stroke-width="2" stroke-linejoin="round"/>
      <path d="M30 246 Q100 262 170 246 L170 306 Q100 324 30 306 Z" fill="url(#mv${u})" stroke="rgba(0,0,0,.65)" stroke-width="1.6"/>
      <path d="M32 250 Q100 266 168 250" stroke="${pal.trim[2]}" stroke-width="1.6" fill="none" opacity=".8"/>
      ${pal.rust ? rustSpots(11, [34, 200, 132, 100], 18) : ''}
      ${ch.cold}
      ${[46, 80, 120, 154].map((x, i) => `<circle cx="${x}" cy="${[160, 144, 144, 160][i] + (broken ? 40 : 0)}" r="4" fill="url(#tv${u})" stroke="rgba(0,0,0,.5)"/>`).join('')}
      <circle cx="100" cy="${broken ? 160 : 118}" r="5" fill="url(#tv${u})" stroke="rgba(0,0,0,.5)"/>
      ${pal.gem ? [60, 100, 140].map(x => `<ellipse cx="${x}" cy="${x === 100 ? 290 : 284}" rx="${x === 100 ? 9 : 6}" ry="${x === 100 ? 8 : 6}" fill="url(#g${u})" stroke="${pal.trim[0]}" stroke-width="1.4"/>`).join('') : ''}
      ${pal.fili ? '<path d="M44 270 Q56 262 68 272 M132 272 Q144 262 156 270 M86 190 Q100 176 114 190" stroke="' + pal.trim[2] + '" stroke-width="1.3" fill="none"/>' : ''}
      ${broken ? '<path d="M64 250 L70 280 L64 304 M140 250 L134 282" stroke="#0a0605" stroke-width="1.8" fill="none"/>' : ''}
    </g>`;
    const hot = `${ch.hot}
      ${broken ? channel(u, 'M64 250 L70 280 L64 304 M140 250 L134 282', 1.4, pal).hot : ''}
      ${t >= 6 ? `<path d="${pts}" fill="none" stroke="#ffd79a" stroke-width="1.8"/>` : ''}`;
    return { body, hot, glowY: 230 };
  };

  ART.lantern = function (u, t, pal) {
    const broken = t === 0;
    const flame = broken ? '' : `<path class="art-flame" d="M100 ${300 - t * 8} C${116 + t} 280 ${110} 250 100 ${236 - t * 6} C${90} 250 ${84 - t} 280 100 ${300 - t * 8}Z" fill="#ffb347"/>`;
    const ch = channel(u, 'M100 372 L100 344 M62 330 L62 176 M138 330 L138 176 M100 150 L100 112', 3.2, pal);
    let body = `<g class="art-body">
      <path d="M100 52 C70 52 70 100 100 100 C130 100 130 52 100 52" fill="none" stroke="url(#t${u})" stroke-width="7"/>
      <path d="M72 150 L100 104 L128 150 Z" fill="url(#t${u})" stroke="rgba(0,0,0,.6)" stroke-width="1.5"/>
      <rect x="54" y="146" width="92" height="16" rx="4" fill="url(#t${u})" stroke="rgba(0,0,0,.6)"/>
      <rect x="62" y="162" width="76" height="176" fill="${broken ? '#0e0c0b' : 'rgba(40,20,10,.55)'}"/>
      ${flame}
      ${broken ? '' : `<ellipse cx="100" cy="${282 - t * 6}" rx="${22 + t * 3}" ry="${34 + t * 4}" fill="#ff8a2a" opacity=".22" filter="url(#bl${u})"/>`}
      <rect x="62" y="162" width="76" height="176" fill="url(#m${u})" opacity="${broken ? .35 : .12}"/>
      ${broken ? '<path d="M68 180 L90 230 L80 262 M130 200 L110 250 L124 300" stroke="rgba(200,200,200,.25)" stroke-width="1.2" fill="none"/>' : ''}
      <rect x="56" y="162" width="10" height="176" rx="3" fill="url(#m${u})" stroke="rgba(0,0,0,.6)"/>
      <rect x="134" y="162" width="10" height="176" rx="3" fill="url(#m${u})" stroke="rgba(0,0,0,.6)"/>
      <rect x="96" y="162" width="8" height="176" fill="url(#m${u})" opacity=".85" ${broken ? 'transform="rotate(6 100 250)"' : ''}/>
      <rect x="50" y="334" width="100" height="18" rx="4" fill="url(#t${u})" stroke="rgba(0,0,0,.6)"/>
      <path d="M58 352 L142 352 L150 378 L50 378 Z" fill="url(#mv${u})" stroke="rgba(0,0,0,.6)"/>
      ${pal.rust ? rustSpots(13, [56, 150, 90, 220], 16) : ''}
      ${ch.cold}
      ${pal.fili ? `<path d="M60 360 Q80 350 100 362 Q120 350 140 360 M76 148 Q100 136 124 148" stroke="${pal.trim[2]}" stroke-width="1.2" fill="none"/>` : ''}
      ${pal.gem ? `<circle cx="100" cy="126" r="6" fill="url(#g${u})" stroke="${pal.trim[0]}" stroke-width="1.4"/>` : ''}
    </g>`;
    const hot = `${ch.hot}
      <ellipse cx="100" cy="258" rx="30" ry="60" fill="#ffb347" opacity=".35" filter="url(#bl${u})"/>
      ${t >= 6 ? '<rect x="56" y="146" width="88" height="206" fill="none" stroke="#ffd79a" stroke-width="1.6"/>' : ''}`;
    return { body, hot, glowY: 250 };
  };

  /* ---------- public: build + heat --------------------------------------- */
  function get(id) { return LIST.find(a => a.id === id) || LIST[0]; }

  function heatY(def, pct) {
    const s = def.heatStops, p = Math.max(0, Math.min(100, pct)) / 20, i = Math.min(4, Math.floor(p));
    return s[i] + (s[i + 1] - s[i]) * (p - i);
  }

  /* opts: {tier, heat (0..100), silhouette, className, label} → SVG markup string */
  function svg(id, opts) {
    opts = opts || {};
    const def = get(id), t = opts.tier || 0, u = 'a' + (UID++), pal = palette(t);
    const raster = ES.Manifest && ES.Manifest.artifactImage && ES.Manifest.artifactImage(id, t);
    const art = ART[id](u, t, pal);
    const aura = '';
    const sil = opts.silhouette;
    const inner = raster
      ? `<image href="${raster}" x="0" y="0" width="200" height="400" preserveAspectRatio="xMidYMid meet"/>`
      : art.body;
    return `<svg class="artifact-svg ${opts.className || ''}${sil ? ' is-silhouette' : ''}" style="--tint:${opts.tint != null ? opts.tint : (t >= 6 ? .38 : .6)}" viewBox="-10 0 220 400" role="img" aria-label="${opts.label || (def.name + ', ' + TIERS[t])}" data-art="${id}" data-uid="${u}" preserveAspectRatio="xMidYMid meet">
      ${defs(u, pal)}
      ${sil ? '' : aura}
      <g class="art-base" id="b${u}">${inner}</g>
      ${sil ? '' : `<g class="art-hot" mask="url(#hm${u})"><use href="#b${u}" class="art-tint" filter="url(#ht${u})"/>${art.hot}</g>`}
    </svg>`;
  }

  /* Set heat on an SVG produced by svg(). pct 0..100 */
  function setHeat(el, id, pct) {
    if (!el) return;
    const s = el.tagName === 'svg' || el.tagName === 'SVG' ? el : el.querySelector('svg.artifact-svg');
    if (!s) return;
    const def = get(id || s.dataset.art);
    const y = heatY(def, pct);
    const off = pct <= 0 ? 0 : Math.max(0, Math.min(1, (400 - y) / 400));
    const stops = s.querySelectorAll('linearGradient[id^="hg"] stop');
    if (stops.length === 3) {
      stops[1].setAttribute('offset', off.toFixed(4));
      stops[2].setAttribute('offset', Math.min(1, off + (pct >= 100 ? 0 : 0.035)).toFixed(4));
    }
    s.style.setProperty('--heat', (pct / 100).toFixed(3));
  }

  ES.Artifacts = { TIERS, TIER_LORE, LIST, CATEGORY_LABEL, get, svg, setHeat, heatY, palette };
})(typeof window !== 'undefined' ? window : globalThis);
