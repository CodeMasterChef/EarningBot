import { chromium, Browser } from "playwright";
import { PoolXEvent } from "./types";

const POOLX_URL = "https://www.bitget.com/events/poolx";

export async function scrapeOngoingEvents(): Promise<PoolXEvent[]> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    console.log("[Scraper] Navigating to PoolX...");
    await page.goto(POOLX_URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3000);

    // Click on "Ongoing" tab if visible
    try {
      const ongoingTab = page.locator('text="Ongoing"').first();
      if (await ongoingTab.isVisible()) {
        await ongoingTab.click();
        await page.waitForTimeout(2000);
      }
    } catch {
      console.log("[Scraper] No Ongoing tab found or already on it");
    }

    // Extract events using DOM structure
    const events = await page.evaluate(() => {
      const results: {
        name: string;
        poolType: string;
        totalReward: string;
        startTime: string;
        endTime: string;
        url: string;
      }[] = [];

      const links = document.querySelectorAll<HTMLAnchorElement>(
        'a[href*="/events/poolx/"]'
      );

      links.forEach((el) => {
        const href = el.getAttribute("href") || "";
        if (!href.match(/\/events\/poolx\/\d+/)) return;

        // Pool name: <label> contains "ETH Pool", "BTC Pool", etc.
        const label = el.querySelector("label");
        const poolLabel = label?.textContent?.trim() || "";

        // Description: <p> contains "Lock ETH to get BTW"
        const desc = el.querySelector("p");
        const descText = desc?.textContent?.trim() || "";

        // Extract reward token from description
        const lockMatch = descText.match(/Lock\s+(\S+)\s+to\s+get\s+(\S+)/);
        const stakeToken = lockMatch?.[1] || "Unknown";
        const rewardToken = lockMatch?.[2] || "Unknown";

        // Trading pool tag
        const tradingTag = el.querySelector('[class*="bit-tag"]');
        const isTrading = tradingTag?.textContent?.includes("Trading") || false;

        // APR: find spans inside the APR section
        // The APR section has "Est. APR" label followed by value spans
        const allSpans = el.querySelectorAll("span");
        let apr = "N/A";
        let cumAmount = "N/A";
        let cumToken = "";
        let nextIsApr = false;
        let nextIsCum = false;

        // Use a more structured approach - find divs with specific content
        const divs = el.querySelectorAll("div");
        divs.forEach((div) => {
          const spans = div.querySelectorAll(":scope > span");
          if (spans.length === 0) return;

          // Check for "Est. APR" label
          const firstSpanText = spans[0]?.textContent?.trim() || "";
          if (firstSpanText === "Est. APR") {
            // APR value is in the next sibling div's spans
            const valueDiv = div.nextElementSibling as HTMLElement | null;
            if (!valueDiv) {
              const parentDiv = div.parentElement;
              const aprValueEl = parentDiv?.querySelector(
                'div:not(:first-child) span'
              );
              if (aprValueEl) {
                apr = aprValueEl.textContent?.trim() || "N/A";
              }
            }
          }

          if (firstSpanText === "Cumulative locking") {
            const valueDiv = div.nextElementSibling as HTMLElement | null;
            if (!valueDiv) {
              const parentDiv = div.parentElement;
              const valueSpans = parentDiv?.querySelectorAll(
                'div:not(:first-child) span'
              );
            }
          }
        });

        // Simpler approach: extract from specific DOM positions
        // Each event row has columns: [name+desc] [apr] [cumulative] [button]
        const columns = el.querySelectorAll(':scope > div');

        // APR column (index 2 in grid, but check for content)
        columns.forEach((col) => {
          const labelSpan = col.querySelector('span.text-content-tertiary');
          const labelText = labelSpan?.textContent?.trim() || "";

          if (labelText === "Est. APR") {
            const valueContainer = col.querySelector('div.inline-flex');
            if (valueContainer) {
              const valueSpans = valueContainer.querySelectorAll('span');
              if (valueSpans.length >= 1) {
                apr = valueSpans[0]?.textContent?.trim() || "N/A";
              }
            }
          }

          if (labelText === "Cumulative locking") {
            const valueContainer = col.querySelector('div.inline-flex');
            if (valueContainer) {
              const valueSpans = valueContainer.querySelectorAll('span');
              cumAmount = valueSpans[0]?.textContent?.trim() || "N/A";
              cumToken = valueSpans[1]?.textContent?.trim() || "";
            }
          }
        });

        const poolType = isTrading
          ? `Trading Pool (Lock ${stakeToken})`
          : `Lock ${stakeToken}`;

        results.push({
          name: rewardToken,
          poolType,
          totalReward: `APR ${apr}% | Locked: ${cumAmount} ${cumToken}`,
          startTime: "Ongoing",
          endTime: "N/A",
          url: `https://www.bitget.com${href}`,
        });
      });

      return results;
    });

    console.log(`[Scraper] Found ${events.length} ongoing events`);
    return events;
  } catch (error) {
    console.error("[Scraper] Error:", error);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
