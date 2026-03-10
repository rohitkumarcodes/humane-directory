import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'data.json');

function validateNonEmptyString(value, fieldName, entryIndex, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`Entry ${entryIndex + 1} is missing a valid ${fieldName}.`);
    return;
  }

  if ((fieldName === 'url' || fieldName === 'feed')) {
    try {
      new URL(value);
    } catch (error) {
      errors.push(`Entry ${entryIndex + 1} has an invalid ${fieldName} URL.`);
    }
  }
}

function validateTags(tags, entryIndex, errors) {
  if (!Array.isArray(tags) || tags.length === 0) {
    errors.push(`Entry ${entryIndex + 1} must have at least one tag.`);
    return;
  }

  const seenTags = new Set();

  tags.forEach((tag) => {
    if (typeof tag !== 'string' || tag.trim() === '') {
      errors.push(`Entry ${entryIndex + 1} contains an invalid tag.`);
      return;
    }

    const normalizedTag = tag.trim();

    if (seenTags.has(normalizedTag)) {
      errors.push(`Entry ${entryIndex + 1} contains a duplicate tag: ${normalizedTag}.`);
      return;
    }

    seenTags.add(normalizedTag);
  });
}

async function main() {
  const rawFile = await fs.readFile(dataPath, 'utf8');
  const parsedData = JSON.parse(rawFile);
  const errors = [];

  if (!Array.isArray(parsedData)) {
    throw new Error('data.json must contain an array.');
  }

  parsedData.forEach((entry, entryIndex) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`Entry ${entryIndex + 1} must be an object.`);
      return;
    }

    validateNonEmptyString(entry.name, 'name', entryIndex, errors);
    validateNonEmptyString(entry.url, 'url', entryIndex, errors);
    validateNonEmptyString(entry.description, 'description', entryIndex, errors);

    if (entry.feed !== undefined && entry.feed !== null && entry.feed !== '') {
      validateNonEmptyString(entry.feed, 'feed', entryIndex, errors);
    }

    validateTags(entry.tags, entryIndex, errors);
  });

  if (errors.length > 0) {
    console.error('check-data failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`check-data passed for ${parsedData.length} entries.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
