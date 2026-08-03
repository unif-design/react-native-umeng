export const nativeMissingInitError = Object.assign(new Error('missing init'), {
  code: 'E_NOT_INITIALIZED',
});

export const nativeVendorError = {
  code: 'VENDOR_42',
  message: '',
};

export const nativeWhitelistedObjectError = {
  code: 'E_SHARE_FAILED',
  message: 'native share failed',
};
