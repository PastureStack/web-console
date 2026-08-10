import { helper } from '@ember/component/helper';
import { createLegacyClosureAction } from 'ui/utils/legacy-template-action';

export default helper(function action([context, actionName, ...curriedArgs], named) {
  return createLegacyClosureAction(context, actionName, curriedArgs, named);
});
