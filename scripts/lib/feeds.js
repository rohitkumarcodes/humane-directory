import { getDomain } from './url.js';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createFeedCatalog(websites) {
  const feedMap = new Map();

  websites.forEach((site) => {
    if (!site.feed) {
      return;
    }

    if (!feedMap.has(site.feed)) {
      feedMap.set(site.feed, {
        id: site.feed,
        name: site.name || site.feed,
        feed: site.feed,
        url: site.url || site.feed,
        tags: new Set(site.tags)
      });
      return;
    }

    const existingFeed = feedMap.get(site.feed);

    site.tags.forEach((tag) => existingFeed.tags.add(tag));

    if (!existingFeed.url && site.url) {
      existingFeed.url = site.url;
    }

    if (!existingFeed.name && site.name) {
      existingFeed.name = site.name;
    }
  });

  return Array.from(feedMap.values())
    .map((feed) => ({
      id: feed.id,
      name: feed.name,
      feed: feed.feed,
      url: feed.url,
      tags: Array.from(feed.tags).sort((leftTag, rightTag) => leftTag.localeCompare(rightTag)),
      domain: getDomain(feed.url)
    }))
    .sort((leftFeed, rightFeed) => leftFeed.name.localeCompare(rightFeed.name));
}

export function createFolderData(feeds) {
  const folderMap = new Map();

  feeds.forEach((feed) => {
    feed.tags.forEach((tag) => {
      if (!folderMap.has(tag)) {
        folderMap.set(tag, new Set());
      }

      folderMap.get(tag).add(feed.id);
    });
  });

  return Array.from(folderMap.entries())
    .sort(([leftTag], [rightTag]) => leftTag.localeCompare(rightTag))
    .map(([tag, feedIds]) => ({
      tag,
      feedIds: Array.from(feedIds)
    }));
}

export function createOpmlFilename(selectedFeedCount, totalFeedCount) {
  if (selectedFeedCount === totalFeedCount) {
    return 'humane-directory-feeds.opml';
  }

  if (!selectedFeedCount) {
    return 'humane-directory-selected-feeds.opml';
  }

  return `humane-directory-selected-${selectedFeedCount}-feeds.opml`;
}

export function buildOpml(feeds) {
  const title = 'humane.directory export';
  const feedXml = feeds.map((feed) => (
    `  <outline text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" type="rss" xmlUrl="${escapeXml(feed.feed)}" htmlUrl="${escapeXml(feed.url)}" />`
  )).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="1.0">',
    '  <head>',
    `    <title>${escapeXml(title)}</title>`,
    '  </head>',
    '  <body>',
    feedXml,
    '  </body>',
    '</opml>'
  ].join('\n');
}
