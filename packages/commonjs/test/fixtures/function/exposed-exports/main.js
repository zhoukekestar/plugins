module.exports.foo = 'foo';
addOther(exports);

function addOther(exportObject) {
  exportObject.bar = 'bar';
  exportObject.baz = 'baz';
}
