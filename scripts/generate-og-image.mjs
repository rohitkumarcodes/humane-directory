import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = path.join(rootDir, 'logo.svg');
const ogSvgPath = path.join(rootDir, 'new-og-image.svg');
const ogPngPath = path.join(rootDir, 'new-og-image.png');
const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
];

function parseLogoSvg(logoSvgSource) {
  const svgMatch = logoSvgSource.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/i);

  if (!svgMatch) {
    throw new Error('Could not parse logo.svg.');
  }

  const [, viewBox, innerMarkup] = svgMatch;
  const styleMatch = innerMarkup.match(/<style>([\s\S]*?)<\/style>/i);
  const style = styleMatch ? styleMatch[1].trim() : '';
  const bodyMarkup = innerMarkup.replace(/<style>[\s\S]*?<\/style>/i, '').trim();

  return {
    viewBox,
    style,
    bodyMarkup
  };
}

function inlineOgLogoMarkup(logoMarkup) {
  return logoMarkup
    .replace(/\sclass="logo-bracket"/g, ' fill="#111111"')
    .replace(/\sclass="logo-dot"/g, ' fill="#111111"')
    .replace(
      /<g\s+class="logo-mark"[^>]*>/i,
      '<g stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">'
    );
}

function buildOgSvg({ logoMarkup }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">humane.directory open graph image</title>
  <desc id="desc">The humane.directory logo, title, and a short description of a directory of personal websites with RSS and Atom feeds.</desc>
  <style>
    .og-bg {
      fill: #f7f4ef;
    }

    .og-panel {
      fill: #fbfaf7;
      stroke: rgba(17, 17, 17, 0.14);
      stroke-width: 2;
    }

    .og-title {
      fill: #111111;
      font-family: Arial, sans-serif;
      font-size: 64px;
      font-weight: 700;
      text-anchor: middle;
    }

    .og-intro {
      fill: #111111;
      font-family: Arial, sans-serif;
      font-size: 31px;
      text-anchor: middle;
    }

    .og-chip {
      fill: rgba(17, 17, 17, 0.045);
      stroke: rgba(17, 17, 17, 0.14);
      stroke-width: 1.5;
    }

    .og-chip-text {
      fill: #111111;
      font-family: Arial, sans-serif;
      font-size: 24px;
      font-weight: 600;
      text-anchor: middle;
    }
  </style>

  <rect class="og-bg" width="1200" height="630" rx="0" ry="0" />
  <rect class="og-panel" x="190" y="72" width="820" height="486" rx="38" ry="38" />

  <g transform="translate(476 100) scale(1.55)">
    ${logoMarkup}
  </g>

  <text class="og-title" x="600" y="286">humane.directory</text>
  <text class="og-intro" x="600" y="350">A curated list of personal websites</text>

  <rect class="og-chip" x="370" y="392" width="220" height="52" rx="26" ry="26" />
  <text class="og-chip-text" x="480" y="425">Text-first</text>

  <rect class="og-chip" x="610" y="392" width="220" height="52" rx="26" ry="26" />
  <text class="og-chip-text" x="720" y="425">Updated often</text>

  <rect class="og-chip" x="370" y="462" width="220" height="52" rx="26" ry="26" />
  <text class="og-chip-text" x="480" y="495">RSS / Atom</text>

  <rect class="og-chip" x="610" y="462" width="220" height="52" rx="26" ry="26" />
  <text class="og-chip-text" x="720" y="495">Human-made</text>
</svg>
`;
}

function runCommand(command, args, errorMessage) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8'
  });

  if (result.error) {
    throw new Error(`${errorMessage}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || errorMessage);
  }

  return result;
}

function findBrowserExecutable() {
  return chromeCandidates.find((candidate) => {
    const result = spawnSync('test', ['-x', candidate], {
      cwd: rootDir,
      encoding: 'utf8'
    });

    return result.status === 0;
  });
}

async function main() {
  const logoSvgSource = await fs.readFile(logoPath, 'utf8');
  const { bodyMarkup } = parseLogoSvg(logoSvgSource);
  const ogSvgSource = buildOgSvg({
    logoMarkup: inlineOgLogoMarkup(bodyMarkup)
  });

  await fs.writeFile(ogSvgPath, ogSvgSource);

  const browserPath = findBrowserExecutable();

  if (!browserPath) {
    throw new Error(
      'Could not find a supported Chromium-based browser for OG image rendering. Install Google Chrome, Chromium, or Microsoft Edge.'
    );
  }

  runCommand(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1200,630',
      `--screenshot=${ogPngPath}`,
      `file://${ogSvgPath}`
    ],
    'Headless browser failed to render the OG image.'
  );

  console.log('Generated new-og-image.svg and new-og-image.png');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
