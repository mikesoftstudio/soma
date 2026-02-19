import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createWebhookSchema, updateWebhookSchema } from '../../utils/schemas';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('webhook:write'), validate(createWebhookSchema), webhookController.create);
router.get('/', requirePermission('webhook:read'), webhookController.list);
router.get('/:id', requirePermission('webhook:read'), webhookController.get);
router.patch('/:id', requirePermission('webhook:write'), validate(updateWebhookSchema), webhookController.update);
router.delete('/:id', requirePermission('webhook:write'), webhookController.remove);

export default router;
