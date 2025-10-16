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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[BOOT] Faltam SUPABASE_URL ou SUPABASE_ANON_KEY nas variáveis da Vercel.');
}

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req, res) {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Configuração Supabase em falta.' });
    }

    const { method } = req;

    if (method === 'GET') {
      const { data, error } = await supabase
        .from('musicas')
        .select('*')
        .order('title', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action } = body || {};
      if (!action) return res.status(400).json({ error: 'Campo "action" é obrigatório.' });

      // --- generate-signed-urls ---
      if (action === 'generate-signed-urls') {
        const { audioFile, pdfFiles, title } = body;
        const signedUrls = {};
        const filePaths = {};

        // AUDIO
        if (audioFile) {
          const sanitizedFileName = (audioFile.name || 'audio.mp3').toLowerCase().replace(/\s+/g, '-');
          const path = `audio/${Date.now()}_${sanitizedFileName}`;
          const { data, error } = await supabase
            .storage.from('arquivos')
            .createSignedUploadUrl(path, { upsert: true });
          if (error) throw error;
          signedUrls.audio = data;          // { signedUrl, token, path }
          filePaths.audio = path;
        }

        // PDFs
        if (Array.isArray(pdfFiles) && pdfFiles.length > 0) {
          signedUrls.pdfs = [];
          filePaths.pdfs = {};
          for (const file of pdfFiles) {
            const instrumentName = (file.name || 'partitura.pdf').replace(/\.pdf$/i, '').trim();
            const sanitizedTitle = (title || 'sem-titulo').toLowerCase().replace(/\s+/g, '-');
            const sanitizedFileName = (file.name || 'partitura.pdf').toLowerCase().replace(/\s+/g, '-');
            const path = `partituras/${sanitizedTitle}/${sanitizedFileName}`;
            const { data, error } = await supabase
              .storage.from('arquivos')
              .createSignedUploadUrl(path, { upsert: true });
            if (error) throw error;
            signedUrls.pdfs.push({ ...data, originalFileIndex: file.originalFileIndex });
            filePaths.pdfs[instrumentName] = path;
          }
        }

        return res.status(200).json({ signedUrls, filePaths });
      }

      // --- save-music ---
      if (action === 'save-music') {
        let { musicData } = body;
        if (!musicData) return res.status(400).json({ error: 'musicData em falta.' });

        const { id, partiturasPaths, audioPath } = musicData;

        if (id && id !== 'undefined' && id !== 'null') {
          const { data: oldData, error } = await supabase.from('musicas').select('*').eq('id', id).single();
          if (error) throw error;
          musicData = { ...oldData, ...musicData };
        }

        // Construir URLs públicas
        if (audioPath) {
          const { data } = supabase.storage.from('arquivos').getPublicUrl(audioPath);
          musicData.audioUrl = data.publicUrl;
        }
        if (partiturasPaths) {
          musicData.partituras = musicData.partituras || {};
          for (const instrumentName in partiturasPaths) {
            const path = partiturasPaths[instrumentName];
            const { data } = supabase.storage.from('arquivos').getPublicUrl(path);
            musicData.partituras[instrumentName] = data.publicUrl;
          }
        }

        // UPSERT
        let responseData;
        if (id && id !== 'undefined' && id !== 'null') {
          const { data, error } = await supabase.from('musicas').update(musicData).eq('id', id).select().single();
          if (error) throw error;
          responseData = data;
        } else {
          const copy = { ...musicData };
          delete copy.id;
          const { data, error } = await supabase.from('musicas').insert(copy).select().single();
          if (error) throw error;
          responseData = data;
        }

        return res.status(200).json(responseData);
      }

      return res.status(400).json({ error: 'Ação desconhecida.' });
    }

    if (method === 'DELETE') {
      // Alguns clientes não enviam body em DELETE; suportar body OU query.
      let payload = {};
      if (req.body && typeof req.body === 'string') {
        try { payload = JSON.parse(req.body); } catch {}
      } else if (req.body) {
        payload = req.body;
      }
      const id = payload.id || req.query.id;
      const audioPath = payload.audioPath;
      const partiturasPaths = payload.partiturasPaths;

      if (!id) return res.status(400).json({ error: 'ID é obrigatório para apagar.' });

      const filesToDelete = [];
      if (audioPath) filesToDelete.push(audioPath);
      if (partiturasPaths) filesToDelete.push(...Object.values(partiturasPaths));
      if (filesToDelete.length > 0) {
        const { error } = await supabase.storage.from('arquivos').remove(filesToDelete);
        if (error) throw error;
      }

      const { error } = await supabase.from('musicas').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ message: 'Música apagada com sucesso' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (err) {
    console.error('[API /api/musicas] Erro:', err);
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}