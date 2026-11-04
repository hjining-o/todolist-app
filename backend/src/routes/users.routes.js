import { Router } from 'express';
import * as usersService from '../services/users.service.js';

export const usersRouter = Router();

usersRouter.get('/me', async (req, res) => {
  res.json(await usersService.getMe(req.user.id));
});
