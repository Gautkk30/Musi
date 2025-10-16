const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
const fileInput = document.getElementById('fileInput');
const prevBtn = document.getElementById('prev-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const nextBtn = document.getElementById('next-btn');
const volumeSlider = document.getElementById('volume-slider');
const trackNameEl = document.getElementById('track-name');
const rightSidebar = document.getElementById('right-sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const playlistListEl = document.getElementById('playlist-list');
const newPlaylistInput = document.getElementById('new-playlist-input');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const playlistTitle = document.getElementById('playlist-title');
const themeSwitcher = document.getElementById('theme-switcher');
const visualizer = document.getElementById('visualizer');
const eqBtn = document.getElementById('eq-btn');
const eqPanel = document.getElementById('eq-panel');
const eqBandsContainer = document.querySelector('.eq-bands');
const eqPresetsContainer = document.querySelector('.eq-presets');

let db;
let playlists = {};
let activePlaylist = 'My Playlist';
let currentTrack = 0;
let audioCtx, analyser, source, bufferLength, dataArray;
let draggedItem = null;
let filters = [];
const FREQUENCIES = [60, 310, 1000, 3000, 6000];
const PRESETS = {
    'flat': [0, 0, 0, 0, 0],
    'bass-boost': [8, 5, 0, 0, 0],
    'vocal-boost': [0, 0, 5, 5, 0]
};

// --- DATABASE --- //
function initDB() {
    const request = indexedDB.open("musicDB", 1);

    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        db.createObjectStore("songs", { keyPath: "id", autoIncrement:true });
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        loadSongsFromDB();
    };

    request.onerror = function(event) {
        console.error("Database error: " + event.target.errorCode);
    };
}

function saveSongToDB(file) {
    if (!db) return;
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    const song = { name: file.name, file: file };
    const request = store.add(song);

    request.onsuccess = function(event) {
        const songId = event.target.result;
        const url = URL.createObjectURL(file);
        const track = { name: file.name, src: url, dbId: songId };

        if (!playlists[activePlaylist]) {
            playlists[activePlaylist] = [];
        }
        playlists[activePlaylist].push(track);
        renderTracks(); 
        if (playlists[activePlaylist].length === 1) {
            playTrack(0);
        }
    };

    request.onerror = function() {
        console.error("Error saving song:", request.error);
    };
}

function loadSongsFromDB() {
    if (!db) return;
    const transaction = db.transaction(["songs"], "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();

    request.onsuccess = function() {
        const songsFromDB = request.result;
        const currentPlaylist = playlists[activePlaylist] || [];

        const existingDbIds = new Set(currentPlaylist.map(t => t.dbId).filter(id => id));

        songsFromDB.forEach(song => {
            if (!existingDbIds.has(song.id)) {
                const url = URL.createObjectURL(song.file);
                currentPlaylist.push({ name: song.name, src: url, dbId: song.id });
            }
        });

        renderTracks();
    };

    request.onerror = function() {
        console.error("Error loading songs from DB:", request.error);
    };
}

function deleteSongFromDB(dbId) {
    if (!db) return;
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    const request = store.delete(dbId);

    request.onerror = function() {
        console.error("Error deleting song from DB:", request.error);
    };
}

// --- LOCALSTORAGE --- //
function loadFromLocalStorage() {
    const savedPlaylists = localStorage.getItem('playlists');
    if (savedPlaylists) {
        playlists = JSON.parse(savedPlaylists);
    } else {
        playlists = {'My Playlist': []};
    }
    
    const savedActivePlaylist = localStorage.getItem('activePlaylist');
    if (savedActivePlaylist && playlists[savedActivePlaylist]) {
        activePlaylist = savedActivePlaylist;
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.toggle('light-theme', savedTheme === 'light');
        themeSwitcher.innerHTML = savedTheme === 'light' ? '&#9790;' : '&#9728;';
    }
}

function savePlaylists() {
    const playlistsToSave = JSON.parse(JSON.stringify(playlists));
    for (const playlistName in playlistsToSave) {
        playlistsToSave[playlistName] = playlistsToSave[playlistName].filter(track => !track.src.startsWith('blob:'));
    }
    localStorage.setItem('playlists', JSON.stringify(playlistsToSave));
    localStorage.setItem('activePlaylist', activePlaylist);
}

// --- PLAYLIST MANAGEMENT --- //
function renderPlaylists() {
    playlistListEl.innerHTML = '';
    for (const playlistName in playlists) {
        const li = document.createElement('li');
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = playlistName;
        nameSpan.style.cursor = 'pointer';
        nameSpan.onclick = () => switchPlaylist(playlistName);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'playlist-actions';
        
        const renameBtn = document.createElement('button');
        renameBtn.innerHTML = '&#9998;'; // Pencil icon
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            renamePlaylist(playlistName);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;'; // Cross icon
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deletePlaylist(playlistName);
        };

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(nameSpan);
        li.appendChild(actionsDiv);

        if(playlistName === activePlaylist) {
            li.classList.add('active');
        }

        playlistListEl.appendChild(li);
    }
    playlistTitle.textContent = activePlaylist;
    renderTracks();
}

function renamePlaylist(oldName) {
    const newName = prompt('Enter new playlist name:', oldName);
    if (newName && newName.trim() !== '' && newName !== oldName && !playlists[newName]) {
        playlists[newName] = playlists[oldName];
        delete playlists[oldName];
        if (activePlaylist === oldName) {
            activePlaylist = newName;
        }
        savePlaylists();
        renderPlaylists();
    } else if (newName) {
        alert('Invalid or duplicate playlist name.');
    }
}

function deletePlaylist(playlistName) {
    if (Object.keys(playlists).length <= 1) {
        alert('Cannot delete the last playlist.');
        return;
    }
    if (confirm(`Are you sure you want to delete the playlist "'${playlistName}'"?`)) {
        // Before deleting playlist, remove associated songs from DB
        const tracksToDelete = playlists[playlistName] || [];
        tracksToDelete.forEach(track => {
            if (track.dbId) {
                deleteSongFromDB(track.dbId);
            }
        });

        delete playlists[playlistName];
        if (activePlaylist === playlistName) {
            activePlaylist = Object.keys(playlists)[0];
        }
        savePlaylists();
        renderPlaylists();
    }
}

function switchPlaylist(playlistName) {
    activePlaylist = playlistName;
    currentTrack = 0;
    audioPlayer.pause();
    audioPlayer.src = '';
    trackNameEl.textContent = '';
    playPauseBtn.innerHTML = '&#9654;';
    savePlaylists();
    loadFromLocalStorage(); // Reload local storage for the new playlist
    loadSongsFromDB(); // Reload DB songs for the new playlist
    renderPlaylists();
    document.body.classList.remove('sidebar-open');
}

createPlaylistBtn.addEventListener('click', () => {
    const newPlaylistName = newPlaylistInput.value.trim();
    if (newPlaylistName && !playlists[newPlaylistName]) {
        playlists[newPlaylistName] = [];
        newPlaylistInput.value = '';
        savePlaylists();
        renderPlaylists();
        switchPlaylist(newPlaylistName);
    } else {
        alert('Invalid or duplicate playlist name.');
    }
});

// --- TRACK MANAGEMENT --- //
function renderTracks() {
    playlistEl.innerHTML = '';
    const tracks = playlists[activePlaylist] || [];
    tracks.forEach((track, index) => {
        const listItem = document.createElement('li');
        listItem.draggable = true;
        listItem.dataset.index = index;
        
        const trackNameContainer = document.createElement('div');
        trackNameContainer.className = 'track-name-container';
        
        const nowPlayingIndicator = document.createElement('div');
        nowPlayingIndicator.className = 'now-playing-indicator';

        const trackNameSpan = document.createElement('span');
        trackNameSpan.textContent = track.name;
        trackNameSpan.onclick = () => playTrack(index);
        
        trackNameContainer.appendChild(nowPlayingIndicator);
        trackNameContainer.appendChild(trackNameSpan);

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.className = 'remove-btn';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeTrack(index);
        };
        
        listItem.appendChild(trackNameContainer);
        listItem.appendChild(removeBtn);

        playlistEl.appendChild(listItem);
    });
    updateActiveTrack();
    addDragAndDropListeners();
}

