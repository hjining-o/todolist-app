import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { AppError } from '../domain/errors.js';
import { authRouter } from './auth.routes.js';
import { categoriesRouter } from './categories.routes.js';
import { teamsRouter } from './teams.routes.js';
import { todosRouter } from './todos.routes.js';
import { usersRouter } from './users.routes.js';

export const router = Router();

// 공개 경로, 응답 고정(SEC-04)
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// 공개 경로이므로 authenticate 앞에 마운트(SEC-04)
router.use('/auth', authRouter);

router.use(authenticate);

// 보호 라우터 마운트 자리
router.use(usersRouter);
router.use('/categories', categoriesRouter);
router.use('/teams', teamsRouter);
router.use('/todos', todosRouter);

router.use((req, res, next) => next(AppError.of('NOT_FOUND')));
