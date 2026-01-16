// Frontend JavaScript for Image Generator
console.log('Script loaded');

// Initialize Socket.IO connection
let socket;
try {
    if (typeof io !== 'undefined') {
        socket = io();
        console.log('Socket.IO initialized');
    } else {
        console.warn('Socket.IO library not found. Real-time updates will not work.');
    }
} catch (e) {
    console.error('Failed to initialize Socket.IO:', e);
}

// State management
let state = {
    category: null,
    orientation: 'landscape', // Default
    count: 1,
    models: ['google/gemini-2.5-flash-image-preview'],
    generatedImages: [],
    currentSessionId: null,
    editingIndex: null,
    history: [],
    currentHistoryId: null,
    style: null,
    referenceImages: [], // Base64 strings
    apiKeys: {
        openrouter: ''
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
const orientationGrid = document.querySelector('.orientation-grid') || document.querySelector('#orientation-section .orientation-grid');
const generateBtn = document.getElementById('generate-btn');
const userInput = document.getElementById('prompt');
const fileUpload = document.getElementById('file-upload');
const attachmentsPreview = document.getElementById('attachments-preview');

// API Key Elements
const apiKeysToggle = document.getElementById('api-keys-toggle');
const apiKeysContent = document.getElementById('api-keys-content');
const openrouterKeyInput = document.getElementById('openrouter-key');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const refineInput = document.getElementById('refine-input');
const confirmRefineBtn = document.getElementById('confirm-refine-btn');
const closeModalBtns = document.querySelectorAll('.close-modal');

// Preview Modal Elements
const previewModal = document.getElementById('preview-modal');
const previewImage = document.getElementById('preview-image');
const closePreviewBtn = document.querySelector('.close-preview');

// Progress & Results Elements
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const resultsSection = document.getElementById('results-section');
const resultsGrid = document.getElementById('results-grid');
const resultsSummary = document.getElementById('results-summary');

// Legacy/Optional Elements (for backward compatibility)
const followupSection = document.getElementById('follow-up-section');
const refineBtn = document.getElementById('refine-btn');
const selectedImageSelect = document.getElementById('selected-image');
const followupInstructions = document.getElementById('followup-instructions');

// ... (existing code) ...

function init() {
    console.log('Initializing app...');
    if (!categoryGrid) console.error('categoryGrid is missing');

    setupCategorySelection();
    setupOrientationSelection();
    setupFileUpload();
    setupStyleSelection();
    setupCountSelection();
    setupModelSelection();
    setupGenerateButton();
    setupEditModal();
    setupPreviewModal();
    setupSocketListeners();
    setupApiKeys();
    loadHistory();
    console.log('App initialized');
}

// ... (existing code) ...

// --- Edit Modal Logic ---

function setupEditModal() {
    // Close modal handlers
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            editModal.classList.add('hidden');
        });
    });

    // Close on outside click
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.classList.add('hidden');
        }
    });

    // Confirm refine handler
    confirmRefineBtn.addEventListener('click', handleRefine);
}

function openEditModal(index) {
    state.editingIndex = index;
    refineInput.value = ''; // Clear previous input
    editModal.classList.remove('hidden');
    refineInput.focus();
}

