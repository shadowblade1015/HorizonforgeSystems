/* EMBER SOLITAIRE — forged line icon set (24×24, stroke = currentColor) */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const P = {
    play: '<path d="M12 3c.6 2.4 7 5.6 6.8 9.6-.1 2.6-3 3.6-5.2 1.9.1 1.9.9 3.2 2.2 4.5H8.2c1.3-1.3 2.1-2.6 2.2-4.5-2.2 1.7-5.1.7-5.2-1.9C5 8.6 11.4 5.4 12 3Z"/>',
    forge: '<path d="M3 10h12.5c1.8 0 3.2-.6 4.5-2v5.5h-5l-1 2.5 2 3.5H6l2-3.5-1-2.5C4.8 13.5 3.3 12.2 3 10Z"/><path d="M8 19h9"/>',
    challenges: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 12.2c.9 1.1 2 1.8 2 3.2a2 2 0 0 1-4 0c0-.8.4-1.3.9-1.8.2.6.5.9.9 1 0-.9.1-1.6.2-2.4Z"/>',
    collection: '<path d="M4 20h16M6 20v-2h12v2M8 18V9M16 18V9M6 9h12l-6-5-6 5Z"/><path d="M12 11.5v4"/>',
    profile: '<path d="M6 20v-1.5C6 15.5 8.7 13.5 12 13.5s6 2 6 5V20"/><path d="M8.5 7.5a3.5 3.5 0 0 1 7 0V10a3.5 3.5 0 0 1-7 0Z"/><path d="M8.5 8.5h7M12 4v4"/>',
    pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
    undo: '<path d="M9 7 4.5 11 9 15"/><path d="M5 11h9a5 5 0 0 1 0 10h-3"/>',
    hint: '<path d="M9.2 17.5h5.6M10 20.5h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.1v.6h5.2v-.6c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/><path d="M12 7c.5 1.4 2 2.1 2 3.7a2 2 0 0 1-4 0c0-.9.4-1.3.9-1.8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/><circle cx="12" cy="12" r="6.2"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.5"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
    haptics: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M4.5 8v8M19.5 8v8M2 10v4M22 10v4"/>',
    motion: '<path d="M4 17c3-6 5-10 8-10s5 4 8 10"/><path d="M3 20h18"/>',
    contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5Z" fill="currentColor" stroke="none"/>',
    cards: '<rect x="3.5" y="6" width="10" height="14" rx="1.5" transform="rotate(-8 8.5 13)"/><rect x="10" y="4" width="10" height="14" rx="1.5" transform="rotate(8 15 11)"/>',
    cardback: '<rect x="5.5" y="3.5" width="13" height="17" rx="2"/><rect x="8" y="6" width="8" height="12" rx="1"/><path d="M12 8.5l2 3.5-2 3.5-2-3.5Z"/>',
    table: '<path d="M3 9h18l-2 9H5Z"/><path d="M7 9V6h10v3"/><path d="M12 12.5v3"/>',
    language: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.3 3.5 5.3 3.5 8.5s-1 6.2-3.5 8.5c-2.5-2.3-3.5-5.3-3.5-8.5s1-6.2 3.5-8.5Z"/>',
    about: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    moves: '<path d="M5 12h14M15 8l4 4-4 4M9 16l-4-4 4-4"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v3.5M8.5 20h7M9.5 16.5h5V20h-5Z"/>',
    shield: '<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    flame: '<path d="M12 3c1.5 3 5.5 5.3 5.5 10a5.5 5.5 0 0 1-11 0c0-2.5 1.2-4 2.6-5.3.3 1.5 1 2.4 2 2.7-.3-2.6.1-5 .9-7.4Z"/>',
    percent: '<path d="M6 18 18 6"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
    hall: '<path d="M3 20h18M4.5 20V10M19.5 20V10M9 20v-6h6v6M2.5 10 12 4l9.5 6Z"/>',
    inspect: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
    stock: '<rect x="6" y="3.5" width="12" height="16" rx="2"/><path d="M9 20.5h8.5a2 2 0 0 0 2-2V7"/>',
    restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
    home: '<path d="M4 11 12 4l8 7v9h-5.5v-6h-5v6H4Z"/>',
    sets: '<path d="M12 3c.6 2.4 7 5.6 6.8 9.6-.1 2.6-3 3.6-5.2 1.9.1 1.9.9 3.2 2.2 4.5H8.2c1.3-1.3 2.1-2.6 2.2-4.5-2.2 1.7-5.1.7-5.2-1.9C5 8.6 11.4 5.4 12 3Z"/>'
  };
  function icon(name, cls) {
    return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
  }
  /* Achievement medal: forged bronze/gold disc with an engraved glyph */
  function medal(glyph, earned, tone) {
    const g = tone === 'gold' ? ['#fff0c0', '#e0a445', '#7a4a12'] : tone === 'ember' ? ['#ffd5a0', '#e36b28', '#6a1e08'] : ['#e8c9a2', '#a8743f', '#4a2a12'];
    const id = 'md' + Math.random().toString(36).slice(2, 7);
    return `<svg class="medal ${earned ? 'is-earned' : 'is-locked'}" viewBox="0 0 64 64" aria-hidden="true">
      <defs><radialGradient id="${id}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${g[0]}"/><stop offset=".45" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></radialGradient></defs>
      <circle cx="32" cy="32" r="29" fill="#0d0f11" stroke="url(#${id})" stroke-width="3"/>
      <circle cx="32" cy="32" r="23" fill="url(#${id})" opacity="${earned ? 1 : .18}"/>
      <circle cx="32" cy="32" r="23" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
      <g transform="translate(20 20)" fill="none" stroke="${earned ? '#2a1406' : '#6b6259'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[glyph] || P.star}</g>
    </svg>`;
  }
  ES.Icons = { icon, medal, paths: P };
})(typeof window !== 'undefined' ? window : globalThis);
