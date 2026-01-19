import { CONFIG } from './config.js';
import { GeminiAPI } from './api.js';
import { PromptBuilder } from './promptBuilder.js';

// State management
let state = {
    category: null,
    orientation: 'landscape',
    count: 1,
    models: ['google/gemini-2.5-flash-image'],
    generatedImages: [],
    editingIndex: null,
    history: [],
    currentHistoryId: null,
    style: 'original',
    referenceImages: [],
    apiKeys: {
        openrouter: localStorage.getItem('openrouter_key') || ''
    }
};

// UI Elements
const historyList = document.getElementById('history-list');
const categoryGrid = document.getElementById('category-grid');
const styleSection = document.getElementById('style-section');
const styleGrid = document.getElementById('style-grid');
const countSection = document.getElementById('count-section');
const countGrid = document.getElementById('count-grid');
const modelSection = document.getElementById('model-section');
const modelGrid = document.getElementById('model-grid');
const instructionSection = document.getElementById('instruction-section');
const orientationSection = document.getElementById('orientation-section');
const orientationGrid = document.querySelector('.orientation-grid');
const generateBtn = document.getElementById('generate-btn');
const userInput = document.getElementById('prompt');
const fileUpload = document.getElementById('file-upload');
const attachmentsPreview = document.getElementById('attachments-preview');
const openrouterKeyInput = document.getElementById('openrouter-key');
const apiKeysToggle = document.getElementById('api-keys-toggle');
const apiKeysContent = document.getElementById('api-keys-content');

// Progress & Results
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const resultsSection = document.getElementById('results-section');
const resultsGrid = document.getElementById('results-grid');
const resultsSummary = document.getElementById('results-summary');

// Modals
const editModal = document.getElementById('edit-modal');
const previewModal = document.getElementById('preview-modal');
const previewImage = document.getElementById('preview-image');
const refineInput = document.getElementById('refine-input');
const confirmRefineBtn = document.getElementById('confirm-refine-btn');

const api = new GeminiAPI(state.apiKeys.openrouter);
const promptBuilder = new PromptBuilder();

function init() {
    setupCategorySelection();
    setupOrientationSelection();
    setupFileUpload();
    setupStyleSelection();
    setupCountSelection();
    setupModelSelection();
    setupGenerateButton();
    setupEditModal();
    setupApiKeys();
    setupPreviewModal();
    setupClearHistory();
    loadHistory();

    if (state.apiKeys.openrouter) {
        openrouterKeyInput.value = state.apiKeys.openrouter;
    }
}

function setupApiKeys() {
    apiKeysToggle.addEventListener('click', () => {
        apiKeysContent.classList.toggle('hidden');
    });

    const updateApiKey = (e) => {
        const key = e.target.value.trim();
        state.apiKeys.openrouter = key;
        localStorage.setItem('openrouter_key', key);
        api.apiKey = key;
        console.log('API key updated:', key ? 'Key set' : 'Key empty');
    };

    openrouterKeyInput.addEventListener('change', updateApiKey);
    openrouterKeyInput.addEventListener('blur', updateApiKey);
    openrouterKeyInput.addEventListener('input', (e) => {
        // Update state immediately on input but don't save to localStorage yet
        state.apiKeys.openrouter = e.target.value.trim();
        api.apiKey = e.target.value.trim();
    });
}

function setupClearHistory() {
    const clearBtn = document.getElementById('clear-history-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all history? This cannot be undone.')) {
                state.history = [];
                state.currentHistoryId = null;
                localStorage.removeItem('imageGenHistory');
                renderHistory();
                console.log('History cleared');
            }
        });
    }
}

function setupCategorySelection() {
    const tiles = categoryGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.category = tile.dataset.value;
            showNextSections();
        });
    });
}

function setupOrientationSelection() {
    const tiles = orientationGrid.querySelectorAll('.orientation-tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.orientation = tile.dataset.value;
        });
    });
}

function setupStyleSelection() {
    const tiles = styleGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.style = tile.dataset.value;
        });
    });
}

function setupCountSelection() {
    const tiles = countGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.count = parseInt(tile.dataset.value);
        });
    });
}

function setupModelSelection() {
    const tiles = modelGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.models = [tile.dataset.value];
        });
    });
}

