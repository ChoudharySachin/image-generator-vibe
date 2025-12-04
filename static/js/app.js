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
    count: 1,
    models: ['google/gemini-2.5-flash-image-preview'],
    generatedImages: [],
    currentSessionId: null,
    editingIndex: null,
    history: [],
    currentHistoryId: null,
    style: null  // Automatic selection by backend
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
const generateBtn = document.getElementById('generate-btn');
const userInput = document.getElementById('prompt');

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
    setupStyleSelection();
    setupCountSelection();
    setupModelSelection();
    setupGenerateButton();
    setupEditModal();
    setupPreviewModal();
    setupSocketListeners();
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

async function uploadToImgBB(imageBlob) {
    const formData = new FormData();
    formData.append('image', imageBlob);
    formData.append('key', '1afba94ad303d0430d1a528f1b33c1dc');

    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    if (data.success) {
        return data.data.url;
    } else {
        throw new Error('ImgBB upload failed: ' + (data.error ? data.error.message : 'Unknown error'));
    }
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
            <p id="refine-status-${newIndex}">Uploading image...</p>
        </div>
    `;

    // Append to results grid
    resultsGrid.appendChild(placeholder);

    try {
        // 1. Fetch the image blob
        const imageResponse = await fetch(`/output/${image.filename}`);
        const imageBlob = await imageResponse.blob();

        // 2. Upload to ImgBB
        const imgbbUrl = await uploadToImgBB(imageBlob);
        console.log('Uploaded to ImgBB:', imgbbUrl);

        // Update status
        const statusEl = document.getElementById(`refine-status-${newIndex}`);
        if (statusEl) statusEl.textContent = 'Refining...';

        // 3. Send refinement request with the ImgBB URL
        const response = await fetch('/api/refine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                category: state.category,
                base_image_path: imgbbUrl, // Send URL instead of local path
                refinement_instructions: instructions,
                index: newIndex
            })
        });

        const data = await response.json();

        if (data.success) {
            state.currentSessionId = data.session_id;
            console.log('Refinement started:', data.session_id);
        } else {
            showError('Failed to start refinement: ' + data.error);
            placeholder.remove();
        }
    } catch (error) {
        console.error('Refinement error:', error);
        showError('Failed: ' + error.message);
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
    if (!countSection) return;

    if (countSection.classList.contains('hidden')) {
        console.log('Revealing sections...');
        countSection.classList.remove('hidden');
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
    }
}

// --- Generation Logic ---

function setupGenerateButton() {
    generateBtn.addEventListener('click', () => {
        const prompt = userInput.value.trim();

        if (!state.category) {
            alert('Please select an image type.');
            return;
        }

        if (!prompt) {
            alert('Please describe your image.');
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

        // Add to history
        state.currentHistoryId = addToHistory(prompt, state.category, state.count, state.models);

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
                style: state.style  // Include style for subtopic_cover
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    state.currentSessionId = data.session_id;
                    console.log('Generation started:', data.session_id);
                } else {
                    showError('Failed to start generation: ' + data.error);
                    resetUI();
                }
            })
            .catch(error => {
                showError('Failed to start generation: ' + error.message);
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
                    refinement_instructions: instructions
                })
            });

            const data = await response.json();

            if (data.success) {
                state.currentSessionId = data.session_id;
                console.log('Refinement started:', data.session_id);
            } else {
                showError('Failed to start refinement: ' + data.error);
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

        // Also update session ID if provided
        if (data.session_id) {
            state.currentSessionId = data.session_id;
        }
    });

    socket.on('image_generated', (data) => {
        console.log('Image generated:', data);
        if (data.session_id === state.currentSessionId) {
            updatePlaceholderWithImage(data.index, data.image);
        }
    });

    socket.on('generation_complete', (data) => {
        console.log('Generation complete:', data.result);
        // We don't need to displayResults here anymore as images are shown progressively
        // Just update the summary and other UI elements
        updateGenerationSummary(data.result);
        resetUI();
    });

    socket.on('generation_error', (data) => {
        showError('Generation failed: ' + data.error);
        resetUI();
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
            });
            renderHistory();
        } catch (e) {
            console.error('Failed to load history:', e);
        }
    }
}

function addToHistory(prompt, category, count, models) {
    const historyItem = {
        id: Date.now(),
        timestamp: new Date(),
        prompt: prompt,
        category: category,
        count: count,
        models: models,
        images: [] // Will be populated as images are generated
    };

    state.history.unshift(historyItem); // Add to beginning
    saveHistory();
    renderHistory();
    return historyItem.id;
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

        // Format time
        const time = item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
            <div class="history-meta">
                <span>${time}</span>
                <span>${item.images.length}/${item.count}</span>
            </div>
            <div class="history-prompt">${item.prompt}</div>
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
