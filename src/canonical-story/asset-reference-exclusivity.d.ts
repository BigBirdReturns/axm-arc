import "./types.js";

declare module "./types.js" {
  interface CanonicalStorySourceRequiredAssetReference {
    /** Source-required assets never carry manifested byte custody. */
    bytes?: never;
    /** Source-required assets never carry a manifested digest. */
    sha256?: never;
  }
}

export {};
