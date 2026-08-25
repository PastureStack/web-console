import { helper as buildHelper } from '@ember/component/helper';

export function strReplace(params, options) {
 return (params[0]+'').replace(options.match, options.with);
}

export default buildHelper(strReplace);
