import { CONFIG } from './config.js';
import { GeminiAPI } from './api.js';
import { PromptBuilder } from './promptBuilder.js';
import { HistoryStorage } from './storage.js';

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
    activeGenerationId: null,
    style: 'original',
    referenceImages: [],
    apiKeys: {
        openrouter: localStorage.getItem('openrouter_key') || ''
    },
    activeStudio: 'generate',
    editStudioImage: null,
    hidePreviewTimeout: null
};

let audioCtx = null;

// UI Elements
const historyList = document.getElementById('history-list');
// categoryGrid removed
// styleSection removed
// styleGrid removed
// countSection removed
// countGrid removed
// modelSection removed
// modelGrid removed
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

const resultsSection = document.getElementById('results-section');
const resultsGrid = document.getElementById('results-grid');

const editResultsSection = document.getElementById('edit-results-section');
const editResultsGrid = document.getElementById('edit-results-grid');


const resultsSummary = document.getElementById('results-summary');

// Modals
const editModal = document.getElementById('edit-modal');
const previewModal = document.getElementById('preview-modal');
const previewImage = document.getElementById('preview-image');
const refineInput = document.getElementById('refine-input');
const confirmRefineBtn = document.getElementById('confirm-refine-btn');

const historyHoverPreview = document.getElementById('history-hover-preview');
const historyPreviewGrid = document.getElementById('history-preview-grid');

// Studio Elements
const tabGenerate = document.getElementById('tab-generate');
const tabEdit = document.getElementById('tab-edit');
const generateStudio = document.getElementById('generate-studio');
const editStudio = document.getElementById('edit-studio');
const restartBtn = document.getElementById('restart-btn');

const editFileUpload = document.getElementById('edit-file-upload');
const editPreviewImage = document.getElementById('edit-preview-image');
const editImageContainer = document.getElementById('edit-image-container');
const removeEditImageBtn = document.getElementById('remove-edit-image');
const editPromptInput = document.getElementById('edit-prompt');
const editGenerateBtn = document.getElementById('edit-generate-btn');
const editCountSelect = document.getElementById('edit-count-select');
const editModelSelect = document.getElementById('edit-model-select');

const api = new GeminiAPI(state.apiKeys.openrouter);
const promptBuilder = new PromptBuilder();
const storage = new HistoryStorage();

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
    setupStudioNavigation();
    setupEditStudio();
    initHistory();

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


function setupCategorySelection() {
    const select = document.getElementById('category-select');
    select.addEventListener('change', (e) => {
        state.category = e.target.value;
        showNextSections();
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
    const select = document.getElementById('style-select');
    select.addEventListener('change', (e) => {
        state.style = e.target.value;
    });
}

function setupCountSelection() {
    const select = document.getElementById('count-select');
    select.addEventListener('change', (e) => {
        state.count = parseInt(e.target.value);
    });
}

function setupModelSelection() {
    const select = document.getElementById('model-select');
    const editSelect = document.getElementById('edit-model-select');

    const updateModel = (model) => {
        state.models = [model];
        // Sync both dropdowns
        if (select) select.value = model;
        if (editSelect) editSelect.value = model;
    };

    if (select) {
        select.addEventListener('change', (e) => updateModel(e.target.value));
    }
    if (editSelect) {
        editSelect.addEventListener('change', (e) => updateModel(e.target.value));
    }
}

function showNextSections() {
    const styleSelect = document.getElementById('style-select');
    if (!styleSelect) return;

    styleSelect.innerHTML = ''; // Clear existing options
    styleSelect.disabled = false;

    const categoryConfig = CONFIG.categories[state.category];
    if (!categoryConfig) return;

    const styles = categoryConfig.styles || [{ id: 'original', name: 'Original' }];

    // Populate styles
    styles.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.name;
        styleSelect.appendChild(option);
    });

    // Only set default if current style is not in the list for this category
    const styleExists = styles.some(s => s.id === state.style);
    if (!styleExists) {
        state.style = styles[0].id;
    }
    styleSelect.value = state.style;

    orientationSection.classList.remove('hidden');
    instructionSection.classList.remove('hidden');
    generateBtn.classList.remove('hidden');
}

