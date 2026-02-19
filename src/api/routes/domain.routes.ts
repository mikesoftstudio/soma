import { Router } from 'express';
import { domainController } from '../controllers/domain.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { addDomainSchema } from '../../utils/schemas';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('domain:write'), validate(addDomainSchema), domainController.add);
router.get('/', requirePermission('domain:read'), domainController.list);
router.get('/:id', requirePermission('domain:read'), domainController.get);
router.post('/:id/verify', requirePermission('domain:write'), domainController.verify);
router.delete('/:id', requirePermission('domain:write'), domainController.remove);

export default router;