async function handleRefine() {
    const instructions = refineInput.value.trim();

    if (!instructions) {
        alert('Please describe your changes.');
        return;
    }

    const originalIndex = state.editingIndex;
    const image = state.generatedImages.find(img => img.index === originalIndex);

    if (!image) {
        alert('Error: Image not found.');
        return;
    }

    // Close modal
    editModal.classList.add('hidden');

    // Generate new index for the refined image (next available index)
    const maxIndex = Math.max(...state.generatedImages.map(img => img.index), 0);
    const newIndex = maxIndex + 1;

    // Create a new placeholder for the refined image
    const placeholder = document.createElement('div');
    placeholder.className = 'result-item placeholder';
    placeholder.id = `result-item-${newIndex}`;
    placeholder.innerHTML = `
        <div class="placeholder-content">
            <div class="spinner"></div>
            <p id="refine-status-${newIndex}">Starting refinement...</p>
        </div>
    `;

    // Append to results grid
    resultsGrid.appendChild(placeholder);

    try {
        // We no longer need to upload to ImgBB since the backend can access local files.
        // We just send the absolute filepath that the backend previously provided.

        // Update status
        const statusEl = document.getElementById(`refine-status-${newIndex}`);
        if (statusEl) statusEl.textContent = 'Refining...';

        // Send refinement request with the local filepath
        const response = await fetch('/api/refine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                category: state.category,
                base_image_path: image.filepath, // Send local path directly
                refinement_instructions: instructions,
                index: newIndex,
                api_key: state.apiKeys.openrouter
            })
        });

        const data = await response.json();

        if (data.success) {
            state.currentSessionId = data.session_id;
            console.log('Refinement started:', data.session_id);
        } else {
            showError(data.error);
            placeholder.remove();
        }
    } catch (error) {
        console.error('Refinement error:', error);
        showError(error.message);
        placeholder.remove();
    }
}

// --- Preview Modal Logic ---

function setupPreviewModal() {
    if (!previewModal || !closePreviewBtn) return;

    // Close on button click
    closePreviewBtn.addEventListener('click', () => {
        previewModal.classList.add('hidden');
    });

    // Close on outside click
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal || e.target.classList.contains('preview-content')) {
            previewModal.classList.add('hidden');
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
            previewModal.classList.add('hidden');
        }
    });
}

function openPreviewModal(imageUrl) {
    if (!previewModal || !previewImage) return;
    previewImage.src = imageUrl;
    previewModal.classList.remove('hidden');
}

// ... (existing code) ...

function updatePlaceholderWithImage(index, image) {
    const placeholder = document.getElementById(`result-item-${index}`);
    if (placeholder && image.success) {
        placeholder.className = 'result-item fade-in';
        placeholder.innerHTML = `
            <img src="/output/${image.filename}" alt="Generated Image ${index}"
                 onclick="openPreviewModal('/output/${image.filename}')"
                 style="cursor: pointer;">
            <button class="edit-btn" onclick="openEditModal(${index})" title="Refine Image">
                ✏️
            </button>
            <div class="result-item-overlay">
                <span class="result-item-index">Image ${index}</span>
                <button class="download-btn" onclick="downloadImage('${image.filename}', ${index})">
                    Download
                </button>
            </div>
        `;

        // Update state (replace existing or add new)
        const existingIndex = state.generatedImages.findIndex(img => img.index === index);
        const imageData = {
            index: index,
            filename: image.filename,
            filepath: image.filepath,
            category: state.category
        };

        if (existingIndex >= 0) {
            state.generatedImages[existingIndex] = imageData;
        } else {
            state.generatedImages.push(imageData);
        }

        // Update history
        if (state.currentHistoryId) {
            updateHistoryImages(state.currentHistoryId, imageData);
        }
    } else if (placeholder) {
        // ... error handling ...
        placeholder.className = 'result-item error';
        placeholder.innerHTML = `
            <div class="error-content">
                <p>Failed to generate image ${index}</p>
                <p class="error-detail">${image.error || 'Unknown error'}</p>
            </div>
            `;
    }
}

// Global function for edit button
// Global function for edit button
window.openEditModal = openEditModal;
window.openPreviewModal = openPreviewModal;

// --- Selection Logic ---

// --- Selection Logic ---

function setupCategorySelection() {
    if (!categoryGrid) {
        console.error('Error: categoryGrid not found');
        return;
    }

    const tiles = categoryGrid.querySelectorAll('.tile');
    console.log(`Found ${tiles.length} category tiles`);

    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            console.log('Category clicked:', tile.dataset.value);

            // Remove selected class from all category tiles
            tiles.forEach(t => t.classList.remove('selected'));

            // Select clicked tile
            tile.classList.add('selected');
            state.category = tile.dataset.value;
            console.log('Category set to:', state.category);

            // Show next sections
            showNextSections();
        });
    });
}

function setupOrientationSelection() {
    if (!orientationGrid) return;
    const tiles = orientationGrid.querySelectorAll('.orientation-tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.orientation = tile.dataset.value;
            console.log('Orientation set to:', state.orientation);
        });
    });
}

