import { Router } from 'express';
import { templateController } from '../controllers/template.controller';
import { authenticate, requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createTemplateSchema, updateTemplateSchema } from '../../utils/schemas';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('template:write'), validate(createTemplateSchema), templateController.create);
router.get('/', requirePermission('template:read'), templateController.list);
router.get('/:id', requirePermission('template:read'), templateController.get);
router.patch('/:id', requirePermission('template:write'), validate(updateTemplateSchema), templateController.update);
router.delete('/:id', requirePermission('template:write'), templateController.remove);
router.post('/:id/preview', requirePermission('template:read'), templateController.preview);

export default router;