function updateStyleSelectionUI() {
    const select = document.getElementById('style-select');
    if (select) {
        select.value = state.style;
    }
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
        // Add click handler to image to open preview modal
        item.innerHTML = `
            <img src="${img}" onclick="window.openPreviewModal('${img}')" style="cursor: pointer;">
            <div class="attachment-remove" data-index="${index}">×</div>
        `;
        item.querySelector('.attachment-remove').onclick = (e) => {
            e.stopPropagation(); // Prevent opening modal when clicking remove
            state.referenceImages.splice(index, 1);
            renderAttachmentPreviews();
        };
        attachmentsPreview.appendChild(item);
    });
}

async function handleGenerate() {
    const isEdit = state.activeStudio === 'edit';
    const promptText = isEdit ? editPromptInput.value.trim() : userInput.value.trim();
    const count = isEdit ? parseInt(editCountSelect.value) : state.count;
    const model = isEdit ? editModelSelect.value : state.models[0];

    if (!promptText || !state.apiKeys.openrouter) {
        alert("Please fill in all required fields and API key.");
        return;
    }

    if (!isEdit && !state.category) {
        alert("Please select an image type.");
        return;
    }

    // Capture state at the start of generation to prevent issues if user switches tabs
    const genState = {
        promptText,
        category: state.category || 'tutero_ai',
        count: count,
        orientation: state.orientation,
        style: state.style,
        models: [model],
        referenceImages: isEdit ? [state.editStudioImage] : [...state.referenceImages],
        apiKeys: { ...state.apiKeys }
    };

    const targetGrid = isEdit ? editResultsGrid : resultsGrid;
    const targetResultsSection = isEdit ? editResultsSection : resultsSection;

    // We don't want to reset generatedImages if we are adding to them (editing)
    if (!isEdit) {
        state.generatedImages = [];
        targetGrid.innerHTML = '';
        state.currentHistoryId = null; // Clear to force new history if not in edit mode
    }

    generateBtn.disabled = true;
    editGenerateBtn.disabled = true;

    if (isEdit) {
        editGenerateBtn.innerHTML = '<span class="spinner"></span> Working...';
    } else {
        generateBtn.innerHTML = '<span class="spinner"></span> Generating...';
    }

    targetResultsSection.style.display = 'block';

    let historyId = state.currentHistoryId;
    if (!historyId) {
        historyId = addToHistory(genState.promptText, genState.category, genState.count, genState);
        state.currentHistoryId = historyId;
    }
    state.activeGenerationId = historyId;

    const startIndex = state.generatedImages.length;
    // Create placeholders - first one "Generating", rest "Waiting"
    for (let i = 0; i < genState.count; i++) {
        const index = startIndex + i + 1;
        const placeholder = document.createElement('div');
        placeholder.className = 'result-item placeholder';
        placeholder.id = `result-item-${index}`;

        // First image is generating, rest are waiting
        const isGenerating = i === 0;
        placeholder.innerHTML = `
            <div class="placeholder-content">
                <div class="${isGenerating ? 'jumping-bot' : 'waiting-bot'}">
                    <img src="static/images/bot-head.png" alt="Loading">
                </div>
                <p class="${isGenerating ? 'generating-text' : 'waiting-text'}">${isGenerating ? 'Generating' : 'Waiting'}</p>
            </div>
        `;
        targetGrid.appendChild(placeholder);
    }

    updateGridScaling(targetGrid);

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

        // Determine correct aspect ratio string to pass to prompt builder
        let aspectRatioStr = categoryConfig.aspect_ratio;
        if (width > height) {
            aspectRatioStr = "16:9";
        } else {
            aspectRatioStr = "9:16";
        }

        console.log(`Generating ${genState.count} images at ${width}x${height} (${genState.orientation}) in style: ${genState.style}`);


        for (let i = 0; i < genState.count; i++) {
            const index = startIndex + i + 1;
            // Update the current placeholder to "Generating" if it's not the first one
            if (i > 0) {
                const currentPlaceholder = document.getElementById(`result-item-${index}`);
                if (currentPlaceholder && currentPlaceholder.classList.contains('placeholder')) {
                    currentPlaceholder.innerHTML = `
                        <div class="placeholder-content">
                            <div class="jumping-bot">
                                <img src="static/images/bot-head.png" alt="Loading">
                            </div>
                            <p class="generating-text">Generating</p>
                        </div>
                    `;
                }
            }

            const finalPrompt = promptBuilder.buildPrompt(genState.category, genState.promptText, {
                style: genState.style,
                variationIndex: i,
                totalVariations: genState.count,
                width: width,
                height: height,
                aspectRatio: aspectRatioStr,
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

            updateResultItem(index, imageUrl, historyId, targetGrid);
        }

        if (!isEdit) {
            resultsSummary.textContent = `Generated ${genState.count} images.`;
        }
    } catch (error) {
        console.error(error);
        alert("Error generating images: " + error.message);
    } finally {
        generateBtn.disabled = false;
        editGenerateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="btn-text">Generate Images</span><span class="btn-icon">✨</span>';
        editGenerateBtn.innerHTML = '<span class="btn-text">Edit Image</span><span class="btn-icon">✨</span>';

        state.activeGenerationId = null;
        renderHistory(); // Update sidebar to show previews
    }
}

function renderResultItem(index, imageUrl, grid) {
    const targetGrid = grid || (state.activeStudio === 'edit' ? editResultsGrid : resultsGrid);
    const item = targetGrid.querySelector(`#result-item-${index}`);
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

function playSuccessSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // A very subtle, soft "bloom" sound (C5 to E5 interval)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.warn('Audio feedback failed:', e);
    }
}

