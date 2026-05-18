/**
 * Mock for react-native/Libraries/BatchedBridge/NativeModules.
 * Provides a minimal object so jest-expo's setup.js can call Object.defineProperty on it.
 */
'use strict';

const NativeModules = {
  AlertManager: {
    alertWithArgs: jest.fn(),
  },
  AsyncLocalStorage: {
    multiGet: jest.fn((keys, callback) => process.nextTick(() => callback(null, []))),
    multiSet: jest.fn((entries, callback) => process.nextTick(() => callback(null))),
    multiRemove: jest.fn((keys, callback) => process.nextTick(() => callback(null))),
    multiMerge: jest.fn((entries, callback) => process.nextTick(() => callback(null))),
    clear: jest.fn((callback) => process.nextTick(() => callback(null))),
    getAllKeys: jest.fn((callback) => process.nextTick(() => callback(null, []))),
  },
  DeviceInfo: {
    getConstants() {
      return {
        Dimensions: {
          window: { fontScale: 1, height: 1334, scale: 2, width: 750 },
          screen: { fontScale: 1, height: 1334, scale: 2, width: 750 },
        },
      };
    },
  },
  ImageLoader: {
    prefetchImage: jest.fn(),
    getSize: jest.fn((uri, success) => process.nextTick(() => success(320, 240))),
  },
  ImageViewManager: {
    prefetchImage: jest.fn(),
    getSize: jest.fn((uri, success) => process.nextTick(() => success(320, 240))),
  },
  KeyboardObserver: {},
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
    getInitialURL: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  LinkingManager: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
    getInitialURL: jest.fn(),
  },
  Networking: {
    sendRequest: jest.fn(),
    abortRequest: jest.fn(),
    clearCookies: jest.fn(),
  },
  PlatformConstants: {
    getConstants() {
      return {
        forceTouchAvailable: false,
        interfaceIdiom: 'phone',
        isTesting: true,
        osVersion: '14.0',
        reactNativeVersion: { major: 0, minor: 76, patch: 5 },
        systemName: 'iOS',
      };
    },
  },
  RCTDeviceEventEmitter: {},
  RCTEventEmitter: {},
  SettingsManager: {
    settings: {},
    setValues: jest.fn(),
    deleteValues: jest.fn(),
  },
  SourceCode: {
    getConstants() {
      return { scriptURL: null };
    },
  },
  StatusBarManager: {
    getHeight: jest.fn(),
    setStyle: jest.fn(),
    setHidden: jest.fn(),
    setNetworkActivityIndicatorVisible: jest.fn(),
    HEIGHT: 20,
  },
  Timing: {
    createTimer: jest.fn(),
    deleteTimer: jest.fn(),
  },
  UIManager: {
    AndroidViewPager: { Commands: {} },
    blur: jest.fn(),
    configureNextLayoutAnimation: jest.fn(),
    createView: jest.fn(),
    dispatchViewManagerCommand: jest.fn(),
    focus: jest.fn(),
    getViewManagerConfig: jest.fn(),
    hasViewManagerConfig: jest.fn(),
    manageChildren: jest.fn(),
    measure: jest.fn(),
    measureInWindow: jest.fn(),
    measureLayout: jest.fn(),
    removeRootView: jest.fn(),
    removeSubviews: jest.fn(),
    replaceExistingNonRootView: jest.fn(),
    setChildren: jest.fn(),
    updateView: jest.fn(),
  },
  WebSocketModule: {
    connect: jest.fn(),
    send: jest.fn(),
    sendBinary: jest.fn(),
    ping: jest.fn(),
    close: jest.fn(),
  },
};

// Support both CommonJS and ES module default import patterns
NativeModules.default = NativeModules;
module.exports = NativeModules;
