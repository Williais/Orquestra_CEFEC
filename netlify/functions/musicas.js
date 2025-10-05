// Importamos as ferramentas necessárias para o nosso backend
const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

// Função para "limpar" nomes de arquivos (igual à do front-end)
function slugify(text) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
  const p = new RegExp(a.split('').join('|'), 'g')
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-').replace(p, c => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-').replace(/[^\w\-.]+/g, '')
    .replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// Função auxiliar para processar formulários com arquivos
function parseMultipartForm(event) {
    return new Promise((resolve) => {
        const fields = {};
        const files = [];
        const busboy = Busboy({ headers: event.headers });

        busboy.on('file', (fieldname, file, filenameInfo) => {
            const { filename, encoding, mimeType } = filenameInfo;
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                files.push({
                    fieldname,
                    buffer: Buffer.concat(chunks),
                    filename,
                    mimetype: mimeType,
                });
            });
        });

        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });

        busboy.on('finish', () => {
            resolve({ fields, files });
        });
        
        const bodyBuffer = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
        busboy.end(bodyBuffer);
    });
}

// A função principal que a Netlify vai executar
exports.handler = async function(event, context) {
    // 1. As chaves SÓ existem aqui, em segurança no backend.
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
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    // --- LÓGICA PARA CRIAR/ATUALIZAR MÚSICAS (POST) ---
    if (event.httpMethod === 'POST') {
        try {
            const { fields, files } = await parseMultipartForm(event);
            const { id, title, arranger } = fields;
            
            let musicData = { title, arranger };
            if (id) {
                const { data } = await supabase.from('musicas').select('*').eq('id', id).single();
                musicData = { ...data, ...musicData };
            }

            for (const file of files) {
                const sanitizedFileName = slugify(file.filename);
                if (file.fieldname === 'audioFile') {
                    const filePath = `audio/${Date.now()}_${sanitizedFileName}`;
                    const { error } = await supabase.storage.from('arquivos').upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
                    musicData.audioUrl = urlData.publicUrl;
                    musicData.audioPath = filePath;
                } else if (file.fieldname === 'pdfFiles[]') {
                    const instrumentName = file.filename.replace(/\.pdf$/i, '').trim();
                    const sanitizedTitle = slugify(title);
                    const filePath = `partituras/${sanitizedTitle}/${sanitizedFileName}`;
                    const { error } = await supabase.storage.from('arquivos').upload(filePath, file.buffer, { contentType: 'application/pdf', upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
                    
                    musicData.partituras = musicData.partituras || {};
                    musicData.partiturasPaths = musicData.partiturasPaths || {};
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
                delete musicData.id; // Garante que não tentamos inserir um ID nulo
                const { data, error } = await supabase.from('musicas').insert(musicData).select().single();
                if (error) throw error;
                responseData = data;
            }
            
            return { statusCode: 200, body: JSON.stringify(responseData) };

        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: `Erro no Servidor: ${error.message}` }) };
        }
    }

    // --- LÓGICA PARA APAGAR MÚSICAS (DELETE) ---
    if (event.httpMethod === 'DELETE') {
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
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    return { statusCode: 405, body: 'Método não permitido' };
};