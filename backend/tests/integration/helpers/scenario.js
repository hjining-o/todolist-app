import { addMember, createTeam, createUser } from './db.js';

// 시나리오 1.3: 마케팅팀(A 소유, B 매니저, C 멤버)과 영업팀(D 소유, C 멤버). C는 두 팀에 속하고 D는 마케팅팀과 무관하다
export async function setupScenario() {
  const [A, B, C, D] = [
    await createUser({ email: 'a@example.com', name: 'A' }),
    await createUser({ email: 'b@example.com', name: 'B' }),
    await createUser({ email: 'c@example.com', name: 'C' }),
    await createUser({ email: 'd@example.com', name: 'D' }),
  ];
  const marketing = await createTeam({ ownerId: A.id, name: '마케팅팀' });
  await addMember({ teamId: marketing.id, userId: B.id, role: 'MANAGER' });
  await addMember({ teamId: marketing.id, userId: C.id });
  const sales = await createTeam({ ownerId: D.id, name: '영업팀' });
  await addMember({ teamId: sales.id, userId: C.id });
  return { A, B, C, D, marketing, sales };
}
