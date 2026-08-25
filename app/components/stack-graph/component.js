import { observer } from '@ember/object';
import $ from 'jquery';
import { later, once, throttle } from '@ember/runloop';
import { service } from '@ember/service';
import Component from '@ember/component';
import * as d3 from 'd3';
import * as dagreD3 from 'dagre-d3-es';
import Util from 'ui/utils/util';
import ThrottledResize from 'ui/mixins/throttled-resize';
import { activeIcon } from 'ui/models/service';

export default Component.extend(ThrottledResize, {
  classNames: ['stack-graph'],
  tooltipService: service('tooltip'),
  graphZoom: null,
  graphInner: null,
  graphOuter: null,
  graphRender: null,
  graph: null,
  stackId: null,

  didInsertElement: function() {
    this._super();
    this.bootstrap();
  },

  bootstrap: function() {
    var elem = $('<div id="stack-svg"><svg style="width: 100%; height: 100%;"><g/></svg></div>').appendTo('BODY');
    this.set('graphElem', elem[0]);
    this.set('stackId', this.get('model.stack.id'));

    if (this.get('model.stack.services.length')) {
      later(this,'initGraph',100);
    } else {
      this.sendAction('setNoServices', true);
    }
  },


  click: function(evt) {
    if ($(evt.target).hasClass('icon-x')) {
      this.styleSvg();
    }
  },

  onResize: function() {
    $('#stack-svg').css('top', $('MAIN').position().top + 55 + 'px');
    $('#stack-svg').css('bottom', $('FOOTER').outerHeight() + 'px');
    if ( this.get('graph') )
    {
      this.renderGraph();
    }
  },

  initGraph: function() {
    var outer = d3.select("#stack-svg svg");  // SVG must be lowercase!   This is case sensitive in not-Chrome
    var inner = outer.select("g");
    var zoom = d3.zoom().on("zoom", function(event) {
       inner.attr("transform", event.transform);
    });

    outer.call(zoom);

    var g = new dagreD3.graphlib.Graph().setGraph({
      rankdir: "TB",
      nodesep: 50,
      ranksep: 50,
      marginx: 30,
      marginy: 30
    }).setDefaultEdgeLabel(function() {
      return {};
    });

    var render = new dagreD3.render();

    this.setProperties({
      graphZoom: zoom,
      graphOuter: outer,
      graphInner: inner,
      graphRender: render,
      graph: g
    });

    this.updateGraph();
    $(outer[0]).on('click', (event) => {
      if ( this.isDestroyed || this.isDestroying ) {
        return;
      }

      var fo = $(event.target).closest('foreignObject');

      if ( fo )
      {
        if ( this.get('currentFO') ) {
          this.get('currentFO').find('>div').removeClass('highlighted');

          this.set('prevFO', this.get('currentFO'));

          this.set('currentFO', fo);

          fo.find('>div').addClass('highlighted');

        } else {
          this.set('currentFO', fo);

          fo.find('>div').addClass('highlighted');

        }


        var serviceId = $('span[data-service]', fo).data('service');

        if ( serviceId )
        {
          this.showService(serviceId);
          return;
        }
      }

      this.showService(null);

      this.setProperties({
        currentFO: null,
        prevFO: null,
      });

    });
  },

  styleSvg: function(height='100%') {
    $('#stack-svg svg').css('height', height);
  },

  showService: function(id) {
    let svgHeight;
    if ( id ) {
        svgHeight = $('#stack-svg').height() - 260; // svg minus the height of info service-addtl-info.scss
        this.styleSvg(`${svgHeight}px`);

        if (!this.get('model.showServiceInfo')) {
          this.zoomAndScale(1.5);
        }

        this.set('model.showServiceInfo', true);
        this.set('model.selectedService', this.get('model.stack.services').findBy('id', id));
    } else {
      svgHeight = $('#stack-svg').height() - 0; // svg minus the height of info service-addtl-info.scss
      this.styleSvg(svgHeight);

      if (this.get('model.showServiceInfo')) {
        this.zoomAndScale(2);
      }

      this.set('model.showServiceInfo', null);
    }
  },

  crosslinkServices: function() {
    // Add services that are cross-linked from another stack
    var out = [];

    this.get('model.stack.services').forEach((service) => {
      var externals = (service.get('consumedServicesWithNames')||[]).filter((linked) => {
        return linked.get('service.stackId') !== this.get('model.stack.id');
      }).map((linked) => { return linked.get('service'); });
      out.pushObjects(externals);
    });

    return out;
  }.property('model.stack.services.@each.consumedServicesWithNames'),

  updateGraph: function() {
    var g = this.get('graph');
    var services = this.get('model.stack.services');
    var unremovedServices = services.filter(function(service) {
      return ['removed','purging','purged'].indexOf(service.get('state')) === -1;
    });

    var unexpectedNodes = g.nodes();
    var unexpectedEdges = g.edges();

    var expectedServices = unremovedServices.slice();
    expectedServices.pushObjects(this.get('crosslinkServices'));

    expectedServices.filter(service => !service.get('arbitraryString')).forEach((service) => {
      var serviceId = service.get('id');
      var instances = service.get('instances.length')||'No';
      var color = service.get('stateColor').replace('text-','');
      var isCrossLink = service.get('stackId') !== this.get('model.stack.id');

      var stackName = '';
      if ( isCrossLink )
      {
        stackName = service.get('displayStack') + '/';
      }

      var html = `<span data-service="${service.get('id')}"></span><i class="icon  ${activeIcon(service)}"></i>
                  <h4 class="clip stack-graph-tooltip">${stackName}${Util.escapeHtml(service.get('displayName'))}</h4>
                  <h6 class="count"><b>${instances}</b> container${(instances === 1 ? '' : 's')}</h6>
                  <h6><span class="state ${color}">${Util.escapeHtml(service.get('displayState'))}</span></h6>`;

      g.setNode(serviceId, {
        labelType: "html",
        label: html,
        padding: 0,
        class: color + (isCrossLink ? ' crosslink' : ''),
      });

      unexpectedNodes.removeObject(serviceId);
    });

    unremovedServices.forEach(function(service) {
      var serviceId = service.get('id');
      (service.get('consumedServicesWithNames')||[]).filter(map => !map.get('service.arbitraryString')).map(function(map) {
        var target = map.get('service');
        var targetId = target.get('id');
        var color = target.get('stateColor').replace('text-','');
        var markerColor = color+'-fill';

        var edgeOpts = {
          arrowhead: 'vee',
          arrowheadClass: markerColor,
          curve: d3.curveBundle.beta(1),
          class: color,
        };

        var mapName = map.get('name');
        if ( mapName && mapName !== target.get('name') )
        {
          edgeOpts.label = mapName;
        }

        g.setEdge(serviceId, targetId, edgeOpts);

        var existing = unexpectedEdges.filter(function(edge) {
          return edge.v === serviceId && edge.w === targetId;
        });
        unexpectedEdges.removeObjects(existing);
      });
    });

    // Remove nodes & edges that shouldn't be there anymore
    unexpectedNodes.forEach(function(node) {
      g.removeNode(node);
    });

    unexpectedEdges.forEach(function(edge) {
      g.removeEdge(edge.v, edge.w);
    });

    this.renderGraph();
  },

  addTooltip: function () {
    let svc = this.get('tooltipService');
    $(".stack-graph-tooltip").mouseenter(function (e) {
      let node = $(e.target);
      let out = {
        type: 'tooltip-basic',
        eventPosition: node.offset(),
        originalNode: node,
        model: e.target.textContent,
        template: 'tooltip-static',
      };
      svc.set('tooltipOpts', out);
    });
    $(".stack-graph-tooltip").mouseleave(function () {
      svc.leave();
    });
  },

  zoomAndScale: function(scaleFactor=2.0) {
    var zoom = this.get('graphZoom');
    var outer = this.get('graphOuter');
    var g = this.get('graph');

    // Zoom and scale to fit
    var graphWidth = g.graph().width;
    var graphHeight = g.graph().height;
    var width = $('#stack-svg svg').width();
    var height = $('#stack-svg svg').height();
    var zoomScale = Math.min(scaleFactor, Math.min(width / graphWidth, height / graphHeight));
    var translate = [(width/2) - ((graphWidth*zoomScale)/2), (height/2) - ((graphHeight*zoomScale)/2)];
    var transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(zoomScale);
    outer.call(zoom.transform, transform);
  },

  renderGraph: function() {
    var render = this.get('graphRender');
    var inner = this.get('graphInner');
    var g = this.get('graph');

    inner.call(render, g);

    this.zoomAndScale();

    // Overflow the foreignObjects
    $(this.get('graphElem').getElementsByTagName('foreignObject')).css('overflow','visible');
    this.addTooltip();
  },

  stackIdObserver: observer('model.stack.id', function() {
    if (this.get('model.stack.id') !== this.get('stackId')) {
      this.tearDown();
      once(() => {
        this.sendAction('setNoServices', false);
      });
      later(this,'bootstrap',100);
    }
  }),

  throttledUpdateGraph: function() {
    if (this.get('model.stack.id') === this.get('stackId')) {
      throttle(this,'updateGraph',250);
    }
  }.observes('model.stack.services.@each.{id,name,displayState,consumedServicesWithNames}','crosslinkServices.@each.{id,name,displayState,displayStack}'),

  willDestroyElement: function() {
    this._super();
    this.sendAction('setNoServices', false);
    this.tearDown();
  },
  tearDown: function() {
    var elem = this.get('graphElem');
    if ( elem )
    {
      $(elem).remove();
    }
  },
});
