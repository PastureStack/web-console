import { helper as buildHelper } from '@ember/component/helper';

export function lowerCase(params) {
  return (params[0]||'').toLowerCase();
}

export default buildHelper(lowerCase);
