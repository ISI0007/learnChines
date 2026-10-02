/* 汉学课堂 — self-contained SVG artwork (no network: works offline and from file://).
   Returns data-URI images for the hero banner and lesson stages. */
(function () {
  'use strict';

  function uri(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim()); }

  // Misty mountain + pagoda landscape (hero).
  function landscape(w, h) {
    w = w || 1200; h = h || 700;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
      '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2a4a"/><stop offset="0.55" stop-color="#3b5a86"/><stop offset="1" stop-color="#6b8bb5"/></linearGradient>' +
      '<linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c7ba6"/><stop offset="1" stop-color="#2b3f60"/></linearGradient>' +
      '<linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa8c9"/><stop offset="1" stop-color="#4a6488"/></linearGradient>' +
      '<radialGradient id="moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff8e6" stop-opacity="0.95"/><stop offset="0.6" stop-color="#ffe9b0" stop-opacity="0.5"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<rect width="' + w + '" height="' + h + '" fill="url(#sky)"/>' +
      '<circle cx="' + (w * 0.78) + '" cy="' + (h * 0.24) + '" r="' + (h * 0.16) + '" fill="url(#moon)"/>' +
      '<path d="M0 ' + (h * 0.68) + ' L' + (w * 0.2) + ' ' + (h * 0.42) + ' L' + (w * 0.36) + ' ' + (h * 0.6) + ' L' + (w * 0.5) + ' ' + (h * 0.34) + ' L' + (w * 0.68) + ' ' + (h * 0.62) + ' L' + (w * 0.84) + ' ' + (h * 0.46) + ' L' + w + ' ' + (h * 0.7) + ' L' + w + ' ' + h + ' L0 ' + h + ' Z" fill="url(#m2)" opacity="0.55"/>' +
      '<path d="M0 ' + (h * 0.8) + ' L' + (w * 0.16) + ' ' + (h * 0.56) + ' L' + (w * 0.32) + ' ' + (h * 0.74) + ' L' + (w * 0.5) + ' ' + (h * 0.5) + ' L' + (w * 0.66) + ' ' + (h * 0.76) + ' L' + (w * 0.82) + ' ' + (h * 0.6) + ' L' + w + ' ' + (h * 0.8) + ' L' + w + ' ' + h + ' L0 ' + h + ' Z" fill="url(#m1)"/>' +
      '<g fill="#101b30" opacity="0.92">' +
      '<rect x="' + (w * 0.6) + '" y="' + (h * 0.52) + '" width="' + (w * 0.11) + '" height="' + (h * 0.3) + '"/>' +
      '<polygon points="' + (w * 0.6) + ',' + (h * 0.52) + ' ' + (w * 0.655) + ',' + (h * 0.45) + ' ' + (w * 0.71) + ',' + (h * 0.52) + '"/>' +
      '<polygon points="' + (w * 0.585) + ',' + (h * 0.56) + ' ' + (w * 0.655) + ',' + (h * 0.5) + ' ' + (w * 0.725) + ',' + (h * 0.56) + '"/>' +
      '<rect x="' + (w * 0.62) + '" y="' + (h * 0.6) + '" width="' + (w * 0.07) + '" height="' + (h * 0.05) + '" fill="#e9c86a" opacity="0.8"/>' +
      '</g>' +
      '<ellipse cx="' + (w * 0.3) + '" cy="' + (h * 0.72) + '" rx="' + (w * 0.36) + '" ry="' + (h * 0.06) + '" fill="#c9d6e8" opacity="0.35"/>' +
      '<ellipse cx="' + (w * 0.7) + '" cy="' + (h * 0.62) + '" rx="' + (w * 0.4) + '" ry="' + (h * 0.05) + '" fill="#c9d6e8" opacity="0.28"/>' +
      '</svg>';
    return uri(svg);
  }

  // A warm indoor dialogue scene (lesson video stage).
  function dialogue(w, h) {
    w = w || 960; h = h || 540;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e6cf"/><stop offset="1" stop-color="#e6c9a3"/></linearGradient>' +
      '<linearGradient id="flo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c99a67"/><stop offset="1" stop-color="#a97a4a"/></linearGradient></defs>' +
      '<rect width="' + w + '" height="' + (h * 0.72) + '" fill="url(#room)"/>' +
      '<rect y="' + (h * 0.72) + '" width="' + w + '" height="' + (h * 0.28) + '" fill="url(#flo)"/>' +
      '<rect x="' + (w * 0.08) + '" y="' + (h * 0.12) + '" width="' + (w * 0.22) + '" height="' + (h * 0.3) + '" rx="6" fill="#bfe0e8" stroke="#8a6d48" stroke-width="8"/>' +
      '<rect x="' + (w * 0.62) + '" y="' + (h * 0.14) + '" width="' + (w * 0.3) + '" height="' + (h * 0.34) + '" rx="6" fill="#f3d9a8" stroke="#8a6d48" stroke-width="8"/>' +
      '<g fill="#7a5a34"><rect x="' + (w * 0.44) + '" y="' + (h * 0.5) + '" width="' + (w * 0.12) + '" height="' + (h * 0.06) + '" rx="4"/></g>' +
      '<g transform="translate(' + (w * 0.2) + ',' + (h * 0.44) + ')">' +
      '<circle cx="0" cy="0" r="26" fill="#e8b48a"/><rect x="-22" y="22" width="44" height="70" rx="16" fill="#3b6fb0"/>' +
      '<circle cx="0" cy="0" r="26" fill="#e8b48a"/></g>' +
      '<g transform="translate(' + (w * 0.72) + ',' + (h * 0.46) + ')">' +
      '<circle cx="0" cy="0" r="24" fill="#d99a72"/><rect x="-20" y="20" width="40" height="64" rx="15" fill="#b0433e"/></g>' +
      '<g fill="#fff" opacity="0.9"><rect x="' + (w * 0.3) + '" y="' + (h * 0.2) + '" width="' + (w * 0.16) + '" height="34" rx="17"/><rect x="' + (w * 0.52) + '" y="' + (h * 0.26) + '" width="' + (w * 0.14) + '" height="34" rx="17"/></g>' +
      '</svg>';
    return uri(svg);
  }

  // Generic gradient banner for cards.
  function banner(c1, c2, glyph, w, h) {
    w = w || 600; h = h || 300;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (c1 || '#2563EB') + '"/><stop offset="1" stop-color="' + (c2 || '#1D4ED8') + '"/></linearGradient></defs>' +
      '<rect width="' + w + '" height="' + h + '" fill="url(#g)"/>' +
      '<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Noto Sans SC,sans-serif" font-size="' + Math.round(h * 0.42) + '" font-weight="800" fill="#ffffff" opacity="0.9">' + (glyph || '中') + '</text>' +
      '</svg>';
    return uri(svg);
  }

  window.Art = { landscape: landscape, dialogue: dialogue, banner: banner, uri: uri };
})();