function updateResultItem(index, imageUrl, historyId, grid) {
    if (!imageUrl) {
        console.warn(`Update result item called with empty imageUrl for index ${index}`);
        return;
    }

    const targetGrid = grid || (state.activeStudio === 'edit' ? editResultsGrid : resultsGrid);

    // 1. Update History State (Source of Truth) using the specific historyId
    const item = state.history.find(h => h.id == historyId); // Loose equality for safety
    if (item) {
        // Avoid duplicates in history
        const exists = item.images.some(img => img.index === index && img.url === imageUrl);
        if (!exists) {
            item.images.push({ index, url: imageUrl });
            saveHistory();

            // If this is the first image, update the history sidebar immediately to show thumbnail
            if (index === 1) {
                renderHistory();
            }
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
        renderResultItem(index, imageUrl, targetGrid);
        updateGridScaling(targetGrid);
        playSuccessSound();
    }
}

function updateGridScaling(grid) {
    if (!grid) return;
    const count = grid.querySelectorAll('.result-item').length;
    grid.classList.remove('grid-compact', 'grid-super-compact');
    if (count > 8) {
        grid.classList.add('grid-super-compact');
    } else if (count > 4) {
        grid.classList.add('grid-compact');
    }
}

async function initHistory() {
    await storage.init();
    await storage.migrateFromLocalStorage();
    await loadHistory();
}

function setupGenerateButton() {
    generateBtn.addEventListener('click', handleGenerate);
}

// History Management
function addToHistory(prompt, category, count, additionalState = {}) {
    // Reference images are the main memory culprits. We prune them here to prevent storage bloat.
    // We only keep extremely simplified versions or just drop them if they are too large.
    const item = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        prompt,
        category,
        count,
        style: additionalState.style || state.style,
        orientation: additionalState.orientation || state.orientation,
        model: additionalState.models ? additionalState.models[0] : state.models[0],
        referenceImages: [...(additionalState.referenceImages || [])],
        images: []
    };
    state.history.unshift(item);
    saveHistory();
    renderHistory();
    return item.id;
}

async function saveHistory() {
    try {
        const MAX_ITEMS = 20;
        const historyToSave = state.history.slice(0, MAX_ITEMS);
        await storage.saveHistory(historyToSave);
    } catch (e) {
        console.error('Failed to save history to IndexedDB:', e);

        // Fallback or alert user if critical? 
        // With IndexedDB this is unlikely unless disk is full.
    }
}

