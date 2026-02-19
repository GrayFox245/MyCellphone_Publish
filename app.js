// Configuration - UPDATE THESE VALUES
const CONFIG = {
    // Google Drive folder ID (from the sharing URL)
    FOLDER_ID: '1RM9NNd4NHhNTnqxRou8zsmrFE0yfwI0I',
    // JSON data file ID (created by Google Apps Script)
    DATA_FILE_ID: '1nKBU2p2rEiityzROstX1O-yq-R6vwyEW'
};

// State
let allImages = [];
let allThemes = new Set();
let currentSort = 'a-z';

// DOM Elements
const gallery = document.getElementById('gallery');
const searchInput = document.getElementById('searchInput');
const themeFilter = document.getElementById('themeFilter');
const sortOrder = document.getElementById('sortOrder');
const modal = document.getElementById('modal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalThemes = document.getElementById('modalThemes');
const closeBtn = document.querySelector('.close');
const loading = document.getElementById('loading');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    loading.classList.add('active');

    try {
        await loadData();
        populateThemeFilter();
        filterImages();  // This applies sorting on initial load
    } catch (error) {
        console.error('Error loading data:', error);
        gallery.innerHTML = '<div class="no-results">Error loading images. Please check configuration.</div>';
    }

    loading.classList.remove('active');

    // Event listeners
    searchInput.addEventListener('input', filterImages);
    themeFilter.addEventListener('change', filterImages);
    sortOrder.addEventListener('change', handleSort);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

async function loadData() {
    // Load JSON data from local file
    try {
        const response = await fetch('image-data.json');
        if (!response.ok) throw new Error('Failed to load data');

        const data = await response.json();
        allImages = data.images || [];

        // Collect all themes
        allImages.forEach(img => {
            if (img.themes) {
                img.themes.forEach(theme => allThemes.add(theme));
            }
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        loadSampleData();
    }
}

function loadSampleData() {
    // Sample data for testing without Google Drive
    allImages = [
        {
            name: "Sample Image 1",
            filename: "sample1.jpg",
            description: "This is a sample description.",
            themes: ["Theme A", "Theme B"]
        }
    ];
    allThemes.add("Theme A");
    allThemes.add("Theme B");
}

function getImageUrl(filename) {
    // Construct Google Drive image URL
    // Note: This requires the image to be publicly shared
    return `https://drive.google.com/uc?export=view&id=${CONFIG.FOLDER_ID}/${encodeURIComponent(filename)}`;
}

function convertToThumbnailUrl(url) {
    // Convert Google Drive URL to thumbnail format which works better for embedding
    if (!url) return '';
    const match = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }
    return url;
}

function renderGallery(images) {
    if (images.length === 0) {
        gallery.innerHTML = '<div class="no-results">No images found</div>';
        return;
    }

    gallery.innerHTML = images.map(img => `
        <div class="gallery-item" onclick="openModal('${escapeHtml(img.name)}')">
            <img src="${convertToThumbnailUrl(img.imageUrl) || getImageUrl(img.filename)}"
                 alt="${escapeHtml(img.name)}"
                 loading="lazy"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%23333%22 width=%22200%22 height=%22200%22/><text fill=%22%23666%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>Image</text></svg>'">
            <div class="title">${escapeHtml(img.name)}</div>
        </div>
    `).join('');
}

function populateThemeFilter() {
    const themes = Array.from(allThemes).sort();
    themeFilter.innerHTML = '<option value="">All Themes</option>' +
        themes.map(theme => `<option value="${escapeHtml(theme)}">${escapeHtml(theme)}</option>`).join('');
}

function filterImages() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedTheme = themeFilter.value;

    let filtered = allImages.filter(img => {
        const matchesSearch = img.name.toLowerCase().includes(searchTerm);
        const matchesTheme = !selectedTheme ||
            (img.themes && img.themes.includes(selectedTheme));
        return matchesSearch && matchesTheme;
    });

    filtered = sortImages(filtered);
    renderGallery(filtered);
}

function handleSort() {
    currentSort = sortOrder.value;
    filterImages();
}

function sortImages(images) {
    const sorted = [...images];

    switch (currentSort) {
        case 'a-z':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'z-a':
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'newest':
            sorted.sort((a, b) => {
                const dateA = a.dateCreated ? new Date(a.dateCreated) : new Date(0);
                const dateB = b.dateCreated ? new Date(b.dateCreated) : new Date(0);
                return dateB - dateA;
            });
            break;
        case 'oldest':
            sorted.sort((a, b) => {
                const dateA = a.dateCreated ? new Date(a.dateCreated) : new Date(0);
                const dateB = b.dateCreated ? new Date(b.dateCreated) : new Date(0);
                return dateA - dateB;
            });
            break;
        case 'random':
            for (let i = sorted.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
            }
            break;
    }

    return sorted;
}

function openModal(imageName) {
    const img = allImages.find(i => i.name === imageName);
    if (!img) return;

    // Use larger thumbnail for modal (w1600 for better quality)
    const modalUrl = img.imageUrl ? img.imageUrl.replace('uc?export=view&id=', 'thumbnail?id=') + '&sz=w1600' : getImageUrl(img.filename);
    modalImage.src = modalUrl;
    modalTitle.textContent = img.name;
    modalDescription.textContent = img.description || '';

    modalThemes.innerHTML = (img.themes || [])
        .map(theme => `<span class="theme-tag">${escapeHtml(theme)}</span>`)
        .join('');

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
