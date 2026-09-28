type WasmFs = {
  writeFile: (path: string, data: Uint8Array) => void;
  readFile: (path: string) => Uint8Array;
  unlink: (path: string) => void;
  analyzePath: (path: string, dontResolveLastLink: boolean) => { exists: boolean };
};

type LibreDwgModule = {
  FS: WasmFs;
  dwg_write_dxf: (inputName: string, outputName: string) => number;
};

type CreateLibreDwg = (options?: {
  locateFile?: (filename: string) => string;
}) => Promise<LibreDwgModule>;

const WASM_URL = "/wasm/libredwg/libredwg-web.js";

let modulePromise: Promise<LibreDwgModule> | null = null;
let queue: Promise<unknown> = Promise.resolve();

export async function dwgToDxf(bytes: ArrayBuffer): Promise<string | null> {
  const run = queue.then(() => convertDwg(bytes));
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function convertDwg(bytes: ArrayBuffer): Promise<string | null> {
  const inputName = "upload.dwg";
  const outputName = "upload.dxf";
  try {
    const lib = await loadLibreDwg();
    lib.FS.writeFile(inputName, new Uint8Array(bytes));
    const error = lib.dwg_write_dxf(inputName, outputName);
    if (error !== 0 || !lib.FS.analyzePath(outputName, false).exists) {
      return null;
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      lib.FS.readFile(outputName),
    );
    if (!text.includes("SECTION") || !text.includes("ENTITIES")) {
      return null;
    }
    return text;
  } catch {
    modulePromise = null;
    return null;
  } finally {
    const lib = await modulePromise?.catch(() => null);
    if (lib) {
      unlinkIfPresent(lib, inputName);
      unlinkIfPresent(lib, outputName);
    }
  }
}

function unlinkIfPresent(lib: LibreDwgModule, path: string) {
  if (lib.FS.analyzePath(path, false).exists) {
    lib.FS.unlink(path);
  }
}

async function loadLibreDwg() {
  if (!modulePromise) {
    modulePromise = createLibreDwg().then((create) => create(locateOptions()));
  }
  return modulePromise;
}

function locateOptions() {
  const directory =
    typeof window === "undefined"
      ? `${process.cwd()}/node_modules/@mlightcad/libredwg-web/wasm`
      : "/wasm/libredwg";
  return {
    locateFile: (filename: string) => `${directory}/${filename}`,
  };
}

async function createLibreDwg(): Promise<CreateLibreDwg> {
  if (typeof window === "undefined") {
    const importer = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<{
      default?: CreateLibreDwg;
      pathToFileURL?: (path: string) => URL;
      join?: (...parts: string[]) => string;
    }>;
    const url = await importer("node:url");
    const path = await importer("node:path");
    const href = url.pathToFileURL!(
      path.join!(
        process.cwd(),
        "node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.js",
      ),
    ).href;
    const mod = await importer(href);
    if (!mod.default) {
      throw new Error("LibreDWG module did not load");
    }
    return mod.default;
  }

  const mod = (await import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    WASM_URL
  )) as { default: CreateLibreDwg };
  return mod.default;
}
