// Assembles the single-file game at index.html from src/. Run: node tools/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Anteater">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0b0910">
<meta name="description" content="A Manic Miner-style browser game: an anteater slurps up every ant hill across 10 rooms to open each level's portal.">
<title>Manic Anteater</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>*,*::before,*::after{box-sizing:border-box}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${src('page.html').trim()}
<script>
${src('core.js').trim()}
${src('ui.js').trim()}
</script>
</body>
</html>
`;
const out = path.join(root, 'index.html');
const version = 'ma-' + require('crypto').createHash('sha256').update(html).digest('hex').slice(0, 10);
const sw = src('sw.js').replace('__VERSION__', version);
const swOut = path.join(root, 'sw.js');
if (process.argv.includes('--check')) {
  const stale = [[out, html], [swOut, sw]].filter(([f, c]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== c);
  if (stale.length) { console.error('out of date: ' + stale.map(([f]) => path.basename(f)).join(', ') + ' (run node tools/build.js)'); process.exit(1); }
  console.log('index.html and sw.js are up to date');
} else { fs.writeFileSync(out, html); fs.writeFileSync(swOut, sw); console.log('wrote index.html and sw.js (' + version + ')'); }
