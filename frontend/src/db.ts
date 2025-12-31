import { openDB, type DBSchema } from 'idb';

export interface Folder {
    id: string;
    name: string;
    createdAt: number;
}

export interface SavedTrack {
    id: string;
    title: string;
    author: string;
    timestamp: string;
    blob: Blob;
    addedAt: number;
    folderId?: string;
    lyrics?: string;
    size?: number;
}

interface MusicDB extends DBSchema {
    tracks: {
        key: string;
        value: SavedTrack;
        indexes: { 'by-date': number; 'by-folder': string };
    };
    folders: {
        key: string;
        value: Folder;
    };
}

const dbPromise = openDB<MusicDB>('music-grab-db-clean-v4', 1, {
    upgrade(db, oldVersion) {
        if (oldVersion < 1) {
            const store = db.createObjectStore('tracks', { keyPath: 'id' });
            store.createIndex('by-date', 'addedAt');
            store.createIndex('by-folder', 'folderId');
            db.createObjectStore('folders', { keyPath: 'id' });
        }
    },
});

export const createFolder = async (name: string) => {
    const db = await dbPromise;
    // Polyfill for randomUUID if not available
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    await db.put('folders', {
        id,
        name,
        createdAt: Date.now(),
    });
    return id;
};

export const getFolders = async () => {
    const db = await dbPromise;
    return db.getAll('folders');
};

export const deleteFolder = async (id: string) => {
    const db = await dbPromise;
    // Get all tracks in this folder and move them to root (or delete them? Usually move to root or delete. Let's move to root for safety)
    const tx = db.transaction(['folders', 'tracks'], 'readwrite');
    const folderStore = tx.objectStore('folders');
    const trackStore = tx.objectStore('tracks');
    const index = trackStore.index('by-folder');

    await folderStore.delete(id);

    // Move tracks to root (remove folderId)
    let cursor = await index.openCursor(IDBKeyRange.only(id));
    while (cursor) {
        const track = cursor.value;
        delete track.folderId;
        await cursor.update(track);
        cursor = await cursor.continue();
    }

    await tx.done;
};

export const saveTrack = async (track: SavedTrack) => {
    const db = await dbPromise;
    await db.put('tracks', { ...track, addedAt: Date.now() });
};

export const getAllTracks = async () => {
    const db = await dbPromise;
    return db.getAllFromIndex('tracks', 'by-date');
};

export const getTracksByFolder = async (folderId: string | undefined) => {
    const db = await dbPromise;
    if (!folderId) {
        // Return tracks with NO folderId
        // IDB doesn't easily query "undefined" index values efficiently without a specific index setup for it or filtering.
        // For simplicity with small libraries, we'll filter in memory or get all and filter.
        // However, we can use a trick: standard getAll and filter.
        const all = await db.getAllFromIndex('tracks', 'by-date');
        return all.filter(t => !t.folderId);
    }
    return db.getAllFromIndex('tracks', 'by-folder', folderId);
};

export const deleteTrack = async (id: string) => {
    const db = await dbPromise;
    await db.delete('tracks', id);
};