async function loadHistory() {
    try {
        const history = await storage.loadHistory();
        if (history) {
            state.history = history;
            renderHistory();
        }
    } catch (e) {
        console.error('Failed to load history from IndexedDB:', e);
        state.history = [];
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

        // Get first image for thumbnail
        let thumbnailHtml = '';
        const firstImage = item.images && item.images.length > 0 ?
            item.images.sort((a, b) => a.index - b.index)[0] : null;

        if (firstImage) {
            thumbnailHtml = `<div class="history-thumbnail"><img src="${firstImage.url}" alt="Preview"></div>`;
        } else {
            thumbnailHtml = `<div class="history-thumbnail placeholder"><img src="static/images/bot-head.png" alt="Pending"></div>`;
        }

        el.innerHTML = `
            ${thumbnailHtml}
            <div class="history-item-content">
                <div class="history-prompt">${item.prompt}</div>
                <div class="history-meta">
                    <span class="history-category">${CONFIG.categories[item.category]?.name || item.category}</span>
                    <span class="history-time">${timeStr} • ${dateStr}</span>
                </div>
            </div>
        `;
        el.onclick = () => loadHistoryItem(item);
        el.onmouseenter = (e) => showHistoryPreview(e, item);
        el.onmouseleave = hideHistoryPreview;
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
    state.style = item.style || 'original';
    state.orientation = item.orientation || 'landscape';
    state.models = [item.model || 'google/gemini-2.5-flash-image'];
    state.referenceImages = [...(item.referenceImages || [])];
    state.generatedImages = [...item.images];

    // Update UI elements to match state
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) categorySelect.value = state.category;

    // Trigger showNextSections to populate style dropdown and show orientation
    showNextSections();

    // Update orientation UI
    const orientationTiles = orientationGrid.querySelectorAll('.orientation-tile');
    orientationTiles.forEach(tile => {
        if (tile.dataset.value === state.orientation) {
            tile.classList.add('selected');
        } else {
            tile.classList.remove('selected');
        }
    });

    // Update Style dropdown
    const styleSelect = document.getElementById('style-select');
    if (styleSelect) styleSelect.value = state.style;

    // Update Count dropdown
    const countSelect = document.getElementById('count-select');
    if (countSelect) countSelect.value = state.count;

    // Update Model dropdowns
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) modelSelect.value = state.models[0];
    const editModelSelect = document.getElementById('edit-model-select');
    if (editModelSelect) editModelSelect.value = state.models[0];

    // Render reference images
    renderAttachmentPreviews();

    resultsSection.style.display = 'block';
    resultsGrid.innerHTML = '';
    editResultsGrid.innerHTML = '';
    editResultsSection.style.display = 'none'; // Hide edit results on load

    // Render all images in item.images (including refined ones)
    // First, find the maximum index to know how many slots to show at minimum
    const maxImgIndex = (item.images || []).reduce((max, img) => Math.max(max, img.index), 0);
    const displayCount = Math.max(state.count, maxImgIndex);

    for (let i = 0; i < displayCount; i++) {
        const index = i + 1;
        const div = document.createElement('div');
        div.id = `result-item-${index}`;
        resultsGrid.appendChild(div);

        const existingImg = (item.images || []).find(img => img.index === index);
        if (existingImg) {
            renderResultItem(existingImg.index, existingImg.url);
        } else if (index <= state.count) {
            // Check if this is the ACTIVE generation
            const isCurrentlyGenerating = (state.activeGenerationId === item.id);

            div.className = 'result-item placeholder';
            div.innerHTML = `
                <div class="placeholder-content">
                    <div class="jumping-bot">
                        <img src="static/images/bot-head.png" alt="Loading">
                    </div>
                    <p class="generating-text ${isCurrentlyGenerating ? '' : 'generation-failed'}">${isCurrentlyGenerating ? 'Generating' : 'Generation Failed'}</p>
                </div>
            `;
        } else {
            // Remove extra empty slots
            div.remove();
        }
    }

    updateGridScaling(resultsGrid);
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

    const historyIdAtStart = state.currentHistoryId;
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

    // Append to results grid (only if still on same history item)
    if (state.currentHistoryId === historyIdAtStart) {
        resultsGrid.appendChild(placeholder);
    }

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
        updateResultItem(newIndex, imageUrl, historyIdAtStart);
        renderHistory();

    } catch (error) {
        console.error('Refinement error:', error);
        alert('Error refining image: ' + error.message);
        if (placeholder.parentNode) {
            placeholder.remove();
        }
    }
}

function setupStudioNavigation() {
    tabGenerate.onclick = () => switchStudio('generate');
    tabEdit.onclick = () => switchStudio('edit');
    restartBtn.onclick = () => location.reload();
}

function switchStudio(studio) {
    state.activeStudio = studio;
    if (studio === 'generate') {
        tabGenerate.classList.add('active');
        tabEdit.classList.remove('active');
        generateStudio.classList.remove('hidden');
        editStudio.classList.add('hidden');
    } else {
        tabGenerate.classList.remove('active');
        tabEdit.classList.add('active');
        generateStudio.classList.add('hidden');
        editStudio.classList.remove('hidden');
    }
}

function setupEditStudio() {
    editFileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.editStudioImage = event.target.result;
                renderEditStudioImage();
            };
            reader.readAsDataURL(file);
        }
    });

    removeEditImageBtn.onclick = (e) => {
        e.stopPropagation();
        state.editStudioImage = null;
        renderEditStudioImage();
    };

    editGenerateBtn.onclick = handleEditStudioGenerate;
}

