const { SUPABASE_URL, SUPABASE_ANON_KEY } = (window.CONFIG ?? window);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Config ausente: verifique se config.js foi carregado antes do main.js');
}

supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Importamos a função 'createClient' do Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Declaramos a variável supabase aqui, mas não a inicializamos ainda.
// Ela vai esperar que a página e o config.js carreguem completamente.
let supabase;

// --- O RESTANTE DO CÓDIGO ---

// Variável para guardar a lista de músicas localmente para a pesquisa
let localMusicList = [];

// Função para "limpar" nomes de arquivos, removendo acentos e caracteres especiais.
function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')

  return text.toString().toLowerCase()
    .replace(/\s+/g, '-') // Substitui espaços por -
    .replace(p, c => b.charAt(a.indexOf(c))) // Substitui caracteres especiais
    .replace(/&/g, '-and-') // Substitui & por 'and'
    .replace(/[^\w\-.]+/g, '') // Remove todos os caracteres não-alfanuméricos exceto .
    .replace(/\-\-+/g, '-') // Substitui múltiplos - por um único -
    .replace(/^-+/, '') // Remove hífens do início
    .replace(/-+$/, '') // Remove hífens do fim
}


// --- ELEMENTOS DO DOM ---
const musicListContainer = document.getElementById('music-list');
const mainView = document.getElementById('main-view');
const detailsView = document.getElementById('details-view');
const backToListBtn = document.getElementById('back-to-list-btn');
const initialMessage = document.getElementById('initial-message');
const audioPlayerContainer = document.getElementById('audio-player-container');
const audioPlayer = document.getElementById('audio-player');
const nowPlayingTitle = document.getElementById('now-playing-title');
const closePlayerBtn = document.getElementById('close-player-btn');


// --- LÓGICA DE DADOS E RENDERIZAÇÃO ---

// Função para buscar e renderizar as músicas
async function fetchAndRenderMusic() {
    if (!supabase) {
        console.error("Cliente Supabase não inicializado.");
        return;
    }
    console.log("Buscando músicas no Supabase...");
    const { data: musicas, error } = await supabase
        .from('musicas')
        .select('*')
        .order('title', { ascending: true });

    if (error) {
        console.error("Erro ao buscar músicas:", error);
        initialMessage.innerHTML = `<p>Não foi possível carregar as músicas. Verifique sua conexão ou a configuração do Supabase. Erro: ${error.message}</p>`;
        return;
    }

    console.log("Músicas recebidas:", musicas);
    localMusicList = musicas;
    renderMusicList(localMusicList);
}

// Função para configurar o listener em tempo real
function setupRealtimeListener() {
    if (!supabase) return;
    supabase.channel('public:musicas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'musicas' }, payload => {
        console.log('Mudança detectada no banco de dados, atualizando lista.');
        fetchAndRenderMusic();
      })
      .subscribe();
}


// Função para renderizar a lista de músicas na tela
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

// --- LÓGICA DE NAVEGAÇÃO ---

musicListContainer.addEventListener('click', (e) => {
    const cardInfo = e.target.closest('.music-card-info');
    if (cardInfo) {
        showDetailsView(cardInfo.dataset.id);
    }
});

backToListBtn.addEventListener('click', () => {
    mainView.classList.remove('hidden');
    detailsView.classList.add('hidden');
});

function showDetailsView(musicId) {
    const music = localMusicList.find(m => m.id == musicId);
    if (!music) return;

    document.getElementById('details-title').textContent = music.title;
    document.getElementById('details-arranger').textContent = `por ${music.arranger}`;

    const select = document.getElementById('instrument-select');
    const noPdfMessage = document.getElementById('no-pdf-message');
    const pdfViewer = document.getElementById('pdf-viewer');
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
    
    pdfViewer.src = 'about:blank';
    noPdfMessage.classList.remove('hidden');
    document.getElementById('download-pdf-btn').style.display = 'none';
}

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

// --- LÓGICA DO MODAL (ADICIONAR/EDITAR) ---
const addMusicFab = document.getElementById('add-music-fab');
const musicModal = document.getElementById('music-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const musicForm = document.getElementById('music-form');
const modalTitle = document.getElementById('modal-title');
const musicIdInput = document.getElementById('music-id');

function openModal() { musicModal.classList.remove('hidden'); }
function closeModal() {
    musicModal.classList.add('hidden');
    musicForm.reset();
    musicIdInput.value = '';
    document.getElementById('current-audio-file').textContent = '';
    document.getElementById('current-pdfs-list').innerHTML = '';
}

addMusicFab.addEventListener('click', () => {
    modalTitle.textContent = 'Adicionar Nova Música';
    openModal();
});
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// Lógica para preencher o modal para Edição e para Apagar
musicListContainer.addEventListener('click', async (e) => {
    const target = e.target;
    const editBtn = target.closest('.edit-btn');
    const deleteBtn = target.closest('.delete-btn');

    if (editBtn) {
        const id = editBtn.dataset.id;
        const music = localMusicList.find(m => m.id == id);
        if (music) {
            modalTitle.textContent = 'Editar Música';
            musicIdInput.value = id;
            document.getElementById('music-title').value = music.title;
            document.getElementById('music-arranger').value = music.arranger;
            if (music.audioUrl) {
                document.getElementById('current-audio-file').textContent = `Áudio atual carregado. Selecione novo para substituir.`;
            }
            if (music.partituras && Object.keys(music.partituras).length > 0) {
                const pdfsList = document.getElementById('current-pdfs-list');
                pdfsList.innerHTML = '<h6>Partituras atuais:</h6>';
                Object.keys(music.partituras).forEach(instr => { pdfsList.innerHTML += `<span>${instr}</span>`; });
            }
            openModal();
        }
    }

    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('Tem certeza de que deseja apagar esta música? Esta ação é irreversível.')) {
            try {
                // Antes de apagar do DB, apagar arquivos do Storage
                const musicToDelete = localMusicList.find(m => m.id == id);
                if (musicToDelete) {
                    const filesToDelete = [];
                    if (musicToDelete.audioPath) filesToDelete.push(musicToDelete.audioPath);
                    if (musicToDelete.partiturasPaths) filesToDelete.push(...Object.values(musicToDelete.partiturasPaths));
                    
                    if (filesToDelete.length > 0) {
                        const { error: removeError } = await supabase.storage.from('arquivos').remove(filesToDelete);
                        if (removeError) throw removeError;
                    }
                }
                
                // Apagar do banco de dados
                const { error: deleteError } = await supabase.from('musicas').delete().eq('id', id);
                if (deleteError) throw deleteError;
                
                alert('Música apagada com sucesso!');

            } catch (error) {
                console.error("Erro ao apagar música: ", error);
                alert(`Ocorreu um erro ao apagar a música. Mensagem: ${error.message}`);
            }
        }
    }
});

