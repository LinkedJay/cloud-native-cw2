const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

app.http("UpdateAsset", {
  methods: ["PUT"],
  authLevel: "anonymous", // easier for local + demo; change to "function" later if you want
  route: "assets/{id}",

  handler: async (request, context) => {
    try {
      const id = request.params.id;
      const partitionKey = "assets";

      if (!id) {
        return {
          status: 400,
          jsonBody: { error: "Missing asset id in route" }
        };
      }

      // --- Validate JSON body ---
      const contentType = request.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return {
          status: 400,
          jsonBody: { error: "Content-Type must be application/json" }
        };
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return {
          status: 400,
          jsonBody: { error: "Invalid JSON body" }
        };
      }

      const { title, description } = body;

      if (!title && !description) {
        return {
          status: 400,
          jsonBody: { error: "Provide title and/or description to update" }
        };
      }

      // --- Cosmos setup ---
       const client = new CosmosClient({
          endpoint: "https://cosmosdb-cw2.documents.azure.com:443/",
          key: process.env.COSMOS_KEY
        });

      context.log("COSMOS_ENDPOINT:", process.env.COSMOS_ENDPOINT);
        context.log("COSMOS_KEY length:", (process.env.COSMOS_KEY || "").length);
      const container = client
        .database(process.env.COSMOS_DB || "driverside")
        .container(process.env.COSMOS_CONTAINER || "assets");

      // --- Read existing document ---
      const { resource: existing } = await container
        .item(id, partitionKey)
        .read();

      if (!existing) {
        return {
          status: 404,
          jsonBody: { error: "Asset not found" }
        };
      }

      // --- Update fields ---
      const updated = {
        ...existing,
        title: title ?? existing.title,
        description: description ?? existing.description,
        updatedAt: new Date().toISOString()
      };

      // --- Replace document ---
      const { resource: saved } = await container
        .item(id, partitionKey)
        .replace(updated);

      return {
        status: 200,
        jsonBody: saved
      };

    } catch (err) {
      context.log(err);
      return {
        status: 500,
        jsonBody: {
          error: "Update failed",
          details: err.message
        }
      };
    }
  }
});
