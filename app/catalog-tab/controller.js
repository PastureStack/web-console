import Controller from '@ember/controller';

export default Controller.extend({
  queryParams: ['category', 'catalogId','templateBase'],
  category: 'all',
  templateBase: '',
  catalogId: 'all'
});
