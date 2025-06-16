import { serveDir } from "@std/http";
import { resolve } from "@std/path";
import "jsr:@std/dotenv/load";
import PagePool, { pagePool } from "./pagepool.ts";
import { parsePage } from "./parser.ts";

try {
  const pageCount = parseInt(Deno.env.get("PAGE_COUNT") ?? "5", 10);
  if (isNaN(pageCount) || pageCount <= 0) {
    throw new Error("PAGE_COUNT must be a positive integer");
  }
  await new PagePool(pageCount).init();
} catch (e) {
  console.error("PagePool initialization failed:", e.message);
  Deno.exit(1);
}

// on exit, close the page pool
Deno.addSignalListener("SIGINT", async () => {
  await pagePool.close();
  Deno.exit(0);
});

const port = parseInt(Deno.env.get("PORT") ?? "8999", 10);
if (isNaN(port)) throw new Error("PORT must be a number");

Deno.serve({ port }, async (req) => {
  try {
    const url = new URL(req.url);

    if (url.pathname === "/api") {
      const options = {
        text: url.searchParams.get("text"),
        from: url.searchParams.get("from") ?? "auto",
        to: url.searchParams.get("to") ?? "bn",
        lite: url.searchParams.get("lite") === "true",
        ...(await req.json().catch(() => ({}))),
      };

      const { text, from, to, lite } = options;

      if (!text) {
        serverLog(req, 400);
        return new Response(
          JSON.stringify({ error: 1, message: "text is required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
          }
        );
      }

      const page = pagePool.getPage();
      if (!page) {
        serverLog(req, 400);
        return new Response(
          JSON.stringify({ error: 1, message: "No available pages" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
          }
        );
      }

      try {
        const result = await parsePage(page, { text, from, to, lite });
        serverLog(req, 200);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      } catch (e) {
        serverLog(req, 500);
        console.error(e);
        return new Response(
          JSON.stringify({ error: 1, message: "Internal Server Error" }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
          }
        );
      } finally {
        pagePool.releasePage(page);
      }
    }

    return serveDir(req, {
      fsRoot: resolve(Deno.cwd(), "src", "public"),
    });
  } catch (e) {
    serverLog(req, 500);
    console.error(e);
    return new Response(
      JSON.stringify({
        error: 1,
        message: e instanceof Error ? e.message : "Internal Server Error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }
});

function serverLog(req: Request, status: number) {
  const d = new Date().toISOString();
  const dateFmt = `[${d.slice(0, 10)} ${d.slice(11, 19)}]`;
  const url = new URL(req.url);
  const s = `${dateFmt} [${req.method}] ${url.pathname}${url.search} ${status}`;
  // deno-lint-ignore no-console
  console.debug(s);
}
