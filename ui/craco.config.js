const CracoEsbuildPlugin = require("craco-esbuild");

module.exports = {
  plugins: [
    {
      plugin: CracoEsbuildPlugin,
      options: {
        esbuildLoaderOptions: {
          loader: "tsx",
          target: "es6",
        },
        esbuildMinimizerOptions: {
          target: "es6",
          css: true,
        },
        skipEsbuildJest: false,
        esbuildJestOptions: {
          loaders: {
            ".ts": "ts",
            ".tsx": "tsx",
          },
        },
      },
    },
  ],
};
