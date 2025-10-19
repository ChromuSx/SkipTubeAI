// rollup.config.cache-viewer.js - Rollup configuration for cache viewer bundle

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/cache-viewer/cache-viewer-main.js',
  output: {
    file: 'dist/cache-viewer-bundle.js',
    format: 'iife',
    sourcemap: false
  },
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    copy({
      targets: [
        { src: 'src/cache-viewer/cache-viewer.html', dest: '.' }
      ],
      hook: 'writeBundle'
    })
  ]
};
