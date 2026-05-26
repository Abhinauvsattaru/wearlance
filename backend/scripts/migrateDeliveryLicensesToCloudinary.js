require("dotenv").config();

const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const DeliveryPartner = require("../models/DeliveryPartner");

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const uploadLicenseToCloudinary = ({ data, fileName, mimeType, applicantEmail }) => {
  return new Promise((resolve, reject) => {
    const safeEmail = normalizeEmail(applicantEmail).replace(/[^a-z0-9._-]/g, "-");
    const safeFileName = String(fileName || "driving-license")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 90);

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `wearlance/delivery-licenses/${safeEmail || "unknown"}`,
        resource_type: "auto",
        public_id: `${Date.now()}-${safeFileName}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    const base64Payload = String(data || "").split(",")[1];

    if (!base64Payload) {
      reject(new Error("Invalid base64 data"));
      return;
    }

    stream.end(Buffer.from(base64Payload, "base64"));
  });
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const partners = await DeliveryPartner.find({
    "drivingLicense.data": { $regex: "^data:" },
    $or: [
      { "drivingLicense.url": { $exists: false } },
      { "drivingLicense.url": "" },
      { "drivingLicense.url": null },
    ],
  });

  console.log(`Found ${partners.length} old base64 license record(s).`);

  for (const partner of partners) {
    try {
      const uploaded = await uploadLicenseToCloudinary({
        data: partner.drivingLicense.data,
        fileName: partner.drivingLicense.fileName,
        mimeType: partner.drivingLicense.mimeType,
        applicantEmail: partner.email,
      });

      partner.drivingLicense.url = uploaded.secure_url || "";
      partner.drivingLicense.publicId = uploaded.public_id || "";
      partner.drivingLicense.data = "";
      partner.drivingLicense.uploadedAt = partner.drivingLicense.uploadedAt || new Date();

      await partner.save();

      console.log(`Migrated: ${partner.email}`);
    } catch (error) {
      console.error(`Failed: ${partner.email}`, error.message);
    }
  }

  await mongoose.disconnect();
  console.log("Migration complete.");
};

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
