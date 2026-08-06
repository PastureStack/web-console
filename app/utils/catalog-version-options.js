export function catalogVersionOptions(versionLinks, currentOption=null) {
  let links = versionLinks && typeof versionLinks === 'object' ? versionLinks : {};
  let options = Object.keys(links).filter((version) => {
    return version && typeof links[version] === 'string' && links[version].length > 0;
  }).map((version) => {
    return {version: version, link: links[version]};
  });

  if ( currentOption && currentOption.version && currentOption.link ) {
    options.unshift({
      version: currentOption.version,
      link: currentOption.link,
    });
  }

  return options;
}
