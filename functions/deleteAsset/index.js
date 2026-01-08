const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

app.http("DeleteAsset", {
  methods: ["DELETE"],
  authLevel: "function",
  route: "assets/{id}",

  handler: async (request, context) => {
    try {
      const id = request.params.id;
      const partitionKey = "assets";

      if (!id) {
        return { status: 400, jsonBody: { error: "Missing asset id in route" } };
      }

      const endpoint = process.env.COSMOS_ENDPOINT;
      const key = process.env.COSMOS_KEY;

      if (!endpoint || !key) {
        return {
          status: 500,
          jsonBody: { error: "Missing COSMOS_ENDPOINT or COSMOS_KEY app settings" }
        };
      }

      const client = new CosmosClient({ endpoint, key });

      const dbId = process.env.COSMOS_DB || "driverside";
      const containerId = process.env.COSMOS_CONTAINER || "assets";

      const container = client.database(dbId).container(containerId);

      // Optional: read first so we can return what was deleted (and confirm it existed)
      let existing = null;
      try {
        const readRes = await container.item(id, partitionKey).read();
        existing = readRes.resource || null;
      } catch (readErr) {
        // If it doesn't exist, Cosmos will throw 404 – handle below
        if (readErr.code === 404) existing = null;
        else throw readErr;
      }

      if (!existing) {
        return { status: 404, jsonBody: { error: "Asset not found" } };
      }

      // Delete document
      await container.item(id, partitionKey).delete();

      return {
        status: 200,
        jsonBody: {
          message: "Asset deleted",
          deletedId: id,
          deleted: existing
        }
      };
    } catch (err) {
      context.log(err);
      return {
        status: 500,
        jsonBody: { error: "Delete failed", details: err.message }
      };
    }
  }
});
