const fs = require("fs");
const cluster = require("cluster");
const forks = require("os").cpus().length;
const scraper = require("./pageScraper");

const urls = fs.readFileSync(`domains.txt`).toString().split("\r\n");

const main = async () => {
  if (cluster.isMaster) {
    console.log(`Master: [${process.pid}] is running`);

    for (let i = 0; i < forks; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log(`Worker [${worker.process.pid}] died`);
    });
  } else {
    const threadCount = Math.ceil(urls.length / forks);

    const workerId = cluster.worker.id;
    console.log(`Worker ${workerId}: [${process.pid}] is running`);

    const workerIndex = workerId - 1;
    const startIndex = workerIndex * threadCount;

    const workerUrls = urls.splice(startIndex, threadCount);

    if (workerUrls.length <= 0) {
      cluster.worker.disconnect();
    }

    const promises = workerUrls.map(async (url) => {
      return await scraper.scrapeDomain(url);
    });

    const result = await Promise.all(promises);

    console.log(`Found a total of ${result.length} domains`);
    cluster.worker.disconnect();
  }
};

main();
