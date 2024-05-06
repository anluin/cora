import { afterAll, beforeAll, describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { setupWorkspace, startServer, Workspace } from "./main.ts";


describe("Test the /images api", () => {
    let abortController: AbortController;
    let workspace: Workspace;

    beforeAll(async () => {
        abortController = new AbortController();
        workspace = await setupWorkspace({
            dataDirectoryPath: await Deno.makeTempDir({ prefix: "cora-" }),
        });

        console.log("workspace:", workspace);

        await startServer({
            signal: abortController.signal,
            workspace,
        });
    });

    afterAll(async () => {
        assert(abortController);
        abortController.abort();

        assert(workspace);

        if (workspace.rootPath.startsWith("/tmp/")) {
            await Deno.remove(workspace.rootPath, {
                recursive: true,
            });
        }
    });

    it("GET /images initially empty", async () => {
        assertEquals(await (
            fetch("http://127.0.0.1:8042/images", {
                method: "GET",
            })
                .then(response => response.json())
        ), []);
    });

    it("POST /images?name=alpine&tag=3.19.1", async () => {
        assertEquals(await (
            fetch("http://127.0.0.1:8042/images?name=alpine&tag=3.19.1", {
                method: "POST",
            })
                .then(response => response.json())
        ), {
            name: "alpine",
            nameHash: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
            tag: "3.19.1",
            digest: "sha256:f8c2d9504fa2fd3b919a4fa027f43157fbe3dc435cfd6205cbffc3135f77597e",
            size: 348,
        });
    });

    it("GET /images has alpine:3.19.1", async () => {
        assertEquals(await (
            fetch("http://127.0.0.1:8042/images", {
                method: "GET",
            })
                .then(response => response.json())
        ), [{
            "name": "alpine",
            "nameHash": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
            "tags": [{
                "name": "3.19.1",
                "digest": "sha256:f8c2d9504fa2fd3b919a4fa027f43157fbe3dc435cfd6205cbffc3135f77597e",
                "size": 348
            }]
        }]);
    });

    it("DELETE /images?name=alpine&tag=3.19.1", async () => {
        assertEquals(await (
            fetch("http://127.0.0.1:8042/images?name=alpine&tag=3.19.1", {
                method: "DELETE",
            })
                .then(response => response.json())
        ), {
            name: "alpine",
            nameHash: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
            tag: "3.19.1",
            digest: "sha256:f8c2d9504fa2fd3b919a4fa027f43157fbe3dc435cfd6205cbffc3135f77597e",
            size: 348,
        });
    });
});
