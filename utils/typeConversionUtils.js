const CryptoJS = require("crypto-js");

const hashPassword = password => {
  const hashedPassword = CryptoJS.AES.encrypt(
    password,
    process.env.SECRET_KEY,
  ).toString();

  return hashedPassword;
};

const decryptPassword = hashedPassword => {
  try {
    const bytes = CryptoJS.AES.decrypt(hashedPassword, process.env.SECRET_KEY);
    const password = bytes.toString(CryptoJS.enc.Utf8);

    return password;
  } catch (error) {
    console.log(error);
  }
};

const formatCurrentDate = () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const day = currentDate.getDate().toString().padStart(2, "0");
  const hours = currentDate.getHours().toString().padStart(2, "0");
  const minutes = currentDate.getMinutes().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

module.exports = { hashPassword, decryptPassword, formatCurrentDate };
