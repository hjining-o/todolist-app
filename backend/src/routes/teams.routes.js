import { Router } from 'express';
import * as teamsService from '../services/teams.service.js';
import { bad, emailRule, nameRule, ok, optional, uuidParam, uuidRule, validate } from './validate.js';

export const teamsRouter = Router();

// OWNER는 지정할 수 없다(SEC-12)
const roleRule = (required) => (v) => {
  if (v === undefined && !required) return ok('MEMBER');
  return v === 'MANAGER' || v === 'MEMBER' ? ok(v) : bad('역할은 MANAGER 또는 MEMBER여야 합니다.');
};

teamsRouter.get('/', async (req, res) => {
  res.json({ items: await teamsService.listMyTeams(req.user.id) });
});

teamsRouter.post('/', async (req, res) => {
  res.status(201).json(await teamsService.createTeam(req.user.id, validate(req.body, { name: nameRule })));
});

teamsRouter.get('/:teamId/members', async (req, res) => {
  const teamId = uuidParam(req.params.teamId, 'teamId');
  res.json({ items: await teamsService.listMembers(req.user.id, teamId) });
});

teamsRouter.post('/:teamId/members', async (req, res) => {
  const teamId = uuidParam(req.params.teamId, 'teamId');
  const body = validate(req.body, { email: emailRule(true), role: roleRule(false) });
  res.status(201).json(await teamsService.addMember(req.user.id, teamId, body));
});

teamsRouter.patch('/:teamId/members/:userId', async (req, res) => {
  const teamId = uuidParam(req.params.teamId, 'teamId');
  const userId = uuidParam(req.params.userId, 'userId');
  const { role } = validate(req.body, { role: roleRule(true) });
  res.json(await teamsService.changeMemberRole(req.user.id, teamId, userId, role));
});

teamsRouter.delete('/:teamId/members/:userId', async (req, res) => {
  const teamId = uuidParam(req.params.teamId, 'teamId');
  const userId = uuidParam(req.params.userId, 'userId');
  await teamsService.removeMember(req.user.id, teamId, userId);
  res.status(204).end();
});

teamsRouter.post('/:teamId/leave', async (req, res) => {
  const teamId = uuidParam(req.params.teamId, 'teamId');
  // 본문 없이 오면 Express 5는 req.body가 undefined
  const body = validate(req.body ?? {}, { nextOwnerId: optional(uuidRule) });
  await teamsService.leaveTeam(req.user.id, teamId, body);
  res.status(204).end();
});
