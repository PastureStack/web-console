import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { setupContext, teardownContext } from '@ember/test-helpers';
import { module, test } from 'qunit';

import CattleTransitioningResource from 'ui/mixins/cattle-transitioning-resource';
import ScaleService from 'ui/models/scaleservice';
import ScaleHost from 'ui/models/scalehost';
import { initialize as initializeResource } from 'ui/initializers/extend-resource';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import resolver from '../../helpers/resolver';

const visibleLabels = {
  receiver: {name: 'generic.name', driver: 'newReceiver.driver.label'},
  scaleService: {
    action: 'newReceiver.action.label', serviceId: 'newReceiver.service.label',
    amount: 'newReceiver.amount.label', min: 'newReceiver.min.label', max: 'newReceiver.max.label',
  },
  scaleHost: {
    action: 'newReceiver.action.label', hostSelector: 'newReceiver.hostSelector.label',
    amount: 'newReceiver.amount.label', min: 'newReceiver.min.label', max: 'newReceiver.max.label',
    deleteOption: 'newReceiver.deleteOption.label',
  },
  serviceUpgrade: {
    payloadFormat: 'newReceiver.payloadFormat.label', addressType: 'newReceiver.addressType.label',
    tag: 'newReceiver.tag.label', serviceSelector: 'newReceiver.serviceSelector.label',
    batchSize: 'formUpgrade.size', intervalMillis: 'formUpgrade.interval', startFirst: 'formUpgrade.behavior',
  },
};

function expectedLabel(intl, type, key) {
  let modelKey = `model.${type}.${key}`;
  if (intl.exists(`${modelKey}.label`)) {
    return intl.t(`${modelKey}.label`);
  }
  if (intl.exists(modelKey)) {
    return intl.t(modelKey);
  }
  return intl.t(visibleLabels[type][key]);
}

