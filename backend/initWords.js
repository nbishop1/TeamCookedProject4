const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./config.env" });

async function initializeWords() {
    const client = new MongoClient(process.env.ATLAS_URI);

    try {
        await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db("accounts");

        // Check if words already exist
        const existingWords = await db.collection("words").countDocuments();
        if (existingWords > 0) {
            console.log(`Words already initialized. Count: ${existingWords}`);
            return;
        }

        const sampleWords = [
            { word: "javascript" },
            { word: "python" },
            { word: "computer" },
            { word: "programming" },
            { word: "hangman" },
            { word: "database" },
            { word: "algorithm" },
            { word: "function" },
            { word: "variable" },
            { word: "keyboard" },
            { word: "monitor" },
            { word: "internet" },
            { word: "software" },
            { word: "hardware" },
            { word: "technology" },
            { word: "application" },
            { word: "development" },
            { word: "framework" },
            { word: "library" },
            { word: "server" },
            { word: "client" },
            { word: "network" },
            { word: "security" },
            { word: "encryption" },
            { word: "password" },
            { word: "debugging" },
            { word: "compiler" },
            { word: "syntax" },
            { word: "runtime" },
            { word: "terminal" }
        ];

        const result = await db.collection("words").insertMany(sampleWords);
        console.log(`${result.insertedCount} words inserted successfully!`);

    } catch (error) {
        console.error("Error initializing words:", error);
    } finally {
        await client.close();
    }
}

initializeWords();