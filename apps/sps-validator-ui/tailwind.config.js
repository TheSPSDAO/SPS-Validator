const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const withMT = require('@material-tailwind/react/utils/withMT');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = withMT({
    content: [join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'), ...createGlobPatternsForDependencies(__dirname)],
    theme: {
        extend: {},
    },
    plugins: [],
});
