const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const uploadFileToS3 = async file => {
  const { name, buffer } = file;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `uploads/${name}`, // 한글 파일 이름을 그대로 사용
    Body: buffer,
  };

  try {
    const uploadResult = await s3.upload(uploadParams).promise();
    return uploadResult;
  } catch (error) {
    console.error("Error uploading file to S3", error);
    throw error;
  }
};

module.exports = { uploadFileToS3 };
