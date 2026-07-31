import $ from 'jquery';
import Controller from '@ember/controller';
import Console from 'ui/mixins/console';

import { on } from '@ember/object/evented';

export default Controller.extend(Console, {

  bootstrap: on('init', function() {
    let body        = $('body');
    let application = $('#application');

    body.css('overflow', 'hidden');

    application.css('padding-bottom', '0');

  }),

});
