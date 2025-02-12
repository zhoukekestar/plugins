export function wrapCode(magicString, uses, moduleName, exportsName) {
  const args = [];
  const passedArgs = [];
  if (uses.module) {
    args.push('module');
    passedArgs.push(moduleName);
  }
  if (uses.exports) {
    args.push('exports');
    passedArgs.push(exportsName);
  }
  magicString
    .trim()
    .prepend(`(function (${args.join(', ')}) {\n`)
    .append(`\n}(${passedArgs.join(', ')}));`);
}

export function rewriteExportsAndGetExportsBlock(
  magicString,
  moduleName,
  exportsName,
  wrapped,
  moduleExportsAssignments,
  firstTopLevelModuleExportsAssignment,
  exportsAssignmentsByName,
  topLevelAssignments,
  defineCompiledEsmExpressions,
  deconflictedExportNames,
  code,
  HELPERS_NAME,
  exportMode,
  detectWrappedDefault,
  defaultIsModuleExports,
  id,
  moduleAccessScopes
) {
  const exports = [];
  const exportDeclarations = [];

  if (exportMode === 'replace') {
    getExportsForReplacedModuleExports(
      magicString,
      exports,
      exportDeclarations,
      moduleExportsAssignments,
      firstTopLevelModuleExportsAssignment,
      exportsName,
      id,
      moduleAccessScopes
    );
  } else {
    exports.push(`${exportsName} as __moduleExports`);
    if (wrapped) {
      getExportsWhenWrapping(
        exportDeclarations,
        exportsName,
        detectWrappedDefault,
        HELPERS_NAME,
        defaultIsModuleExports,
        id,
        moduleAccessScopes
      );
    } else {
      getExports(
        magicString,
        exports,
        exportDeclarations,
        moduleExportsAssignments,
        exportsAssignmentsByName,
        deconflictedExportNames,
        topLevelAssignments,
        moduleName,
        exportsName,
        defineCompiledEsmExpressions,
        HELPERS_NAME,
        defaultIsModuleExports,
        id,
        moduleAccessScopes
      );
    }
  }
  if (exports.length) {
    exportDeclarations.push(`export { ${exports.join(', ')} };`);
  }

  return `\n\n${exportDeclarations.join('\n')}`;
}

function getExportsForReplacedModuleExports(
  magicString,
  exports,
  exportDeclarations,
  moduleExportsAssignments,
  firstTopLevelModuleExportsAssignment,
  exportsName,
  id,
  moduleAccessScopes
) {
  for (const { left } of moduleExportsAssignments) {
    magicString.overwrite(left.start, left.end, exportsName);
  }
  magicString.prependRight(firstTopLevelModuleExportsAssignment.left.start, 'var ');
  exports.push(`${exportsName} as __moduleExports`);
  exportDeclarations.push(`export default ${exportsName};`);

  if (global.rollupPluginCommonJsGenerateExportsHook) {
    global.rollupPluginCommonJsGenerateExportsHook({
      exportDeclarations,
      defaultName: exportsName,
      id,
      moduleAccessScopes
    });
  }
}

function getExportsWhenWrapping(
  exportDeclarations,
  exportsName,
  detectWrappedDefault,
  HELPERS_NAME,
  defaultIsModuleExports,
  id,
  moduleAccessScopes
) {
  const defaultName =
    detectWrappedDefault && defaultIsModuleExports === 'auto'
      ? `/*@__PURE__*/${HELPERS_NAME}.getDefaultExportFromCjs(${exportsName})`
      : defaultIsModuleExports === false
      ? `${exportsName}.default`
      : exportsName;

  exportDeclarations.push(`export default ${defaultName};`);

  if (global.rollupPluginCommonJsGenerateExportsHook) {
    global.rollupPluginCommonJsGenerateExportsHook({
      exportDeclarations,
      defaultName,
      id,
      moduleAccessScopes
    });
  }
}

function getExports(
  magicString,
  exports,
  exportDeclarations,
  moduleExportsAssignments,
  exportsAssignmentsByName,
  deconflictedExportNames,
  topLevelAssignments,
  moduleName,
  exportsName,
  defineCompiledEsmExpressions,
  HELPERS_NAME,
  defaultIsModuleExports,
  id,
  moduleAccessScopes
) {
  let deconflictedDefaultExportName;
  // Collect and rewrite module.exports assignments
  for (const { left } of moduleExportsAssignments) {
    magicString.overwrite(left.start, left.end, `${moduleName}.exports`);
  }

  // Collect and rewrite named exports
  for (const [exportName, { nodes }] of exportsAssignmentsByName) {
    const deconflicted = deconflictedExportNames[exportName];
    let needsDeclaration = true;
    for (const node of nodes) {
      let replacement = `${deconflicted} = ${exportsName}.${exportName}`;
      if (needsDeclaration && topLevelAssignments.has(node)) {
        replacement = `var ${replacement}`;
        needsDeclaration = false;
      }
      magicString.overwrite(node.start, node.left.end, replacement);
    }
    if (needsDeclaration) {
      magicString.prepend(`var ${deconflicted};\n`);
    }

    if (exportName === 'default') {
      deconflictedDefaultExportName = deconflicted;
    } else {
      exports.push(exportName === deconflicted ? exportName : `${deconflicted} as ${exportName}`);
    }
  }

  // Collect and rewrite exports.__esModule assignments
  let isRestorableCompiledEsm = false;
  for (const expression of defineCompiledEsmExpressions) {
    isRestorableCompiledEsm = true;
    const moduleExportsExpression =
      expression.type === 'CallExpression' ? expression.arguments[0] : expression.left.object;
    magicString.overwrite(moduleExportsExpression.start, moduleExportsExpression.end, exportsName);
  }

  if (!isRestorableCompiledEsm || defaultIsModuleExports === true) {
    exportDeclarations.push(`export default ${exportsName};`);

    if (global.rollupPluginCommonJsGenerateExportsHook) {
      global.rollupPluginCommonJsGenerateExportsHook({
        exportDeclarations,
        defaultName: exportsName,
        id,
        exportsAssignmentsByName,
        moduleAccessScopes
      });
    }
  } else if (moduleExportsAssignments.length === 0 || defaultIsModuleExports === false) {
    exports.push(`${deconflictedDefaultExportName || exportsName} as default`);

    if (global.rollupPluginCommonJsGenerateExportsHook) {
      global.rollupPluginCommonJsGenerateExportsHook({
        exportDeclarations,
        defaultName: deconflictedDefaultExportName || exportsName,
        id,
        exportsAssignmentsByName,
        moduleAccessScopes
      });
    }
  } else {
    exportDeclarations.push(
      `export default /*@__PURE__*/${HELPERS_NAME}.getDefaultExportFromCjs(${exportsName});`
    );

    if (global.rollupPluginCommonJsGenerateExportsHook) {
      global.rollupPluginCommonJsGenerateExportsHook({
        exportDeclarations,
        defaultName: `${HELPERS_NAME}.getDefaultExportFromCjs(${exportsName})`,
        id,
        exportsAssignmentsByName,
        moduleAccessScopes
      });
    }
  }
}
