const phone = require("phone");
const USA_COUNTRY = "USA";

const validator = {};

validator.validateUsaPhone = (phoneNumber) => {
  const initalFilter = phone(phoneNumber);

  if (initalFilter.length > 0) {
    const countryCode = initalFilter[1];
    const cleanedNum = initalFilter[0].replace(/\+1/, "");

    return {
      cleanedNum,
      status: countryCode && countryCode === USA_COUNTRY,
    };
  }
  return { status: false };
};

module.exports = validator;