function setupFileUpload() {
    if (!fileUpload) return;
    fileUpload.addEventListener('change', handleFileSelect);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            state.referenceImages.push(base64);
            renderAttachmentPreviews();
        };
        reader.readAsDataURL(file);
    });
    // Reset input so the same file can be selected again if removed
    e.target.value = '';
}

function renderAttachmentPreviews() {
    if (!attachmentsPreview) return;
    attachmentsPreview.innerHTML = '';
    state.referenceImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'attachment-preview-item';
        item.innerHTML = `
            <img src="${img}" alt="Reference">
            <div class="attachment-remove" onclick="removeAttachment(${index})">×</div>
        `;
        attachmentsPreview.appendChild(item);
    });
}

window.removeAttachment = function (index) {
    state.referenceImages.splice(index, 1);
    renderAttachmentPreviews();
};

function setupCountSelection() {
    if (!countGrid) return;
    const tiles = countGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.count = parseInt(tile.dataset.value);
            console.log('Count set to:', state.count);
        });
    });
}

function setupModelSelection() {
    if (!modelGrid) return;
    const tiles = modelGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            const model = tile.dataset.value;

            if (tile.classList.contains('selected')) {
                // Don't allow deselecting if it's the only one selected
                if (state.models.length > 1) {
                    tile.classList.remove('selected');
                    state.models = state.models.filter(m => m !== model);
                }
            } else {
                tile.classList.add('selected');
                state.models.push(model);
            }
            console.log('Models set to:', state.models);
        });
    });
}

function showNextSections() {
    console.log('showNextSections called');
    if (!orientationSection) return;

    if (orientationSection.classList.contains('hidden')) {
        console.log('Revealing sections...');
        orientationSection.classList.remove('hidden');
        setTimeout(() => {
            if (countSection) countSection.classList.remove('hidden');
            setTimeout(() => {
                if (modelSection) modelSection.classList.remove('hidden');
                setTimeout(() => {
                    if (instructionSection) instructionSection.classList.remove('hidden');
                    if (generateBtn) {
                        generateBtn.classList.remove('hidden');
                        generateBtn.disabled = false;
                    }
                }, 100);
            }, 100);
        }, 100);
    }
}

// --- Generation Logic ---

function setupGenerateButton() {
    generateBtn.addEventListener('click', () => {
        const prompt = userInput.value.trim();

        if (!state.category) {
            showError('Please select an image type.');
            return;
        }

        if (!state.apiKeys.openrouter) {
            showError('No API key found. Enter a valid API Key');
            return;
        }

        if (!prompt) {
            showError('Please describe your image.');
            return;
        }

        // Disable button and show loader
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner"></span> Generating...';

        // Hide progress section (we'll show progress on tiles instead)
        progressSection.style.display = 'none';

        // Hide follow-up section (legacy)
        if (followupSection) followupSection.style.display = 'none';

        // Show results section immediately with placeholders
        resultsSection.style.display = 'block';
        resultsGrid.innerHTML = '';
        state.generatedImages = [];

        // Add to history immediately (without session ID yet)
        const historyId = addToHistory(prompt, state.category, state.count, state.models, null);
        state.currentHistoryId = historyId;

        // Create placeholders
        for (let i = 0; i < state.count; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'result-item placeholder';
            placeholder.id = `result-item-${i + 1}`;
            placeholder.innerHTML = `
                <div class="placeholder-content">
                    <div class="spinner"></div>
                    <p class="placeholder-status">Waiting...</p>
                </div>
            `;
            resultsGrid.appendChild(placeholder);
        }

        // Send request via REST API
        fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                category: state.category,
                user_input: prompt,
                count: state.count,
                selected_models: state.models,
                style: state.style,
                orientation: state.orientation,
                reference_images: state.referenceImages,
                api_key: state.apiKeys.openrouter
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update history item with session ID
                    const historyItem = state.history.find(h => h.id === historyId);
                    if (historyItem) {
                        historyItem.sessionId = data.session_id;
                        saveHistory();
                    }
                    console.log('Generation started:', data.session_id);
                } else {
                    showError(data.error);
                    resetUI();
                }
            })
            .catch(error => {
                showError(error.message);
                resetUI();
            });
    });
}

