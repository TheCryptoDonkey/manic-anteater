// Assembles the single-file game at index.html from src/. Run: node tools/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0910">
<meta name="description" content="A Manic Miner-style browser game: an anteater slurps up every ant hill across 10 rooms to open each level's portal.">
<title>Manic Anteater</title>
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
if (process.argv.includes('--check')) {
  if (fs.readFileSync(out, 'utf8') !== html) { console.error('index.html is out of date: run node tools/build.js'); process.exit(1); }
  console.log('index.html is up to date');
} else { fs.writeFileSync(out, html); console.log('wrote index.html'); }
