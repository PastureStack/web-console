import { helper as buildHelper } from '@ember/component/helper';

export function dateFromNow(params) {
  return moment(params[0]).fromNow();
}

export default buildHelper(dateFromNow);