// --- Refinement Logic ---

function setupRefineButton() {
    if (!refineBtn) return;

    refineBtn.addEventListener('click', async () => {
        const selectedImageIndex = parseInt(selectedImageSelect.value);
        const instructions = followupInstructions.value.trim();

        if (!selectedImageIndex) {
            alert('Please select an image to refine');
            return;
        }

        if (!instructions) {
            alert('Please enter refinement instructions');
            return;
        }

        const selectedImage = state.generatedImages.find(img => img.index === selectedImageIndex);
        if (!selectedImage) return;

        // Disable button and show loading
        refineBtn.disabled = true;
        const originalText = refineBtn.innerHTML;
        refineBtn.innerHTML = '<span class="spinner"></span> Refining...';

        // Show progress
        progressSection.style.display = 'block';
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Refining image...';

        try {
            const response = await fetch('/api/refine', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    category: state.category, // Use current category
                    base_image_path: selectedImage.filepath,
                    refinement_instructions: instructions,
                    api_key: state.apiKeys.openrouter
                })
            });

            const data = await response.json();

            if (data.success) {
                state.currentSessionId = data.session_id;
                console.log('Refinement started:', data.session_id);
            } else {
                showError(data.error);
                refineBtn.disabled = false;
                refineBtn.innerHTML = originalText;
            }
        } catch (error) {
            showError('Failed to start refinement: ' + error.message);
            refineBtn.disabled = false;
            refineBtn.innerHTML = originalText;
        }
    });
}

// --- Socket.IO Handlers ---

function setupSocketListeners() {
    if (!socket) {
        console.warn('Socket.IO not initialized, skipping listeners');
        return;
    }

    socket.on('connected', (data) => {
        console.log('Connected to server:', data.message);
    });

    socket.on('generation_progress', (data) => {
        // Find history item for this session
        const historyItem = state.history.find(h => h.sessionId === data.session_id);

        // Only update UI if we are currently viewing this history item
        if (historyItem && state.currentHistoryId === historyItem.id) {
            // Update placeholder status text instead of progress bar
            const status = data.status;

            // Parse status to determine which image is being generated
            // Status format: "Generating images..." or similar
            // We'll update all placeholders that haven't been replaced yet
            const placeholders = document.querySelectorAll('.result-item.placeholder .placeholder-status');
            placeholders.forEach((statusEl, index) => {
                if (index === data.current - 2) { // Adjust for offset
                    statusEl.textContent = 'Generating...';
                }
            });
        }
    });

    socket.on('image_generated', (data) => {
        console.log('Image generated:', data);

        // Find history item for this session
        const historyItem = state.history.find(h => h.sessionId === data.session_id);

        if (historyItem) {
            // Update history data
            updateHistoryImages(historyItem.id, data.image);

            // Only update UI if we are currently viewing this history item
            if (state.currentHistoryId === historyItem.id) {
                updatePlaceholderWithImage(data.index, data.image);
            }
        }
    });

    socket.on('generation_complete', (data) => {
        console.log('Generation complete:', data.result);

        // Find history item for this session
        const historyItem = state.history.find(h => h.sessionId === data.result.session_id);

        if (historyItem) {
            historyItem.status = 'complete';
            saveHistory();

            // Only update UI if we are currently viewing this history item
            if (state.currentHistoryId === historyItem.id) {
                updateGenerationSummary(data.result);
                resetUI();
            }
        }
    });

    socket.on('generation_error', (data) => {
        // Find history item for this session
        // Note: data.session_id might be needed here, assuming error data includes it
        const historyItem = state.history.find(h => h.sessionId === data.session_id);

        if (historyItem) {
            historyItem.status = 'error';
            saveHistory();

            if (state.currentHistoryId === historyItem.id) {
                showError(data.error);
                resetUI();
            }
        } else if (data.session_id === state.currentSessionId) {
            // Fallback
            showError(data.error);
            resetUI();
        }
    });
}

// --- Helper Functions ---