function addToPlaylist(song) {
    if (!playlists[activePlaylist]) {
        playlists[activePlaylist] = [];
    }
    playlists[activePlaylist].push({ name: song.trackName, src: song.previewUrl });
    savePlaylists();
    renderTracks();
    if (playlists[activePlaylist].length === 1) {
        playTrack(0);
    }
}

function removeTrack(trackIndex) {
    const track = playlists[activePlaylist][trackIndex];
    if (track.dbId) {
        deleteSongFromDB(track.dbId);
    }

    playlists[activePlaylist].splice(trackIndex, 1);
    savePlaylists();
    renderTracks();
    if (currentTrack === trackIndex) {
        audioPlayer.pause();
        audioPlayer.src = '';
        trackNameEl.textContent = '';
        playPauseBtn.innerHTML = '&#9654;';
        // Optional: play next track
        if(playlists[activePlaylist].length > 0) {
            playTrack(currentTrack % playlists[activePlaylist].length);
        } 
    } else if (currentTrack > trackIndex) {
        currentTrack--;
    }
    updateActiveTrack();
}

// --- MUSIC PLAYER --- //
function playTrack(trackIndex) {
    const tracks = playlists[activePlaylist] || [];
    if (trackIndex >= 0 && trackIndex < tracks.length) {
        let track = tracks[trackIndex];
        if (!audioCtx) {
            setupVisualizer();
        }
        audioPlayer.src = track.src;
        audioPlayer.play();
        currentTrack = trackIndex;
        updateActiveTrack();
        trackNameEl.textContent = track.name;
    }
}

