export interface LocalFileRef {
  id: string;
  file: File;
  name: string;
  relativePath: string;
  size: number;
  lastModified: number;
  type: string;
}

export function toLocalFileRefs(files: FileList | File[], useRelativePath: boolean): LocalFileRef[] {
  return Array.from(files).map((file) => {
    const relativePath = useRelativePath && file.webkitRelativePath ? file.webkitRelativePath : file.name;
    return createLocalFileRef(file, relativePath);
  });
}

export function createLocalFileRef(file: File, relativePath = file.name): LocalFileRef {
  const cleanPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  return {
    id: `${cleanPath}:${file.size}:${file.lastModified}`,
    file,
    name: file.name,
    relativePath: cleanPath,
    size: file.size,
    lastModified: file.lastModified,
    type: file.type,
  };
}

export function dedupeFileRefs(files: LocalFileRef[]): LocalFileRef[] {
  const seen = new Set<string>();
  const result: LocalFileRef[] = [];

  for (const file of files) {
    if (!seen.has(file.id)) {
      seen.add(file.id);
      result.push(file);
    }
  }

  return result;
}
