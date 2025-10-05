// Importamos apenas a ferramenta do Supabase
const { createClient } = require('@supabase/supabase-js');

// Função para "limpar" nomes de arquivos
function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-').replace(p, c => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-').replace(/[^\w\-.]+/g, '')
    .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// A função principal que a Netlify vai executar
exports.handler = async function(event, context) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- LÓGICA PARA LER MÚSICAS (GET) ---
    if (event.httpMethod === 'GET') {
        try {
            const { data, error } = await supabase.from('musicas').select('*').order('title', { ascending: true });
            if (error) throw error;
            return { statusCode: 200, body: JSON.stringify(data) };
        } catch (error) {
            console.error("[GET Error]", error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    // --- LÓGICA PARA CRIAR/ATUALIZAR MÚSICAS (POST) ---
    if (event.httpMethod === 'POST') {
        try {
            // O corpo do pedido agora é um JSON simples.
            const payload = JSON.parse(event.body);
            const { id, title, arranger, audioFile, pdfFiles } = payload;
            
            let musicData = { title, arranger };
            if (id && id !== 'undefined' && id !== 'null') {
                const { data } = await supabase.from('musicas').select('*').eq('id', id).single();
                musicData = { ...data, ...musicData };
            }

            // Se um ficheiro de áudio foi enviado
            if (audioFile && audioFile.content) {
                // Convertemos o texto Base64 de volta para um ficheiro (Buffer)
                const audioBuffer = Buffer.from(audioFile.content, 'base64');
                const sanitizedFileName = slugify(audioFile.filename);
                const filePath = `audio/${Date.now()}_${sanitizedFileName}`;
                const { error } = await supabase.storage.from('arquivos').upload(filePath, audioBuffer, { upsert: true, contentType: audioFile.contentType });
                if (error) throw error;
                const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
                musicData.audioUrl = urlData.publicUrl;
                musicData.audioPath = filePath;
            }

            // Se ficheiros PDF foram enviados
            if (pdfFiles && pdfFiles.length > 0) {
                 musicData.partituras = musicData.partituras || {};
                 musicData.partiturasPaths = musicData.partiturasPaths || {};
                for (const file of pdfFiles) {
                    const pdfBuffer = Buffer.from(file.content, 'base64');
                    const instrumentName = file.filename.replace(/\.pdf$/i, '').trim();
                    const sanitizedFileName = slugify(file.filename);
                    const sanitizedTitle = slugify(title);
                    const filePath = `partituras/${sanitizedTitle}/${sanitizedFileName}`;
                    const { error } = await supabase.storage.from('arquivos').upload(filePath, pdfBuffer, { upsert: true, contentType: 'application/pdf' });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
                    musicData.partituras[instrumentName] = urlData.publicUrl;
                    musicData.partiturasPaths[instrumentName] = filePath;
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
            
            return { statusCode: 200, body: JSON.stringify(responseData) };

        } catch (error) {
            console.error("[POST Error]", error);
            return { statusCode: 500, body: JSON.stringify({ error: `Erro Interno do Servidor: ${error.message}` }) };
        }
    }

    // --- LÓGICA PARA APAGAR MÚSICAS (DELETE) ---
    if (event.httpMethod === 'DELETE') {
        // (Esta parte já estava correta e não precisa de alterações)
        try {
            const { id, audioPath, partiturasPaths } = JSON.parse(event.body);
            if (!id) throw new Error("ID da música é obrigatório para apagar.");
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
            console.error("[DELETE Error]", error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    return { statusCode: 405, body: 'Método não permitido' };
};