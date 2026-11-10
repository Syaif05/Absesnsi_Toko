export interface StorageProvider {
  uploadPrivate(path: string, bytes: Uint8Array): Promise<void>;
  getSignedReadUrl(path: string, seconds: number): Promise<string>;
  delete(path: string): Promise<void>;
}
