// Usamos 'require' em vez de 'import' - o formato padrão da Vercel
const { createClient } = require('@supabase/supabase-js');

function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-').replace(p, c => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-').replace(/[^\w\-.]+/g, '')
    .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// Usamos 'module.exports' em vez de 'export default'
module.exports = async (req, res) => {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('[ERRO DE BOOT] Faltam as variáveis de ambiente do Supabase.');
            return res.status(500).json({ error: 'Configuração do servidor ausente.' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { method, body } = req;

        if (method === 'GET') {
            const { data, error } = await supabase.from('musicas').select('*').order('title', { ascending: true });
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (method === 'POST') {
            const { action } = body || {};
            if (!action) return res.status(400).json({ error: 'Campo "action" é obrigatório.' });

            if (action === 'generate-signed-urls') {
                const { audioFile, pdfFiles, title } = body;
                const signedUrls = {};
                const filePaths = {};

                if (audioFile) {
                    const sanitizedFileName = slugify(audioFile.name);
                    const path = `audio/${Date.now()}_${sanitizedFileName}`;
                    const { data, error } = await supabase.storage.from('arquivos').createSignedUploadUrl(path, { upsert: true });
                    if (error) throw error;
                    signedUrls.audio = data;
                    filePaths.audio = path;
                }

                if (pdfFiles && pdfFiles.length > 0) {
                    signedUrls.pdfs = [];
                    filePaths.pdfs = {};
                    for (const file of pdfFiles) {
                        const instrumentName = file.name.replace(/\.pdf$/i, '').trim();
                        const sanitizedFileName = slugify(file.name);
                        const sanitizedTitle = slugify(title);
                        const path = `partituras/${sanitizedTitle}/${sanitizedFileName}`;
                        const { data, error } = await supabase.storage.from('arquivos').createSignedUploadUrl(path, { upsert: true });
                        if (error) throw error;
                        signedUrls.pdfs.push({ ...data, originalFileIndex: file.originalFileIndex });
                        filePaths.pdfs[instrumentName] = path;
                    }
                }
                return res.status(200).json({ signedUrls, filePaths });
            }

            if (action === 'save-music') {
                let { musicData } = body;
                const { id, audioPath, partiturasPaths } = musicData;

                if (id && id !== 'undefined' && id !== 'null') {
                    const { data: oldData } = await supabase.from('musicas').select('*').eq('id', id).single();
                    musicData = { ...oldData, ...musicData };
                }
                
                if (musicData.audioPath) {
                    const { data } = supabase.storage.from('arquivos').getPublicUrl(musicData.audioPath);
                    musicData.audioUrl = data.publicUrl;
                }
                if (musicData.partiturasPaths) {
                    musicData.partituras = musicData.partituras || {};
                    for (const instrumentName in musicData.partiturasPaths) {
                        const path = musicData.partiturasPaths[instrumentName];
                        const { data } = supabase.storage.from('arquivos').getPublicUrl(path);
                        musicData.partituras[instrumentName] = data.publicUrl;
                    }
                }
                
                let responseData;
                if (id && id !== 'undefined' && id !== 'null') {
                    const { data, error } = await supabase.from('musicas').update(musicData).eq('id', id).select().single();
                    if (error) throw error;
                    responseData = data;
                } else {
                    delete musicData.id;
                    const { data, error } = await supabase.from('musicas').insert(musicData).select().single();
                    if (error) throw error;
                    responseData = data;
                }
                return res.status(200).json(responseData);
            }

            return res.status(400).json({ error: 'Ação desconhecida.' });
        }

        if (method === 'DELETE') {
            const { id, audioPath, partiturasPaths } = body;
            if (!id) return res.status(400).json({ error: 'ID é obrigatório para apagar.' });
            
            const filesToDelete = [];
            if (audioPath) filesToDelete.push(audioPath);
            if (partiturasPaths) filesToDelete.push(...Object.values(partiturasPaths));
            
            if (filesToDelete.length > 0) {
                await supabase.storage.from('arquivos').remove(filesToDelete);
            }
            
            const { error } = await supabase.from('musicas').delete().eq('id', id);
            if (error) throw error;
            
            return res.status(200).json({ message: 'Música apagada com sucesso' });
        }

        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });

    } catch (err) {
        console.error('[ERRO GERAL NA FUNÇÃO]', err);
        return res.status(500).json({ error: err?.message || 'Erro Interno do Servidor' });
    }
};