function renderEditStudioImage() {
    if (state.editStudioImage) {
        editPreviewImage.src = state.editStudioImage;
        editPreviewImage.classList.remove('hidden');
        editImageContainer.classList.remove('empty');
        removeEditImageBtn.classList.remove('hidden');
        editImageContainer.querySelector('.upload-placeholder').classList.add('hidden');
    } else {
        editPreviewImage.src = '';
        editPreviewImage.classList.add('hidden');
        editImageContainer.classList.add('empty');
        removeEditImageBtn.classList.add('hidden');
        editImageContainer.querySelector('.upload-placeholder').classList.remove('hidden');
    }
}

async function handleEditStudioGenerate() {
    const instructions = editPromptInput.value.trim();
    if (!instructions || !state.editStudioImage) {
        alert('Please provide an image and instructions.');
        return;
    }

    if (!state.apiKeys.openrouter) {
        alert('Please provide an API key.');
        return;
    }

    const count = parseInt(editCountSelect.value);
    const model = editModelSelect.value;

    // Build the genState for the new generation
    const genState = {
        promptText: instructions,
        category: state.category || 'tutero_ai',
        count: count,
        orientation: state.orientation || 'landscape',
        style: state.style || 'original',
        models: [model],
        referenceImages: [state.editStudioImage],
        apiKeys: { ...state.apiKeys }
    };

    // Update state but don't switch studio
    if (!state.category) {
        state.category = 'tutero_ai';
    }
    state.referenceImages = [state.editStudioImage];
    // renderAttachmentPreviews(); // This is for Generate Studio, maybe not needed here if we stay on Edit

    // Trigger handleGenerate which is now studio-aware
    handleGenerate();
}

// Override openEditModal to switch to Edit Studio instead of modal
window.openEditModal = (index) => {
    const baseImage = state.generatedImages.find(img => img.index === index);
    if (!baseImage) return;

    state.editStudioImage = baseImage.url;
    editPromptInput.value = '';
    renderEditStudioImage();
    switchStudio('edit');
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

function showHistoryPreview(e, item) {
    if (!item.images || item.images.length === 0) return;

    // Clear and populate grid
    historyPreviewGrid.innerHTML = '';

    // Sort images by index to show in order
    const images = [...item.images].sort((a, b) => a.index - b.index);

    // Limit to 4 images max for preview
    images.forEach(img => {
        const div = document.createElement('div');
        div.className = 'history-preview-item';
        div.innerHTML = `<img src="${img.url}" onclick="window.openPreviewModal('${img.url}')" style="cursor: pointer;">`;
        historyPreviewGrid.appendChild(div);
    });

    // Handle single image layout
    if (images.length === 1) {
        historyPreviewGrid.classList.add('single');
        historyHoverPreview.classList.add('single');
    } else {
        historyPreviewGrid.classList.remove('single');
        historyHoverPreview.classList.remove('single');
    }

    // Handle preview hover to keep it visible
    historyHoverPreview.onmouseenter = () => {
        clearTimeout(state.hidePreviewTimeout);
    };
    historyHoverPreview.onmouseleave = hideHistoryPreview;

    // Position the tooltip
    const rect = e.currentTarget.getBoundingClientRect();
    // Ensure it doesn't go off screen bottom
    let top = rect.top;
    const previewHeight = historyHoverPreview.offsetHeight || 200; // Estimate if not visible yet
    if (top + previewHeight > window.innerHeight) {
        top = window.innerHeight - previewHeight - 20;
    }

    // Ensure top is at least 10px
    top = Math.max(10, top);

    const left = rect.right + 10; // 10px spacing

    historyHoverPreview.style.top = `${top}px`;
    historyHoverPreview.style.left = `${left}px`;

    // Show
    clearTimeout(state.hidePreviewTimeout);
    historyHoverPreview.classList.add('visible');
}

function hideHistoryPreview(e) {
    state.hidePreviewTimeout = setTimeout(() => {
        // If we are moving from item to preview or vice versa, don't hide
        const relatedTarget = e?.relatedTarget;
        if (relatedTarget && (historyHoverPreview.contains(relatedTarget) || relatedTarget.closest('.history-item'))) {
            return;
        }
        historyHoverPreview.classList.remove('visible');
    }, 100);
}


init();
