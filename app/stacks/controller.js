import Controller from '@ember/controller';
export default Controller.extend({
  which: 'user',
  tags: '',
  queryParams: ['which','tags'],
});
