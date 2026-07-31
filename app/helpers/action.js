import { helper } from '@ember/component/helper';
import { legacyAction } from 'ui/utils/legacy-action';

export default helper((positional, named) => legacyAction(positional, named));
