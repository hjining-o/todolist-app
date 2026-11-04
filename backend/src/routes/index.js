import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { AppError } from '../domain/errors.js';

export const router = Router();

// 공개 경로, 응답 고정(SEC-04)
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// API-06: /auth 라우터는 authenticate 앞에 마운트(공개 경로, SEC-04)
router.use(authenticate);

// 보호 라우터 마운트 자리

router.use((req, res, next) => next(AppError.of('NOT_FOUND')));
