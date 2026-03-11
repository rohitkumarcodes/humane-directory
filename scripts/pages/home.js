import { loadDirectoryData } from '../lib/data.js';
import { addReferralParam, getDomain } from '../lib/url.js';

const DIRECTORY_DATA_URL = 'data.json';
const REFERRAL_SOURCE = 'humane.directory';
const LOAD_ERROR_MESSAGE = 'Error: Could not load the directory data. If you are viewing this locally on your computer, you may need a local web server to fetch the JSON file.';

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function getSortedTags(websites) {
  const tags = new Set();

  websites.forEach((site) => {
    site.tags.forEach((tag) => tags.add(tag));
  });

  return Array.from(tags).sort((leftTag, rightTag) => leftTag.localeCompare(rightTag));
}

function getTagCounts(websites) {
  const tagCounts = new Map();

  websites.forEach((site) => {
    site.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return tagCounts;
}

function getFilteredSites(state) {
  if (state.currentFilter === 'all') {
    return state.websites;
  }

  return state.websites.filter((site) => site.tags.includes(state.currentFilter));
}

function createTagButton(tag, count, isActive) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tag-btn';
  button.dataset.tag = tag;
  button.textContent = `${tag === 'all' ? 'All' : tag} (${count})`;

  if (isActive) {
    button.disabled = true;
  }

  return button;
}

function createSiteItem(site) {
  const article = document.createElement('article');
  article.className = 'site-item';

  const header = document.createElement('div');
  header.className = 'site-header';

  const domain = getDomain(site.url);

  if (domain) {
    const favicon = document.createElement('img');
    favicon.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    favicon.className = 'favicon';
    favicon.alt = '';
    header.appendChild(favicon);
  }

  const title = document.createElement('h3');
  const link = document.createElement('a');
  link.href = addReferralParam(site.url, REFERRAL_SOURCE);
  link.target = '_blank';
  link.rel = 'noopener';
  link.title = `Visit ${site.name}`;
  link.textContent = site.name;
  title.appendChild(link);
  header.appendChild(title);

  if (site.feed) {
    const rssButton = document.createElement('button');
    rssButton.type = 'button';
    rssButton.className = 'rss-btn';
    rssButton.dataset.feed = site.feed;
    rssButton.dataset.defaultLabel = 'Copy RSS';
    rssButton.title = 'Copy RSS feed link to clipboard';
    rssButton.textContent = 'Copy RSS';
    header.appendChild(rssButton);
  }

  const description = document.createElement('p');
  description.textContent = site.description;

  article.append(header, description);

  return article;
}

function renderTags(state, tagNav) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tag-nav-layout';

  const label = document.createElement('strong');
  label.className = 'tag-nav-label';
  label.textContent = 'Filter:';
  wrapper.appendChild(label);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'tag-nav-options';
  buttonGroup.appendChild(createTagButton('all', state.websites.length, state.currentFilter === 'all'));

  state.sortedTags.forEach((tag) => {
    buttonGroup.appendChild(createTagButton(tag, state.tagCounts.get(tag) || 0, state.currentFilter === tag));
  });

  wrapper.appendChild(buttonGroup);
  tagNav.replaceChildren(wrapper);
}

function renderSites(state, listContainer) {
  const fragment = document.createDocumentFragment();

  getFilteredSites(state).forEach((site) => {
    fragment.appendChild(createSiteItem(site));
  });

  listContainer.replaceChildren(fragment);
}

function setTemporaryButtonLabel(button, text) {
  const defaultLabel = button.dataset.defaultLabel || 'Copy RSS';

  button.textContent = text;

  if (button._resetTimerId) {
    window.clearTimeout(button._resetTimerId);
  }

  button._resetTimerId = window.setTimeout(() => {
    button.textContent = defaultLabel;
  }, 2000);
}

async function handleRssButtonClick(button) {
  const feedUrl = button.dataset.feed;

  if (!feedUrl) {
    return;
  }

  try {
    await navigator.clipboard.writeText(feedUrl);
    setTemporaryButtonLabel(button, 'Copied!');
  } catch (error) {
    setTemporaryButtonLabel(button, 'Error');
  }
}

function showLoadError(listContainer) {
  const errorMessage = document.createElement('p');
  errorMessage.className = 'page-error';
  errorMessage.textContent = LOAD_ERROR_MESSAGE;
  listContainer.replaceChildren(errorMessage);
}

export async function initHomePage() {
  const listContainer = document.getElementById('site-list');
  const tagNav = document.getElementById('tag-nav');

  if (!listContainer || !tagNav) {
    return;
  }

  const state = {
    websites: [],
    currentFilter: 'all',
    sortedTags: [],
    tagCounts: new Map()
  };

  tagNav.addEventListener('click', (event) => {
    const button = event.target.closest('.tag-btn');

    if (!button || button.disabled) {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    state.currentFilter = button.dataset.tag || 'all';
    renderTags(state, tagNav);
    renderSites(state, listContainer);
  });

  listContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.rss-btn');

    if (!button) {
      return;
    }

    void handleRssButtonClick(button);
  });

  try {
    const websites = await loadDirectoryData(DIRECTORY_DATA_URL);

    shuffleInPlace(websites);

    state.websites = websites;
    state.sortedTags = getSortedTags(websites);
    state.tagCounts = getTagCounts(websites);

    renderTags(state, tagNav);
    renderSites(state, listContainer);
  } catch (error) {
    console.error('Failed to load directory data:', error);
    showLoadError(listContainer);
  }
}

if (typeof document !== 'undefined') {
  void initHomePage();
}
