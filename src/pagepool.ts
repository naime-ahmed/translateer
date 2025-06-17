import { connect } from "puppeteer-real-browser";

export type Browser = Awaited<ReturnType<typeof connect>>["browser"];
export type Page = Awaited<ReturnType<Browser["pages"]>>[number];

export let pagePool: PagePool;

export default class PagePool {
  private _pages: Page[] = [];
  private _pagesInUse: Page[] = [];
  private _browser!: Browser;

  constructor(private pageCount: number = 5) {
    pagePool = this;
  }

  public async init() {
    await this._initBrowser();
    await this._initPages();

    // refresh pages every 1 hour to keep alive
    this._resetInterval(60 * 60 * 1000);
  }

  public getPage() {
    const page = this._pages.pop();
    if (!page) {
      return undefined;
    }
    this._pagesInUse.push(page);
    return page;
  }

  public releasePage(page: Page) {
    const index = this._pagesInUse.indexOf(page);
    if (index === -1) {
      return;
    }
    this._pagesInUse.splice(index, 1);
    this._pages.push(page);
  }

  public async close() {
    await this._browser.close();
  }

  private async _initBrowser() {
    // Remove puppeteer-real-browser and use standard puppeteer
    const browser = await puppeteer.launch({
      executablePath: Deno.env.get("PUPPETEER_EXECUTABLE_PATH"),
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    });
    this._browser = browser;
  }

  private async _initPages() {
    this._pages = await Promise.all(
      Array(this.pageCount)
        .fill(null)
        .map(async (_, i) => {
          const page = await this._browser.newPage();
          await this._setupPage(page, i);
          return page;
        })
    );
  }

  private async _setupPage(page: Page, index: number) {
    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);

    // Block unnecessary resources
    page.on("request", (req) => {
      const blockTypes = ["image", "stylesheet", "font", "media"];
      if (
        blockTypes.includes(req.resourceType()) ||
        req.url().includes("google-analytics")
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`page ${index} created`);

    // Use alternative Google Translate domain with retries
    const domains = [
      "https://translate.google.co.jp/",
      "https://translate.google.com.hk/",
      "https://translate.google.com/",
    ];

    for (const domain of domains) {
      try {
        await page.goto(domain, {
          waitUntil: "domcontentloaded", // Faster than networkidle2
          timeout: 45000, // 45s timeout
        });
        console.log(`page ${index} loaded from ${domain}`);
        break;
      } catch (err) {
        console.log(`Failed ${domain}, trying next...`);
      }
    }

    // Simplified privacy handling
    try {
      await page.click('button[aria-label="Reject all"]', { timeout: 2000 });
      console.log(`page ${index} privacy consent rejected`);
    } catch {
      console.log(`page ${index} privacy consent not found`);
    }
  }

  private async _handlePrivacyConsent(page: Page, index: number) {
    try {
      const btnSelector = 'button[aria-label="Reject all"]';
      await page.waitForSelector(btnSelector, { timeout: 1000 });
      await page.click(btnSelector);
      console.log(`page ${index} privacy consent rejected`);
    } catch {
      console.log(`page ${index} privacy consent not found`);
    }
  }

  private _resetInterval(ms: number) {
    setInterval(async () => {
      this._pagesInUse = [];
      this._pages = [];
      await this._browser.close();
      await this._initBrowser();
      await this._initPages();
    }, ms);
  }
}
