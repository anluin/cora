export class UmociError extends Error {
    static fromStderr(stderr: string) {
        return new this(
            stderr
                .split("\n")
                .filter(line => !!line)
                .map(line => line.trim().replace(/^⨯\s*/, ""))
                .join("\n")
        );
    }
}

export type UmociCopyOptions = {
    signal?: AbortSignal,
    onProgress?: (status: string) => void | Promise<void>,
};

export const umoci = {
    remove: async (imagePath: string, options?: UmociCopyOptions) => {
        const command = new Deno.Command("umoci", {
            args: ["remove", "--image", imagePath],
            signal: options?.signal,
            stdout: "piped",
            stderr: "piped",
        });

        const process = command.spawn();

        let stdoutBuffer = "";
        let stderrBuffer = "";

        await Promise.all([
            process.stdout
                .pipeThrough(new TextDecoderStream())
                .pipeTo(new WritableStream({
                    async write(chunk) {
                        stdoutBuffer += chunk;

                        for (; ;) {
                            const index = stdoutBuffer.indexOf("\n");

                            if (index !== -1) {
                                const line = stdoutBuffer.slice(0, index);
                                stdoutBuffer = stdoutBuffer.slice(index + 1);
                                await options?.onProgress?.(line);

                                continue;
                            }

                            break;
                        }
                    },
                })),
            process.stderr
                .pipeThrough(new TextDecoderStream())
                .pipeTo(new WritableStream({
                    write(chunk) {
                        stderrBuffer += chunk;
                    },
                }))
        ]);

        if (!await process.status.then(status => status.success)) {
            throw UmociError.fromStderr(stderrBuffer);
        }
    },

    gc: async (imagePath: string, options?: UmociCopyOptions) => {
        const command = new Deno.Command("umoci", {
            args: ["gc", "--layout", imagePath],
            signal: options?.signal,
            stdout: "piped",
            stderr: "piped",
        });

        const process = command.spawn();

        let stdoutBuffer = "";
        let stderrBuffer = "";

        await Promise.all([
            process.stdout
                .pipeThrough(new TextDecoderStream())
                .pipeTo(new WritableStream({
                    async write(chunk) {
                        stdoutBuffer += chunk;

                        for (; ;) {
                            const index = stdoutBuffer.indexOf("\n");

                            if (index !== -1) {
                                const line = stdoutBuffer.slice(0, index);
                                stdoutBuffer = stdoutBuffer.slice(index + 1);
                                await options?.onProgress?.(line);

                                continue;
                            }

                            break;
                        }
                    },
                })),
            process.stderr
                .pipeThrough(new TextDecoderStream())
                .pipeTo(new WritableStream({
                    write(chunk) {
                        stderrBuffer += chunk;
                    },
                }))
        ]);

        if (!await process.status.then(status => status.success)) {
            throw UmociError.fromStderr(stderrBuffer);
        }
    },
} as const;