// --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
musicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-music-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    saveBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');

    const id = musicIdInput.value;
    const title = document.getElementById('music-title').value;
    const arranger = document.getElementById('music-arranger').value;
    const audioFile = document.getElementById('music-audio').files[0];
    const pdfFiles = document.getElementById('music-pdfs').files;

    try {
        let musicData = { title, arranger };

        if(id) {
            const music = localMusicList.find(m => m.id == id);
            musicData.audioUrl = music.audioUrl;
            musicData.audioPath = music.audioPath;
            musicData.partituras = music.partituras || {};
            musicData.partiturasPaths = music.partiturasPaths || {};
        }

        if (audioFile) {
            const sanitizedAudioName = slugify(audioFile.name);
            const filePath = `audio/${Date.now()}_${sanitizedAudioName}`;
            const { error: uploadError } = await supabase.storage.from('arquivos').upload(filePath, audioFile);
            if (uploadError) throw uploadError;
            
            const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
            musicData.audioUrl = urlData.publicUrl;
            musicData.audioPath = filePath;
        }

        if (pdfFiles.length > 0) {
            musicData.partituras = musicData.partituras || {};
            musicData.partiturasPaths = musicData.partiturasPaths || {};

            for (const file of pdfFiles) {
                const instrumentName = file.name.replace(/\.pdf$/i, '').trim();
                const sanitizedPdfName = slugify(file.name);
                const sanitizedTitle = slugify(title);
                const filePath = `partituras/${sanitizedTitle}/${sanitizedPdfName}`;
                
                const { error: uploadError } = await supabase.storage.from('arquivos').upload(filePath, file, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
                musicData.partituras[instrumentName] = urlData.publicUrl;
                musicData.partiturasPaths[instrumentName] = filePath;
            }
        }
        
        if (id) {
            const { error } = await supabase.from('musicas').update(musicData).eq('id', id);
            if (error) throw error;
            alert("Música atualizada com sucesso!");
        } else {
            const { error } = await supabase.from('musicas').insert(musicData);
            if (error) throw error;
            alert("Música adicionada com sucesso!");
        }
        closeModal();
    } catch (error) {
        console.error("Erro detalhado ao salvar música: ", error);
        alert(`Ocorreu um erro ao salvar a música. Verifique o console para mais detalhes.\n\nMensagem: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
        loadingIndicator.classList.add('hidden');
    }
});


// --- INICIALIZAÇÃO E FUNCIONALIDADES ADICIONAIS ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM totalmente carregado. Iniciando a aplicação.");

    try {
        // Inicializamos o Supabase lendo as variáveis globais do objeto 'window'.
        // Isto garante que o config.js já foi executado.
        supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        
        // Agora que o supabase está inicializado, podemos carregar os dados e configurar o listener.
        fetchAndRenderMusic();
        setupRealtimeListener();

    } catch(e) {
        console.error("ERRO FATAL: Falha ao inicializar o Supabase. Verifique se o arquivo 'config.js' está correto e sendo carregado.", e);
        initialMessage.innerHTML = `<p style="color: red; font-weight: bold;">ERRO: As credenciais do Supabase não foram configuradas corretamente. Verifique o arquivo 'config.js'.</p>`;
        initialMessage.style.display = 'block';
        return;
    }


    // PWA Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('ServiceWorker registrado:', reg.scope))
                .catch(err => console.log('Falha ao registrar ServiceWorker:', err));
        });
    }

    // Tema Dark/Light
    const themeSwitcherBtn = document.getElementById('theme-switcher-btn');
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeSwitcherBtn.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            themeSwitcherBtn.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    themeSwitcherBtn.addEventListener('click', () => {
        let newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // Lógica de Pesquisa
    document.getElementById('search-input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredMusic = localMusicList.filter(music => 
            music.title.toLowerCase().includes(searchTerm) || 
            music.arranger.toLowerCase().includes(searchTerm)
        );
        renderMusicList(filteredMusic);
    });

    // Lógica para tocar áudio no player flutuante
    musicListContainer.addEventListener('click', (e) => {
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

    // Lógica para fechar o player de áudio
    closePlayerBtn.addEventListener('click', () => {
        audioPlayer.pause();
        audioPlayer.src = '';
        audioPlayerContainer.classList.add('hidden');
    });
});
