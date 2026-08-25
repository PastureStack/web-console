import { helper as buildHelper } from '@ember/component/helper';
import { get } from '@ember/object';

export function selectProperty(params/*, hash*/) {
  var [objToSelect, property] = params;
  return get(objToSelect, property);
}

export default buildHelper(selectProperty);
