module.exports = {
  description: 'allows specifying exposed exports for-entries',
  pluginOptions: {
    // TODO Lukas also test with default
    exposedExports: {
      'fixtures/function/exposed-exports/main': ['foo', 'bar']
    }
  },
  exports(exports) {
    console.log(exports);
  }
};