function updateActiveTrack() {
    const listItems = playlistEl.getElementsByTagName('li');
    for (let i = 0; i < listItems.length; i++) {
        listItems[i].classList.toggle('active', i === currentTrack && !audioPlayer.paused);
    }
}

// --- UI & THEME --- //
toggleSidebarBtn.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
});

themeSwitcher.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    themeSwitcher.innerHTML = isLight ? '&#9790;' : '&#9728;';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// --- AUDIO VISUALIZER & EQ --- //
function setupVisualizer() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    setupEQ(); 
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audioPlayer);

    source.connect(filters[0]);
    filters[filters.length - 1].connect(analyser);
    analyser.connect(audioCtx.destination);
    
    analyser.fftSize = 256;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    renderFrame();
}

function setupEQ() {
    if (!audioCtx) return;

    filters = FREQUENCIES.map(freq => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return filter;
    });

    for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
    }
    
    createEQBands();
}

function createEQBands() {
    eqBandsContainer.innerHTML = '';
    filters.forEach((filter, i) => {
        const band = document.createElement('div');
        band.className = 'eq-band';

        const label = document.createElement('label');
        label.textContent = `${FREQUENCIES[i] < 1000 ? FREQUENCIES[i] : (FREQUENCIES[i] / 1000) + 'k'}Hz`;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = -12;
        slider.max = 12;
        slider.step = 0.1;
        slider.value = filter.gain.value;
        slider.addEventListener('input', e => {
            filter.gain.value = e.target.value;
        });
        
        band.appendChild(slider);
        band.appendChild(label);
        eqBandsContainer.appendChild(band);
    });
}

eqBtn.addEventListener('click', () => {
    const isDisplayed = eqPanel.style.display === 'block';
    eqPanel.style.display = isDisplayed ? 'none' : 'block';
});

eqPresetsContainer.addEventListener('click', e => {
    if (e.target.classList.contains('eq-preset-btn')) {
        const preset = e.target.dataset.preset;
        if (PRESETS[preset]) {
            applyEQPreset(preset);
        }
    }
});

function applyEQPreset(preset) {
    const values = PRESETS[preset];
    filters.forEach((filter, i) => {
        filter.gain.value = values[i];
    });
    const sliders = eqBandsContainer.querySelectorAll('input[type=range]');
    sliders.forEach((slider, i) => {
        slider.value = values[i];
    });
}