function showNextSections() {
    const subtopicStyles = document.querySelectorAll('.subtopic-style');
    const contextStyles = document.querySelectorAll('.context-style');

    if (state.category === 'subtopic_cover') {
        styleSection.style.display = 'block';
        styleSection.classList.remove('hidden');

        subtopicStyles.forEach(el => el.style.display = 'flex');
        contextStyles.forEach(el => el.style.display = 'none');

        // Reset to original if switching back or if current style is invalid for subtopic
        if (state.style === 'realistic' || state.style === 'cartoon' || !state.style) {
            state.style = 'original';
            updateStyleSelectionUI();
        }

    } else if (state.category === 'context_introduction') {
        styleSection.style.display = 'block';
        styleSection.classList.remove('hidden');

        subtopicStyles.forEach(el => el.style.display = 'none');
        contextStyles.forEach(el => el.style.display = 'flex');

        // Default to realistic if switching to context or if current style is invalid
        if (state.style !== 'realistic' && state.style !== 'cartoon') {
            state.style = 'realistic';
            updateStyleSelectionUI();
        }

    } else {
        styleSection.style.display = 'none';
        // Reset style just in case
        state.style = 'original';
    }

    orientationSection.classList.remove('hidden');
    countSection.classList.remove('hidden');
    modelSection.classList.remove('hidden');
    instructionSection.classList.remove('hidden');
    generateBtn.classList.remove('hidden');
}

function updateStyleSelectionUI() {
    const tiles = styleGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        if (tile.dataset.value === state.style) {
            tile.classList.add('selected');
        } else {
            tile.classList.remove('selected');
        }
    });
}

function setupFileUpload() {
    fileUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.referenceImages.push(event.target.result);
                renderAttachmentPreviews();
            };
            reader.readAsDataURL(file);
        });
    });
}

function renderAttachmentPreviews() {
    attachmentsPreview.innerHTML = '';
    state.referenceImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-preview-item';
        item.innerHTML = `
            <img src="${img}">
            <div class="attachment-remove" data-index="${index}">×</div>
        `;
        item.querySelector('.attachment-remove').onclick = () => {
            state.referenceImages.splice(index, 1);
            renderAttachmentPreviews();
        };
        attachmentsPreview.appendChild(item);
    });
}

async function handleGenerate() {
    const promptText = userInput.value.trim();
    if (!state.category || !promptText || !state.apiKeys.openrouter) {
        alert("Please fill in all required fields and API key.");
        return;
    }

    // Capture state at the start of generation to prevent issues if user switches tabs
    const genState = {
        promptText,
        category: state.category,
        count: state.count,
        orientation: state.orientation,
        style: state.style,
        models: [...state.models],
        referenceImages: [...state.referenceImages],
        apiKeys: { ...state.apiKeys }
    };

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> Generating...';
    resultsSection.style.display = 'block';
    resultsGrid.innerHTML = '';
    state.generatedImages = [];

    const historyId = addToHistory(genState.promptText, genState.category, genState.count);
    state.currentHistoryId = historyId;

    // Create placeholders
    for (let i = 0; i < genState.count; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'result-item placeholder';
        placeholder.id = `result-item-${i + 1}`;
        placeholder.innerHTML = `<div class="placeholder-content"><div class="spinner"></div><p>Generating...</p></div>`;
        resultsGrid.appendChild(placeholder);
    }

    try {
        const systemReferences = await api.fetchReferenceImages(genState.category);

        // Get dimensions based on orientation
        const categoryConfig = CONFIG.categories[genState.category];
        let width = categoryConfig.width;
        let height = categoryConfig.height;

        // Determine if we need to swap based on selected orientation
        const isCurrentlyLandscape = width > height;
        const wantsLandscape = genState.orientation === 'landscape';

        // Swap if the current orientation doesn't match the desired orientation
        if (isCurrentlyLandscape && !wantsLandscape) {
            // Default is landscape, user wants portrait
            [width, height] = [height, width];
        } else if (!isCurrentlyLandscape && wantsLandscape) {
            // Default is portrait, user wants landscape
            [width, height] = [height, width];
        }

        console.log(`Generating ${genState.count} images at ${width}x${height} (${genState.orientation})`);


        for (let i = 0; i < genState.count; i++) {
            const finalPrompt = promptBuilder.buildPrompt(genState.category, genState.promptText, {
                style: genState.style,
                variationIndex: i,
                totalVariations: genState.count,
                width: width,
                height: height,
                hasUserReferenceImages: genState.referenceImages.length > 0
            });

            const imageUrl = await api.generateImage({
                prompt: finalPrompt,
                category: genState.category,
                model: genState.models[0],
                width: width,
                height: height,
                userReferenceImages: genState.referenceImages,
                systemReferenceImages: systemReferences
            });

            updateResultItem(i + 1, imageUrl, historyId);
        }

        resultsSummary.textContent = `Generated ${genState.count} images.`;
    } catch (error) {
        console.error(error);
        alert("Error generating images: " + error.message);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="btn-text">Generate Images</span><span class="btn-icon">✨</span>';
    }
}

