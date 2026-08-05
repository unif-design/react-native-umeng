module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@unif/react-native-umeng$': '<rootDir>/../src/index.ts',
    '^@unif/react-native-umeng/mock$': '<rootDir>/../src/mock.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@unif/react-native-design|@sbaiahmed1/react-native-blur|react-native-(gesture-handler|reanimated|worklets|safe-area-context|svg|reanimated-carousel))/)',
  ],
};
