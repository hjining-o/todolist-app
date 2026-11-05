import express from 'express';
import cookieParser from 'cookie-parser';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { cors } from './middleware/cors.js';

export const app = express();

app.use(cors);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', router);
app.use(errorHandler);
