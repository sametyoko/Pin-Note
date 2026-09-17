const pluginPaths = { paths: [__dirname + '/frontend'] };

module.exports = {
  plugins: [
    require.resolve('prettier-plugin-java', pluginPaths),
    require.resolve('@prettier/plugin-xml', pluginPaths),
  ],
  tabWidth: 2,
  useTabs: false,
  printWidth: 100,
  singleQuote: true,
  semi: true,
  trailingComma: 'es5',
  endOfLine: 'lf',
  overrides: [
    { files: '*.java', options: { tabWidth: 4 } },
    { files: '*.xml', options: { tabWidth: 4 } },
  ],
};
