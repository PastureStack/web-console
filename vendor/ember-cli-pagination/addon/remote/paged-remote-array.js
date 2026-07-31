import { once } from '@ember/runloop';
import { computed, observer } from '@ember/object';
import Evented from '@ember/object/evented';
import ArrayProxy from '@ember/array/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';
import Mixin from '@ember/object/mixin';
import Util from 'ember-cli-pagination/util';
import LockToRange from 'ember-cli-pagination/watch/lock-to-range';
import { QueryParamsForBackend, ChangeMeta } from './mapping';
import PageMixin from '../page-mixin';

var ArrayProxyPromiseMixin = Mixin.create(PromiseProxyMixin, {
  then: function(success,failure) {
    var promise = this.get('promise');
    var me = this;

    promise.then(function() {
      success(me);
    }, failure);
  }
});

export default ArrayProxy.extend(PageMixin, Evented, ArrayProxyPromiseMixin, {
  page: 1,
  paramMapping: computed(() => {
    return {};
  }),

  init: function() {
    var initCallback = this.get('initCallback');
    if (initCallback) {
      initCallback(this);
    }

    try {
      this.get('promise');
    }
    catch (e) {
      this.set('promise', this.fetchContent());
    }
  },

  addParamMapping: function(key,mappedKey,mappingFunc) {
    var paramMapping = this.get('paramMapping') || {};
    if (mappingFunc) {
      paramMapping[key] = [mappedKey,mappingFunc];
    }
    else {
      paramMapping[key] = mappedKey;
    }
    this.set('paramMapping',paramMapping);
    this.incrementProperty('paramsForBackendCounter');
    //this.pageChanged();
  },

  addQueryParamMapping: function(key,mappedKey,mappingFunc) {
    return this.addParamMapping(key,mappedKey,mappingFunc);
  },

  addMetaResponseMapping: function(key,mappedKey,mappingFunc) {
    return this.addParamMapping(key,mappedKey,mappingFunc);
  },

  paramsForBackend: computed('page','perPage','paramMapping','paramsForBackendCounter', function() {
    var paramsObj = QueryParamsForBackend.create({page: this.getPage(),
                                                  perPage: this.getPerPage(),
                                                  paramMapping: this.get('paramMapping')});
    var ops = paramsObj.make();

    // take the otherParams hash and add the values at the same level as page/perPage
    ops = Util.mergeHashes(ops,this.get('otherParams')||{});

    return ops;
  }),

  rawFindFromStore: function() {
    var store = this.get('store');
    var modelName = this.get('modelName');

    var ops = this.get('paramsForBackend');
    var res = store.query(modelName, ops);

    return res;
  },

  fetchContent: function() {
    this.set("loading",true);
    var res = this.rawFindFromStore();
    this.incrementProperty("numRemoteCalls");
    var me = this;

    res.then(function(rows) {
      var metaObj = ChangeMeta.create({paramMapping: me.get('paramMapping'),
                                       meta: rows.meta,
                                       page: me.getPage(),
                                       perPage: me.getPerPage()});

      me.set("loading",false);
      return me.set("meta", metaObj.make());

    }, function(error) {
      Util.log("PagedRemoteArray#fetchContent error " + error);
      me.set("loading",false);
    });

    return res;
  },

  totalPagesBinding: "meta.total_pages",

  pageChanged: observer("page", "perPage", function() {
    this.set("promise", this.fetchContent());
  }),

  lockToRange: function() {
    LockToRange.watch(this);
  },

  watchPage: observer('page','totalPages', function() {
    var page = this.get('page');
    var totalPages = this.get('totalPages');
    if (parseInt(totalPages) <= 0) {
      return;
    }

    this.trigger('pageChanged',page);

    if (page < 1 || page > totalPages) {
      this.trigger('invalidPage',{page: page, totalPages: totalPages, array: this});
    }
  }),

  setOtherParam: function(k,v) {
    if (!this.get('otherParams')) {
      this.set('otherParams',{});
    }

    this.get('otherParams')[k] = v;
    this.incrementProperty('paramsForBackendCounter');
    once(this,"pageChanged");
  }
});