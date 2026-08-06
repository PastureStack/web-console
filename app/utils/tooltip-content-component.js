const TOOLTIP_CONTENT_COMPONENTS = Object.freeze({
  'tooltip-action-menu': 'tooltip-content-action-menu',
  'tooltip-basic': 'tooltip-content-basic',
  'tooltip-basic-literal': 'tooltip-content-basic-literal',
  'tooltip-container-subpod': 'tooltip-content-container-subpod',
  'tooltip-cpu': 'tooltip-content-cpu',
  'tooltip-select-dot': 'tooltip-content-select-dot',
  'tooltip-snapshot-timeline': 'tooltip-content-snapshot-timeline',
  'tooltip-static': 'tooltip-content-static',
  'tooltip-storage': 'tooltip-content-storage'
});

export function resolveTooltipContentComponent(template, fallback = 'tooltip-basic') {
  return TOOLTIP_CONTENT_COMPONENTS[template] ||
    TOOLTIP_CONTENT_COMPONENTS[fallback] ||
    TOOLTIP_CONTENT_COMPONENTS['tooltip-basic'];
}

export { TOOLTIP_CONTENT_COMPONENTS };
