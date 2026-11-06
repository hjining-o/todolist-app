// 로컬 실행 전용. 배포 진입점(backend/api/index.js)은 app.js를 쓰므로 Swagger UI는 개발 모드에만 붙는다
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { app } from './app.js';
import { env } from './config/env.js';

// 설명문은 문서에만 두고 UI에서는 뺀다. 문자열 값만 지워 `description`이라는 이름의 필드 정의(객체)와 예시 값은 남긴다
function stripDescriptions(node) {
  if (Array.isArray(node)) return node.forEach(stripDescriptions);
  if (!node || typeof node !== 'object') return;
  if (typeof node.description === 'string') delete node.description;
  for (const [key, value] of Object.entries(node))
    if (key !== 'example' && key !== 'examples') stripDescriptions(value);
}

// 명세 원본은 docs/8-swagger.yaml 하나. '/swagger'는 '/api' 라우터(인증·404)에 걸리지 않는다
const spec = yaml.load(await readFile(new URL('../../docs/8-swagger.yaml', import.meta.url), 'utf8'));
stripDescriptions(spec);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(spec));

app.listen(env.port);
