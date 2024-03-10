const fs = require("fs");
const puppeteer = require("puppeteer");
const { Parser } = require("json2csv");

async function scrapeYoutubeComments(link) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const navigationPromise = page.waitForNavigation();
  await page.goto(link);
  await page.waitForSelector('#title > h1');

  // Wait for the video player to load
  await page.waitForSelector('video');
  await new Promise((resolve) => setTimeout(resolve, 5000));
 
  // Disable autoplay by interacting with the YouTube player
  await page.focus('body');
  await page.keyboard.press('Space');

  // Scroll the page
  let lastHeight = await page.evaluate("document.documentElement.scrollHeight");
  let newHeight = 0;
  let timeout = 0;
  let scrollCount = 0;

  while (lastHeight !== newHeight || timeout < 20) {
    lastHeight = newHeight;
    scrollCount += 1;
    if (scrollCount <= 2) {
      await page.evaluate((scrollHeight) => {
        window.scrollTo(0, scrollHeight / 5);
      }, lastHeight);
    } else {
      await page.evaluate((scrollHeight) => {
        window.scrollTo(0, scrollHeight);
      }, lastHeight);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)); 
    newHeight = await page.evaluate("document.documentElement.scrollHeight");

    if (lastHeight === newHeight) {
      timeout += 1;
    } else {
      timeout = 0;
    }
  }

  // Load replies to comments
  await page.waitForSelector('ytd-comment-thread-renderer');
  const commentSectionElements = await page.$$("ytd-comment-thread-renderer");

  for (const element of commentSectionElements) {
    const moreButton = await element.$(".ytd-comment-replies-renderer .more-button");
    if (moreButton) {
      await moreButton.click();
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait 1.5 seconds after each click
      let loadMoreButton = await element.$("#button > ytd-button-renderer > yt-button-shape > button > yt-touch-feedback-shape > div > div.yt-spec-touch-feedback-shape__fill");
      if (loadMoreButton) {
        await loadMoreButton.click();
        await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 0.1 seconds after each click
      }
    }
  }

  // Wait for the last comment to load
  await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds after each click

  await navigationPromise;
  const infoOutput = await page.evaluate(() => {
    const elements = document.getElementsByTagName("ytd-comment-thread-renderer");
    let output = [];
    Array.from(elements).forEach((element) => {
      output.push({
        user: element.getElementsByTagName("h3")[0].getElementsByTagName("yt-formatted-string")[0]?.textContent,
        comment: element.getElementsByTagName("ytd-expander")[0].getElementsByTagName("yt-formatted-string")[0]?.textContent,
        upVotes: element.getElementsByTagName("ytd-comment-action-buttons-renderer")[0].querySelector("#vote-count-middle")?.textContent.trim(),
        isReply: false,
      });

      if (element.querySelector(".ytd-comment-replies-renderer")?.getElementsByClassName('more-button')[0]) {
        const replyElements = element.getElementsByClassName("ytd-comment-replies-renderer");
        Array.from(replyElements).forEach(async (replyElement) => {
          output.push({
            user: replyElement.querySelector('#body').getElementsByTagName("h3")[0]?.textContent.trim(),
            comment: replyElement.querySelector('#body').querySelector('#comment-content')?.textContent.replace('\n', ' ').replace('Ler mais', ' ').replace('Mostrar menos', ' ').trim(),
            upVotes: replyElement.querySelector('#vote-count-left')?.textContent.trim(),
            isReply: true
          });
        });
      }
    });
    return output;
  });

  // Remove duplicate lines
  const uniqueOutput = infoOutput.filter((item, index, self) => self.findIndex(t => t.user === item.user && t.comment === item.comment) === index);

  const json2csvParser = new Parser({ fields: ["user", "isReply", "upVotes", "comment"] });
  const csv = json2csvParser.parse(uniqueOutput);

  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace("T", "_").split(".")[0];
  const fileName = `comentarios_video_id_${link.split("v=")[1]}_${timestamp}.csv`;

  fs.writeFile(fileName, csv, "utf8", (err) => {
    if (err) {
      console.error("Error writing CSV file:", err);
    } else {
      console.log("CSV file saved successfully!");
    }
  });

  await browser.close();
}

const videoLink = process.argv[2];

if (!videoLink) {
  console.error("Please provide the YouTube video link as an argument.");
  process.exit(1);
}

scrapeYoutubeComments(videoLink);
