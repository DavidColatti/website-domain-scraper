const cheerio = require("cheerio");
const axios = require("axios");
const phoneValidator = require("./phoneValidation");

const scraper = {};

const makeRequest = async (url) => {
  try {
    const response = await axios.get(url);
    return response;
  } catch (err) {
    // console.log(err.message);
  }
  return null;
};

const extractPhoneByAttrs = ($) => {
  const attrs = ["tel:", "callto:"];

  for (let attr of attrs) {
    const selector = `[href^='${attr}']`;
    const elements = $(selector);

    if (elements) {
      for (let i = 0; i < elements.length; i++) {
        let href = $(elements[i]).attr("href");
        href = href.replace(attr, "").replace(/${attr}/g, "");
        return href;
      }
    }
  }

  return null;
};

const extractPhonesByHtml = async (html) => {
  const $ = cheerio.load(html);
  let phone = extractPhoneByAttrs($);

  if (!phone) {
    const regexs = [
      "\\W([0-9]{3})\\W*([0-9]{3})\\-\\W*([0-9]{4})(\\se?x?t?(\\d*))?",
      "\\(?\\b[2-9][0-9]{2}\\)?[-][2-9][0-9]{2}[-][0-9]{4}\\b",
      "\\(?\\b[2-9][0-9]{2}\\)?[-. ]?[2-9][0-9]{2}[-. ]?[0-9]{4}\\b",
    ];

    for (let regex of regexs) {
      const regexExp = RegExp(regex, "g");

      let array = null;

      while ((array = regexExp.exec(html)) !== null) {
        if (array && array.length > 0) {
          return array[0].replace(/[^+\-()\d]/g, "");
        }
      }
    }
  }
  return phone;
};

const extractContactUrls = async (html, url) => {
  const urlsSet = new Set();

  if (!html) {
    const response = await makeRequest(url);

    if (response && response.data) {
      const $ = cheerio.load(response.data.toLowerCase());
      const contactElements = $("a:contains(contact)");

      if (contactElements) {
        for (let contactElement of contactElements) {
          let contactUrl = $(contactElement).attr("href");

          if (contactUrl) {
            if (
              contactUrl.search(url) == -1 &&
              (!contactUrl.startsWith("http://") ||
                !contactUrl.startsWith("https://"))
            ) {
              contactUrl = `${
                url.endsWith("/") ? url.substring(0, url.length() - 1) : url
              }
                      /${
                        contactUrl.endsWith("/")
                          ? contactUrl.substring(0, contactUrl.length() - 1)
                          : contactUrl
                      }`;
            }
            urlsSet.add(contactUrl);
          }
        }
      }
    }
  }
  return Array.from(urlsSet);
};

const extractPhonesByUrl = async (html, url) => {
  if (html) {
    try {
      let phone = null;

      if (html) {
        phone = extractPhonesByHtml(html);

        if (phone) {
          return phone;
        }

        const contactUrls = await extractContactUrls(html, url);

        if (contactUrls) {
          for (let i = 0; i < contactUrls.length; i++) {
            const contactResponse = await makeRequest(contactUrls[i]);

            if (contactResponse && contactResponse.data) {
              phone = extractPhonesByHtml(contactResponse.data);

              if (phone) {
                return phone;
              }
            }
          }
        }
      }
    } catch (err) {}
  }
  return null;
};

scraper.scrapeDomain = async (domain) => {
  let url = domain;
  let initalDomain = url;

  if (url) {
    if (url.indexOf("http://") == -1 && url.indexOf("https://") == -1) {
      url = "http://" + url;
    }
    const response = await makeRequest(url);

    if (response && response.data) {
      let phone = await extractPhonesByUrl(response.data, url);

      if (phone) {
        const validated = phoneValidator.validateUsaPhone(phone);

        if (validated.status) {
          phone = validated.cleanedNum;
          let $ = cheerio.load(response.data);

          let title = "";
          let titleElement = $("title");

          if (titleElement) {
            title = titleElement
              .text()
              .trim()
              .replace(/"/g, "")
              .replace("/\r\n|\n\r|\n|\r/g", "");
          }

          const data = {
            domain: initalDomain,
            title,
            phone,
          };

          console.log(data);
        }
      }
    }
  }
};

scraper.scrapeUrls = async (urls) => {
  while (urls.length > 0) {
    const url = urls.shift();
    if (url) {
      await scraper.scrapeDomain(url);
    }
  }
};

module.exports = scraper;
