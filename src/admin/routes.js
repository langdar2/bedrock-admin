import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import {
  readProperties, writeProperties,
  readAllowlist, writeAllowlist,
  readPermissions, writePermissions,
  listWorlds, getActiveWorld, createWorld,
} from './bedrock.js';
import { getDockerControl } from './docker.js';

const router = Router();
router.use(requireAuth);

// --- Server Properties ---

router.get('/api/properties', (req, res) => {
  const { props, comments } = readProperties();
  res.json({ props, comments });
});

router.put('/api/properties', (req, res) => {
  const { props, comments } = req.body;
  if (!props || typeof props !== 'object') return res.status(400).json({ error: 'props required' });
  writeProperties(props, comments || []);
  res.json({ ok: true, restartRequired: true });
});

// --- Allowlist ---

router.get('/api/allowlist', (req, res) => {
  res.json(readAllowlist());
});

router.put('/api/allowlist', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Array required' });
  writeAllowlist(req.body);
  res.json({ ok: true });
});

router.post('/api/allowlist', (req, res) => {
  const { name, xuid, ignoresPlayerLimit } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const list = readAllowlist();
  if (list.some(p => p.name === name)) return res.status(400).json({ error: 'Player already in allowlist' });
  list.push({ name, xuid: xuid || '', ignoresPlayerLimit: !!ignoresPlayerLimit });
  writeAllowlist(list);
  res.json({ ok: true });
});

router.delete('/api/allowlist/:name', (req, res) => {
  const list = readAllowlist().filter(p => p.name !== req.params.name);
  writeAllowlist(list);
  res.json({ ok: true });
});

// --- Permissions ---

router.get('/api/permissions', (req, res) => {
  res.json(readPermissions());
});

router.put('/api/permissions', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Array required' });
  writePermissions(req.body);
  res.json({ ok: true });
});

router.post('/api/permissions', (req, res) => {
  const { xuid, permission } = req.body;
  if (!xuid || !permission) return res.status(400).json({ error: 'xuid and permission required' });
  if (!['visitor', 'member', 'operator'].includes(permission)) return res.status(400).json({ error: 'Invalid permission level' });
  const list = readPermissions();
  const existing = list.find(p => p.xuid === xuid);
  if (existing) { existing.permission = permission; } else { list.push({ xuid, permission }); }
  writePermissions(list);
  res.json({ ok: true });
});

router.delete('/api/permissions/:xuid', (req, res) => {
  const list = readPermissions().filter(p => p.xuid !== req.params.xuid);
  writePermissions(list);
  res.json({ ok: true });
});

// --- Worlds ---

router.get('/api/worlds', (req, res) => {
  res.json({ worlds: listWorlds(), active: getActiveWorld() });
});

router.post('/api/worlds', (req, res) => {
  const { name, seed } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    createWorld(name);
    if (seed) {
      const { props, comments } = readProperties();
      props['level-seed'] = seed;
      writeProperties(props, comments);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/api/worlds/activate', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const worlds = listWorlds();
  if (!worlds.includes(name)) return res.status(404).json({ error: 'World not found' });
  const { props, comments } = readProperties();
  props['level-name'] = name;
  writeProperties(props, comments);
  res.json({ ok: true, restartRequired: true });
});

// --- Server Control ---

router.get('/api/server/status', async (req, res) => {
  try {
    const docker = getDockerControl();
    const status = await docker.getStatus();
    res.json(status);
  } catch (e) {
    res.json({ running: false, error: e.message });
  }
});

router.post('/api/server/:action', async (req, res) => {
  const { action } = req.params;
  if (!['start', 'stop', 'restart'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    const docker = getDockerControl();
    await docker[action]();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
