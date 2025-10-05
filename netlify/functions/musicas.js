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

exports.handler = async function(event, context) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY; // A chave segura!
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- LÓGICA PARA LER MÚSICAS (GET) ---
    if (event.httpMethod === 'GET') {
        try {
            const { data, error } = await supabase.from('musicas').select('*').order('title', { ascending: true });
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify(data) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    if (event.httpMethod === 'POST') {
        try {
            const payload = JSON.parse(event.body);
            const { action } = payload;

            // --- AÇÃO: GERAR PERMISSÕES DE UPLOAD ---
            if (action === 'generate-signed-urls') {
                const { audioFile, pdfFiles, title } = payload;
                const signedUrls = {};
                const filePaths = {};

                if (audioFile) {
                    const sanitizedFileName = slugify(audioFile.name);
                    const path = `audio/${Date.now()}_${sanitizedFileName}`;
                    const { data, error } = await supabase.storage.from('arquivos').createSignedUploadUrl(path);
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
                        const { data, error } = await supabase.storage.from('arquivos').createSignedUploadUrl(path);
                        if (error) throw error;
                        signedUrls.pdfs.push({ ...data, originalFileIndex: file.originalFileIndex });
                        filePaths.pdfs[instrumentName] = path;
                    }
                }
                return { statusCode: 200, body: JSON.stringify({ signedUrls, filePaths }) };
            }

            // --- AÇÃO: SALVAR OS DADOS DA MÚSICA DEPOIS DO UPLOAD ---
            if (action === 'save-music') {
                const { musicData } = payload;
                const { id } = musicData;
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
                return { statusCode: 200, body: JSON.stringify(responseData) };
            }

            throw new Error('Ação desconhecida.');

        } catch (error) {
            console.error("[POST Error]", error);
            return { statusCode: 500, body: JSON.stringify({ error: `Erro Interno do Servidor: ${error.message}` }) };
        }
    }

    // --- LÓGICA PARA APAGAR MÚSICAS (DELETE) ---
    if (event.httpMethod === 'DELETE') {
        try {
            const { id, audioPath, partiturasPaths } = JSON.parse(event.body);
            if (!id) throw new Error("ID é obrigatório para apagar.");
            const filesToDelete = [];
            if (audioPath) filesToDelete.push(audioPath);
            if (partiturasPaths) filesToDelete.push(...Object.values(partiturasPaths));
            if (filesToDelete.length > 0) {
                await supabase.storage.from('arquivos').remove(filesToDelete);
            }
            const { error } = await supabase.from('musicas').delete().eq('id', id);
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify({ message: 'Música apagada com sucesso' }) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    return { statusCode: 405, body: 'Método não permitido' };
};