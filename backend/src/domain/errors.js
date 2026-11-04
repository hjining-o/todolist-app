// 오류 코드 표(docs/3-user-scenario.md 6.2)
export const ERRORS = {
  VALIDATION_ERROR: { status: 400, message: '입력값을 확인해 주세요.' },
  INVALID_PERIOD: { status: 400, message: '종료 일시는 시작 일시보다 빠를 수 없습니다.' },
  INVALID_SHARE_TEAM: { status: 400, message: '속한 팀에만 공유할 수 있습니다.' },
  INVALID_OWNER: { status: 400, message: '선택한 팀의 구성원만 소유자로 지정할 수 있습니다.' },
  WRONG_PASSWORD: { status: 400, message: '현재 비밀번호가 올바르지 않습니다.' },
  UNAUTHENTICATED: { status: 401, message: '로그인이 필요합니다.' },
  INVALID_CREDENTIALS: { status: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
  FORBIDDEN: { status: 403, message: '권한이 없습니다.' },
  DEFAULT_CATEGORY_PROTECTED: { status: 403, message: '기본 카테고리는 삭제하거나 이름을 바꿀 수 없습니다.' },
  NOT_FOUND: { status: 404, message: '찾을 수 없습니다.' },
  USER_NOT_FOUND: { status: 404, message: '가입되지 않은 이메일입니다.' },
  EMAIL_TAKEN: { status: 409, message: '이미 가입된 이메일입니다.' },
  CATEGORY_NAME_TAKEN: { status: 409, message: '같은 이름의 카테고리가 있습니다.' },
  TEAM_NAME_TAKEN: { status: 409, message: '같은 이름의 팀이 있습니다.' },
  ALREADY_MEMBER: { status: 409, message: '이미 팀 구성원입니다.' },
  OWNER_MUST_TRANSFER: { status: 409, message: '다음 소유자를 지정한 뒤 나갈 수 있습니다.' },
  NO_NEXT_OWNER: { status: 409, message: '다음 소유자로 지정할 구성원이 없습니다.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: '요청이 너무 큽니다.' },
  INTERNAL_ERROR: { status: 500, message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
};

export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  static of(code, fields) {
    return new AppError(ERRORS[code].status, code, ERRORS[code].message, fields);
  }
}
