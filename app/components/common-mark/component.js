import Component from '@ember/component';

import { computed } from '@ember/object';

export default Component.extend({

  markdown: null,

  cmReader: new commonmark.Parser(),
  cmWriter: new commonmark.HtmlRenderer(),

  parsedMarkdown: computed('markdown', function() {

      var parsed = this.cmReader.parse(this.get('markdown'));

      return this.cmWriter.render(parsed);
  })
});
