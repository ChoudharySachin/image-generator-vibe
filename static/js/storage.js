export class HistoryStorage {
    constructor() {
        this.dbName = 'ImageGenDB';
        this.storeName = 'history';
        this.version = 1;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    async saveHistory(history) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // We want to sync the DB with the provided history array.
            // Simplified approach: Clear and re-add all, or just put all.
            // Since we usually have a small number of items (MAX_ITEMS = 20),
            // put all is fine. But we need to handle deletions.

            // To handle deletions, we can clear first:
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                let count = 0;
                if (history.length === 0) {
                    resolve();
                    return;
                }

                history.forEach(item => {
                    const addRequest = store.add(item);
                    addRequest.onsuccess = () => {
                        count++;
                        if (count === history.length) resolve();
                    };
                    addRequest.onerror = (e) => reject(e.target.error);
                });
            };

            clearRequest.onerror = (e) => reject(e.target.error);
        });
    }

    async loadHistory() {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result;
                // Sort by timestamp descending
                results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(results);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    async migrateFromLocalStorage() {
        const saved = localStorage.getItem('imageGenHistory');
        if (saved) {
            try {
                const history = JSON.parse(saved);
                if (Array.isArray(history) && history.length > 0) {
                    await this.saveHistory(history);
                    // We can keep it in localStorage for now as backup, 
                    // or remove it to save space. Let's keep it until verified.
                    // Actually, let's remove it after migration to prevent confusion.
                    localStorage.removeItem('imageGenHistory');
                    return true;
                }
            } catch (e) {
                console.error('Failed to migrate history:', e);
            }
        }
        return false;
    }
}
