export interface UploadedFile {
  path: string;
  name: string;
  /** Set for files just picked in this session (a blob: URL); absent for files loaded from the database, which need a signed URL to view. */
  previewUrl?: string;
}

export const isImageName = (name: string) => /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(name);

/** Rehydrate a stored storage path into an UploadedFile for editing UIs. */
export const fileFromPath = (path: string): UploadedFile => ({ path, name: path.split("/").pop() ?? path });

/** Paths that were on the record when it was opened for editing, so a save can tell what to delete from storage. */
export const diffRemovedPaths = (original: string[], current: UploadedFile[]) => {
  const currentPaths = new Set(current.map((f) => f.path));
  return original.filter((p) => !currentPaths.has(p));
};
