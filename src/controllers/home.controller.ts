import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { marked } from "marked";

const README_PATH = path.join(__dirname, "..", "..", "README.md");

const renderPage = (bodyHtml: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>exercise-api</title>
    <style>
      body {
        max-width: 860px;
        margin: 2rem auto;
        padding: 0 1.5rem;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
      }
      pre {
        background: #f5f5f5;
        padding: 1rem;
        overflow-x: auto;
        border-radius: 6px;
      }
      code {
        background: #f5f5f5;
        padding: 0.15em 0.35em;
        border-radius: 4px;
        font-size: 0.9em;
      }
      pre code {
        background: none;
        padding: 0;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 0.5rem;
        text-align: left;
      }
      th {
        background: #f5f5f5;
      }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>
`;

const getHome = (req: Request, res: Response) => {
  const readme = fs.readFileSync(README_PATH, "utf-8");

  res.type("html").send(renderPage(marked.parse(readme, { async: false })));
};

export const HomeController = { getHome };
