import { loadDirectoryData } from '../lib/data.js';
import { buildOpml, createFeedCatalog, createFolderData, createOpmlFilename } from '../lib/feeds.js';

const DIRECTORY_DATA_URL = '../data.json';
const LOAD_ERROR_MESSAGE = 'Error: Could not load the directory data. If you are viewing this locally, run a local web server first.';

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function setStatus(elements, message, tone = '') {
  elements.status.textContent = message;
  elements.status.className = 'download-status';

  if (tone) {
    elements.status.classList.add(`is-${tone}`);
  }
}

function getVisibleFeeds(state) {
  return state.feedCatalog.filter((feed) => state.visibleFeedIds.has(feed.id));
}

function getSelectedFeeds(state) {
  return state.feedCatalog.filter((feed) => state.selectedFeedIds.has(feed.id));
}

function updateDownloadButton(state, elements) {
  elements.downloadButton.disabled = state.selectedFeedIds.size === 0;
}

function createFolderOption(folder, selectedFolders) {
  const label = document.createElement('label');
  label.className = 'folder-option';
  label.htmlFor = `folder-${slugify(folder.tag)}`;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `folder-${slugify(folder.tag)}`;
  input.dataset.folderTag = folder.tag;
  input.checked = selectedFolders.has(folder.tag);

  const text = document.createElement('span');
  text.textContent = folder.tag;

  const count = document.createElement('span');
  count.className = 'folder-option-count';
  count.textContent = `(${folder.feedIds.length})`;

  label.append(input, text, count);

  return label;
}

function createFeedOption(feed, selectedFeedIds) {
  const label = document.createElement('label');
  label.className = 'feed-option';
  label.htmlFor = `feed-${slugify(feed.name)}-${slugify(feed.id)}`;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `feed-${slugify(feed.name)}-${slugify(feed.id)}`;
  input.dataset.feedId = feed.id;
  input.checked = selectedFeedIds.has(feed.id);

  const copy = document.createElement('span');
  copy.className = 'feed-option-copy';

  const name = document.createElement('span');
  name.className = 'feed-option-name';
  name.textContent = feed.name;
  copy.appendChild(name);

  if (feed.domain) {
    const meta = document.createElement('span');
    meta.className = 'feed-option-meta';
    meta.textContent = feed.domain;
    copy.appendChild(meta);
  }

  label.append(input, copy);

  return label;
}

function renderFolderOptions(state, elements) {
  const fragment = document.createDocumentFragment();

  state.folders.forEach((folder) => {
    fragment.appendChild(createFolderOption(folder, state.selectedFolders));
  });

  elements.folderOptions.replaceChildren(fragment);
}

