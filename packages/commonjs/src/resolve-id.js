/* eslint-disable no-param-reassign, no-undefined */

import { statSync } from 'fs';
import { dirname, resolve, sep } from 'path';

import {
  DYNAMIC_JSON_PREFIX,
  DYNAMIC_PACKAGES_ID,
  EXPOSED_EXPORTS_PROXY_SUFFIX,
  EXTERNAL_PROXY_SUFFIX,
  getIdFromProxyId,
  getProxyId,
  HELPERS_ID,
  CJS_PROXY_SUFFIX
} from './helpers';

function getCandidatesForExtension(resolved, extension) {
  return [resolved + extension, `${resolved}${sep}index${extension}`];
}

function getCandidates(resolved, extensions) {
  return extensions.reduce(
    (paths, extension) => paths.concat(getCandidatesForExtension(resolved, extension)),
    [resolved]
  );
}

export default function getResolveId(extensions, getExposedExports) {
  function resolveExtensions(importee, importer) {
    // not our problem
    if (importee[0] !== '.' || !importer) return undefined;

    const resolved = resolve(dirname(importer), importee);
    const candidates = getCandidates(resolved, extensions);

    for (let i = 0; i < candidates.length; i += 1) {
      try {
        const stats = statSync(candidates[i]);
        if (stats.isFile()) return { id: candidates[i] };
      } catch (err) {
        /* noop */
      }
    }

    return undefined;
  }

  function resolveId(importee, importer) {
    const isProxyModule = importee.endsWith(CJS_PROXY_SUFFIX);
    if (isProxyModule) {
      importee = getIdFromProxyId(importee, CJS_PROXY_SUFFIX);
    }
    if (importee.startsWith('\0')) {
      if (
        importee.startsWith(HELPERS_ID) ||
        importee === DYNAMIC_PACKAGES_ID ||
        importee.startsWith(DYNAMIC_JSON_PREFIX) ||
        importee.endsWith(EXPOSED_EXPORTS_PROXY_SUFFIX)
      ) {
        return importee;
      }
      if (!isProxyModule) {
        return null;
      }
    }

    if (importer && importer.endsWith(CJS_PROXY_SUFFIX)) {
      importer = getIdFromProxyId(importer, CJS_PROXY_SUFFIX);
    }

    return this.resolve(importee, importer, { skipSelf: true }).then(async (resolved) => {
      if (!resolved) {
        resolved = resolveExtensions(importee, importer);
      }
      if (isProxyModule) {
        if (!resolved) {
          return { id: getProxyId(importee, EXTERNAL_PROXY_SUFFIX), external: false };
        }
        if (resolved.external) {
          resolved.id = getProxyId(resolved.id, EXTERNAL_PROXY_SUFFIX);
          resolved.external = false;
        } else {
          resolved.id = getProxyId(resolved.id, CJS_PROXY_SUFFIX);
        }
        return resolved;
      }
      if (resolved && !importer && (await getExposedExports(resolved.id))) {
        return getProxyId(resolved.id, EXPOSED_EXPORTS_PROXY_SUFFIX);
      }
      return resolved;
    });
  }

  return resolveId;
}
