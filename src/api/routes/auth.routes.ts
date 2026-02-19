import { Router } from 'express';
import { authController, apiKeyController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, createApiKeySchema } from '../../utils/schemas';

const router = Router();

// ─── Public ──────────────────────────────────
router.post('/auth/register', validate(registerSchema), authController.register);

// ─── Protected ───────────────────────────────
router.use(authenticate);

router.get('/auth/me', authController.me);

// API Keys
router.post('/api-keys', validate(createApiKeySchema), apiKeyController.create);
router.get('/api-keys', apiKeyController.list);
router.patch('/api-keys/:id', apiKeyController.update);
router.delete('/api-keys/:id', apiKeyController.revoke);

export default router;