function renderResultItem(index, imageUrl) {
    const item = document.getElementById(`result-item-${index}`);
    if (!item) return;

    item.className = 'result-item fade-in';
    item.innerHTML = `
        <img src="${imageUrl}" onclick="window.openPreviewModal('${imageUrl}')">
        <button class="edit-btn" onclick="window.openEditModal(${index})">✏️</button>
        <div class="result-item-overlay">
            <button class="download-btn" onclick="window.downloadImage('${imageUrl}', ${index})">Download</button>
        </div>
    `;
}

function updateResultItem(index, imageUrl, historyId) {
    // 1. Update History State (Source of Truth) using the specific historyId
    const item = state.history.find(h => h.id == historyId); // Loose equality for safety
    if (item) {
        // Avoid duplicates in history
        const exists = item.images.some(img => img.index === index && img.url === imageUrl);
        if (!exists) {
            item.images.push({ index, url: imageUrl });
            saveHistory();
            renderHistory();
        }
    } else {
        console.warn(`History item with id ${historyId} not found in state.`);
    }

    // 2. Update UI only if we are currently viewing this history item
    if (state.currentHistoryId == historyId) { // Loose equality
        // Update current view state
        const alreadyInGen = state.generatedImages.some(img => img.index === index);
        if (!alreadyInGen) {
            state.generatedImages.push({ index, url: imageUrl });
        }
        // Update DOM
        renderResultItem(index, imageUrl);
    }
}

function setupGenerateButton() {
    generateBtn.addEventListener('click', handleGenerate);
}

// History Management
function addToHistory(prompt, category, count) {
    const item = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        prompt,
        category,
        count,
        images: []
    };
    state.history.unshift(item);
    saveHistory();
    renderHistory();
    return item.id;
}

function saveHistory() {
    try {
        // Only save the last 20 items to avoid quota issues
        const historyToSave = state.history.slice(0, 20);
        localStorage.setItem('imageGenHistory', JSON.stringify(historyToSave));
    } catch (e) {
        console.warn('Failed to save history (quota exceeded):', e);
        // Clear old history and try again with just the last 5 items
        try {
            const recentHistory = state.history.slice(0, 5);
            localStorage.setItem('imageGenHistory', JSON.stringify(recentHistory));
        } catch (e2) {
            console.error('Could not save history even after clearing:', e2);
        }
    }
}

function loadHistory() {
    const saved = localStorage.getItem('imageGenHistory');
    if (saved) {
        state.history = JSON.parse(saved);
        renderHistory();
    }
}

function renderHistory() {
    historyList.innerHTML = '';
    if (state.history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No history yet</div>';
        return;
    }

    state.history.forEach(item => {
        const el = document.createElement('div');
        el.className = `history-item ${state.currentHistoryId === item.id ? 'active' : ''}`;

        // Format timestamp
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        el.innerHTML = `
            <div class="history-prompt">${item.prompt}</div>
            <div class="history-meta">
                <span class="history-category">${CONFIG.categories[item.category]?.name || item.category}</span>
                <span class="history-time">${timeStr} • ${dateStr}</span>
            </div>
        `;
        el.onclick = () => loadHistoryItem(item);
        historyList.appendChild(el);
    });
}

