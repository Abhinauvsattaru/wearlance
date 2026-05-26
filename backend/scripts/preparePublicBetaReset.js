require("dotenv").config();

const mongoose = require("mongoose");
const path = require("path");

const User = require("../models/User");

let DeliveryPartner = null;
let cloudinary = null;

try {
  DeliveryPartner = require("../models/DeliveryPartner");
} catch (error) {
  console.log("DeliveryPartner model not found. Skipping license file cleanup.");
}

try {
  cloudinary = require("../config/cloudinary");
} catch (error) {
  console.log("Cloudinary config not found. Skipping Cloudinary file deletion.");
}

const CONFIRM_TEXT = "RESET-WEARLANCE-BETA";

const preserveEmails = String(
  process.env.PRESERVE_ADMIN_EMAILS ||
    process.env.ADMIN_EMAILS ||
    "abhinauv22@gmail.com"
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const collectionsToClear = [
  "orders",
  "reviews",
  "deliverypartners",
  "deliveryaccessinvites",
  "deliverylogs",
  "payments",
];

const countCollection = async (name) => {
  const exists = await mongoose.connection.db
    .listCollections({ name })
    .hasNext();

  if (!exists) return 0;

  return mongoose.connection.db.collection(name).countDocuments({});
};

const deleteCollection = async (name) => {
  const exists = await mongoose.connection.db
    .listCollections({ name })
    .hasNext();

  if (!exists) {
    return { collection: name, deleted: 0, skipped: true };
  }

  const result = await mongoose.connection.db.collection(name).deleteMany({});
  return { collection: name, deleted: result.deletedCount || 0 };
};

const destroyCloudinaryAsset = async (publicId) => {
  if (!cloudinary || !publicId) return false;

  const resourceTypes = ["image", "raw", "video"];

  for (const resourceType of resourceTypes) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      if (result && ["ok", "not found"].includes(result.result)) {
        return true;
      }
    } catch (error) {
      // Try next resource type.
    }
  }

  return false;
};

const cleanupDeliveryLicenseFiles = async (dryRun) => {
  if (!DeliveryPartner || !cloudinary) {
    return {
      found: 0,
      deleted: 0,
      skipped: true,
    };
  }

  const partners = await DeliveryPartner.find({
    "drivingLicense.publicId": { $exists: true, $ne: "" },
  }).select("email drivingLicense.publicId");

  if (dryRun) {
    return {
      found: partners.length,
      deleted: 0,
      skipped: false,
    };
  }

  let deleted = 0;

  for (const partner of partners) {
    const ok = await destroyCloudinaryAsset(partner.drivingLicense.publicId);

    if (ok) deleted += 1;
  }

  return {
    found: partners.length,
    deleted,
    skipped: false,
  };
};

const run = async () => {
  const confirmed =
    process.argv.includes("--confirm") &&
    process.env.CONFIRM_PUBLIC_RESET === CONFIRM_TEXT;

  const dryRun = !confirmed;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI missing in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log("\n==================================================");
  console.log("WEARLANCE PUBLIC BETA CLEANUP");
  console.log("==================================================");
  console.log(`Mode: ${dryRun ? "DRY RUN - no data will be deleted" : "CONFIRMED DELETE MODE"}`);
  console.log(`Preserved admin emails: ${preserveEmails.join(", ")}`);
  console.log("Products are NOT deleted.");
  console.log("Admin users are NOT deleted.");
  console.log("==================================================\n");

  const counts = {};

  for (const name of collectionsToClear) {
    counts[name] = await countCollection(name);
  }

  const nonAdminUsersCount = await User.countDocuments({
    isAdmin: { $ne: true },
    email: { $nin: preserveEmails },
  });

  const adminUsersCount = await User.countDocuments({
    $or: [{ isAdmin: true }, { email: { $in: preserveEmails } }],
  });

  const licenseCleanup = await cleanupDeliveryLicenseFiles(true);

  console.log("Data that will be cleared:");
  for (const [name, count] of Object.entries(counts)) {
    console.log(`- ${name}: ${count}`);
  }

  console.log(`- non-admin/test users: ${nonAdminUsersCount}`);
  console.log(`- delivery license Cloudinary files found: ${licenseCleanup.found}`);
  console.log(`\nData preserved:`);
  console.log(`- admin users: ${adminUsersCount}`);
  console.log("- products/product images: preserved");
  console.log("- Cloudinary product images: preserved");

  if (dryRun) {
    console.log("\nDRY RUN complete. Nothing was deleted.");
    console.log("\nTo actually clear test data, run:");
    console.log(`$env:CONFIRM_PUBLIC_RESET="${CONFIRM_TEXT}"`);
    console.log("node scripts/preparePublicBetaReset.js --confirm\n");
    await mongoose.disconnect();
    return;
  }

  console.log("\nDeleting test data...\n");

  const cloudinaryResult = await cleanupDeliveryLicenseFiles(false);
  console.log(
    `Cloudinary delivery license cleanup: ${cloudinaryResult.deleted}/${cloudinaryResult.found} deleted`
  );

  for (const name of collectionsToClear) {
    const result = await deleteCollection(name);
    console.log(
      `${result.collection}: ${result.skipped ? "collection missing/skipped" : `${result.deleted} deleted`}`
    );
  }

  const userDeleteResult = await User.deleteMany({
    isAdmin: { $ne: true },
    email: { $nin: preserveEmails },
  });

  console.log(`non-admin/test users: ${userDeleteResult.deletedCount || 0} deleted`);

  await User.updateMany(
    {
      $or: [{ isAdmin: true }, { email: { $in: preserveEmails } }],
    },
    {
      $set: {
        otp: null,
        otpExpires: null,
      },
    }
  );

  console.log("Admin OTP fields cleared.");

  await mongoose.disconnect();

  console.log("\n✅ Wearlance test data cleanup complete.");
  console.log("You can now start public COD beta with clean orders/users/delivery data.\n");
};

run().catch(async (error) => {
  console.error("\nCleanup failed:", error.message);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});
