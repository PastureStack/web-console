import { alias } from '@ember/object/computed';
import Controller from '@ember/controller';

export default Controller.extend({
  rules: alias('model.lbConfig.portRules'),
});
