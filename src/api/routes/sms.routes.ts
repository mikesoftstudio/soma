import { Router } from 'express';
import { smsController } from '../controllers/sms.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { sendSmsSchema } from '../../utils/schemas';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('sms:send'), validate(sendSmsSchema), smsController.send);
router.get('/', requirePermission('sms:read'), smsController.list);
router.get('/:id', requirePermission('sms:read'), smsController.get);

export default router;
