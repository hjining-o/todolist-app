import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { AppError } from '../domain/errors.js';
import { pool } from '../config/db.js';
import { authRouter } from './auth.routes.js';
import { categoriesRouter } from './categories.routes.js';
import { teamsRouter } from './teams.routes.js';
import { todoHistoriesRouter } from './todo-histories.routes.js';
import { todosRouter } from './todos.routes.js';
import { usersRouter } from './users.routes.js';

export const router = Router();

// 공개 경로(SEC-04). 서버·DB 상태를 따로 알리고 내부 정보(에러 내용)는 담지 않는다
router.get('/health', async (req, res) => {
  let db = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(err.stack);
    db = 'error';
  }
  res.status(db === 'ok' ? 200 : 503).json({ server: 'ok', db });
});

// 공개 경로이므로 authenticate 앞에 마운트(SEC-04)
router.use('/auth', authRouter);

router.use(authenticate);

// 보호 라우터 마운트 자리
router.use(usersRouter);
router.use('/categories', categoriesRouter);
router.use('/teams', teamsRouter);
router.use('/todos', todosRouter);
router.use('/todos', todoHistoriesRouter);

router.use((req, res, next) => next(AppError.of('NOT_FOUND')));
