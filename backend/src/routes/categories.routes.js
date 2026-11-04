import { Router } from 'express';
import * as svc from '../services/categories.service.js';
import { nameRule, uuidParam, validate } from './validate.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (req, res) => {
  res.json({ items: await svc.listCategories(req.user.id) });
});

categoriesRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createCategory(req.user.id, validate(req.body, { name: nameRule })));
});

categoriesRouter.patch('/:categoryId', async (req, res) => {
  const id = uuidParam(req.params.categoryId, 'categoryId');
  res.json(await svc.renameCategory(req.user.id, id, validate(req.body, { name: nameRule })));
});

categoriesRouter.delete('/:categoryId', async (req, res) => {
  await svc.deleteCategory(req.user.id, uuidParam(req.params.categoryId, 'categoryId'));
  res.status(204).end();
});
