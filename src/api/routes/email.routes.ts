import { Router } from 'express';
import { emailController } from '../controllers/email.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { sendEmailSchema } from '../../utils/schemas';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('email:send'), validate(sendEmailSchema), emailController.send);
router.get('/', requirePermission('email:read'), emailController.list);
router.get('/:id', requirePermission('email:read'), emailController.get);
router.get('/:id/events', requirePermission('email:read'), emailController.getEvents);

export default router;
