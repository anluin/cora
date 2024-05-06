import { std } from "./deps/mod.ts";
import { skopeo, SkopeoError } from "./utilities/skopeo.ts";
import { hashString } from "./utils.ts";
import { umoci } from "./utilities/umoci.ts";

export type SetupWorkspaceOptions = {
    dataDirectoryPath?: string,
};

export type Workspace = {
    rootPath: string,
    imagesDirectoryPath: string,
};

export async function setupWorkspace(options?: SetupWorkspaceOptions): Promise<Workspace> {
    // Setup workspace
    const dataDirectoryPath = std.path.resolve(options?.dataDirectoryPath ?? "/var/lib/cora");
    const imagesDirectoryPath = `${ dataDirectoryPath }/images`;
    // const bundlesDirectoryPath = `${ dataDirectoryPath }/bundles`;
    // const containersDirectoryPath = `${ dataDirectoryPath }/containers`;

    await Deno.mkdir(imagesDirectoryPath, { recursive: true });
    // await Deno.mkdir(bundlesDirectoryPath, { recursive: true });
    // await Deno.mkdir(containersDirectoryPath, { recursive: true });

    return {
        rootPath: dataDirectoryPath,
        imagesDirectoryPath,
    };
}

export type StartServerOptions = {
    signal?: AbortSignal,
    workspace: Workspace,
};

export type ImageMeta = {
    name: string,
    nameHash: string,
};

export type ImageManifest = {
    mediaType: string,
    digest: string,
    size: number,
    annotations: {
        "org.opencontainers.image.ref.name": string,
    },
};

export type ImageIndex = {
    schemaVersion: number,
    manifests: Array<ImageManifest> | null,
};

export const fetchImageMeta = async (workspace: Workspace, options: {
    imageName: string,
} | {
    imageNameHash: string,
}): Promise<ImageMeta> => {
    const imageNameHash = (
        "imageNameHash" in options
            ? options.imageNameHash
            : await hashString("SHA-1", options.imageName)
    );

    const indexFilePath = `${ workspace.imagesDirectoryPath }/${ imageNameHash }/cora.json`;
    return await Deno.readTextFile(indexFilePath).then(JSON.parse);
};

export const fetchImageIndex = async (workspace: Workspace, options: {
    imageName: string,
} | {
    imageNameHash: string,
}): Promise<ImageIndex> => {
    const imageNameHash = (
        "imageNameHash" in options
            ? options.imageNameHash
            : await hashString("SHA-1", options.imageName)
    );

    const indexFilePath = `${ workspace.imagesDirectoryPath }/${ imageNameHash }/index.json`;
    return await Deno.readTextFile(indexFilePath).then(JSON.parse);
};

export const fetchImageManifest = async (workspace: Workspace, imageTag: string, options: {
    imageName: string,
} | {
    imageNameHash: string,
}) => {
    const index = await fetchImageIndex(workspace, options);
    return index.manifests?.find(manifest => manifest.annotations["org.opencontainers.image.ref.name"] === imageTag);
};

