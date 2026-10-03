import { module, test } from 'qunit';
import { render, find, findAll, fillIn, settled, setupContext, setupRenderingContext, teardownContext } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { run } from '@ember/runloop';
import resolver from '../helpers/resolver';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';

module('Integration | Component | VM boot image', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    initializeIntl(this.owner);
    this.owner.register('service:projects', Service.extend({
      current: EmberObject.create({isWindows: false}),
    }));
    this.owner.register('service:settings', Service.extend({appName: 'PastureStack'}));
    this.intl = this.owner.lookup('service:intl');

    for (let locale of ['en-us', 'zh-tw', 'fr-fr']) {
      let response = await fetch('/translations/' + locale + '.json');

      if (!response.ok) {
        throw new Error('Local translation fixture failed: ' + locale + ' ' + response.status);
      }
      this.intl.addTranslations(locale, await response.json());
    }
    this.intl.setLocale(['en-us']);
    this.changed = (value) => { this.set('selectedImage', value); };
    this.setLabels = () => {};
    await setupRenderingContext(this);
  });

  hooks.afterEach(async function() {
    await teardownContext(this);
    this.testRoot.remove();
  });

  async function renderVm() {
    await render(precompileTemplate('{{form-image isVm=true initialValue="docker:example.test/boot:qa" errors=this.imageErrors changed=this.changed setLabels=this.setLabels}}{{top-errors errors=this.imageErrors}}'));
  }

  test('VM accepts custom boot-image text with no ordinary-container quick picks', async function(assert) {
    await renderVm();
    assert.strictEqual(find('input[type="text"]').value, 'example.test/boot:qa', 'existing image is preserved');
    assert.strictEqual(find('input[type="text"]').placeholder, 'VM boot image');
    assert.strictEqual(findAll('.dropdown-toggle, .dropdown-menu').length, 0, 'no VM quick picks imply that ordinary container images can boot a VM');
    assert.ok(find('.vm-boot-image-help').textContent.includes('/dev/kvm'));

    await fillIn('input[type="text"]', 'registry.example/custom-boot:qa');
    assert.strictEqual(this.selectedImage, 'docker:registry.example/custom-boot:qa', 'arbitrary custom VM images remain accepted');
    await fillIn('input[type="text"]', '');
    assert.deepEqual(this.imageErrors, ['Enter a compatible VM boot image.']);
    assert.ok(this.testRoot.textContent.includes('Enter a compatible VM boot image.'), 'the actual top-errors component displays the required error');
  });

  test('blank VM required copy and guidance react to locale, with English fallback', async function(assert) {
    await renderVm();
    await fillIn('input[type="text"]', '');
    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await settled();
    assert.deepEqual(this.imageErrors, ['請填入相容的 VM 專用開機映像。']);
    assert.strictEqual(find('input[type="text"]').placeholder, 'VM 專用開機映像');
    assert.ok(this.testRoot.textContent.includes('確認目標主機符合映像的虛擬化需求'));

    run(() => this.intl.setLocale(['fr-fr', 'en-us']));
    await settled();
    assert.deepEqual(this.imageErrors, ['Enter a compatible VM boot image.'], 'missing non-primary locale keys use loaded English translations');
    assert.strictEqual(find('input[type="text"]').placeholder, 'VM boot image');
    let help = find('.vm-boot-image-help').textContent;

    for (let capability of ['-m', '-smp', '/image', '/dev/kvm']) {
      assert.ok(help.includes(capability), capability);
    }
    assert.notOk(this.testRoot.textContent.includes('Missing translation'), 'fallback has no missing-key marker');
  });

  test('blank container required copy rerenders on the same form with zh-tw and English fallback', async function(assert) {
    await render(precompileTemplate('{{form-image isVm=false initialValue="docker:example.test/container:qa" errors=this.imageErrors changed=this.changed setLabels=this.setLabels}}{{top-errors errors=this.imageErrors}}'));
    let input = find('input[type="text"]');

    await fillIn('input[type="text"]', '');
    assert.strictEqual(this.selectedImage, null);
    assert.deepEqual(this.imageErrors, ['Image is required']);
    assert.ok(this.testRoot.textContent.includes('Image is required'));
    assert.strictEqual(findAll('.vm-boot-image-help').length, 0, 'no VM guidance is added to the container form');

    run(() => this.intl.setLocale(['zh-tw', 'en-us']));
    await settled();
    assert.strictEqual(find('input[type="text"]'), input, 'the same input remains mounted');
    assert.deepEqual(this.imageErrors, ['請填入容器映像。']);
    assert.ok(this.testRoot.textContent.includes('請填入容器映像。'));

    run(() => this.intl.setLocale(['fr-fr', 'en-us']));
    await settled();
    assert.strictEqual(find('input[type="text"]'), input, 'fallback does not replace the form');
    assert.deepEqual(this.imageErrors, ['Image is required']);
    assert.ok(this.testRoot.textContent.includes('Image is required'));
    assert.strictEqual(this.selectedImage, null, 'locale changes do not substitute an image');
    assert.notOk(this.testRoot.textContent.includes('Missing translation'));
  });
});
