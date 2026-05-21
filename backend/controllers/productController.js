const Product = require("../models/Product");

const FIXED_PRICE = 399;

const getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSingleProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, category, gender, description, image, stock, badge } = req.body;

    if (!name || !category || !gender || !description || !image) {
      return res.status(400).json({
        success: false,
        message: "Name, category, gender, description and image are required",
      });
    }

    const safeStock = Number(stock);

    const product = await Product.create({
      name,
      category,
      gender,
      description,
      image,
      price: FIXED_PRICE,
      stock: Number.isFinite(safeStock) && safeStock >= 0 ? safeStock : 50,
      badge: badge || "New",
      rating: 0,
      numReviews: 0,
      reviews: 0,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const { name, category, gender, description, image, stock, badge } = req.body;

    if (name !== undefined) product.name = name;
    if (category !== undefined) product.category = category;
    if (gender !== undefined) product.gender = gender;
    if (description !== undefined) product.description = description;
    if (image !== undefined) product.image = image;
    if (badge !== undefined) product.badge = badge;

    if (stock !== undefined) {
      const safeStock = Number(stock);

      if (!Number.isFinite(safeStock) || safeStock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a valid number greater than or equal to 0",
        });
      }

      product.stock = safeStock;
    }

    product.price = FIXED_PRICE;

    const updatedProduct = await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      productId: req.params.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getProducts,
  getSingleProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
