export type SkopeoErrorData = {
    time: string,
    level: string,
    msg: string,
};

export class SkopeoError extends Error {
    readonly time: string;
    readonly level: string;

    constructor(data: SkopeoErrorData) {
        super(data.msg);
        this.time = data.time;
        this.level = data.level;
    }

    static fromStderr(stderr: string) {
        const regExp = /(?<key>\w+)\s*=\s*(?<value>"([^"]*\\")*[^"]*"|\w+)/gm;
        const errorData: Record<string, string> = {};

        for (let match: RegExpMatchArray | null; (match = regExp.exec(stderr)) !== null;) {
            if (match.index === regExp.lastIndex) {
                regExp.lastIndex += 1;
            }

            const { key, value } = match.groups as Record<string, string>;

            errorData[key] = value.startsWith('"') ? JSON.parse(value) : value;
        }

        return new this(errorData as SkopeoErrorData);
    }
}

export type SkopeoCopyOptions = {
    signal?: AbortSignal,
    onProgress?: (status: string) => void | Promise<void>,
};

export const skopeo = {
    copy: async (sourceImage: string, destinationImage: string, options?: SkopeoCopyOptions) => {
        const command = new Deno.Command("skopeo", {
            args: ["copy", sourceImage, destinationImage],
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
            throw SkopeoError.fromStderr(stderrBuffer);
        }
    },
} as const;
