import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match the library's generic arity to merge
  interface TableMeta<_TData> {
    onScreenshotCaptured?: (domain: string, path: string) => void;
  }
}
