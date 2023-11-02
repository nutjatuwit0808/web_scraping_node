const puppteer = require("puppeteer");
const http = require("http");
const cors = require("cors");
const cron = require("node-cron");
const socketIo = require("socket.io");

const express = require("express");
const app = express();
const server = http.createServer(app);
const PORT = 5000;

const io = socketIo(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

io.on("connection", (socket) => {
  console.log(`User: ${socket.id} connected`);
  socket.on("disconnect", () => {
    console.log(`User: ${socket.id} disconnected`);
  });
});
cron.schedule("*/1 * * * *", async () => {
  console.log("start scheduler");
  let stocks_data = await startStockScraping();
  console.log("stocks_data :: ", stocks_data);
  io.emit("schedule-stock", stocks_data)
});

const startStockScraping = async () => {
  let browser, page;
  return new Promise(async (resolve, reject) => {
    try {
      browser = await puppteer.launch();
      page = await browser.newPage();

      await page.goto("https://www.set.or.th/th/market/index/set100/overview");
      let page_content_set100 = await page.content();
      let stocks_data = getSET100Stocks(page_content_set100);
      resolve(stocks_data);
    } catch (error) {
      console.log(error);
      reject(error);
    } finally {
      await browser.close();
    }
  });
};
const getSET100Stocks = (page_content) => {
  let stocks_data = [];
  const pattern_all_stock = /<tr role="row" indexselected=([\s\S]*?)<\/tr>/g;
  let allStockByMatchWord = page_content.match(pattern_all_stock);

  const stock_name_pattern = /<div class="symbol pt-1">([\s\S]*?)<\/div>/g;
  const open_price_pattern =
    /<td aria-colindex="2" role="cell" class="text-end">([\s\S]*?)<\/td>/g;
  const higest_price_pattern =
    /<td aria-colindex="3" role="cell" class="text-end">([\s\S]*?)<\/td>/g;
  const lowest_price_pattern =
    /<td aria-colindex="4" role="cell" class="text-end">([\s\S]*?)<\/td>/g;
  const last_price_pattern =
    /<td aria-colindex="5" role="cell" class="text-end">([\s\S]*?)<\/td>/g;

  for (let stock of allStockByMatchWord) {
    let stock_name_by_pattern = stock.match(stock_name_pattern);
    let open_price_by_pattern = stock.match(open_price_pattern);
    let higest_price_by_pattern = stock.match(higest_price_pattern);
    let lowest_price_by_pattern = stock.match(lowest_price_pattern);
    let last_price_by_pattern = stock.match(last_price_pattern);

    let stock_name = getOnlyValueFromElementTag(...stock_name_by_pattern);
    let open_price = getOnlyValueFromElementTag(...open_price_by_pattern);
    let higest_price = getOnlyValueFromElementTag(...higest_price_by_pattern);
    let lowest_price = getOnlyValueFromElementTag(...lowest_price_by_pattern);
    let last_price = getOnlyValueFromElementTag(...last_price_by_pattern);

    let stock_data = {
      stock_name,
      open_price,
      higest_price,
      lowest_price,
      last_price,
      change_percent:
        (((last_price - open_price) / open_price) * 100).toFixed(2) + "%",
    };
    stocks_data.push(stock_data);
  }
  return stocks_data;
};
const getOnlyValueFromElementTag = (tag_element) => {
  const pattern = />([\s\S]*?)</g;
  let remove_tag_element = pattern.exec(tag_element);
  return remove_tag_element[1].trim();
};

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