function loadHistoryItem(itemInput) {
    // Refresh item from state to ensure we have latest images and object reference
    const item = state.history.find(h => h.id == itemInput.id) || itemInput;

    state.currentHistoryId = item.id;
    state.category = item.category;
    userInput.value = item.prompt;
    state.count = item.count;
    state.generatedImages = [...item.images];

    resultsSection.style.display = 'block';
    resultsGrid.innerHTML = '';

    // Render placeholders + images
    // We use state.count to determine how many slots there should be.
    // We use item.images to fill the completed ones.
    for (let i = 0; i < state.count; i++) {
        const div = document.createElement('div');
        div.id = `result-item-${i + 1}`;
        resultsGrid.appendChild(div);

        const existingImg = item.images.find(img => img.index === (i + 1));
        if (existingImg) {
            renderResultItem(existingImg.index, existingImg.url);
        } else {
            // Render placeholder
            div.className = 'result-item placeholder';
            div.innerHTML = `<div class="placeholder-content"><div class="spinner"></div><p>Generating...</p></div>`;
        }
    }

    renderHistory();
}

// Modals
function setupEditModal() {
    const closeBtns = editModal.querySelectorAll('.close-modal, .close-modal-btn');
    closeBtns.forEach(btn => btn.onclick = () => editModal.classList.add('hidden'));
    confirmRefineBtn.onclick = handleRefine;
}

function setupPreviewModal() {
    previewModal.onclick = (e) => {
        if (e.target === previewModal || e.target.className === 'close-preview') {
            previewModal.classList.add('hidden');
        }
    };
}

async function handleRefine() {
    const instructions = refineInput.value.trim();
    if (!instructions) {
        alert('Please describe your changes.');
        return;
    }

    const baseImage = state.generatedImages.find(img => img.index === state.editingIndex);
    if (!baseImage) {
        alert('Error: Image not found.');
        return;
    }

    // Close modal
    editModal.classList.add('hidden');

    // Generate new index for the refined image
    const maxIndex = Math.max(...state.generatedImages.map(img => img.index), 0);
    const newIndex = maxIndex + 1;

    // Create a new placeholder for the refined image
    const placeholder = document.createElement('div');
    placeholder.className = 'result-item placeholder';
    placeholder.id = `result-item-${newIndex}`;
    placeholder.innerHTML = `
        <div class="placeholder-content">
            <div class="spinner"></div>
            <p>Refining image...</p>
        </div>
    `;

    // Append to results grid
    resultsGrid.appendChild(placeholder);

    try {
        // Build refinement prompt
        const refinementPrompt = `CRITICAL INSTRUCTION: The first image is the base image to refine.

Modify this image according to these instructions: "${instructions}"

IMPORTANT RULES:
- Maintain the overall style and composition of the original image
- Only make the specific changes requested in the instructions
- Keep the same aspect ratio and dimensions
- Preserve the quality and clarity of the original`;

        // Get dimensions from the base image (use same as original)
        const categoryConfig = CONFIG.categories[state.category];
        let width = categoryConfig.width;
        let height = categoryConfig.height;

        // Apply orientation
        const isCurrentlyLandscape = width > height;
        const wantsLandscape = state.orientation === 'landscape';

        if (isCurrentlyLandscape && !wantsLandscape) {
            [width, height] = [height, width];
        } else if (!isCurrentlyLandscape && wantsLandscape) {
            [width, height] = [height, width];
        }

        // Call API with base image as reference
        const imageUrl = await api.generateImage({
            prompt: refinementPrompt,
            category: state.category,
            model: state.models[0],
            width: width,
            height: height,
            userReferenceImages: [baseImage.url],
            systemReferenceImages: []
        });

        // Update the placeholder with the refined image
        updateResultItem(newIndex, imageUrl, state.currentHistoryId);

    } catch (error) {
        console.error('Refinement error:', error);
        alert('Error refining image: ' + error.message);
        placeholder.remove();
    }
}

window.openEditModal = (index) => {
    state.editingIndex = index;
    refineInput.value = '';
    editModal.classList.remove('hidden');
};

window.openPreviewModal = (url) => {
    previewImage.src = url;
    previewModal.classList.remove('hidden');
};

window.downloadImage = (url, index) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-image-${index}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

init();
