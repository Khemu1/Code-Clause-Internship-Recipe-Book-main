import express from "express";
import sqlite3 from "sqlite3";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { storeRecipe, editRecipe } from "./src/validation/backend.js";
import { transformYupErrorsIntoObject } from "./src/validation/backend.js";

const db = new sqlite3.Database("recipes.db");

db.run(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    recipe TEXT,
    thumbnail TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationFolder = file.fieldname === "thumbnail" ? "thumbnail" : "";
    cb(null, path.join(__dirname, `public/assets/images/${destinationFolder}`));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const sendErrorResponse = (res, statusCode, message) => {
  console.error(message);
  return res.status(statusCode).json({ error: message });
};

const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") return reject(err);
      resolve();
    });
  });
};

app.post("/add-recipe", upload.single("thumbnail"), async (req, res) => {
  try {
    const validatedRecipe = await storeRecipe.validate(
      {
        title: req.body.title,
        recipe: req.body.recipe,
        thumbnail: req.file ? req.file.filename : null,
      },
      { abortEarly: false }
    );

    const stmt = db.prepare(`
      INSERT INTO recipes (title, recipe, thumbnail)
      VALUES (?, ?, ?)
    `);
    stmt.run(
      validatedRecipe.title,
      validatedRecipe.recipe,
      validatedRecipe.thumbnail,
      function (err) {
        if (err) {
          console.error("Error inserting recipe into DB:", err);
          return sendErrorResponse(res, 500, "Error inserting recipe into DB");
        }

        const insertedId = this.lastID;
        db.get(
          "SELECT * FROM recipes WHERE id = ?",
          [insertedId],
          (err, recipe) => {
            if (err) {
              console.error("Error retrieving inserted recipe:", err);
              return sendErrorResponse(
                res,
                500,
                "Error retrieving inserted recipe"
              );
            }

            res.status(201).json({
              message: "Recipe submitted successfully",
              recipe,
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("Validation error:", err);
    return sendErrorResponse(res, 400, transformYupErrorsIntoObject(err));
  }
});

app.get("/get-recipes", (req, res) => {
  db.all("SELECT * FROM recipes", [], (err, rows) => {
    if (err) return sendErrorResponse(res, 500, "Error retrieving data");
    res.status(200).json(rows);
  });
});

app.post("/delete-recipe", async (req, res) => {
  const { id } = req.body;

  if (!id) return sendErrorResponse(res, 400, "ID is required");

  db.get(
    "SELECT thumbnail FROM recipes WHERE id = ?",
    [id],
    async (err, row) => {
      if (err) return sendErrorResponse(res, 500, "Error retrieving record");

      if (!row) return sendErrorResponse(res, 404, "Recipe not found");

      const filePath = path.join(
        __dirname,
        "public",
        "assets/images/thumbnail",
        row.thumbnail
      );

      try {
        await deleteFile(filePath);
        const stmt = db.prepare("DELETE FROM recipes WHERE id = ?");
        stmt.run(id, (err) => {
          if (err) return sendErrorResponse(res, 500, "Error deleting recipe");
          res.status(200).json({ message: "Recipe deleted successfully", id });
        });
      } catch (fileErr) {
        return sendErrorResponse(res, 500, "Error deleting associated file");
      }
    }
  );
});

app.put("/update-recipe", upload.single("thumbnail"), async (req, res) => {
  const { id, title, recipe } = req.body;

  try {
    // Validate input data
    await editRecipe.validate({ id, title, recipe }, { abortEarly: false });

    // Retrieve the current recipe from the database
    db.get(
      "SELECT thumbnail FROM recipes WHERE id = ?",
      [id],
      async (err, row) => {
        if (err) {
          console.error("Error retrieving record:", err);
          return sendErrorResponse(res, 500, "Error retrieving record");
        }

        if (!row) return sendErrorResponse(res, 404, "Recipe not found");

        let thumbnail = row.thumbnail;

        // If a new thumbnail is uploaded, replace the old one
        if (req.file) {
          const oldThumbnailPath = path.join(
            __dirname,
            "public/assets/images/thumbnail",
            thumbnail
          );

          thumbnail = req.file.filename;

          try {
            await deleteFile(oldThumbnailPath);
          } catch (fileErr) {
            console.error("Error deleting old thumbnail:", fileErr);
          }
        }

        const stmt = db.prepare(`
          UPDATE recipes
          SET title = ?, recipe = ?, thumbnail = ?
          WHERE id = ?
        `);
        stmt.run(title, recipe, thumbnail, id, function (updateErr) {
          if (updateErr) {
            console.error("Error updating recipe:", updateErr);
            return sendErrorResponse(res, 500, "Error updating recipe");
          }

          db.get(
            "SELECT * FROM recipes WHERE id = ?",
            [id],
            (getErr, updatedRecipe) => {
              if (getErr) {
                console.error("Error retrieving updated recipe:", getErr);
                return sendErrorResponse(
                  res,
                  500,
                  "Error retrieving updated recipe"
                );
              }

              res.status(200).json({
                message: "Recipe updated successfully",
                recipe: updatedRecipe,
              });
            }
          );
        });
      }
    );
  } catch (err) {
    console.error("Validation error:", err);
    return sendErrorResponse(res, 400, transformYupErrorsIntoObject(err));
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
