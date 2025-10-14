// rollup.config.popup.js - Build configuration for popup script
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/popup/popup-main.js',
  output: {
    file: 'popup-bundle.js',
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
    })
  ].filter(Boolean)
};
