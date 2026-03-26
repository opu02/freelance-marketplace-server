require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}))
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("freelance-marketplace");
    const jobsCollection = db.collection("jobs");
    const acceptedTasksCollection = db.collection("acceptedTasks");

    console.log("Connected to MongoDB!");

    // ─── JOBS ROUTES ─────────────────────────────────────────────────────────

    // GET all jobs (with optional sort)
    app.get("/jobs", async (req, res) => {
      try {
        const { sort } = req.query;
        let sortObj = {};
        if (sort === "newest") sortObj = { postedAt: -1 };
        else if (sort === "oldest") sortObj = { postedAt: 1 };
        const jobs = await jobsCollection.find().sort(sortObj).toArray();
        res.json(jobs);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // GET latest 6 jobs for homepage
    app.get("/jobs/latest", async (req, res) => {
      try {
        const jobs = await jobsCollection
          .find()
          .sort({ postedAt: -1 })
          .limit(6)
          .toArray();
        res.json(jobs);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // GET jobs by user email
    app.get("/jobs/user/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const jobs = await jobsCollection
          .find({ userEmail: email })
          .sort({ postedAt: -1 })
          .toArray();
        res.json(jobs);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // GET single job by ID
    app.get("/jobs/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid ID" });
        const job = await jobsCollection.findOne({ _id: new ObjectId(id) });
        if (!job) return res.status(404).json({ message: "Job not found" });
        res.json(job);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // POST create a new job
    app.post("/jobs", async (req, res) => {
      try {
        const newJob = {
          ...req.body,
          postedAt: new Date(),
        };
        const result = await jobsCollection.insertOne(newJob);
        res.status(201).json({ insertedId: result.insertedId, ...newJob });
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // PUT update a job
    app.put("/jobs/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid ID" });
        const { title, category, summary, coverImage } = req.body;
        const result = await jobsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { title, category, summary, coverImage } }
        );
        if (result.matchedCount === 0)
          return res.status(404).json({ message: "Job not found" });
        res.json({ message: "Job updated successfully" });
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // DELETE a job
    app.delete("/jobs/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid ID" });
        const result = await jobsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0)
          return res.status(404).json({ message: "Job not found" });
        res.json({ message: "Job deleted successfully" });
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // ─── ACCEPTED TASKS ROUTES ────────────────────────────────────────────────

    // GET accepted tasks by user email
    app.get("/accepted-tasks/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const tasks = await acceptedTasksCollection
          .find({ acceptedByEmail: email })
          .sort({ acceptedAt: -1 })
          .toArray();
        res.json(tasks);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // POST accept a task
    app.post("/accepted-tasks", async (req, res) => {
      try {
        const task = {
          ...req.body,
          acceptedAt: new Date(),
        };
        // Prevent duplicates
        const existing = await acceptedTasksCollection.findOne({
          jobId: task.jobId,
          acceptedByEmail: task.acceptedByEmail,
        });
        if (existing)
          return res.status(409).json({ message: "Already accepted this task" });
        const result = await acceptedTasksCollection.insertOne(task);
        res.status(201).json({ insertedId: result.insertedId });
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // DELETE accepted task (done or cancel)
    app.delete("/accepted-tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid ID" });
        const result = await acceptedTasksCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0)
          return res.status(404).json({ message: "Task not found" });
        res.json({ message: "Task removed successfully" });
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });

    // Health check
    app.get("/", (req, res) => {
      res.json({ message: "Freelance Marketplace API is running 🚀" });
    });

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

run();
