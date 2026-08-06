export default function linkCurrentWhen(route, additionalRoutes = []) {
  let routes = Array.isArray(additionalRoutes) ? additionalRoutes.slice() : [additionalRoutes];

  if ( route ) {
    routes.push(route);
  }

  return routes.filter(Boolean).join(' ');
}
