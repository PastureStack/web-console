import { module, test } from 'qunit';
import { isCatalogQuestionAnswerMissing } from 'ui/utils/catalog-question-answer';

module('Unit | Utility | catalog question answer');

test('it rejects only answers that are actually empty', function(assert) {
  assert.true(isCatalogQuestionAnswerMissing(null));
  assert.true(isCatalogQuestionAnswerMissing(undefined));
  assert.true(isCatalogQuestionAnswerMissing(''));
  assert.true(isCatalogQuestionAnswerMissing('   '));
  assert.true(isCatalogQuestionAnswerMissing([]));

  assert.false(isCatalogQuestionAnswerMissing(false), 'false is a valid required enum or boolean answer');
  assert.false(isCatalogQuestionAnswerMissing(0), 'zero is a valid required numeric answer');
  assert.false(isCatalogQuestionAnswerMissing('false'));
  assert.false(isCatalogQuestionAnswerMissing('0'));
  assert.false(isCatalogQuestionAnswerMissing(['value']));
});
