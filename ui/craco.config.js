const CracoEsbuildPlugin = require("craco-esbuild");
const { DefinePlugin } = require("webpack");

const define = {};
for (const k of ["VALIDATOR_API_URL", "VALIDATOR_PREFIX"]) {
    define[`process.env.${k}`] = JSON.stringify(process.env[k]);
}

module.exports = {
    webpack: {
        plugins: [new DefinePlugin(define)],
    },
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
