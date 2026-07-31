import { helper as buildHelper } from '@ember/component/helper';

export function upperCase(params) {
  return (params[0]||'').toUpperCase();
}

export default buildHelper(upperCase);
