import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const DATA_DIR = process.env.DATA_DIR || './data';

app.use(express.json());
app.use(express.static('dist'));

// Ensure data directory exists
const initDir = async () => {
    try { await fs.mkdir(DATA_DIR, { recursive: true }); } 
    catch (err) { console.error(err); }
}
initDir();

app.get('/api/storage/:key', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, `${req.params.key}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    res.json({ value: data });
  } catch (error) { res.json({ value: null }); }
});

app.post('/api/storage/:key', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, `${req.params.key}.json`);
    await fs.writeFile(filePath, req.body.value); 
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
