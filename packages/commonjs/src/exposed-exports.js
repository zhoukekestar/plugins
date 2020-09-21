export function getExposedExportsHandler(exposedExportsOption) {
  let setResolveForExposedExports;
  const exposedExportsPromise = new Promise((resolve) => {
    const exposedExportsById = Object.create(null);
    setResolveForExposedExports = async (resolveId) => {
      if (exposedExportsOption) {
        await Promise.all(
          Object.keys(exposedExportsOption).map((unresolvedId) =>
            resolveId(unresolvedId, undefined, { skipSelf: true }).then((resolved) => {
              // TODO Lukas handle conflicts
              // TODO Lukas handle unresolved, i.e. `null` return value
              exposedExportsById[resolved.id] = exposedExportsOption[unresolvedId];
            })
          )
        );
      }
      resolve(exposedExportsById);
    };
  });
  return {
    setResolveForExposedExports,
    async getExposedExports(id) {
      const exposedExports = await exposedExportsPromise;
      return exposedExports && exposedExports[id];
    }
  };
}

export function getExposedExportsProxy(id, exposedExports) {
  return `export {${exposedExports.join(', ')}} from ${JSON.stringify(id)};`;
}
