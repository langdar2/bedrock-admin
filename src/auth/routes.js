import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  hasUsers, createUser, getUserByUsername, getUserById,
  saveCredential, getCredentialsByUserId, getCredentialById, getAllCredentials,
  updateCredentialCounter, createInvite, getInvite, markInviteUsed,
  getUsers, deleteUser, updateRecoveryHash,
} from '../db.js';

const router = Router();

const rpID = process.env.RP_ID || 'localhost';
const rpName = process.env.RP_NAME || 'Bedrock Admin';
const origin = process.env.ORIGIN || `https://${rpID}`;

// --- Setup: first user registration ---

router.get('/auth/setup/status', (req, res) => {
  res.json({ needsSetup: !hasUsers() });
});

router.post('/auth/setup/register-options', async (req, res) => {
  if (hasUsers()) return res.status(403).json({ error: 'Setup already completed' });
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const userId = randomBytes(16).toString('hex');
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    userID: new TextEncoder().encode(userId),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });

  req.session.challenge = options.challenge;
  req.session.pendingUser = { id: userId, username };
  res.json(options);
});

router.post('/auth/setup/register-verify', async (req, res) => {
  if (hasUsers()) return res.status(403).json({ error: 'Setup already completed' });
  const { pendingUser, challenge } = req.session;
  if (!pendingUser || !challenge) return res.status(400).json({ error: 'No pending registration' });

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    const recoveryCode = randomBytes(16).toString('hex');
    const recoveryHash = createHash('sha256').update(recoveryCode).digest('hex');

    createUser(pendingUser.id, pendingUser.username, recoveryHash);

    const { credential } = verification.registrationInfo;
    saveCredential(
      credential.id,
      pendingUser.id,
      Buffer.from(credential.publicKey),
      credential.counter,
      credential.deviceType,
      credential.backedUp,
      credential.transports,
    );

    req.session.userId = pendingUser.id;
    delete req.session.challenge;
    delete req.session.pendingUser;

    res.json({ verified: true, recoveryCode });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Login ---

router.post('/auth/login-options', async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
  });
  req.session.challenge = options.challenge;
  res.json(options);
});

router.post('/auth/login-verify', async (req, res) => {
  const { challenge } = req.session;
  if (!challenge) return res.status(400).json({ error: 'No pending challenge' });

  try {
    const credential = getCredentialById(req.body.id);
    if (!credential) return res.status(400).json({ error: 'Unknown credential' });

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credential_id,
        publicKey: credential.public_key,
        counter: credential.counter,
        transports: credential.transports,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) return res.status(400).json({ error: 'Verification failed' });

    updateCredentialCounter(credential.credential_id, verification.authenticationInfo.newCounter);
    req.session.userId = credential.user_id;
    delete req.session.challenge;

    const user = getUserById(credential.user_id);
    res.json({ verified: true, username: user.username });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ authenticated: false });
  const user = getUserById(req.session.userId);
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, username: user.username, id: user.id });
});

// --- Invite system ---

router.post('/auth/invite', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const token = randomBytes(24).toString('base64url');
  createInvite(token, req.session.userId);
  res.json({ inviteUrl: `${origin}/setup.html?invite=${token}` });
});

router.post('/auth/invite/register-options', async (req, res) => {
  const { username, invite } = req.body;
  if (!username || !invite) return res.status(400).json({ error: 'Username and invite required' });
  const inv = getInvite(invite);
  if (!inv) return res.status(403).json({ error: 'Invalid or used invite' });

  if (getUserByUsername(username)) return res.status(400).json({ error: 'Username taken' });

  const userId = randomBytes(16).toString('hex');
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    userID: new TextEncoder().encode(userId),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });

  req.session.challenge = options.challenge;
  req.session.pendingUser = { id: userId, username };
  req.session.pendingInvite = invite;
  res.json(options);
});

router.post('/auth/invite/register-verify', async (req, res) => {
  const { pendingUser, challenge, pendingInvite } = req.session;
  if (!pendingUser || !challenge || !pendingInvite) return res.status(400).json({ error: 'No pending registration' });

  const inv = getInvite(pendingInvite);
  if (!inv) return res.status(403).json({ error: 'Invalid or used invite' });

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    const recoveryCode = randomBytes(16).toString('hex');
    const recoveryHash = createHash('sha256').update(recoveryCode).digest('hex');

    createUser(pendingUser.id, pendingUser.username, recoveryHash);
    markInviteUsed(pendingInvite);

    const { credential } = verification.registrationInfo;
    saveCredential(
      credential.id,
      pendingUser.id,
      Buffer.from(credential.publicKey),
      credential.counter,
      credential.deviceType,
      credential.backedUp,
      credential.transports,
    );

    req.session.userId = pendingUser.id;
    delete req.session.challenge;
    delete req.session.pendingUser;
    delete req.session.pendingInvite;

    res.json({ verified: true, recoveryCode });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- User management ---

router.get('/auth/users', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  res.json(getUsers());
});

router.delete('/auth/users/:id', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.params.id === req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
  deleteUser(req.params.id);
  res.json({ ok: true });
});

export default router;