function renderFeedOptions(state, elements) {
  const visibleFeeds = getVisibleFeeds(state);

  if (!visibleFeeds.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'download-empty-state';
    emptyState.textContent = 'No feeds match the selected folders.';
    elements.feedOptions.replaceChildren(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  visibleFeeds.forEach((feed) => {
    fragment.appendChild(createFeedOption(feed, state.selectedFeedIds));
  });

  elements.feedOptions.replaceChildren(fragment);
}

function syncFolderUi(state, elements) {
  const allFoldersAreSelected = state.selectedFolders.size === state.folders.length && state.folders.length > 0;
  const someFoldersAreSelected = state.selectedFolders.size > 0 && state.selectedFolders.size < state.folders.length;

  elements.selectAllCheckbox.checked = allFoldersAreSelected;
  elements.selectAllCheckbox.indeterminate = someFoldersAreSelected;

  elements.folderOptions.querySelectorAll('[data-folder-tag]').forEach((checkbox) => {
    checkbox.checked = state.selectedFolders.has(checkbox.dataset.folderTag);
  });
}

function syncFeedUi(state, elements) {
  const visibleFeeds = getVisibleFeeds(state);
  const selectedVisibleFeedCount = visibleFeeds.filter((feed) => state.selectedFeedIds.has(feed.id)).length;

  elements.selectVisibleFeedsCheckbox.disabled = visibleFeeds.length === 0;
  elements.selectVisibleFeedsCheckbox.checked = visibleFeeds.length > 0 && selectedVisibleFeedCount === visibleFeeds.length;
  elements.selectVisibleFeedsCheckbox.indeterminate = false;

  elements.feedOptions.querySelectorAll('[data-feed-id]').forEach((checkbox) => {
    checkbox.checked = state.selectedFeedIds.has(checkbox.dataset.feedId);
  });

  updateDownloadButton(state, elements);
}

function updateVisibleFeeds(state, elements, previousVisibleFeedIds = new Set()) {
  const nextVisibleFeedIds = new Set();

  state.folders.forEach((folder) => {
    if (!state.selectedFolders.has(folder.tag)) {
      return;
    }

    folder.feedIds.forEach((feedId) => nextVisibleFeedIds.add(feedId));
  });

  const nextSelectedFeedIds = new Set();

  nextVisibleFeedIds.forEach((feedId) => {
    if (state.selectedFeedIds.has(feedId) || !previousVisibleFeedIds.has(feedId)) {
      nextSelectedFeedIds.add(feedId);
    }
  });

  state.visibleFeedIds = nextVisibleFeedIds;
  state.selectedFeedIds = nextSelectedFeedIds;

  renderFeedOptions(state, elements);
  syncFolderUi(state, elements);
  syncFeedUi(state, elements);
}

function downloadOpmlFile(opmlContent, filename) {
  const blob = new Blob([opmlContent], { type: 'text/x-opml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleSelectAllChange(state, elements) {
  const previousVisibleFeedIds = new Set(state.visibleFeedIds);

  if (elements.selectAllCheckbox.checked) {
    state.selectedFolders = new Set(state.folders.map((folder) => folder.tag));
  } else {
    state.selectedFolders = new Set();
  }

  setStatus(elements, '');
  updateVisibleFeeds(state, elements, previousVisibleFeedIds);
}

function handleFolderSelectionChange(state, elements, event) {
  const tag = event.target.dataset.folderTag;

  if (!tag) {
    return;
  }

  const previousVisibleFeedIds = new Set(state.visibleFeedIds);

  if (event.target.checked) {
    state.selectedFolders.add(tag);
  } else {
    state.selectedFolders.delete(tag);
  }

  setStatus(elements, '');
  updateVisibleFeeds(state, elements, previousVisibleFeedIds);
}

function handleSelectVisibleFeedsChange(state, elements) {
  if (elements.selectVisibleFeedsCheckbox.checked) {
    state.visibleFeedIds.forEach((feedId) => state.selectedFeedIds.add(feedId));
  } else {
    state.visibleFeedIds.forEach((feedId) => state.selectedFeedIds.delete(feedId));
  }

  setStatus(elements, '');
  syncFeedUi(state, elements);
}

function handleFeedSelectionChange(state, elements, event) {
  const feedId = event.target.dataset.feedId;

  if (!feedId) {
    return;
  }

  if (event.target.checked) {
    state.selectedFeedIds.add(feedId);
  } else {
    state.selectedFeedIds.delete(feedId);
  }

  setStatus(elements, '');
  syncFeedUi(state, elements);
}

async function loadDownloadDirectory(state, elements) {
  setStatus(elements, 'Loading feed list…');

  try {
    const websites = await loadDirectoryData(DIRECTORY_DATA_URL);

    state.feedCatalog = createFeedCatalog(websites);
    state.folders = createFolderData(state.feedCatalog);
    state.selectedFolders = new Set(state.folders.map((folder) => folder.tag));
    state.selectedFeedIds = new Set();
    state.visibleFeedIds = new Set();

    renderFolderOptions(state, elements);
    updateVisibleFeeds(state, elements);
    setStatus(elements, '');
  } catch (error) {
    console.error('Failed to load directory data:', error);
    const emptyState = document.createElement('p');
    emptyState.className = 'download-empty-state';
    emptyState.textContent = 'Could not load the feed list.';
    elements.feedOptions.replaceChildren(emptyState);
    elements.selectAllCheckbox.disabled = true;
    elements.selectVisibleFeedsCheckbox.disabled = true;
    elements.downloadButton.disabled = true;
    setStatus(elements, LOAD_ERROR_MESSAGE, 'error');
  }
}

export async function initDownloadPage() {
  const elements = {
    selectAllCheckbox: document.getElementById('select-all'),
    selectVisibleFeedsCheckbox: document.getElementById('select-visible-feeds'),
    folderOptions: document.getElementById('folder-options'),
    feedOptions: document.getElementById('feed-options'),
    status: document.getElementById('download-status'),
    downloadForm: document.getElementById('download-form'),
    downloadButton: document.getElementById('download-button')
  };

  if (Object.values(elements).some((element) => !element)) {
    return;
  }

  const state = {
    feedCatalog: [],
    folders: [],
    selectedFolders: new Set(),
    visibleFeedIds: new Set(),
    selectedFeedIds: new Set()
  };

  elements.selectAllCheckbox.addEventListener('change', () => {
    handleSelectAllChange(state, elements);
  });

  elements.folderOptions.addEventListener('change', (event) => {
    handleFolderSelectionChange(state, elements, event);
  });

  elements.selectVisibleFeedsCheckbox.addEventListener('change', () => {
    handleSelectVisibleFeedsChange(state, elements);
  });

  elements.feedOptions.addEventListener('change', (event) => {
    handleFeedSelectionChange(state, elements, event);
  });

  elements.downloadForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const selectedFeeds = getSelectedFeeds(state);

    if (!selectedFeeds.length) {
      setStatus(elements, 'Select at least one feed before downloading.', 'error');
      return;
    }

    const opmlContent = buildOpml(selectedFeeds);
    const filename = createOpmlFilename(selectedFeeds.length, state.feedCatalog.length);

    downloadOpmlFile(opmlContent, filename);
    setStatus(elements, `Downloaded ${filename} with ${selectedFeeds.length} feed${selectedFeeds.length === 1 ? '' : 's'}.`, 'success');
  });

  await loadDownloadDirectory(state, elements);
}

if (typeof document !== 'undefined') {
  void initDownloadPage();
}
