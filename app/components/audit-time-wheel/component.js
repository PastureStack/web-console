import Component from '@ember/component';
import { scheduleOnce } from '@ember/runloop';

export const TIME_WHEEL_ROW_HEIGHT = 36;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function timeWheelCycleCount(optionCount) {
  if (!optionCount) {
    return 0;
  }

  let cycles = Math.max(3, Math.ceil(120 / optionCount));

  return cycles % 2 === 0 ? cycles + 1 : cycles;
}

export function timeWheelLogicalIndex(physicalIndex, optionCount) {
  if (!optionCount) {
    return -1;
  }

  return ((physicalIndex % optionCount) + optionCount) % optionCount;
}

export function repeatTimeWheelOptions(options, selectedValue) {
  let source = options || [];
  let cycles = timeWheelCycleCount(source.length);
  let middleCycle = Math.floor(cycles / 2);
  let repeated = [];

  for (let cycle = 0; cycle < cycles; cycle++) {
    source.forEach((option, logicalIndex) => {
      repeated.push({
        accessible: cycle === middleCycle,
        index   : (cycle * source.length) + logicalIndex,
        label   : option.label,
        selected: cycle === middleCycle && option.value === selectedValue,
        value   : option.value,
      });
    });
  }

  return repeated;
}

export default Component.extend({
  classNames: ['audit-time-column'],

  ariaLabel   : null,
  dataTestId  : null,
  label       : null,
  onChange    : null,
  options     : null,
  selectedValue: null,

  repeatedOptions: function() {
    return repeatTimeWheelOptions(this.get('options'), this.get('selectedValue'));
  }.property('options.[]', 'selectedValue'),

  didInsertElement() {
    this._super(...arguments);
    this._viewport = this.element.querySelector('.audit-time-column-viewport');
    this._boundWheel = this.handleWheel.bind(this);
    this._boundScroll = this.handleScroll.bind(this);
    this._boundKeyDown = this.handleKeyDown.bind(this);
    this._boundClick = this.handleClick.bind(this);
    this._viewport.addEventListener('wheel', this._boundWheel, { passive: false });
    this._viewport.addEventListener('scroll', this._boundScroll, { passive: true });
    this._viewport.addEventListener('keydown', this._boundKeyDown);
    this._viewport.addEventListener('click', this._boundClick);
    scheduleOnce('afterRender', this, this.syncToSelected);
  },

  didUpdateAttrs() {
    this._super(...arguments);
    scheduleOnce('afterRender', this, this.syncToSelected);
  },

  willDestroyElement() {
    this.cancelMotion();
    if (this._viewport) {
      this._viewport.removeEventListener('wheel', this._boundWheel);
      this._viewport.removeEventListener('scroll', this._boundScroll);
      this._viewport.removeEventListener('keydown', this._boundKeyDown);
      this._viewport.removeEventListener('click', this._boundClick);
    }
    this._super(...arguments);
  },

  cancelMotion() {
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    if (this._settleTimer) {
      clearTimeout(this._settleTimer);
      this._settleTimer = null;
    }
    this._lastFrameAt = null;
  },

  syncToSelected() {
    if (!this._viewport || this._animationFrame) {
      return;
    }

    let options = this.get('options') || [];
    let logicalIndex = options.findIndex((option) => option.value === this.get('selectedValue'));

    if (logicalIndex < 0 || !options.length) {
      return;
    }

    let middleCycle = Math.floor(timeWheelCycleCount(options.length) / 2);

    this.setProgrammaticScrollTop(((middleCycle * options.length) + logicalIndex) * TIME_WHEEL_ROW_HEIGHT);
    this._targetScroll = this._viewport.scrollTop;
    this.renderDepth();
  },

  setProgrammaticScrollTop(value) {
    // Programmatic recentering must be invisible.  Remember the exact target so
    // its native scroll event cannot start a second settle animation.
    this._programmaticScrollTop = value;
    this._viewport.scrollTop = value;
  },

  normalizedWheelTravel(event) {
    let delta = event.deltaY;

    if (event.deltaMode === 1) {
      delta *= TIME_WHEEL_ROW_HEIGHT;
    } else if (event.deltaMode === 2) {
      delta *= TIME_WHEEL_ROW_HEIGHT * 4;
    }

    if (Math.abs(delta) >= 40) {
      return Math.sign(delta) * TIME_WHEEL_ROW_HEIGHT * clamp(Math.abs(delta) / 100, 1, 3);
    }

    return delta * 0.9;
  },

  handleWheel(event) {
    if (!event.deltaY || event.ctrlKey || event.metaKey) {
      return;
    }

    event.preventDefault();
    let travel = this.normalizedWheelTravel(event);
    let maximum = Math.max(0, (this.get('repeatedOptions.length') - 1) * TIME_WHEEL_ROW_HEIGHT);
    let currentTarget = Number.isFinite(this._targetScroll) ? this._targetScroll : this._viewport.scrollTop;

    this._targetScroll = clamp(currentTarget + travel, 0, maximum);
    this._lastInputAt = performance.now();
    this.startMotion();
  },

  handleScroll() {
    this.renderDepth();

    if (Number.isFinite(this._programmaticScrollTop)) {
      let reachedProgrammaticTarget = Math.abs(this._viewport.scrollTop - this._programmaticScrollTop) < 0.5;

      this._programmaticScrollTop = null;
      if (reachedProgrammaticTarget) {
        return;
      }
    }

    if (this._animationFrame) {
      return;
    }

    clearTimeout(this._settleTimer);
    this._settleTimer = setTimeout(() => {
      this._settleTimer = null;
      this.animateToIndex(Math.round(this._viewport.scrollTop / TIME_WHEEL_ROW_HEIGHT));
    }, 90);
  },

  handleKeyDown(event) {
    let step = ({ ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 })[event.key];

    if (!step) {
      return;
    }

    event.preventDefault();
    let currentIndex = Math.round(this._viewport.scrollTop / TIME_WHEEL_ROW_HEIGHT);

    this.animateToIndex(currentIndex + step);
  },

  handleClick(event) {
    let option = event.target.closest('[data-wheel-index]');

    if (!option || !this.element.contains(option)) {
      return;
    }

    this.animateToIndex(Number(option.getAttribute('data-wheel-index')));
  },

  animateToIndex(index) {
    let maximumIndex = Math.max(0, this.get('repeatedOptions.length') - 1);
    let boundedIndex = clamp(index, 0, maximumIndex);

    this._targetScroll = boundedIndex * TIME_WHEEL_ROW_HEIGHT;
    this._lastInputAt = performance.now() - 100;
    this.startMotion();
  },

  startMotion() {
    if (this._animationFrame) {
      return;
    }

    this.element.classList.add('is-gliding');
    this._lastFrameAt = null;
    this._animationFrame = requestAnimationFrame((timestamp) => this.motionFrame(timestamp));
  },

  motionFrame(timestamp) {
    let idle = timestamp - this._lastInputAt > 72;

    if (idle) {
      this._targetScroll = Math.round(this._targetScroll / TIME_WHEEL_ROW_HEIGHT) * TIME_WHEEL_ROW_HEIGHT;
    }

    let position = this._viewport.scrollTop;
    let distance = this._targetScroll - position;
    let elapsed = this._lastFrameAt === null ? 16.67 : Math.max(1, timestamp - this._lastFrameAt);
    let response = 1 - Math.exp(-elapsed / 82);
    let nextPosition = position + (distance * response);

    this._lastFrameAt = timestamp;
    this._viewport.scrollTop = nextPosition;
    this.renderDepth();

    if (idle && Math.abs(this._targetScroll - nextPosition) < 0.35) {
      this.setProgrammaticScrollTop(this._targetScroll);
      this._animationFrame = null;
      this._lastFrameAt = null;
      this.element.classList.remove('is-gliding');
      this.commitPosition();
      return;
    }

    this._animationFrame = requestAnimationFrame((nextTimestamp) => this.motionFrame(nextTimestamp));
  },

  commitPosition() {
    let options = this.get('options') || [];

    if (!options.length) {
      return;
    }

    let physicalIndex = Math.round(this._viewport.scrollTop / TIME_WHEEL_ROW_HEIGHT);
    let logicalIndex = timeWheelLogicalIndex(physicalIndex, options.length);
    let selected = options[logicalIndex];
    let middleCycle = Math.floor(timeWheelCycleCount(options.length) / 2);

    this.setProgrammaticScrollTop(((middleCycle * options.length) + logicalIndex) * TIME_WHEEL_ROW_HEIGHT);
    this._targetScroll = this._viewport.scrollTop;
    this.renderDepth();

    if (selected.value !== this.get('selectedValue')) {
      let onChange = this.get('onChange');

      if (typeof onChange === 'function') {
        onChange(selected.value);
      }
    }
  },

  renderDepth() {
    if (!this._viewport) {
      return;
    }

    let centerIndex = this._viewport.scrollTop / TIME_WHEEL_ROW_HEIGHT;

    this._viewport.querySelectorAll('[data-wheel-index]').forEach((option) => {
      let distance = Number(option.getAttribute('data-wheel-index')) - centerIndex;
      let magnitude = Math.min(Math.abs(distance), 3);
      let opacity = Math.max(0.22, 1 - (magnitude * 0.24));
      let scale = Math.max(0.86, 1 - (magnitude * 0.045));

      option.style.opacity = opacity.toFixed(3);
      option.style.transform = `perspective(180px) rotateX(${(-distance * 12).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    });
  },
});
