let localMusicList = [];

function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-').replace(p, c => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-').replace(/[^\w\-.]+/g, '')
    .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

const musicListContainer = document.getElementById('music-list');
const mainView = document.getElementById('main-view');
const detailsView = document.getElementById('details-view');
const backToListBtn = document.getElementById('back-to-list-btn');
const initialMessage = document.getElementById('initial-message');
const audioPlayerContainer = document.getElementById('audio-player-container');
const audioPlayer = document.getElementById('audio-player');
const nowPlayingTitle = document.getElementById('now-playing-title');
const closePlayerBtn = document.getElementById('close-player-btn');
const addMusicFab = document.getElementById('add-music-fab');
const musicModal = document.getElementById('music-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const musicForm = document.getElementById('music-form');
const modalTitle = document.getElementById('modal-title');
const musicIdInput = document.getElementById('music-id');

async function fetchAndRenderMusic() {
    initialMessage.innerHTML = '<p>Carregando músicas...</p>';
    initialMessage.style.display = 'block';
    try {
        const response = await fetch('/.netlify/functions/musicas');
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro de rede');
        }
        const musicas = await response.json();
        localMusicList = musicas;
        renderMusicList(localMusicList);
    } catch (error) {
        console.error("Erro ao buscar músicas:", error);
        initialMessage.innerHTML = `<p style="color: red;">Não foi possível carregar as músicas. Erro: ${error.message}</p>`;
    }
}

function renderMusicList(musicas) {
    if (musicas.length === 0 && document.getElementById('search-input').value === '') {
        initialMessage.innerHTML = '<p>Nenhuma música encontrada. Adicione a primeira!</p>';
        initialMessage.style.display = 'block';
        musicListContainer.innerHTML = '';
    } else {
        initialMessage.style.display = 'none';
        musicListContainer.innerHTML = '';
        musicas.forEach(music => {
            const card = document.createElement('div');
            card.className = 'music-card';
            card.dataset.id = music.id;
            const hasAudio = music.audioUrl;
            
            card.innerHTML = `
                <div class="music-card-header">
                    <div class="music-card-info" data-id="${music.id}">
                        <h2>${music.title}</h2>
                        <h5>${music.arranger}</h5>
                    </div>
                    <div class="music-card-actions">
                        <button class="music-card-menu-btn edit-btn" data-id="${music.id}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                        <button class="music-card-menu-btn delete-btn" data-id="${music.id}" title="Apagar"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="music-card-footer">
                    <button class="action-button listen-btn" ${!hasAudio ? 'disabled' : ''} data-audio="${music.audioUrl}">
                        <i class="fas fa-play"></i> Ouvir
                    </button>
                    <a class="action-button download-btn" href="${music.audioUrl || '#'}" download="${slugify(music.title)}.mp3" ${!hasAudio ? 'style="pointer-events:none; opacity:0.7;"' : ''}>
                        <i class="fas fa-download"></i> Baixar Áudio
                    </a>
                </div>
            `;
            musicListContainer.appendChild(card);
        });
    }
}

function showDetailsView(musicId) {
    const music = localMusicList.find(m => m.id == musicId);
    if (!music) return;
    document.getElementById('details-title').textContent = music.title;
    document.getElementById('details-arranger').textContent = `por ${music.arranger}`;
    const select = document.getElementById('instrument-select');
    const partituras = music.partituras || {};
    const instruments = Object.keys(partituras).sort();
    select.innerHTML = '<option value="">Selecione seu instrumento...</option>';
    if (instruments.length > 0) {
        instruments.forEach(instrument => {
            const option = document.createElement('option');
            option.value = partituras[instrument];
            option.textContent = instrument;
            select.appendChild(option);
        });
    }
    mainView.classList.add('hidden');
    detailsView.classList.remove('hidden');
    document.getElementById('pdf-viewer').src = 'about:blank';
    document.getElementById('no-pdf-message').classList.remove('hidden');
    document.getElementById('download-pdf-btn').style.display = 'none';
}

function openModal() { musicModal.classList.remove('hidden'); }
function closeModal() {
    musicModal.classList.add('hidden');
    musicForm.reset();
    musicIdInput.value = '';
    document.getElementById('current-audio-file').textContent = '';
    document.getElementById('current-pdfs-list').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderMusic();
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => { navigator.serviceWorker.register('/service-worker.js'); });
    }
    const themeSwitcherBtn = document.getElementById('theme-switcher-btn');
    function applyTheme(theme) {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        themeSwitcherBtn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    themeSwitcherBtn.addEventListener('click', () => {
        let newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });
});

