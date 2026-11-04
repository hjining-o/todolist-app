// 로컬 실행 전용. 배포 진입점(api/index.js)은 app.js를 쓴다
import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port);
