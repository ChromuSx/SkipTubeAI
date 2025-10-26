// rollup.config.popup.js - Build configuration for popup script
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/popup/popup-main.js',
  output: {
    file: 'dist/popup-bundle.js',
    format: 'iife',
    name: 'PopupScript',
    sourcemap: false
  },
  plugins: [
    resolve({
      browser: true
    }),
    commonjs({
      ignoreDynamicRequires: true
    }),
    // Minify only in production
    process.env.NODE_ENV === 'production' && terser({
      format: {
        comments: false
      },
      compress: {
        drop_console: false // Keep console logs for debugging
      }
    }),
    copy({
      targets: [
        // HTML files
        { src: 'src/popup/popup.html', dest: 'dist' },
        { src: 'src/cache-viewer/cache-viewer.html', dest: 'dist' },
        { src: 'src/help/help.html', dest: 'dist' },
        { src: 'src/help/help.js', dest: 'dist' },
        // Manifest and assets
        { src: 'src/manifest.json', dest: 'dist' },
        { src: 'src/icons', dest: 'dist' },
        { src: 'src/logo.png', dest: 'dist' }
      ],
      hook: 'writeBundle'
    })
  ].filter(Boolean)
};