musicListContainer.addEventListener('click', async (e) => {
    const cardInfo = e.target.closest('.music-card-info');
    if (cardInfo) showDetailsView(cardInfo.dataset.id);

    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const music = localMusicList.find(m => m.id == id);
        if (music) {
            modalTitle.textContent = 'Editar Música';
            musicIdInput.value = id;
            document.getElementById('music-title').value = music.title;
            document.getElementById('music-arranger').value = music.arranger;
            if (music.audioUrl) document.getElementById('current-audio-file').textContent = `Áudio atual carregado. Selecione novo para substituir.`;
            if (music.partituras && Object.keys(music.partituras).length > 0) {
                const pdfsList = document.getElementById('current-pdfs-list');
                pdfsList.innerHTML = '<h6>Partituras atuais:</h6>';
                Object.keys(music.partituras).forEach(instr => { pdfsList.innerHTML += `<span>${instr}</span>`; });
            }
            openModal();
        }
    }

    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('Tem certeza de que deseja apagar esta música? Esta ação é irreversível.')) {
            try {
                const musicToDelete = localMusicList.find(m => m.id == id);
                const response = await fetch('/.netlify/functions/musicas', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: musicToDelete.id,
                        audioPath: musicToDelete.audioPath,
                        partiturasPaths: musicToDelete.partiturasPaths
                    })
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error);
                }
                alert('Música apagada com sucesso!');
                fetchAndRenderMusic();
            } catch (error) {
                alert(`Ocorreu um erro ao apagar a música: ${error.message}`);
            }
        }
    }
    
    const listenBtn = e.target.closest('.listen-btn');
    if (listenBtn && !listenBtn.disabled) {
        const card = listenBtn.closest('.music-card');
        const title = card.querySelector('h2').textContent;
        nowPlayingTitle.textContent = title;
        audioPlayer.src = listenBtn.dataset.audio;
        audioPlayer.play();
        audioPlayerContainer.classList.remove('hidden');
    }
});

backToListBtn.addEventListener('click', () => {
    mainView.classList.remove('hidden');
    detailsView.classList.add('hidden');
});

document.getElementById('instrument-select').addEventListener('change', (e) => {
    const pdfUrl = e.target.value;
    const viewer = document.getElementById('pdf-viewer');
    const noPdfMessage = document.getElementById('no-pdf-message');
    const downloadBtn = document.getElementById('download-pdf-btn');
    if (pdfUrl) {
        viewer.src = pdfUrl;
        noPdfMessage.classList.add('hidden');
        downloadBtn.href = pdfUrl;
        const selectedOptionText = e.target.options[e.target.selectedIndex].text;
        const musicTitle = document.getElementById('details-title').textContent;
        downloadBtn.download = `${slugify(musicTitle)} - ${slugify(selectedOptionText)}.pdf`;
        downloadBtn.style.display = 'flex';
    } else {
        viewer.src = 'about:blank';
        noPdfMessage.classList.remove('hidden');
        downloadBtn.style.display = 'none';
    }
});

addMusicFab.addEventListener('click', () => {
    modalTitle.textContent = 'Adicionar Nova Música';
    openModal();
});
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

musicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-music-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    saveBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');

    try {
        const id = document.getElementById('music-id').value;
        const title = document.getElementById('music-title').value;
        const arranger = document.getElementById('music-arranger').value;
        const audioFileInput = document.getElementById('music-audio');
        const pdfFilesInput = document.getElementById('music-pdfs');

        let musicData = { id, title, arranger };

        // 1. PEDIR AS PERMISSÕES DE UPLOAD (SIGNED URLS)
        const filesToRequest = { title };
        if (audioFileInput.files[0]) {
            filesToRequest.audioFile = { name: audioFileInput.files[0].name };
        }
        if (pdfFilesInput.files.length > 0) {
            filesToRequest.pdfFiles = Array.from(pdfFilesInput.files).map((file, index) => ({ name: file.name, originalFileIndex: index }));
        }

        const urlResponse = await fetch('/.netlify/functions/musicas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate-signed-urls', ...filesToRequest })
        });
        if (!urlResponse.ok) throw new Error('Falha ao gerar URLs de upload.');
        const { signedUrls, filePaths } = await urlResponse.json();

        // 2. FAZER UPLOAD DOS FICHEIROS DIRETAMENTE PARA O SUPABASE
        const uploadPromises = [];
        if (signedUrls.audio) {
            // CORREÇÃO AQUI: A propriedade é 'signedUrl', não 'url'.
            const { token, signedUrl } = signedUrls.audio;
            uploadPromises.push(
                fetch(signedUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: audioFileInput.files[0]
                }).then(res => { if (!res.ok) throw new Error('Falha no upload do áudio.')})
            );
            musicData.audioPath = filePaths.audio;
        }
        if (signedUrls.pdfs) {
            signedUrls.pdfs.forEach(pdfUrlData => {
                 // CORREÇÃO AQUI: A propriedade é 'signedUrl', não 'url'.
                const { token, signedUrl } = pdfUrlData;
                const originalFile = pdfFilesInput.files[pdfUrlData.originalFileIndex];
                uploadPromises.push(
                    fetch(signedUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/pdf' },
                        body: originalFile
                    }).then(res => { if (!res.ok) throw new Error(`Falha no upload do PDF: ${originalFile.name}`)})
                );
            });
            musicData.partiturasPaths = filePaths.pdfs;
        }

        await Promise.all(uploadPromises);

        // 3. SALVAR OS DADOS DA MÚSICA NO BANCO DE DADOS
        const saveResponse = await fetch('/.netlify/functions/musicas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save-music', musicData })
        });
        if (!saveResponse.ok) throw new Error('Falha ao salvar os dados da música.');

        alert('Música salva com sucesso!');
        closeModal();
        fetchAndRenderMusic();

    } catch (error) {
        alert(`Ocorreu um erro ao salvar a música: ${error.message}`);
        console.error("Erro detalhado no processo de salvar:", error);
    } finally {
        saveBtn.disabled = false;
        loadingIndicator.classList.add('hidden');
    }
});

closePlayerBtn.addEventListener('click', () => {
    audioPlayer.pause();
    audioPlayer.src = '';
    audioPlayerContainer.classList.add('hidden');
});

document.getElementById('search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredMusic = localMusicList.filter(music => 
        music.title.toLowerCase().includes(searchTerm) || 
        music.arranger.toLowerCase().includes(searchTerm)
    );
    renderMusicList(filteredMusic);
});