function updateGenerationSummary(result) {
    // Hide progress
    progressSection.style.display = 'none';

    // Display summary
    if (resultsSummary) {
        resultsSummary.textContent = `Successfully generated ${result.total_generated} out of ${result.total_requested} images`;
    }

    // Populate follow-up image selector (legacy)
    if (selectedImageSelect) {
        selectedImageSelect.innerHTML = '<option value="">Select an image to refine...</option>';
        state.generatedImages.sort((a, b) => a.index - b.index).forEach(img => {
            const option = document.createElement('option');
            option.value = img.index;
            option.textContent = `Image ${img.index} `;
            selectedImageSelect.appendChild(option);
        });
    }

    // Show follow-up section (legacy)
    if (followupSection) followupSection.style.display = 'block';
}

function displayResults(result) {
    // Legacy function, kept for compatibility but logic moved to updateGenerationSummary
    updateGenerationSummary(result);
}

function resetUI() {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span class="btn-text">Generate Images</span><span class="btn-icon">✨</span>';

    if (refineBtn) {
        refineBtn.disabled = false;
        refineBtn.innerHTML = '<span class="btn-text">Refine Image</span><span class="btn-loader" style="display: none;"><span class="spinner"></span></span>';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    const container = document.querySelector('.generator-card');
    container.insertBefore(errorDiv, container.firstChild);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Global function for download button (needs to be accessible from HTML onclick)
window.downloadImage = function (filename, index) {
    const link = document.createElement('a');
    link.href = `/output/${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// --- History Management ---

function saveHistory() {
    try {
        localStorage.setItem('imageGenHistory', JSON.stringify(state.history));
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

function loadHistory() {
    const saved = localStorage.getItem('imageGenHistory');
    if (saved) {
        try {
            state.history = JSON.parse(saved);
            // Convert timestamp strings back to Date objects
            state.history.forEach(item => {
                item.timestamp = new Date(item.timestamp);
                // Reset stuck generation status on reload
                if (item.status === 'generating') {
                    item.status = 'interrupted';
                }
            });
            renderHistory();
        } catch (e) {
            console.error('Failed to load history:', e);
        }
    }
}

function addToHistory(prompt, category, count, models, sessionId) {
    const historyItem = {
        id: Date.now(),
        sessionId: sessionId, // Store session ID to link with socket events
        status: 'generating', // Track generation status
        timestamp: new Date(),
        prompt: prompt,
        category: category,
        count: count,
        models: models,
        images: [] // Will be populated as images are generated
    };
    state.history.unshift(historyItem);
    saveHistory();
    renderHistory();
    return historyItem.id;
}

// --- API Key Management ---

function setupApiKeys() {
    // Load from localStorage
    const savedKeys = localStorage.getItem('imageGenApiKeys');
    if (savedKeys) {
        try {
            state.apiKeys = JSON.parse(savedKeys);
            openrouterKeyInput.value = state.apiKeys.openrouter || '';
        } catch (e) {
            console.error('Failed to parse saved API keys:', e);
        }
    }

    // Toggle accordion
    apiKeysToggle.addEventListener('click', () => {
        apiKeysToggle.classList.toggle('active');
        apiKeysContent.classList.toggle('hidden');
    });

    // Handle input changes
    openrouterKeyInput.addEventListener('input', (e) => {
        state.apiKeys.openrouter = e.target.value.trim();
        saveApiKeys();
    });
}

function saveApiKeys() {
    localStorage.setItem('imageGenApiKeys', JSON.stringify(state.apiKeys));
}

function updateHistoryImages(historyId, image) {
    const item = state.history.find(h => h.id === historyId);
    if (item) {
        // Check if image with this index already exists
        const existingImgIndex = item.images.findIndex(img => img.index === image.index);
        if (existingImgIndex >= 0) {
            item.images[existingImgIndex] = image; // Update existing
        } else {
            item.images.push(image); // Add new
        }
        saveHistory();
        renderHistory(); // Re-render to show thumbnail
    }
}

function renderHistory() {
    if (!historyList) return;

    historyList.innerHTML = '';

    if (state.history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No history yet</div>';
        return;
    }

    state.history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        if (item.id === state.currentHistoryId) {
            div.classList.add('active');
        }
        div.onclick = () => loadHistoryItem(item.id);

        // Category Emojis
        const categoryEmojis = {
            'subtopic_cover': '📚',
            'tutero_ai': '🤖',
            'classroom_activity': '🏫',
            'context_introduction': '🌍'
        };
        const emoji = categoryEmojis[item.category] || '🖼️';

        // Preview images (first 3)
        let imagesHtml = '';
        if (item.images && item.images.length > 0) {
            imagesHtml = '<div class="history-images-preview">';
            item.images.slice(0, 3).forEach(img => {
                if (img.filename) {
                    imagesHtml += `<img src="/output/${img.filename}" class="history-thumb">`;
                }
            });
            imagesHtml += '</div>';
        }

        div.innerHTML = `
            <div class="history-header">
                <span class="history-icon">${emoji}</span>
                <div class="history-prompt">${item.prompt}</div>
            </div>
            ${imagesHtml}
        `;

        historyList.appendChild(div);
    });
}

function loadHistoryItem(id) {
    const item = state.history.find(h => h.id === id);
    if (!item) return;

    // Restore State
    state.category = item.category;
    state.count = item.count;
    state.models = item.models;
    state.generatedImages = item.images || [];
    state.currentHistoryId = item.id;

    // Restore UI
    // 1. Select Category
    document.querySelectorAll('#category-grid .tile').forEach(t => {
        t.classList.toggle('selected', t.dataset.value === item.category);
    });

    // 2. Select Count
    document.querySelectorAll('#count-grid .tile').forEach(t => {
        t.classList.toggle('selected', parseInt(t.dataset.value) === item.count);
    });

    // 3. Select Model
    document.querySelectorAll('#model-grid .tile').forEach(t => {
        // Handle array of models
        const isSelected = item.models.includes(t.dataset.value);
        t.classList.toggle('selected', isSelected);
    });

    // 4. Set Prompt
    const promptInput = document.getElementById('prompt'); // Ensure correct ID
    if (promptInput) promptInput.value = item.prompt;

    // 5. Show Sections
    if (countSection) countSection.classList.remove('hidden');
    if (modelSection) modelSection.classList.remove('hidden');
    if (instructionSection) instructionSection.classList.remove('hidden');
    if (generateBtn) generateBtn.classList.remove('hidden');

    // 6. Show Results
    if (resultsSection) resultsSection.style.display = 'block';
    resultsGrid.innerHTML = '';

    // Update Generate Button State based on history item status
    if (item.status === 'generating') {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner"></span> Generating...';
    } else {
        resetUI();
    }

    // Create placeholders for all images first
    // Calculate total slots needed: max of requested count or highest image index (for refined images)
    const maxIndex = item.images && item.images.length > 0
        ? Math.max(...item.images.map(img => img.index))
        : 0;
    const totalSlots = Math.max(item.count, maxIndex);

    for (let i = 0; i < totalSlots; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'result-item placeholder';
        placeholder.id = `result-item-${i + 1}`;
        placeholder.innerHTML = `
            <div class="placeholder-content">
                <div class="spinner"></div>
                <p class="placeholder-status">Loading...</p>
            </div>
        `;
        resultsGrid.appendChild(placeholder);
    }

    // Re-render images with success flag
    item.images.forEach(img => {
        const imageWithSuccess = {
            ...img,
            success: true
        };
        updatePlaceholderWithImage(img.index, imageWithSuccess);
    });

    // Highlight active history item
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    // We'd need to find the element again or re-render, but simple re-render works
    renderHistory();
}

function setupStyleSelection() {
    if (!styleGrid) return;

    const tiles = styleGrid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            // Remove selected class from all style tiles
            tiles.forEach(t => t.classList.remove('selected'));

            // Select clicked tile
            tile.classList.add('selected');
            state.style = tile.dataset.value;
            console.log('Style set to:', state.style);
        });
    });

    // Set default selection
    const defaultTile = styleGrid.querySelector('[data-value="original"]');
    if (defaultTile) defaultTile.classList.add('selected');
}