export async function startServer(options: StartServerOptions) {
    const { workspace } = options;

    const serveWebInterfaceHandler = async (url: URL, request: Request, info: Deno.ServeHandlerInfo) => {
        if (url.pathname !== "/") return;

        switch (request.method) {
            case "GET":
                // TODO: Cache the fetch response or find another solution that is compatible with deno/x
                return await fetch(new URL("../public/index.html", import.meta.url).href);
            default:
                return new Response(undefined, { status: 405 });
        }
    };

    const serveImagesApiHandler = async (url: URL, request: Request, info: Deno.ServeHandlerInfo) => {
        if (url.pathname !== "/images") return;

        switch (request.method) {
            case "GET": {
                const images: (ImageMeta & {
                    tags: {
                        name: string,
                        digest: string,
                        size: number,
                    }[],
                })[] = [];

                for await (const dirEntry of Deno.readDir(workspace.imagesDirectoryPath)) {
                    const meta = await fetchImageMeta(workspace, { imageNameHash: dirEntry.name });

                    if (meta) {
                        const index = await fetchImageIndex(workspace, { imageNameHash: dirEntry.name });

                        images.push({
                            ...meta,
                            tags: index.manifests?.map(
                                (manifest) => ({
                                    name: manifest.annotations["org.opencontainers.image.ref.name"],
                                    digest: manifest.digest,
                                    size: manifest.size,
                                }),
                            ) ?? [],
                        });
                    }
                }

                return new Response(`${ JSON.stringify(images) }\n`, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store, max-age=0, must-revalidate",
                    },
                });
            }
            case "POST": {
                const {
                    name: imageName,
                    tag: imageTag,
                    force: skipAlreadyPulledCheck,
                    ...ignoredParameters
                } = Object.fromEntries(url.searchParams.entries());

                if (!imageName) {
                    return new Response(`${ JSON.stringify({
                        "error": `Missing parameter`,
                        "message": `This endpoint requires the "name" parameter.`,
                        "requiredParameters": ["name", "tag"],
                        "optionalParameters": ["force"],
                    }) }\n`, { status: 400 });
                }

                if (!imageTag) {
                    return new Response(`${ JSON.stringify({
                        "error": `Missing parameter`,
                        "message": `This endpoint requires the "tag" parameter.`,
                        "requiredParameters": ["name", "tag"],
                        "optionalParameters": ["force"],
                    }) }\n`, { status: 400 });
                }

                const ignoredParameterNames = Object.keys(ignoredParameters);
                const imageNameHash = await hashString("SHA-1", name);

                let manifest = await (
                    fetchImageManifest(workspace, imageTag, { imageNameHash })
                        .catch(() => undefined)
                );

                const meta = {
                    name: imageName,
                    nameHash: imageNameHash,
                };

                if (skipAlreadyPulledCheck === "true" || !manifest) {
                    const spinner = new std.cli.Spinner({
                        message: `${ request.method } ${ url.pathname }${ url.search }`,
                    });

                    try {
                        spinner.start();

                        await skopeo.copy(
                            `docker://${ imageName }:${ imageTag }`,
                            `oci:${ workspace.imagesDirectoryPath }/${ imageNameHash }:${ imageTag }`,
                            {
                                onProgress(status) {
                                    spinner.message = status.trim();
                                },
                            },
                        );

                        await Deno.writeTextFile(
                            `${ workspace.imagesDirectoryPath }/${ imageNameHash }/cora.json`,
                            JSON.stringify(meta),
                        );

                        manifest = await fetchImageManifest(workspace, imageTag, { imageNameHash });
                    } catch (error) {
                        if (error instanceof SkopeoError) {
                            return new Response(`${ JSON.stringify({
                                "error": error.name,
                                "message": error.message,
                            }) }\n`, { status: 400 });
                        }

                        throw error;
                    } finally {
                        spinner.stop();
                    }
                }

                return new Response(`${ JSON.stringify({
                    ...ignoredParameterNames.length === 0 ? {} : {
                        warning: `Some parameters were ignored: ${ ignoredParameterNames.map(name => JSON.stringify(name)) }`,
                    },
                    ...meta,
                    tag: imageTag,
                    digest: manifest!.digest,
                    size: manifest!.size,
                }) }\n`, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store, max-age=0, must-revalidate",
                    },
                });
            }
            case "DELETE": {
                const {
                    name: imageName,
                    tag: imageTag,
                    ...ignoredParameters
                } = Object.fromEntries(url.searchParams.entries());

                if (!imageName) {
                    return new Response(`${ JSON.stringify({
                        "error": `Missing parameter`,
                        "message": `This endpoint requires the "name" parameter.`,
                        "requiredParameters": ["name", "tag"],
                        "optionalParameters": ["force"],
                    }) }\n`, { status: 400 });
                }

                if (!imageTag) {
                    return new Response(`${ JSON.stringify({
                        "error": `Missing parameter`,
                        "message": `This endpoint requires the "tag" parameter.`,
                        "requiredParameters": ["name", "tag"],
                        "optionalParameters": ["force"],
                    }) }\n`, { status: 400 });
                }

                const ignoredParameterNames = Object.keys(ignoredParameters);
                const imageNameHash = await hashString("SHA-1", name);

                const manifest = (
                    await fetchImageManifest(workspace, imageTag, { imageNameHash })
                        .catch(() => undefined)
                );

                if (!manifest) {
                    return new Response(`${ JSON.stringify({ error: "Not Found" }) }\n`, {
                        status: 404,
                    });
                }

                const meta = {
                    name: imageName,
                    nameHash: imageNameHash,
                };

                await umoci.remove(`${ workspace.imagesDirectoryPath }/${ imageNameHash }:${ imageTag }`);
                await umoci.gc(`${ workspace.imagesDirectoryPath }/${ imageNameHash }`);

                if (
                    await fetchImageIndex(workspace, { imageNameHash })
                        .then(index => index.manifests?.length ?? 0)
                    === 0
                ) {
                    await Deno.remove(`${ workspace.imagesDirectoryPath }/${ imageNameHash }`, {
                        recursive: true,
                    });
                }

                return new Response(`${ JSON.stringify({
                    ...ignoredParameterNames.length === 0 ? {} : {
                        warning: `Some parameters were ignored: ${ ignoredParameterNames.map(name => JSON.stringify(name)) }`,
                    },
                    ...meta,
                    tag: imageTag,
                    digest: manifest!.digest,
                    size: manifest!.size,
                }) }\n`, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store, max-age=0, must-revalidate",
                    },
                });
            }
            default:
                return new Response(`${ JSON.stringify({
                    "error": "Method Not Allowed",
                    "message": `This endpoint does not support the ${ request.method } method.`,
                    "supportedMethods": ["GET", "POST", "DELETE"],
                }) }\n`, { status: 405 });
        }
    };

    const serveHandler: Deno.ServeHandler = async (request, info) => {
        const url = new URL(request.url);

        return (
            await serveWebInterfaceHandler(url, request, info) ??
            await serveImagesApiHandler(url, request, info)
        ) ?? new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
        });
    };

    const listen = Promise.withResolvers<Deno.NetAddr>();

    const serveOptions: Deno.ServeOptions = {
        signal: options?.signal,
        hostname: "127.0.0.1",
        port: 8042,
        onListen(localAddr) {
            listen.resolve(localAddr);
        },
    };

    const server = Deno.serve(
        serveOptions,
        serveHandler,
    );

    await listen.promise;

    return {
        finished: server.finished,
    };
}

export async function main() {
    const workspace = await setupWorkspace();
    const server = await startServer({
        workspace,
    });

    await server.finished;
}

if (import.meta.main) {
    await main();
}
