function toNonEmptyString(value, fieldName, entryIndex) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Entry ${entryIndex + 1} is missing a valid ${fieldName}.`);
  }

  return value.trim();
}

function toAbsoluteUrl(value, fieldName, entryIndex) {
  const normalizedValue = toNonEmptyString(value, fieldName, entryIndex);

  try {
    return new URL(normalizedValue).toString();
  } catch (error) {
    throw new Error(`Entry ${entryIndex + 1} has an invalid ${fieldName} URL.`);
  }
}

function normalizeTags(tags, entryIndex) {
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new Error(`Entry ${entryIndex + 1} must have at least one tag.`);
  }

  const normalizedTags = [];
  const seenTags = new Set();

  tags.forEach((tag) => {
    if (typeof tag !== 'string' || tag.trim() === '') {
      throw new Error(`Entry ${entryIndex + 1} contains an invalid tag.`);
    }

    const normalizedTag = tag.trim();

    if (!seenTags.has(normalizedTag)) {
      seenTags.add(normalizedTag);
      normalizedTags.push(normalizedTag);
    }
  });

  return normalizedTags;
}

export function normalizeDirectoryData(rawDirectoryData) {
  if (!Array.isArray(rawDirectoryData)) {
    throw new Error('Directory data must be an array.');
  }

  return rawDirectoryData.map((entry, entryIndex) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Entry ${entryIndex + 1} must be an object.`);
    }

    const normalizedEntry = {
      name: toNonEmptyString(entry.name, 'name', entryIndex),
      url: toAbsoluteUrl(entry.url, 'url', entryIndex),
      description: toNonEmptyString(entry.description, 'description', entryIndex),
      tags: normalizeTags(entry.tags, entryIndex)
    };

    if (entry.feed !== undefined && entry.feed !== null && entry.feed !== '') {
      normalizedEntry.feed = toAbsoluteUrl(entry.feed, 'feed', entryIndex);
    }

    return normalizedEntry;
  });
}

export async function loadDirectoryData(dataUrl) {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error(`Failed to load directory data from ${dataUrl}.`);
  }

  const rawDirectoryData = await response.json();

  return normalizeDirectoryData(rawDirectoryData);
}
