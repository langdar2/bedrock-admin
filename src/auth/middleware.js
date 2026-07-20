import { hasUsers } from '../db.js';

export function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

export function redirectToSetupOrLogin(req, res, next) {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next();
  if (req.path === '/setup.html' || req.path === '/index.html' || req.path === '/' || req.path.endsWith('.js') || req.path.endsWith('.css')) return next();

  if (!req.session.userId) {
    return res.redirect(hasUsers() ? '/' : '/setup.html');
  }
  next();
}
