import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';

import Service from 'ui/models/service';

module('Unit | Model | service scale');

test('quick scale buttons PUT only the latest scale', async function(assert) {
  const requests = [];
  function makeService(id) {
    return Service.create({
      id,
      type: 'service',
      links: {self: `/v1/services/${id}`},
      scale: 2,
      launchConfig: {imageUuid: 'docker:example', volumeDriver: ''},
      upgrade: {inServiceStrategy: {batchSize: 1}},
      request(options) {
        requests.push({id, method: options.method, url: options.url, data: options.data});
        return resolve(null);
      },
    });
  }
  const scaleUp = makeService('1s-up');
  const scaleDown = makeService('1s-down');

  run(() => {
    scaleUp.send('scaleUp');
    scaleUp.send('scaleUp');
    scaleDown.send('scaleDown');
  });
  await new Promise((resolve) => setTimeout(resolve, 600));

  assert.strictEqual(scaleUp.get('scale'), 4);
  assert.strictEqual(scaleDown.get('scale'), 1);
  assert.deepEqual(requests, [
    {id: '1s-up', method: 'PUT', url: '/v1/services/1s-up', data: {scale: 4}},
    {id: '1s-down', method: 'PUT', url: '/v1/services/1s-down', data: {scale: 1}},
  ], 'both buttons send bounded PUTs, and rapid clicks keep the final scale');
  assert.deepEqual(scaleUp.get('launchConfig'), {imageUuid: 'docker:example', volumeDriver: ''});
  assert.deepEqual(scaleDown.get('upgrade'), {inServiceStrategy: {batchSize: 1}});
  run(() => {
    scaleUp.destroy();
    scaleDown.destroy();
  });
});
