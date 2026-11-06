import i18n from '@/shared/i18n'

// 기본 카테고리는 서버가 '기본'으로 만들고 이름 변경이 막혀 있으며 이름이 소유자별 유일하다. 할일·이력의 카테고리 ref에는 isDefault가 없어 이름으로 판별한다
const DEFAULT_CATEGORY_NAME = '기본'

export const categoryName = (name: string) => (name === DEFAULT_CATEGORY_NAME ? i18n.t('category.default') : name)
