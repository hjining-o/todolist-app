import express from 'express';
import cookieParser from 'cookie-parser';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

export const app = express();

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', router);
app.use(errorHandler);
