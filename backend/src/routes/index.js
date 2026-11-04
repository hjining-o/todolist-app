import { Router } from 'express';

export const router = Router();

// 공개 경로, 응답 고정(SEC-04)
router.get('/health', (req, res) => res.json({ status: 'ok' }));
