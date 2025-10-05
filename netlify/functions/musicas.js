// Importamos as ferramentas necessárias para o nosso backend
const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

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

// Função auxiliar CORRIGIDA para processar formulários com arquivos
function parseMultipartForm(event) {
    return new Promise((resolve, reject) => {
        const fields = {};
        const files = [];
        
        // Os cabeçalhos da Netlify podem ter letras maiúsculas/minúsculas diferentes.
        const contentType = event.headers['content-type'] || event.headers['Content-Type'];
        if (!contentType) {
            return reject(new Error('Cabeçalho Content-Type em falta'));
        }

        const busboy = Busboy({ headers: { 'content-type': contentType } });

        busboy.on('file', (fieldname, file, info) => {
            const { filename } = info;
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                files.push({
                    fieldname,
                    buffer: Buffer.concat(chunks),
                    filename,
                });
            });
        });

        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });

        busboy.on('finish', () => {
            resolve({ fields, files });
        });
        
        busboy.on('error', err => {
            reject(err);
        });

        const bodyBuffer = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf-8');
        busboy.end(bodyBuffer);
    });
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
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    // --- LÓGICA PARA CRIAR/ATUALIZAR MÚSICAS (POST) ---
    if (event.httpMethod === 'POST') {
        try {
            console.log("Função POST iniciada.");
            const { fields, files } = await parseMultipartForm(event);
            console.log("Formulário processado. Campos:", fields, "Ficheiros:", files.length);

            const { id, title, arranger } = fields;
            
            let musicData = { title, arranger };
            if (id && id !== 'undefined' && id !== 'null') {
                const { data } = await supabase.from('musicas').select('*').eq('id', id).single();
                musicData = { ...data, ...musicData };
            }

            for (const file of files) {
                const sanitizedFileName = slugify(file.filename);
                if (file.fieldname === 'audioFile') {
                    const filePath = `audio/${Date.now()}_${sanitizedFileName}`;
                    console.log(`Fazendo upload do áudio para: ${filePath}`);
                    const { error } = await supabase.storage.from('arquivos').upload(filePath, file.buffer, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
                    musicData.audioUrl = urlData.publicUrl;
                    musicData.audioPath = filePath;
                } else if (file.fieldname === 'pdfFiles[]') {
                    const instrumentName = file.filename.replace(/\.pdf$/i, '').trim();
                    const sanitizedTitle = slugify(title);
                    const filePath = `partituras/${sanitizedTitle}/${sanitizedFileName}`;
                    console.log(`Fazendo upload da partitura para: ${filePath}`);
                    const { error } = await supabase.storage.from('arquivos').upload(filePath, file.buffer, { upsert: true });
                    if (error) throw error;
                    const { data: urlData } = supabase.storage.from('arquivos').getPublicUrl(filePath);
                    
                    musicData.partituras = musicData.partituras || {};
                    musicData.partiturasPaths = musicData.partiturasPaths || {};
                    musicData.partituras[instrumentName] = urlData.publicUrl;
                    musicData.partiturasPaths[instrumentName] = filePath;
                }
            }

            console.log("Salvando dados no banco de dados...");
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
            
            console.log("Dados salvos com sucesso.");
            return { statusCode: 200, body: JSON.stringify(responseData) };

        } catch (error) {
            console.error("[ERRO NA FUNÇÃO POST]:", error);
            return { statusCode: 500, body: JSON.stringify({ error: `Erro Interno do Servidor: ${error.message}` }) };
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