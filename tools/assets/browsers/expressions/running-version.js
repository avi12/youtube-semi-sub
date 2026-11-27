(async () => {
  await (globalThis.browser ?? globalThis.chrome).runtime.getPlatformInfo();
  return globalThis.devtoolBackground?.version ?? null;
})()
