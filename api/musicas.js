const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[BOOT] Faltam SUPABASE_URL/SUPABASE_ANON_KEY na Vercel.');
}

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req, res) {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Configuração Supabase ausente.' });
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

      // 1) Geração de URLs assinadas
      if (action === 'generate-signed-urls') {
        const { audioFile, pdfFiles, title } = body;
        const signedUrls = {};
        const filePaths = {};

        if (audioFile) {
          const sanitized = (audioFile.name || 'audio.mp3').toLowerCase().replace(/\s+/g, '-');
          const path = `audio/${Date.now()}_${sanitized}`;
          const { data, error } = await supabase.storage.from('arquivos').createSignedUploadUrl(path, { upsert: true });
          if (error) throw error;
          signedUrls.audio = data; // { signedUrl, token, path }
          filePaths.audio = path;
        }

        if (Array.isArray(pdfFiles) && pdfFiles.length > 0) {
          signedUrls.pdfs = [];
          filePaths.pdfs = {};
          for (const file of pdfFiles) {
            const instrumentName = (file.name || 'partitura.pdf').replace(/\.pdf$/i, '').trim();
            const sanitizedTitle = (title || 'sem-titulo').toLowerCase().replace(/\s+/g, '-');
            const sanitizedFile = (file.name || 'partitura.pdf').toLowerCase().replace(/\s+/g, '-');
            const path = `partituras/${sanitizedTitle}/${sanitizedFile}`;
            const { data, error } = await supabase.storage.from('arquivos').createSignedUploadUrl(path, { upsert: true });
            if (error) throw error;
            signedUrls.pdfs.push({ ...data, originalFileIndex: file.originalFileIndex });
            filePaths.pdfs[instrumentName] = path;
          }
        }

        return res.status(200).json({ signedUrls, filePaths });
      }

      // 2) Persistência dos dados
      if (action === 'save-music') {
        let { musicData } = body;
        if (!musicData) return res.status(400).json({ error: 'musicData em falta.' });

        const { id, audioPath, partiturasPaths } = musicData;

        if (id && id !== 'undefined' && id !== 'null') {
          const { data: oldData, error } = await supabase.from('musicas').select('*').eq('id', id).single();
          if (error) throw error;
          musicData = { ...oldData, ...musicData };
        }

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

        let responseData;
        if (id && id !== 'undefined' && id !== 'null') {
          const { data, error } = await supabase.from('musicas').update(musicData).eq('id', id).select().single();
          if (error) throw error;
          responseData = data;
        } else {
          const copy = { ...musicData }; delete copy.id;
          const { data, error } = await supabase.from('musicas').insert(copy).select().single();
          if (error) throw error;
          responseData = data;
        }

        return res.status(200).json(responseData);
      }

      return res.status(400).json({ error: 'Ação desconhecida.' });
    }

    if (method === 'DELETE') {
      let payload = {};
      if (req.body && typeof req.body === 'string') { try { payload = JSON.parse(req.body); } catch {} }
      else if (req.body) { payload = req.body; }

      const id = payload.id || req.query.id;
      const audioPath = payload.audioPath;
      const partiturasPaths = payload.partiturasPaths;

      if (!id) return res.status(400).json({ error: 'ID é obrigatório para apagar.' });

      const files = [];
      if (audioPath) files.push(audioPath);
      if (partiturasPaths) files.push(...Object.values(partiturasPaths));
      if (files.length > 0) {
        const { error } = await supabase.storage.from('arquivos').remove(files);
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