module('Unit | Mixin | cattle transitioning resource validation | receiver labels', function(hooks) {
  hooks.beforeEach(async function() {
    await setupContext(this, {resolver});
    initializeIntl(this.owner);
    initializeResource();
    this.intl = this.owner.lookup('service:intl');
    this.subjects = [];
    for (let locale of ['en-us', 'zh-tw']) {
      let response = await fetch(`/translations/${locale}.json`);
      if (!response.ok) {
        throw new Error(`Local translation fixture failed: ${locale} ${response.status}`);
      }
      this.intl.addTranslations(locale, await response.json());
    }
    this.intl.setLocale(['en-us']);
    this.subject = (type, fields, values = {}, Factory) => {
      let Subject = Factory || EmberObject.extend(CattleTransitioningResource);
      let subject = Subject.extend({trimValues() {}}).create({
        type, ...values, intl: this.intl,
        store: EmberObject.create({
          getById(schemaType, schemaId) {
            return schemaType === 'schema' && schemaId === type.toLowerCase() ? {resourceFields: fields} : null;
          },
        }),
      });
      this.subjects.push(subject);
      return subject;
    };
  });

  hooks.afterEach(async function() {
    run(() => this.subjects.forEach((subject) => subject.destroy()));
    await teardownContext(this);
  });

  test('the actual empty Receiver and target-service errors follow en to zh-tw to en', function(assert) {
    let config = this.subject('scaleService', {serviceId: {type: 'string', required: true}}, {serviceId: ''});
    let receiver = this.subject('receiver', {
      name: {type: 'string', required: true}, scaleServiceConfig: {type: 'scaleService'},
    }, {name: '', scaleServiceConfig: config});

    assert.deepEqual(receiver.validationErrors(), ['"Name" is required', '"Target Service" is required']);
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    assert.deepEqual(receiver.validationErrors(), ['"名稱" 必須設定', '"目標服務" 必須設定']);
    run(() => this.intl.setLocale(['en-us']));
    assert.deepEqual(receiver.validationErrors(), ['"Name" is required', '"Target Service" is required']);
  });

  test('all three nested driver scopes reuse their own visible required-field labels', function(assert) {
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    for (let type of ['scaleService', 'scaleHost', 'serviceUpgrade']) {
      let labels = visibleLabels[type];
      let fields = Object.fromEntries(Object.keys(labels).map((key) => [key, {type: 'string', required: true}]));
      let config = this.subject(type, fields);
      let receiver = this.subject('receiver', {[`${type}Config`]: {type}}, {[`${type}Config`]: config});
      assert.deepEqual(receiver.validationErrors(), Object.keys(labels).map((key) =>
        this.intl.t('validation.required', {key: expectedLabel(this.intl, type, key)})), `${type} labels remain scoped to that embedded schema`);
    }
    let receiver = this.subject('receiver', {driver: {type: 'enum', required: true}});
    assert.deepEqual(receiver.validationErrors(), ['"類型" 必須設定']);
  });

  test('scale numeric errors use By, Minimum Scale and Maximum Scale in each selected locale', function(assert) {
    for (let locale of ['en-us', 'zh-tw']) {
      run(() => this.intl.setLocale([locale, 'en-us']));
      for (let type of ['scaleService', 'scaleHost']) {
        let fields = {amount: {type: 'int', min: 1}, min: {type: 'int', min: 1}, max: {type: 'int', min: 1}};
        let subject = this.subject(type, fields, {amount: -1, min: -1, max: -1});
        assert.deepEqual(subject.validationErrors(), ['amount', 'min', 'max'].map((key) =>
          this.intl.t('validation.number.min', {key: expectedLabel(this.intl, type, key), val: 1})), `${locale} ${type}`);
      }
    }
  });

  test('upgrade numeric errors match the formUpgrade labels actually displayed by its template', function(assert) {
    let config = this.subject('serviceUpgrade', {batchSize: {type: 'int', min: 1}, intervalMillis: {type: 'int', min: 1}},
      {batchSize: -1, intervalMillis: -1});
    assert.deepEqual(config.validationErrors(), ['"Batch Size" should be at least 1', '"Batch Interval" should be at least 1']);
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    assert.deepEqual(config.validationErrors(), ['"批次大小" 必須至少為 1', '"批次間隔" 必須至少為 1']);
  });

  test('the real scale model min-greater-than-max checks are localized without changing their boundaries', function(assert) {
    for (let [type, Factory] of [['scaleService', ScaleService], ['scaleHost', ScaleHost]]) {
      let subject = this.subject(type, {min: {type: 'int'}, max: {type: 'int'}}, {min: 3, max: 2}, Factory);
      run(() => this.intl.setLocale(['en-us']));
      assert.deepEqual(subject.validationErrors(), ['"Minimum Scale" should be at most 2'], `${type} English`);
      run(() => this.intl.setLocale(['zh-tw', 'en-us']));
      assert.deepEqual(subject.validationErrors(), ['"最小數量" 必須最多為 2'], `${type} Traditional Chinese`);
      for (let [min, max] of [[2, 2], [1, 2], [null, 2], [3, null]]) {
        subject.setProperties({min, max});
        assert.deepEqual(subject.validationErrors(), [], `${type} unchanged boundary ${min}/${max}`);
      }
    }
  });

  test('model-specific label then direct model translation retain precedence over the form label', function(assert) {
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    this.intl.addTranslations('zh-tw', {
      'model.receiver.name.label': '專用名稱', 'model.receiver.driver': '專用類型',
      'model.scaleService.serviceId.label': '專用服務',
    });
    let receiver = this.subject('receiver', {name: {type: 'string', required: true}, driver: {type: 'enum', required: true}});
    let config = this.subject('scaleService', {serviceId: {type: 'string', required: true}});
    assert.deepEqual(receiver.validationErrors(), ['"專用名稱" 必須設定', '"專用類型" 必須設定']);
    assert.deepEqual(config.validationErrors(), ['"專用服務" 必須設定']);
  });

  test('unknown fields and same-named fields outside Receiver configs keep the existing English fallback', function(assert) {
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    for (let type of ['receiver', 'scaleService', 'scaleHost', 'serviceUpgrade']) {
      let subject = this.subject(type, {unknownField: {type: 'string', required: true}});
      assert.deepEqual(subject.validationErrors(), ['"Unknown Field" 必須設定'], type);
    }
    let unrelated = this.subject('service', {serviceId: {type: 'string', required: true}});
    assert.deepEqual(unrelated.validationErrors(), ['"Service Id" 必須設定'], 'no global serviceId relabeling');
  });

  test('valid nested inputs retain values, schemas and the same empty-error result', function(assert) {
    for (let locale of ['en-us', 'zh-tw']) {
      run(() => this.intl.setLocale([locale, 'en-us']));
      let config = this.subject('scaleService', {
        serviceId: {type: 'string', required: true}, amount: {type: 'int', min: 1},
      }, {serviceId: 'test-service', amount: 1});
      let receiver = this.subject('receiver', {
        name: {type: 'string', required: true}, scaleServiceConfig: {type: 'scaleService'},
      }, {name: 'test-receiver', scaleServiceConfig: config});
      assert.deepEqual(receiver.validationErrors(), [], locale);
      assert.strictEqual(config.get('serviceId'), 'test-service');
      assert.strictEqual(config.get('amount'), 1);
      assert.strictEqual(receiver.get('name'), 'test-receiver');
    }
  });
});
