const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

const uploadFileToS3 = async file => {
  const { name, buffer } = file;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `uploads/${name}`,
    Body: buffer,
  };

  try {
    const uploader = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    const uploadResult = await uploader.done();
    return uploadResult;
  } catch (error) {
    console.error("Error uploading file to S3", error);
    throw error;
  }
};

module.exports = { uploadFileToS3 };
