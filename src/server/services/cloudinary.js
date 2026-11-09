import { v2 as cloudinary } from 'cloudinary';

const CLOUDINARY_RESOURCE_TYPE = 'image';
const CLOUDINARY_DELIVERY_TYPE = 'authenticated';

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
      && process.env.CLOUDINARY_API_KEY
      && process.env.CLOUDINARY_API_SECRET,
  );
}

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error('Configure the Cloudinary cloud name, API key, and API secret.');
    error.status = 503;
    throw error;
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export function createCloudinaryUploadParams(publicId) {
  const client = getCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    allowed_formats: 'pdf',
    public_id: publicId,
    timestamp,
    type: CLOUDINARY_DELIVERY_TYPE,
  };
  return {
    ...params,
    signature: client.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET),
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    resource_type: CLOUDINARY_RESOURCE_TYPE,
    upload_url: client.uploader.upload_url({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      resource_type: CLOUDINARY_RESOURCE_TYPE,
    }),
  };
}

export async function uploadCloudinaryPdf(publicId, buffer) {
  const client = getCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream({
      public_id: publicId,
      resource_type: CLOUDINARY_RESOURCE_TYPE,
      type: CLOUDINARY_DELIVERY_TYPE,
      format: 'pdf',
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false,
    }, (error, result) => {
      if (error) {
        reject(error);
      } else if (!result) {
        reject(new Error('Cloudinary returned no result for the generated PDF upload.'));
      } else {
        resolve(result);
      }
    });
    uploadStream.end(buffer);
  });
}

export async function readCloudinaryPdf(publicId) {
  const client = getCloudinary();
  const url = client.utils.private_download_url(publicId, 'pdf', {
    resource_type: CLOUDINARY_RESOURCE_TYPE,
    type: CLOUDINARY_DELIVERY_TYPE,
    expires_at: Math.floor(Date.now() / 1000) + 300,
    attachment: true,
  });
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Cloudinary could not retrieve the stored PDF (HTTP ${response.status}).`);
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('Cloudinary returned a file that is not a valid PDF.');
  }
  return buffer;
}
