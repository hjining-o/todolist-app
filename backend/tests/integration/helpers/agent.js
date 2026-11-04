import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../src/app.js';
import { env } from '../../../src/config/env.js';

export function agentFor(userId) {
  const agent = request.agent(app);
  const token = jwt.sign({ sub: userId }, env.jwtSecret, { algorithm: 'HS384', expiresIn: '15m' });
  // 헤더로 고정하면 서버가 쿠키를 지워도 계속 보내므로 쿠키 jar에 넣는다
  // shortcut: agent.jar는 superagent 내부 속성, 버전 업으로 깨지면 Cookie 헤더 방식으로 교체
  agent.jar.setCookie(`access_token=${token}; Path=/`);
  return agent;
}
