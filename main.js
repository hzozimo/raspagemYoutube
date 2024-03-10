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
  await page.goto('https://www.youtube.com/watch?v=U0JFQfADars');

  //rolar a pagina

  for (let i = 0; i < 10; i++) {
    await page.evaluate((_) => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await page.waitForSelector("ytd-comment-thread-renderer", { timeout: 60000 });

  //carregar respostas a comentarios

  const commentSectionElements = await page.$$('ytd-comment-thread-renderer');

  for (const element of commentSectionElements) {
  const moreButton = await element.$('.ytd-comment-replies-renderer .more-button');
  if (moreButton) {
    await moreButton.click();
    await new Promise((resolve) => setTimeout(resolve, 500)); // espera 2 segundos após cada clique
  }
}

//esperar o ultimo comenario carregar
await new Promise((resolve) => setTimeout(resolve, 5000)); // espera 2 segundos após cada clique


  await navigationPromise;
  const infoOutput = await page.evaluate(() => {
    const elements = document.getElementsByTagName(
      "ytd-comment-thread-renderer"
    );
    let output = [];
    Array.from(elements).forEach((element) => {
      output.push({
        user: element
        .getElementsByTagName("h3")[0]
        .getElementsByTagName("yt-formatted-string")[0].textContent,
      comment: element
        .getElementsByTagName("ytd-expander")[0]
        .getElementsByTagName("yt-formatted-string")[0].textContent,
      upVotes: element
        .getElementsByTagName("ytd-comment-action-buttons-renderer")[0]
        .querySelector("#vote-count-middle")?.textContent.trim() ?? "",
      isReply: false,
      })
      // verifica se existe o botão de "ver mais" e clica nele
      if (element.querySelector(".ytd-comment-replies-renderer")?.getElementsByClassName('more-button')[0]) {
        const replayElements = element.getElementsByClassName("ytd-comment-replies-renderer");
        Array.from(replayElements).forEach(async (replayElement) => {
          output.push({
            user: replayElement
            .querySelector('#body')
            .getElementsByTagName("h3")[0]?.textContent.trim() ?? "",
            comment: replayElement.querySelector('#body').querySelector('#comment-content')?.textContent.replace('\n', ' ').replace('Ler mais', ' ').replace('Mostrar menos', ' ').trim() ?? "",
            upVotes: replayElement.querySelector('#vote-count-left').textContent.trim(),
            isReply: true
          });
        });
      }
    });
    return output;
  });

  const json2csvParser = new Parser({ fields: ["user", "isReply", "upVotes", "comment"] });
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
