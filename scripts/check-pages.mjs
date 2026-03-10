import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePaths = ['index.html', 'about.html', 'download/index.html'];

const htmlReferencePatterns = [
  { kind: 'href', regex: /\bhref="([^"]+)"/g },
  { kind: 'src', regex: /\bsrc="([^"]+)"/g }
];

const moduleImportPatterns = [
  /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g
];

function stripQueryAndHash(reference) {
  return reference.split('#')[0].split('?')[0];
}

function isLocalReference(reference) {
  if (!reference) {
    return false;
  }

  return ![
    'http://',
    'https://',
    '//',
    'mailto:',
    'data:',
    '#'
  ].some((prefix) => reference.startsWith(prefix));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function resolveHtmlReference(pagePath, reference) {
  const cleanReference = stripQueryAndHash(reference);
  const absoluteReference = path.resolve(path.dirname(pagePath), cleanReference);

  if (cleanReference.endsWith('/')) {
    return path.join(absoluteReference, 'index.html');
  }

  return absoluteReference;
}

async function validatePageReferences(pagePath, errors, moduleEntrypoints) {
  const pageSource = await fs.readFile(pagePath, 'utf8');

  for (const pattern of htmlReferencePatterns) {
    for (const match of pageSource.matchAll(pattern.regex)) {
      const reference = match[1];

      if (!isLocalReference(reference)) {
        continue;
      }

      const resolvedPath = await resolveHtmlReference(pagePath, reference);

      if (!(await pathExists(resolvedPath))) {
        errors.push(`${path.relative(rootDir, pagePath)} references missing ${pattern.kind}: ${reference}`);
        continue;
      }

      if (reference.endsWith('.js')) {
        moduleEntrypoints.add(resolvedPath);
      }
    }
  }
}

function parseModuleWithNode(modulePath, source, errors) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: source,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    const stderr = result.stderr.trim() || 'Unknown module parse error.';
    errors.push(`${path.relative(rootDir, modulePath)} failed to parse:\n${stderr}`);
  }
}

async function validateModuleGraph(modulePath, errors, visitedModules) {
  if (visitedModules.has(modulePath)) {
    return;
  }

  visitedModules.add(modulePath);

  const moduleSource = await fs.readFile(modulePath, 'utf8');
  parseModuleWithNode(modulePath, moduleSource, errors);

  for (const pattern of moduleImportPatterns) {
    for (const match of moduleSource.matchAll(pattern)) {
      const reference = match[1];

      if (!reference || !reference.startsWith('.')) {
        continue;
      }

      const resolvedPath = path.resolve(path.dirname(modulePath), stripQueryAndHash(reference));

      if (!(await pathExists(resolvedPath))) {
        errors.push(`${path.relative(rootDir, modulePath)} imports missing module: ${reference}`);
        continue;
      }

      await validateModuleGraph(resolvedPath, errors, visitedModules);
    }
  }
}

async function main() {
  const errors = [];
  const moduleEntrypoints = new Set();

  for (const pagePath of pagePaths) {
    await validatePageReferences(path.join(rootDir, pagePath), errors, moduleEntrypoints);
  }

  const visitedModules = new Set();

  for (const entrypoint of moduleEntrypoints) {
    await validateModuleGraph(entrypoint, errors, visitedModules);
  }

  if (errors.length > 0) {
    console.error('check-pages failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`check-pages passed for ${pagePaths.length} pages and ${visitedModules.size} modules.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