function renderFrame() {
    if (analyser) {
        requestAnimationFrame(renderFrame);
        analyser.getByteFrequencyData(dataArray);
        const canvasCtx = visualizer.getContext('2d');
        const { width, height } = visualizer;
        canvasCtx.clearRect(0, 0, width, height);
        
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];
            const isLight = document.body.classList.contains('light-theme');
            canvasCtx.fillStyle = isLight ? `rgba(69, 123, 157, ${barHeight / 255})` : `rgb(${barHeight + 25}, 150, 50)`;
            canvasCtx.fillRect(x, height - barHeight / 2, barWidth, barHeight / 2);
            x += barWidth + 1;
        }
    }
}

// --- DRAG AND DROP --- //
function addDragAndDropListeners() {
    const listItems = playlistEl.querySelectorAll('li');
    listItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    setTimeout(() => {
        this.style.display = 'none';
    }, 0);
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const fromIndex = Number(draggedItem.dataset.index);
    const toIndex = Number(this.dataset.index);
    const tracks = playlists[activePlaylist];
    const [movedTrack] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, movedTrack);
    
    if (currentTrack === fromIndex) {
        currentTrack = toIndex;
    } else if (fromIndex < currentTrack && toIndex >= currentTrack) {
        currentTrack--;
    } else if (fromIndex > currentTrack && toIndex <= currentTrack) {
        currentTrack++;
    }
    
    savePlaylists();
    renderTracks();
}

function handleDragEnd() {
    this.style.display = 'flex';
    draggedItem = null;
}

// --- EVENT LISTENERS & INITIALIZATION --- //
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
        searchSongs(e.target.value);
    }
});

fileInput.addEventListener('change', function() {
    const files = this.files;
    for (const file of files) {
        saveSongToDB(file);
    }
    this.value = ''; // Reset file input
});


playPauseBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        if (audioPlayer.src) {
            audioPlayer.play();
        } else if(playlists[activePlaylist] && playlists[activePlaylist].length > 0) {
            playTrack(currentTrack);
        }
    } else {
        audioPlayer.pause();
    }
});

nextBtn.addEventListener('click', () => {
    const tracks = playlists[activePlaylist] || [];
    if(tracks.length > 0) {
        currentTrack = (currentTrack + 1) % tracks.length;
        playTrack(currentTrack);
    }
});

prevBtn.addEventListener('click', () => {
    const tracks = playlists[activePlaylist] || [];
    if(tracks.length > 0) {
        currentTrack = (currentTrack - 1 + tracks.length) % tracks.length;
        playTrack(currentTrack);
    }
});

volumeSlider.addEventListener('input', (e) => {
    audioPlayer.volume = e.target.value;
});

audioPlayer.addEventListener('play', () => {
    playPauseBtn.innerHTML = '&#10074;&#10074;';
    updateActiveTrack();
});

audioPlayer.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '&#9654;';
    updateActiveTrack();
});

audioPlayer.addEventListener('ended', () => {
    const tracks = playlists[activePlaylist] || [];
    if(tracks.length > 0) {
        currentTrack = (currentTrack + 1) % tracks.length;
        playTrack(currentTrack);
    }
});

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return; // Ignore shortcuts when typing
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            playPauseBtn.click();
            break;
        case 'ArrowRight':
            nextBtn.click();
            break;
        case 'ArrowLeft':
            prevBtn.click();
            break;
        case 'KeyM':
            audioPlayer.muted = !audioPlayer.muted;
            break;
    }
});

document.addEventListener('click', (e) => {
    if (eqPanel.style.display === 'block' && !eqPanel.contains(e.target) && !eqBtn.contains(e.target)) {
        eqPanel.style.display = 'none';
    }
});

async function searchSongs(term) {
    if (!term) return;
    try {
        const response = await fetch(`/api/search?term=${encodeURIComponent(term)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const songs = await response.json();
        searchResults.innerHTML = '';
        songs.forEach(song => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${song.trackName} - ${song.artistName}</span>`;
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Add to playlist';
            downloadBtn.className = 'download-btn';
            downloadBtn.onclick = () => addToPlaylist(song);
            li.appendChild(downloadBtn);
            searchResults.appendChild(li);
        });
    } catch (error) {
        console.error("Error searching songs:", error);
        searchResults.innerHTML = '<li>Error loading results.</li>';
    }
}

// --- INITIALIZATION ---
loadFromLocalStorage();
renderPlaylists();
initDB();
