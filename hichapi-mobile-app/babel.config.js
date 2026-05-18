module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
            '@screens': './screens',
            '@components': './components',
            '@services': './services',
            '@hooks': './hooks',
            '@contexts': './contexts',
            '@navigation': './navigation',
            '@types': './types',
            '@utils': './utils',
            '@config': './config',
          },
          extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.ts', '.tsx', '.json'],
        },
      ],
    ],
  };
};
