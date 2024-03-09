const fs = require("fs");
const puppeteer = require("puppeteer");
const { Parser } = require("json2csv");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Por favor, insira o link do YouTube: ", async (link) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const navigationPromise = page.waitForNavigation();
  await page.goto(link);

  for (let i = 0; i < 10; i++) {
    await page.evaluate((_) => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await page.waitForSelector("ytd-comment-thread-renderer", { timeout: 60000 });

  await navigationPromise;
  const infoOutput = await page.evaluate(() => {
    const elements = document.getElementsByTagName(
      "ytd-comment-thread-renderer"
    );
    return Array.from(elements).map((element) => ({
      user: element
        .getElementsByTagName("h3")[0]
        .getElementsByTagName("yt-formatted-string")[0].textContent,
      comment: element
        .getElementsByTagName("ytd-expander")[0]
        .getElementsByTagName("yt-formatted-string")[0].textContent,
      upVotes: element
        .getElementsByTagName("ytd-comment-action-buttons-renderer")[0]
        .querySelector("#vote-count-middle")?.textContent.trim() ?? "",
    }));
  });

  const json2csvParser = new Parser({ fields: ["user", "comment", "upVotes"] });
  const csv = json2csvParser.parse(infoOutput);

  fs.writeFile("output.csv", csv, "utf8", (err) => {
    if (err) {
      console.error("Error writing CSV file:", err);
    } else {
      console.log("CSV file saved successfully!");
    }
  });

  await browser.close();

  rl.close();
});
