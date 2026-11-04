import { Router } from 'express';
import * as svc from '../services/todo-histories.service.js';
import { uuidParam } from './validate.js';

export const todoHistoriesRouter = Router();

todoHistoriesRouter.get('/:todoId/histories', async (req, res) => {
  res.json(await svc.listHistories(req.user.id, uuidParam(req.params.todoId, 'todoId')));
});
