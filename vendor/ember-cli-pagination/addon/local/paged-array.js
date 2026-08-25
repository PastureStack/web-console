import { A } from '@ember/array';
import { computed, observer } from '@ember/object';
import Evented from '@ember/object/evented';
import ArrayProxy from '@ember/array/proxy';
import Util from 'ember-cli-pagination/util';
import DivideIntoPages from 'ember-cli-pagination/divide-into-pages';
import LockToRange from 'ember-cli-pagination/watch/lock-to-range';

export default ArrayProxy.extend(Evented, {
  page: 1,
  perPage: 10,

  divideObj: function() {
    return DivideIntoPages.create({
      perPage: this.get('perPage'),
      all: this.get('content')
    });
  },

  arrangedContent: computed("content.[]", "page", "perPage", function() {
    return this.divideObj().objsForPage(this.get('page'));
  }),

  totalPages: computed("content.[]", "perPage", function() {
    return this.divideObj().totalPages();
  }),

  setPage: function(page) {
    Util.log("setPage " + page);
    return this.set('page', page);
  },

  watchPage: observer('page','totalPages', function() {
    var page = this.get('page');
    var totalPages = this.get('totalPages');

    this.trigger('pageChanged',page);

    if (page < 1 || page > totalPages) {
      this.trigger('invalidPage',{page: page, totalPages: totalPages, array: this});
    }
  }),

  then: function(success,failure) {
    var content = A(this.get('content'));
    var me = this;

    if (content.then) {
      content.then(function() {
        success(me);
      },failure);
    }
    else {
      success(this);
    }
  },

  lockToRange: function() {
    LockToRange.watch(this);
  }
});
