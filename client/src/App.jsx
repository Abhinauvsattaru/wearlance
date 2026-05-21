import { useEffect, useMemo, useState } from "react";

const FIXED_PRICE = 399;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const PRODUCT_API = `${API_BASE}/api/products`;
const AUTH_API = `${API_BASE}/api/auth`;
const UPLOAD_API = `${API_BASE}/api/upload/image`;
const ORDER_API = `${API_BASE}/api/orders`;
const PAYMENT_API = `${API_BASE}/api/payments`;
const INVOICE_API = `${API_BASE}/api/invoices`;
const REVIEW_API = `${API_BASE}/api/reviews`;

const ADMIN_EMAILS = [
  "abhinauv22@gmail.com",
  "abhinauvo5s@gmail.com",
  "fordealpen@gmail.com",
];

const categories = [
  "All",
  "T-Shirts",
  "Hoodies",
  "Sweatshirts",
  "Jackets",
  "Formal",
  "Bottomwear",
  "Dresses",
  "Ethnic",
  "Sportswear",
];

const genders = ["All", "Men", "Women", "Unisex"];

const orderStatuses = [
  "Placed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivery Verification Pending",
  "Delivered",
  "Return Requested",
  "Return Approved",
  "Returned",
  "Return Rejected",
  "Cancelled",
];

function safeJsonParse(value) {
  try {
    if (!value || value === "undefined" || value === "null") return null;
    return JSON.parse(value);
  } catch {
    localStorage.removeItem("wearlanceUser");
    localStorage.removeItem("wearlanceToken");
    return null;
  }
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState("home");

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedGender, setSelectedGender] = useState("All");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState("");

  const [myOrders, setMyOrders] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [user, setUser] = useState(() =>
    safeJsonParse(localStorage.getItem("wearlanceUser"))
  );

  const [token, setToken] = useState(() => {
    return localStorage.getItem("wearlanceToken") || "";
  });

  const isAdmin =
    user &&
    (user.isAdmin ||
      ADMIN_EMAILS.includes(String(user.email || "").toLowerCase()));

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [otpForm, setOtpForm] = useState({
    email: "",
    otp: "",
  });

  const [forgotForm, setForgotForm] = useState({
    email: "",
  });

  const [resetForm, setResetForm] = useState({
    email: "",
    otp: "",
    newPassword: "",
  });

  const [checkoutForm, setCheckoutForm] = useState({
    fullName: user?.name || "",
    phone: "",
    email: user?.email || "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "COD",
  });

  const [adminForm, setAdminForm] = useState({
    editingId: "",
    name: "",
    category: "T-Shirts",
    gender: "Unisex",
    description: "",
    image: "",
    stock: 50,
    badge: "New",
  });

  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const theme = {
    bg: dark ? "#07111f" : "#f3f6fb",
    panel: dark ? "#0f172a" : "#ffffff",
    panel2: dark ? "#111827" : "#ffffff",
    text: dark ? "#f8fafc" : "#101827",
    muted: dark ? "#9ca3af" : "#64748b",
    border: dark ? "#243244" : "#e2e8f0",
    nav: dark ? "#020617" : "#111827",
    subnav: dark ? "#0f172a" : "#232f3e",
    orange: "#ff9900",
    orange2: "#fb641b",
    blue: "#2874f0",
    pink: "#ec4899",
    green: "#16a34a",
    red: "#ef4444",
    purple: "#7c3aed",
    yellow: "#facc15",
  };

  useEffect(() => {
    if (user) {
      setCheckoutForm((prev) => ({
        ...prev,
        fullName: prev.fullName || user.name || "",
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const saveLogin = (data) => {
    if (!data.user || !data.token) {
      showToast("Login response incomplete. Please try again.");
      return;
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("wearlanceUser", JSON.stringify(data.user));
    localStorage.setItem("wearlanceToken", data.token);
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("wearlanceUser");
    localStorage.removeItem("wearlanceToken");
    setPage("home");
    showToast("Logged out successfully");
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await fetch(PRODUCT_API);
      const data = await response.json();

      if (data.success) {
        setProducts(data.products);
      } else {
        showToast(data.message || "Could not load products");
      }
    } catch (error) {
      console.error(error);
      showToast("Backend is not responding");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const query = search.toLowerCase();

      const matchesSearch =
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.gender?.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory;

      const matchesGender =
        selectedGender === "All" || product.gender === selectedGender;

      return matchesSearch && matchesCategory && matchesGender;
    });
  }, [products, search, selectedCategory, selectedGender]);

  const getProductId = (product) => product._id || product.id;

  const getCartKey = (product) => {
    return `${getProductId(product)}-${product.selectedSize || "NOSIZE"}`;
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cartCount * FIXED_PRICE;

  const addToCart = (product) => {
    const productKey = getCartKey(product);

    setCart((prev) => {
      const exists = prev.find((item) => getCartKey(item) === productKey);

      if (exists) {
        return prev.map((item) =>
          getCartKey(item) === productKey
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }

      return [...prev, { ...product, qty: 1 }];
    });

    showToast(
      product.selectedSize
        ? `${product.name} - Size ${product.selectedSize} added to cart`
        : `${product.name} added to cart`
    );
  };

  const increaseQty = (key) => {
    setCart((prev) =>
      prev.map((item) =>
        getCartKey(item) === key ? { ...item, qty: item.qty + 1 } : item
      )
    );
  };

  const decreaseQty = (key) => {
    setCart((prev) =>
      prev.map((item) =>
        getCartKey(item) === key
          ? { ...item, qty: Math.max(1, item.qty - 1) }
          : item
      )
    );
  };

  const removeFromCart = (key) => {
    setCart((prev) => prev.filter((item) => getCartKey(item) !== key));
    showToast("Product removed from cart");
  };

  const loginUser = async (e) => {
    e.preventDefault();

    if (!loginForm.email || !loginForm.password) {
      showToast("Enter email and password");
      return;
    }

    try {
      const response = await fetch(`${AUTH_API}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.requiresOtp && data.email) {
          setOtpForm({
            email: data.email,
            otp: "",
          });
          setPage("verifySignupOtp");
          showToast(data.message || "OTP sent to verify account");
          return;
        }

        showToast(data.message || "Login failed");
        return;
      }

      saveLogin(data);
      showToast(data.user?.isAdmin ? "Admin login successful" : "Login successful");
      setPage("home");
    } catch (error) {
      console.error(error);
      showToast("Backend error during login");
    }
  };

  const signupUser = async (e) => {
    e.preventDefault();

    if (!signupForm.name || !signupForm.email || !signupForm.password) {
      showToast("Fill all signup fields");
      return;
    }

    try {
      const response = await fetch(`${AUTH_API}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signupForm),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Signup failed");
        return;
      }

      if (data.requiresOtp) {
        setOtpForm({
          email: data.email || signupForm.email,
          otp: "",
        });
        setPage("verifySignupOtp");
        showToast("OTP sent to your email");
        return;
      }

      showToast("Signup response received");
    } catch (error) {
      console.error(error);
      showToast("Backend error during signup");
    }
  };

  const verifySignupOtp = async (e) => {
    e.preventDefault();

    if (!otpForm.email || !otpForm.otp) {
      showToast("Enter OTP");
      return;
    }

    try {
      const response = await fetch(`${AUTH_API}/verify-signup-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: otpForm.email,
          otp: otpForm.otp,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "OTP verification failed");
        return;
      }

      saveLogin(data);
      showToast("Account verified successfully");
      setPage("home");
    } catch (error) {
      console.error(error);
      showToast("OTP verification failed");
    }
  };

  const resendSignupOtp = async () => {
    if (!otpForm.email) {
      showToast("Email missing");
      return;
    }

    try {
      const response = await fetch(`${AUTH_API}/resend-signup-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: otpForm.email,
        }),
      });

      const data = await response.json();
      showToast(data.message || (data.success ? "OTP resent" : "Could not resend OTP"));
    } catch (error) {
      console.error(error);
      showToast("Could not resend OTP");
    }
  };

  const forgotPassword = async (e) => {
    e.preventDefault();

    if (!forgotForm.email) {
      showToast("Enter your email");
      return;
    }

    try {
      const response = await fetch(`${AUTH_API}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotForm.email,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Could not send reset OTP");
        return;
      }

      setResetForm({
        email: data.email || forgotForm.email,
        otp: "",
        newPassword: "",
      });

      showToast("Password reset OTP sent");
      setPage("resetPassword");
    } catch (error) {
      console.error(error);
      showToast("Forgot password failed");
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();

    if (!resetForm.email || !resetForm.otp || !resetForm.newPassword) {
      showToast("Fill email, OTP and new password");
      return;
    }

    try {
      const response = await fetch(`${AUTH_API}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resetForm),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Password reset failed");
        return;
      }

      showToast("Password reset successful. Login now.");
      setLoginForm({
        email: resetForm.email,
        password: "",
      });
      setPage("login");
    } catch (error) {
      console.error(error);
      showToast("Password reset failed");
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

    if (!allowed.includes(file.type)) {
      showToast("Only JPG, PNG, and WEBP images are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be less than 5MB");
      return;
    }

    setSelectedImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImageToCloudinary = async () => {
    if (!isAdmin) {
      showToast("Only admin can upload images");
      return "";
    }

    if (!token) {
      showToast("Login as admin first");
      setPage("login");
      return "";
    }

    if (!selectedImageFile) {
      showToast("Choose an image first");
      return "";
    }

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("image", selectedImageFile);

      const response = await fetch(UPLOAD_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Image upload failed");
        return "";
      }

      setAdminForm((prev) => ({
        ...prev,
        image: data.imageUrl,
      }));

      showToast("Image uploaded to Cloudinary");
      return data.imageUrl;
    } catch (error) {
      console.error(error);
      showToast("Cloudinary upload failed");
      return "";
    } finally {
      setUploadingImage(false);
    }
  };

  const addAdminProduct = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      showToast("Only admin can upload products");
      return;
    }

    if (!token) {
      showToast("Please login as admin first");
      setPage("login");
      return;
    }

    if (!adminForm.name || !adminForm.description) {
      showToast("Fill product name and description");
      return;
    }

    let finalImage = adminForm.image;

    if (!finalImage && selectedImageFile) {
      finalImage = await uploadImageToCloudinary();
    }

    if (!finalImage) {
      showToast("Please upload/select product image");
      return;
    }

    try {
      const editingId = adminForm.editingId;

      const response = await fetch(
        editingId ? `${PRODUCT_API}/${editingId}` : PRODUCT_API,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: adminForm.name,
            category: adminForm.category,
            gender: adminForm.gender,
            description: adminForm.description,
            image: finalImage,
            stock: Number(adminForm.stock),
            badge: adminForm.badge,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Product upload failed");
        return;
      }

      setProducts((prev) =>
        adminForm.editingId
          ? prev.map((item) => getProductId(item) === adminForm.editingId ? data.product : item)
          : [data.product, ...prev]
      );

      setAdminForm({
        editingId: "",
        name: "",
        category: "T-Shirts",
        gender: "Unisex",
        description: "",
        image: "",
        stock: 50,
        badge: "New",
      });

      setSelectedImageFile(null);
      setImagePreview("");

      showToast(adminForm.editingId ? "Product updated successfully" : "Product uploaded successfully");
      setPage("home");
    } catch (error) {
      console.error(error);
      showToast("Product upload failed");
    }
  };

  const buildOrderPayload = () => {
    return {
      orderItems: cart.map((item) => ({
        product: getProductId(item),
        name: item.name,
        image: item.image,
        category: item.category,
        size: item.selectedSize,
        quantity: item.qty,
        price: FIXED_PRICE,
      })),
      shippingAddress: {
        fullName: checkoutForm.fullName,
        phone: checkoutForm.phone,
        email: checkoutForm.email,
        addressLine1: checkoutForm.addressLine1,
        addressLine2: checkoutForm.addressLine2,
        city: checkoutForm.city,
        state: checkoutForm.state,
        pincode: checkoutForm.pincode,
      },
      paymentMethod: checkoutForm.paymentMethod,
    };
  };

  const validateCheckout = () => {
    if (!user || !token) {
      showToast("Please login before checkout");
      setPage("login");
      return false;
    }

    if (cart.length === 0) {
      showToast("Your cart is empty");
      return false;
    }

    const requiredFields = [
      "fullName",
      "phone",
      "email",
      "addressLine1",
      "city",
      "state",
      "pincode",
    ];

    for (const field of requiredFields) {
      if (!checkoutForm[field]) {
        showToast("Please fill complete delivery address");
        return false;
      }
    }

    const invalidSize = cart.find((item) => !item.selectedSize);

    if (invalidSize) {
      showToast("Every product must have selected size");
      return false;
    }

    return true;
  };

  const placeCodOrder = async () => {
    const response = await fetch(ORDER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildOrderPayload()),
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message || "Order failed");
      return;
    }

    setCart([]);
    showToast("COD order placed successfully");
    await fetchProducts();
    await fetchMyOrders();
    setPage("myOrders");
  };

  const placeRazorpayOrder = async () => {
    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded) {
      showToast("Razorpay failed to load. Check internet connection.");
      return;
    }

    const orderPayload = {
      ...buildOrderPayload(),
      paymentMethod: "Razorpay",
    };

    const createResponse = await fetch(`${PAYMENT_API}/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const createData = await createResponse.json();

    if (!createData.success) {
      showToast(createData.message || "Could not start Razorpay payment");
      return;
    }

    const options = {
      key: createData.keyId,
      amount: createData.razorpayOrder.amount,
      currency: createData.razorpayOrder.currency,
      name: "Wearlance",
      description: "Every Style ₹399",
      order_id: createData.razorpayOrder.id,
      prefill: {
        name: checkoutForm.fullName,
        email: checkoutForm.email,
        contact: checkoutForm.phone,
      },
      notes: {
        brand: "Wearlance",
        customer: checkoutForm.fullName,
      },
      theme: {
        color: "#fb641b",
      },
      handler: async function (response) {
        try {
          setPlacingOrder(true);

          const verifyResponse = await fetch(`${PAYMENT_API}/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderData: orderPayload,
            }),
          });

          const verifyData = await verifyResponse.json();

          if (!verifyData.success) {
            showToast(verifyData.message || "Payment verification failed");
            return;
          }

          setCart([]);
          showToast("Payment successful. Order placed.");
          await fetchProducts();
          await fetchMyOrders();
          setPage("myOrders");
        } catch (error) {
          console.error(error);
          showToast("Payment verification failed");
        } finally {
          setPlacingOrder(false);
        }
      },
      modal: {
        ondismiss: function () {
          showToast("Payment cancelled");
          setPlacingOrder(false);
        },
      },
    };

    const paymentObject = new window.Razorpay(options);

    paymentObject.on("payment.failed", function (response) {
      console.error(response.error);
      showToast(response.error?.description || "Payment failed");
      setPlacingOrder(false);
    });

    paymentObject.open();
  };

  const placeOrder = async (e) => {
    e.preventDefault();

    if (!validateCheckout()) return;

    try {
      setPlacingOrder(true);

      if (checkoutForm.paymentMethod === "Razorpay") {
        await placeRazorpayOrder();
        return;
      }

      await placeCodOrder();
    } catch (error) {
      console.error(error);
      showToast("Order placement failed");
    } finally {
      if (checkoutForm.paymentMethod !== "Razorpay") {
        setPlacingOrder(false);
      }
    }
  };

  const fetchMyOrders = async () => {
    if (!token) {
      showToast("Please login first");
      setPage("login");
      return;
    }

    try {
      setLoadingOrders(true);

      const response = await fetch(`${ORDER_API}/my-orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Could not load orders");
        return;
      }

      setMyOrders(data.orders);
    } catch (error) {
      console.error(error);
      showToast("Could not load your orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchAdminOrders = async () => {
    if (!isAdmin || !token) {
      showToast("Admin login required");
      return;
    }

    try {
      setLoadingOrders(true);

      const response = await fetch(`${ORDER_API}/admin/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Could not load admin orders");
        return;
      }

      setAdminOrders(data.orders);
    } catch (error) {
      console.error(error);
      showToast("Could not load admin orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const updateOrderStatus = async (orderId, orderStatus) => {
    if (!isAdmin || !token) {
      showToast("Admin login required");
      return;
    }

    try {
      const response = await fetch(`${ORDER_API}/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderStatus,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Status update failed");
        return;
      }

      setAdminOrders((prev) =>
        prev.map((order) => (order._id === orderId ? data.order : order))
      );

      showToast("Order status updated");
    } catch (error) {
      console.error(error);
      showToast("Order status update failed");
    }
  };


  const verifyDeliveryOtp = async (orderId, otp) => {
    if (!token) {
      showToast("Please login first");
      setPage("login");
      return;
    }

    if (!otp) {
      showToast("Enter delivery OTP");
      return;
    }

    try {
      const response = await fetch(`${ORDER_API}/${orderId}/verify-delivery`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp }),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Delivery OTP verification failed");
        return;
      }

      setMyOrders((prev) =>
        prev.map((order) => (order._id === orderId ? data.order : order))
      );

      showToast("Delivery confirmed successfully");
      await fetchMyOrders();
    } catch (error) {
      console.error(error);
      showToast("Delivery verification failed");
    }
  };

  const createReview = async ({ productId, orderId, rating, comment }) => {
    if (!token) {
      showToast("Please login first");
      setPage("login");
      return false;
    }

    if (!productId || !orderId || !rating || !comment) {
      showToast("Rating and review message are required");
      return false;
    }

    try {
      const response = await fetch(REVIEW_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          orderId,
          rating,
          comment,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Review failed");
        return false;
      }

      setProducts((prev) =>
        prev.map((product) =>
          getProductId(product) === productId ? data.product : product
        )
      );

      showToast("Review added successfully");
      return true;
    } catch (error) {
      console.error(error);
      showToast("Review failed");
      return false;
    }
  };


  const cancelMyOrder = async (orderId) => {
    if (!token) {
      showToast("Please login first");
      setPage("login");
      return;
    }

    try {
      const response = await fetch(`${ORDER_API}/${orderId}/cancel`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Cancel failed");
        return;
      }

      setMyOrders((prev) =>
        prev.map((order) => (order._id === orderId ? data.order : order))
      );

      showToast("Order cancelled successfully");
      await fetchProducts();
      await fetchMyOrders();
    } catch (error) {
      console.error(error);
      showToast("Cancel order failed");
    }
  };

  const requestReturnOrder = async (orderId, reason) => {
    if (!token) {
      showToast("Please login first");
      setPage("login");
      return;
    }

    if (!reason) {
      showToast("Please enter return reason");
      return;
    }

    try {
      const response = await fetch(`${ORDER_API}/${orderId}/return`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || "Return request failed");
        return;
      }

      setMyOrders((prev) =>
        prev.map((order) => (order._id === orderId ? data.order : order))
      );

      showToast("Return request submitted");
      await fetchMyOrders();
    } catch (error) {
      console.error(error);
      showToast("Return request failed");
    }
  };


  const downloadInvoice = async (orderId) => {
    if (!token) {
      showToast("Please login first");
      setPage("login");
      return;
    }

    try {
      const response = await fetch(`${INVOICE_API}/${orderId}/download`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let message = "Invoice download failed";

        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // response is not JSON
        }

        showToast(message);
        return;
      }

      const blob = await response.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = fileUrl;
      link.download = `wearlance-invoice-${String(orderId).slice(-8).toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(fileUrl);

      showToast("Invoice downloaded");
    } catch (error) {
      console.error(error);
      showToast("Invoice download failed");
    }
  };

  const openMyOrders = async () => {
    await fetchMyOrders();
    setPage("myOrders");
  };

  const openAdminOrders = async () => {
    await fetchAdminOrders();
    setPage("adminOrders");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <GlobalStyles />

      <Navbar
        theme={theme}
        dark={dark}
        setDark={setDark}
        setPage={setPage}
        search={search}
        setSearch={setSearch}
        user={user}
        isAdmin={isAdmin}
        logout={logout}
        cartCount={cartCount}
        openMyOrders={openMyOrders}
      />

      <SubNavbar
        theme={theme}
        setPage={setPage}
        isAdmin={isAdmin}
        user={user}
        openMyOrders={openMyOrders}
        openAdminOrders={openAdminOrders}
      />

      <MobileBottomBar
        setPage={setPage}
        cartCount={cartCount}
        user={user}
        isAdmin={isAdmin}
        openMyOrders={openMyOrders}
        openAdminOrders={openAdminOrders}
      />

      {page === "home" && (
        <HomePage
          theme={theme}
          products={filteredProducts}
          loadingProducts={loadingProducts}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedGender={selectedGender}
          setSelectedGender={setSelectedGender}
          setPage={setPage}
          setSelectedProduct={setSelectedProduct}
          fetchProducts={fetchProducts}
          isAdmin={isAdmin}
        />
      )}

      {page === "product" && selectedProduct && (
        <ProductDetails
          theme={theme}
          product={selectedProduct}
          setPage={setPage}
          addToCart={addToCart}
          showToast={showToast}
        />
      )}

      {page === "cart" && (
        <CartPage
          theme={theme}
          cart={cart}
          cartCount={cartCount}
          cartTotal={cartTotal}
          increaseQty={increaseQty}
          decreaseQty={decreaseQty}
          removeFromCart={removeFromCart}
          setPage={setPage}
          getCartKey={getCartKey}
          user={user}
          showToast={showToast}
        />
      )}

      {page === "checkout" && (
        <CheckoutPage
          theme={theme}
          cart={cart}
          cartCount={cartCount}
          cartTotal={cartTotal}
          checkoutForm={checkoutForm}
          setCheckoutForm={setCheckoutForm}
          placeOrder={placeOrder}
          placingOrder={placingOrder}
          setPage={setPage}
          user={user}
        />
      )}

      {page === "myOrders" && (
        <MyOrdersPage
          theme={theme}
          orders={myOrders}
          loadingOrders={loadingOrders}
          fetchMyOrders={fetchMyOrders}
          setPage={setPage}
          verifyDeliveryOtp={verifyDeliveryOtp}
          createReview={createReview}
          cancelMyOrder={cancelMyOrder}
          requestReturnOrder={requestReturnOrder}
          downloadInvoice={downloadInvoice}
        />
      )}

      {page === "adminOrders" &&
        (isAdmin ? (
          <AdminOrdersPage
            theme={theme}
            orders={adminOrders}
            loadingOrders={loadingOrders}
            fetchAdminOrders={fetchAdminOrders}
            updateOrderStatus={updateOrderStatus}
            downloadInvoice={downloadInvoice}
          />
        ) : (
          <AccessDenied theme={theme} setPage={setPage} />
        ))}

      {page === "admin" &&
        (isAdmin ? (
          <AdminPage
            theme={theme}
            products={products}
            setProducts={setProducts}
            adminForm={adminForm}
            setAdminForm={setAdminForm}
            addAdminProduct={addAdminProduct}
            fetchProducts={fetchProducts}
            showToast={showToast}
            getProductId={getProductId}
            token={token}
            handleImageSelect={handleImageSelect}
            uploadImageToCloudinary={uploadImageToCloudinary}
            selectedImageFile={selectedImageFile}
            imagePreview={imagePreview}
            uploadingImage={uploadingImage}
          />
        ) : (
          <AccessDenied theme={theme} setPage={setPage} />
        ))}

      {page === "login" && (
        <LoginPage
          theme={theme}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          loginUser={loginUser}
          setPage={setPage}
        />
      )}

      {page === "signup" && (
        <SignupPage
          theme={theme}
          signupForm={signupForm}
          setSignupForm={setSignupForm}
          signupUser={signupUser}
          setPage={setPage}
        />
      )}

      {page === "verifySignupOtp" && (
        <VerifySignupOtpPage
          theme={theme}
          otpForm={otpForm}
          setOtpForm={setOtpForm}
          verifySignupOtp={verifySignupOtp}
          resendSignupOtp={resendSignupOtp}
          setPage={setPage}
        />
      )}

      {page === "forgotPassword" && (
        <ForgotPasswordPage
          theme={theme}
          forgotForm={forgotForm}
          setForgotForm={setForgotForm}
          forgotPassword={forgotPassword}
          setPage={setPage}
        />
      )}

      {page === "resetPassword" && (
        <ResetPasswordPage
          theme={theme}
          resetForm={resetForm}
          setResetForm={setResetForm}
          resetPassword={resetPassword}
          setPage={setPage}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      * {
        box-sizing: border-box;
      }

      html {
        width: 100%;
        overflow-x: hidden;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        width: 100%;
        overflow-x: hidden;
      }

      img {
        max-width: 100%;
      }

      button,
      input,
      select,
      textarea {
        font-family: inherit;
        font-size: 16px;
      }

      input,
      select,
      textarea {
        min-height: 44px;
      }

      button {
        transition: 0.18s ease;
        min-height: 42px;
        touch-action: manipulation;
      }

      button:hover {
        filter: brightness(1.03);
      }

      button:active {
        transform: scale(0.98);
      }

      .hoverLift {
        transition: transform 0.22s ease, box-shadow 0.22s ease;
      }

      .hoverLift:hover {
        transform: translateY(-7px);
      }

      .hideMobile {
        display: flex;
      }

      .mobileBottomBar {
        display: none;
      }

      .filterRow {
        display: flex;
        gap: 12px;
        overflow-x: visible !important;
        flex-wrap: wrap;
        padding-bottom: 8px;
        max-width: 100%;
      }

      .cartItemRow {
        min-width: 0;
      }

      .cartItemInfo {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .cartItemActions {
        flex-wrap: wrap;
      }

      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 999px;
      }

      @media (max-width: 1100px) {
        .heroGrid,
        .adminGrid,
        .cartGrid,
        .authGrid,
        .detailsGrid,
        .checkoutGrid {
          grid-template-columns: 1fr !important;
        }

        .adminGrid > *,
        .cartGrid > *,
        .checkoutGrid > *,
        .detailsGrid > *,
        .authGrid > * {
          min-width: 0 !important;
        }
      }

      @media (max-width: 700px) {
        body {
          padding-bottom: 82px;
          background: #f3f6fb;
        }

        .subNav {
          display: none !important;
        }

        .topNavInner {
          display: grid !important;
          grid-template-columns: 1fr auto auto !important;
          align-items: center !important;
          padding: 10px 12px !important;
          gap: 10px !important;
        }

        .brandBlock h1 {
          font-size: 24px !important;
          line-height: 1 !important;
          letter-spacing: -0.6px !important;
        }

        .brandBlock p {
          font-size: 8px !important;
          letter-spacing: 1.2px !important;
        }

        .topNavInner > button {
          justify-self: end;
          padding: 9px 11px !important;
          font-size: 13px !important;
          border-radius: 12px !important;
        }

        .navSearch {
          grid-column: 1 / -1;
          order: initial !important;
          width: 100% !important;
          max-width: none !important;
          flex: none !important;
          border-radius: 14px !important;
          box-shadow: 0 8px 20px rgba(15,23,42,0.09);
        }

        .navSearch select {
          display: none !important;
        }

        .navSearch input {
          height: 46px !important;
          padding: 0 13px !important;
          font-size: 14px !important;
          min-width: 0 !important;
        }

        .navSearch button {
          padding: 0 16px !important;
          min-width: 52px !important;
        }

        .hideMobile {
          display: none !important;
        }

        .mobileBottomBar {
          position: fixed;
          left: 10px;
          right: 10px;
          bottom: calc(10px + env(safe-area-inset-bottom));
          z-index: 100;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 9px;
          border-radius: 22px;
          background: rgba(17, 24, 39, 0.94);
          color: #fff;
          box-shadow: 0 18px 40px rgba(0,0,0,0.28);
          backdrop-filter: blur(16px);
        }

        .mobileBottomBar button {
          min-height: 48px;
          border: none;
          border-radius: 15px;
          background: rgba(255,255,255,0.08);
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          display: grid;
          place-items: center;
          gap: 2px;
          padding: 5px;
        }

        .mobileBottomBar span {
          display: block;
          line-height: 1.1;
        }

        .heroSection {
          padding: 14px 12px 6px !important;
        }

        .heroGrid {
          grid-template-columns: 1fr !important;
          border-radius: 24px !important;
          min-height: auto !important;
          box-shadow: 0 12px 32px rgba(15,23,42,0.12) !important;
        }

        .heroCopy {
          padding: 28px 22px 22px !important;
        }

        .heroCopy > p:first-child {
          font-size: 10px !important;
          letter-spacing: 2.4px !important;
          margin-bottom: 12px !important;
        }

        .heroCopy h1 {
          font-size: 42px !important;
          line-height: 0.98 !important;
          letter-spacing: -1.2px !important;
        }

        .heroCopy h1 br {
          display: none;
        }

        .heroCopy > p:not(:first-child) {
          font-size: 14px !important;
          line-height: 1.55 !important;
          margin-top: 14px !important;
        }

        .heroCopy button {
          width: 100%;
          justify-content: center;
          padding: 13px 18px !important;
          border-radius: 14px !important;
        }

        .heroImage {
          min-height: 178px !important;
          background-position: center 45% !important;
        }

        .heroPriceCard {
          right: 14px !important;
          bottom: 14px !important;
          border-radius: 16px !important;
          padding: 12px 15px !important;
        }

        .heroPriceCard h3 {
          font-size: 24px !important;
        }

        .heroPriceCard p {
          font-size: 11px !important;
        }

        .benefitsGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          padding: 14px 12px !important;
          gap: 10px !important;
        }

        .benefitCard {
          padding: 13px !important;
          border-radius: 18px !important;
          gap: 8px !important;
          min-height: 82px !important;
          align-items: center !important;
        }

        .benefitCard span {
          font-size: 23px !important;
        }

        .benefitCard h3 {
          font-size: 13px !important;
          line-height: 1.2 !important;
        }

        .benefitCard p {
          font-size: 11px !important;
          line-height: 1.25 !important;
        }

        .categorySection {
          margin: 8px 12px 0 !important;
          padding: 16px !important;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(226,232,240,0.9);
          border-radius: 22px;
          box-shadow: 0 10px 24px rgba(15,23,42,0.06);
        }

        .categorySection h2 {
          font-size: 22px !important;
          margin-bottom: 12px !important;
        }

        .filterRow {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
          padding-bottom: 0 !important;
        }

        .filterRow button {
          width: 100%;
          min-height: 40px !important;
          padding: 10px 8px !important;
          border-radius: 999px !important;
          font-size: 12px !important;
          line-height: 1.15 !important;
          white-space: normal !important;
        }

        .productSection {
          padding: 22px 12px 92px !important;
        }

        .sectionHeader {
          align-items: flex-start !important;
          gap: 14px !important;
          margin-bottom: 18px !important;
        }

        .sectionHeader h2 {
          font-size: 27px !important;
        }

        .sectionHeader p {
          font-size: 13px !important;
          line-height: 1.45 !important;
        }

        .sectionHeader > div:last-child {
          width: 100%;
          display: grid !important;
          grid-template-columns: 1fr;
        }

        .sectionHeader button {
          width: 100%;
        }

        .productsGrid {
          grid-template-columns: 1fr !important;
          gap: 16px !important;
        }

        .productCard {
          border-radius: 22px !important;
          box-shadow: 0 12px 28px rgba(15,23,42,0.10) !important;
        }

        .productCardImage {
          height: 255px !important;
          object-fit: contain !important;
          background: #f8fafc !important;
          padding: 10px !important;
        }

        .productCardBody {
          padding: 15px !important;
        }

        .productCardBody h3 {
          font-size: 17px !important;
          margin: 6px 0 !important;
        }

        .productPriceRow {
          align-items: center !important;
          flex-wrap: wrap !important;
          margin-bottom: 10px !important;
        }

        .productPriceRow strong {
          font-size: 24px !important;
        }

        .detailsGrid img {
          height: 330px !important;
          object-fit: contain !important;
          background: #f8fafc !important;
        }

        .cartGrid,
        .checkoutGrid,
        .adminGrid,
        .authGrid,
        .detailsGrid {
          gap: 16px !important;
        }

        .cartGrid,
        .checkoutGrid,
        .adminGrid,
        .authGrid,
        .detailsGrid,
        main {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        .cartItemRow {
          display: grid !important;
          grid-template-columns: 82px 1fr !important;
          gap: 12px !important;
          align-items: start !important;
          padding: 14px !important;
        }

        .cartItemRow img {
          width: 82px !important;
          height: 82px !important;
        }

        .cartItemInfo h3 {
          font-size: 16px !important;
          line-height: 1.25 !important;
        }

        .cartItemInfo p {
          font-size: 13px !important;
          line-height: 1.35 !important;
          margin: 7px 0 !important;
        }

        .cartItemActions {
          gap: 8px !important;
        }

        .cartItemPrice {
          grid-column: 1 / -1;
          justify-self: end;
          font-size: 18px !important;
          margin-top: -4px;
        }

        .authGrid {
          border-radius: 22px !important;
        }

        .authGrid > div {
          padding: 28px 22px !important;
        }

        .authGrid h1 {
          font-size: 34px !important;
        }

        .authGrid h2 {
          font-size: 28px !important;
        }

        .hoverLift:hover {
          transform: none;
        }
      }

      @media (max-width: 430px) {
        .topNavInner {
          grid-template-columns: 1fr auto auto !important;
          padding: 9px 10px !important;
          gap: 8px !important;
        }

        .brandBlock h1 {
          font-size: 21px !important;
        }

        .brandBlock p {
          font-size: 7px !important;
        }

        .heroCopy h1 {
          font-size: 35px !important;
        }

        .heroCopy {
          padding: 24px 18px 20px !important;
        }

        .heroImage {
          min-height: 165px !important;
        }

        .benefitsGrid {
          grid-template-columns: 1fr !important;
        }

        .benefitCard {
          min-height: auto !important;
          padding: 14px !important;
        }

        .filterRow {
          grid-template-columns: 1fr 1fr !important;
        }

        .productCardImage {
          height: 235px !important;
        }

        .mobileBottomBar {
          left: 8px;
          right: 8px;
          bottom: calc(8px + env(safe-area-inset-bottom));
        }

        .mobileBottomBar button {
          min-height: 45px;
          font-size: 10px;
        }
      }

      @media (max-width: 360px) {
        .filterRow {
          grid-template-columns: 1fr !important;
        }

        .heroCopy h1 {
          font-size: 31px !important;
        }

        .productCardImage {
          height: 215px !important;
        }

        .mobileBottomBar {
          gap: 6px;
          padding: 7px;
        }

        .mobileBottomBar button {
          min-height: 42px;
          border-radius: 13px;
        }
      }

      .categoryArrow {
        transition: transform 0.22s ease;
      }

      .categoryArrow.open {
        transform: rotate(180deg);
      }

      .categoryDrawer {
        animation: categoryReveal 0.22s ease;
      }

      @keyframes categoryReveal {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 700px) {
        .categorySection {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          margin: 8px 12px 0 !important;
          padding: 0 !important;
        }

        .categoryToggle {
          padding: 15px 16px !important;
          border-radius: 20px !important;
        }

        .categoryToggle strong {
          font-size: 21px !important;
        }

        .categoryToggle span span {
          font-size: 12px !important;
        }

        .categoryArrow {
          width: 38px !important;
          height: 38px !important;
          font-size: 20px !important;
        }

        .categoryDrawer {
          padding: 14px !important;
          border-radius: 20px !important;
        }
      }

      @media (max-width: 430px) {
        .categoryToggle {
          padding: 14px !important;
        }

        .categoryToggle strong {
          font-size: 19px !important;
        }

        .categoryArrow {
          width: 35px !important;
          height: 35px !important;
        }
      }

    `}</style>
  );
}

function Toast({ message }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#111827",
        color: "#fff",
        padding: "13px 24px",
        borderRadius: 999,
        fontWeight: 850,
        zIndex: 9999,
        boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
      }}
    >
      {message}
    </div>
  );
}

function Navbar({
  theme,
  dark,
  setDark,
  setPage,
  search,
  setSearch,
  user,
  isAdmin,
  logout,
  cartCount,
  openMyOrders,
}) {
  return (
    <header
      style={{
        background: theme.nav,
        color: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 6px 24px rgba(0,0,0,0.28)",
      }}
    >
      <div
        className="topNavInner"
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div className="brandBlock" onClick={() => setPage("home")} style={{ cursor: "pointer" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 31,
              fontWeight: 950,
              color: theme.orange,
              letterSpacing: "-1px",
            }}
          >
            WEARLANCE
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: 850,
              opacity: 0.85,
            }}
          >
            EVERY STYLE ₹399
          </p>
        </div>

        <div
          className="hideMobile"
          style={{
            background: "rgba(255,255,255,0.08)",
            padding: "10px 13px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          📍 Deliver to India
        </div>

        <div
          className="navSearch"
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            borderRadius: 13,
            maxWidth: 760,
            background: "#fff",
            border: "2px solid rgba(255,153,0,0.25)",
          }}
        >
          <select
            style={{
              border: "none",
              outline: "none",
              background: "#f3f4f6",
              padding: "0 14px",
              fontWeight: 850,
              color: "#111827",
            }}
          >
            <option>All</option>
            <option>Men</option>
            <option>Women</option>
            <option>Unisex</option>
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clothes, hoodies, shirts, dresses..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              padding: "14px 16px",
              fontSize: 15,
              color: "#111827",
            }}
          />

          <button
            onClick={() => setPage("home")}
            style={{
              border: "none",
              background: theme.orange,
              padding: "0 24px",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            🔍
          </button>
        </div>

        {user ? (
          <>
            <div
              className="hideMobile"
              style={{
                fontSize: 13,
                fontWeight: 850,
                maxWidth: 190,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {isAdmin ? "Admin" : "Customer"}: {user.name}
            </div>

            <button onClick={openMyOrders} style={navButtonStyle()}>
              Orders
            </button>

            <button onClick={logout} style={navButtonStyle()}>
              Logout
            </button>
          </>
        ) : (
          <button onClick={() => setPage("login")} style={navButtonStyle()}>
            Login
          </button>
        )}

        <button
          onClick={() => setPage("cart")}
          style={{
            ...navButtonStyle(),
            position: "relative",
          }}
        >
          🛒 Cart
          {cartCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -10,
                right: -14,
                width: 22,
                height: 22,
                display: "grid",
                placeItems: "center",
                borderRadius: "50%",
                background: theme.orange,
                color: "#111827",
                fontSize: 12,
                fontWeight: 950,
              }}
            >
              {cartCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setDark(!dark)}
          style={{
            border: "none",
            borderRadius: 12,
            padding: "11px 15px",
            background: dark ? "#facc15" : "#334155",
            color: dark ? "#000" : "#fff",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          {dark ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}

function navButtonStyle() {
  return {
    background: "transparent",
    border: "none",
    color: "#fff",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: 15,
  };
}

function SubNavbar({
  theme,
  setPage,
  isAdmin,
  user,
  openMyOrders,
  openAdminOrders,
}) {
  const navItems = [
    {
      label: "🔥 Trending",
      action: () => setPage("home"),
    },
    {
      label: "👕 T-Shirts",
      action: () => setPage("home"),
    },
    {
      label: "🧥 Hoodies",
      action: () => setPage("home"),
    },
    {
      label: "👗 Women",
      action: () => setPage("home"),
    },
    {
      label: "🏷️ Everything ₹399",
      action: () => setPage("home"),
    },
    {
      label: "🚚 Free Delivery",
      action: () => setPage("home"),
    },
  ];

  if (user) {
    navItems.push({
      label: "📦 My Orders",
      action: openMyOrders,
    });
  }

  if (isAdmin) {
    navItems.push({
      label: "⚙️ Admin Portal",
      action: () => setPage("admin"),
    });

    navItems.push({
      label: "📋 Admin Orders",
      action: openAdminOrders,
    });
  }

  return (
    <nav
      className="subNav"
      style={{
        background: theme.subnav,
        color: "#fff",
        overflowX: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "11px 24px",
          display: "flex",
          gap: 26,
          whiteSpace: "nowrap",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {navItems.map((item) => (
          <span
            key={item.label}
            onClick={item.action}
            style={{
              cursor: "pointer",
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </nav>
  );
}


function MobileBottomBar({ setPage, cartCount, user, isAdmin, openMyOrders, openAdminOrders }) {
  return (
    <div className="mobileBottomBar">
      <button onClick={() => setPage("home")}>
        <span>🏠</span>
        <span>Home</span>
      </button>

      <button onClick={() => setPage("cart")}>
        <span>🛒</span>
        <span>Cart {cartCount > 0 ? `(${cartCount})` : ""}</span>
      </button>

      <button onClick={user ? openMyOrders : () => setPage("login")}>
        <span>{user ? "📦" : "🔐"}</span>
        <span>{user ? "Orders" : "Login"}</span>
      </button>

      <button onClick={isAdmin ? openAdminOrders : () => setPage("home")}>
        <span>{isAdmin ? "⚙️" : "🔥"}</span>
        <span>{isAdmin ? "Admin" : "Shop"}</span>
      </button>
    </div>
  );
}

function HomePage({
  theme,
  products,
  loadingProducts,
  selectedCategory,
  setSelectedCategory,
  selectedGender,
  setSelectedGender,
  setPage,
  setSelectedProduct,
  fetchProducts,
  isAdmin,
}) {
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);

  return (
    <>
      <Hero theme={theme} setPage={setPage} isAdmin={isAdmin} />

      <Benefits theme={theme} />

      <section
        className="categorySection"
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "18px 24px 0",
        }}
      >
        <button
          type="button"
          className="categoryToggle"
          onClick={() => setShowCategoryDrawer((prev) => !prev)}
          aria-expanded={showCategoryDrawer}
          style={{
            width: "100%",
            border: `1px solid ${theme.border}`,
            background: theme.panel,
            color: theme.text,
            borderRadius: 22,
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            cursor: "pointer",
            boxShadow:
              theme.bg === "#07111f"
                ? "0 10px 28px rgba(0,0,0,0.28)"
                : "0 12px 28px rgba(15,23,42,0.08)",
          }}
        >
          <span
            style={{
              display: "grid",
              gap: 4,
              textAlign: "left",
            }}
          >
            <strong
              style={{
                fontSize: 28,
                fontWeight: 950,
                lineHeight: 1.1,
              }}
            >
              Shop by Category
            </strong>
            <span
              style={{
                color: theme.muted,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {selectedCategory === "All" && selectedGender === "All"
                ? "Browse categories and styles"
                : `${selectedCategory} · ${selectedGender}`}
            </span>
          </span>

          <span
            className={showCategoryDrawer ? "categoryArrow open" : "categoryArrow"}
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#ff9900,#ec4899)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              fontWeight: 950,
              flex: "0 0 auto",
            }}
          >
           ⌄
          </span>
        </button>

        {showCategoryDrawer && (
          <div
            className="categoryDrawer"
            style={{
              marginTop: 14,
              background: theme.panel,
              border: `1px solid ${theme.border}`,
              borderRadius: 22,
              padding: 18,
              boxShadow:
                theme.bg === "#07111f"
                  ? "0 12px 30px rgba(0,0,0,0.28)"
                  : "0 12px 28px rgba(15,23,42,0.07)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17 }}>Categories</h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("All");
                  setSelectedGender("All");
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: theme.orange2,
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>

            <FilterRow
              list={categories}
              selected={selectedCategory}
              setSelected={setSelectedCategory}
              theme={theme}
            />

            <div style={{ height: 16 }} />

            <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>Style For</h3>

            <FilterRow
              list={genders}
              selected={selectedGender}
              setSelected={setSelectedGender}
              theme={theme}
            />
          </div>
        )}
      </section>

      <main
        className="productSection"
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: "34px 24px 80px",
        }}
      >
        <div
          className="sectionHeader"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 26,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 38,
                margin: 0,
                fontWeight: 950,
              }}
            >
              Everything ₹399
            </h2>
            <p
              style={{
                color: theme.muted,
                margin: "8px 0 0",
                fontSize: 16,
              }}
            >
              Premium clothing with a professional marketplace shopping feel.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
            }}
          >
            <button
              onClick={fetchProducts}
              style={{
                background: theme.panel,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: 13,
                padding: "13px 20px",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>

            {isAdmin && (
              <button
                onClick={() => setPage("admin")}
                style={{
                  background: theme.blue,
                  color: "#fff",
                  border: "none",
                  borderRadius: 13,
                  padding: "13px 20px",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                Upload Product
              </button>
            )}
          </div>
        </div>

        {loadingProducts && (
          <InfoBox theme={theme} text="Loading products from MongoDB..." />
        )}

        {!loadingProducts && products.length === 0 && (
          <InfoBox
            theme={theme}
            text="No products yet. Admin login is required to upload the first clothing item."
          />
        )}

        <div
          className="productsGrid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 24,
          }}
        >
          {products.map((product) => (
            <ProductCard
              key={product._id || product.id}
              product={product}
              theme={theme}
              setPage={setPage}
              setSelectedProduct={setSelectedProduct}
            />
          ))}
        </div>
      </main>
    </>
  );
}

function Hero({ theme, setPage, isAdmin }) {
  return (
    <section
      className="heroSection"
      style={{
        maxWidth: 1500,
        margin: "0 auto",
        padding: "30px 24px 10px",
      }}
    >
      <div
        className="heroGrid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.08fr 0.92fr",
          minHeight: 420,
          borderRadius: 32,
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #ff9900 0%, #fb7185 42%, #7c3aed 100%)",
          boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
        }}
      >
        <div
          className="heroCopy"
          style={{
            padding: "62px 52px",
            color: "#fff",
          }}
        >
          <p
            style={{
              fontWeight: 950,
              letterSpacing: 4,
              fontSize: 13,
              opacity: 0.92,
              marginBottom: 16,
            }}
          >
            PROFESSIONAL ONLINE FASHION MARKETPLACE
          </p>

          <h1
            style={{
              fontSize: "clamp(42px, 5vw, 76px)",
              lineHeight: 1,
              margin: 0,
              fontWeight: 950,
              letterSpacing: "-2px",
            }}
          >
            Every Style.
            <br />
            One Price.
          </h1>

      <p
            style={{
              fontSize: 20,
              lineHeight: 1.65,
              maxWidth: 620,
              marginTop: 22,
            }}
          >
            Wearlance is a premium fixed-price fashion marketplace. Upload,
            manage, and sell clothing products with every item locked at ₹399.
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 32,
            }}
          >
            <button
              onClick={() => setPage("home")}
              style={{
                border: "none",
                background: "#fff",
                color: "#111827",
                padding: "15px 28px",
                borderRadius: 15,
                fontWeight: 950,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Shop Now
            </button>

            {isAdmin && (
              <button
                onClick={() => setPage("admin")}
                style={{
                  background: "rgba(255,255,255,0.16)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.45)",
                  padding: "15px 28px",
                  borderRadius: 15,
                  fontWeight: 950,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Admin Upload
              </button>
            )}
          </div>
        </div>

        <div
          className="heroImage"
          style={{
            minHeight: 420,
            position: "relative",
            backgroundImage:
              "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=90')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            className="heroPriceCard"
            style={{
              position: "absolute",
              right: 26,
              bottom: 26,
              background: "rgba(0,0,0,0.72)",
              color: "#fff",
              padding: "20px 24px",
              borderRadius: 22,
              backdropFilter: "blur(14px)",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 34,
              }}
            >
              ₹399
            </h3>
            <p
              style={{
                margin: "4px 0 0",
                opacity: 0.82,
              }}
            >
              fixed price store
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Benefits({ theme }) {
  const list = [
    ["🚚", "Free Delivery", "On every order"],
    ["💸", "Everything ₹399", "Simple fixed pricing"],
    ["🔒", "Secure Checkout", "Email protected"],
    ["📦", "Order Tracking", "Track every order"],
  ];

  return (
    <section
      className="benefitsGrid"
      style={{
        maxWidth: 1500,
        margin: "0 auto",
        padding: "24px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 18,
      }}
    >
      {list.map(([icon, title, sub]) => (
        <div
          key={title}
          className="benefitCard hoverLift"
          style={{
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 22,
            padding: 22,
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow:
              theme.bg === "#07111f"
                ? "0 10px 30px rgba(0,0,0,0.30)"
                : "0 12px 30px rgba(15,23,42,0.08)",
          }}
        >
          <span
            style={{
              fontSize: 32,
            }}
          >
            {icon}
          </span>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: "5px 0 0",
                color: theme.muted,
              }}
            >
              {sub}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function FilterRow({ list, selected, setSelected, theme }) {
  return (
    <div
      className="filterRow"
      style={{
        display: "flex",
        gap: 12,
        overflowX: "visible",
        flexWrap: "wrap",
        paddingBottom: 8,
      }}
    >
      {list.map((item) => (
        <button
          key={item}
          onClick={() => setSelected(item)}
          style={{
            padding: "12px 20px",
            borderRadius: 999,
            border: selected === item ? "none" : `1px solid ${theme.border}`,
            background:
              selected === item
                ? "linear-gradient(135deg,#ff9900,#ec4899)"
                : theme.panel,
            color: selected === item ? "#fff" : theme.text,
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function InfoBox({ theme, text }) {
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 22,
        padding: 34,
        textAlign: "center",
        marginBottom: 22,
        color: theme.muted,
        fontWeight: 850,
      }}
    >
      {text}
    </div>
  );
}

function ProductCard({ product, theme, setPage, setSelectedProduct }) {
  const outOfStock = Number(product.stock || 0) <= 0;

  return (
    <div
      className="productCard hoverLift"
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow:
          theme.bg === "#07111f"
            ? "0 12px 34px rgba(0,0,0,0.36)"
            : "0 12px 30px rgba(15,23,42,0.10)",
      }}
    >
      <div
        onClick={() => {
          setSelectedProduct(product);
          setPage("product");
        }}
        style={{
          position: "relative",
          cursor: "pointer",
        }}
      >
        <img
          className="productCardImage"
          src={product.image}
          alt={product.name}
          style={{
            width: "100%",
            height: 270,
            objectFit: "cover",
            display: "block",
          }}
        />

        <span
          style={{
            position: "absolute",
            top: 13,
            left: 13,
            background: theme.red,
            color: "#fff",
            padding: "6px 11px",
            borderRadius: 999,
            fontWeight: 950,
            fontSize: 12,
          }}
        >
          {product.badge || "New"}
        </span>
      </div>

      <div
        className="productCardBody"
        style={{
          padding: 18,
        }}
      >
        <p
          style={{
            color: theme.muted,
            margin: 0,
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          {product.gender} · {product.category}
        </p>

        <h3
          style={{
            margin: "7px 0",
            fontSize: 18,
            lineHeight: 1.35,
            fontWeight: 950,
          }}
        >
          {product.name}
        </h3>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 11,
          }}
        >
          <span
            style={{
              background: theme.green,
              color: "#fff",
              padding: "3px 8px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 950,
            }}
          >
            {Number(product.rating || 0).toFixed(1)} ★
          </span>

          <span
            style={{
              color: theme.muted,
              fontSize: 13,
            }}
          >
            ({Number(product.numReviews || product.reviews || 0).toLocaleString()})
          </span>
        </div>

        <div
          className="productPriceRow"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "baseline",
            marginBottom: 15,
          }}
        >
          <strong
            style={{
              fontSize: 27,
            }}
          >
            ₹{FIXED_PRICE}
          </strong>
          <span
            style={{
              color: theme.muted,
              textDecoration: "line-through",
              fontSize: 14,
            }}
          >
            ₹1399
          </span>
          <span
            style={{
              color: theme.green,
              fontWeight: 950,
              fontSize: 13,
            }}
          >
            Best value
          </span>
        </div>

        <div
          style={{
            marginBottom: 12,
            color: outOfStock ? theme.red : theme.green,
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          {outOfStock ? "Out of stock" : `${product.stock} left in stock`}
        </div>

        <button
          disabled={outOfStock}
          onClick={() => {
            if (outOfStock) return;
            setSelectedProduct(product);
            setPage("product");
          }}
          style={{
            width: "100%",
            border: "none",
            background: outOfStock
              ? "#94a3b8"
              : "linear-gradient(135deg,#ff9900,#fb641b)",
            color: "#fff",
            padding: 14,
            borderRadius: 15,
            fontWeight: 950,
            fontSize: 15,
            cursor: outOfStock ? "not-allowed" : "pointer",
          }}
        >
          {outOfStock ? "Out of Stock" : "Select Size"}
        </button>
      </div>
    </div>
  );
}

function ProductDetails({ theme, product, setPage, addToCart, showToast }) {
  const [selectedSize, setSelectedSize] = useState("");
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const sizes = ["S", "M", "L", "XL", "XXL"];
  const productId = product._id || product.id;
  const outOfStock = Number(product.stock || 0) <= 0;

  useEffect(() => {
    const loadReviews = async () => {
      if (!productId) return;

      try {
        setLoadingReviews(true);
        const response = await fetch(`${REVIEW_API}/product/${productId}`);
        const data = await response.json();

        if (data.success) {
          setReviews(data.reviews || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingReviews(false);
      }
    };

    loadReviews();
  }, [productId]);

  const handleAddToCart = () => {
    if (outOfStock) {
      showToast("This product is out of stock");
      return;
    }

    if (!selectedSize) {
      showToast("Please select a size first");
      return;
    }

    addToCart({
      ...product,
      selectedSize,
    });
  };

  const handleBuyNow = () => {
    if (outOfStock) {
      showToast("This product is out of stock");
      return;
    }

    if (!selectedSize) {
      showToast("Please select a size first");
      return;
    }

    addToCart({
      ...product,
      selectedSize,
    });

    setPage("cart");
  };

  return (
    <main
      style={{
        maxWidth: 1300,
        margin: "0 auto",
        padding: "40px 24px 90px",
      }}
    >
      <button
        onClick={() => setPage("home")}
        style={{
          background: "transparent",
          border: "none",
          color: theme.blue,
          fontWeight: 950,
          cursor: "pointer",
          marginBottom: 22,
        }}
      >
        ← Back to products
      </button>

      <div
        className="detailsGrid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 34,
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 30,
          overflow: "hidden",
        }}
      >
        <img
          src={product.image}
          alt={product.name}
          style={{
            width: "100%",
            height: 580,
            objectFit: "cover",
          }}
        />

        <div
          style={{
            padding: 36,
          }}
        >
          <p
            style={{
              color: theme.muted,
              fontWeight: 850,
            }}
          >
            {product.gender} · {product.category}
          </p>

          <h1
            style={{
              fontSize: 40,
              margin: "8px 0",
              fontWeight: 950,
            }}
          >
            {product.name}
          </h1>

          <p
            style={{
              color: theme.muted,
              lineHeight: 1.8,
              fontSize: 16,
            }}
          >
            {product.description}
          </p>

          <div
            style={{
              marginTop: 20,
            }}
          >
            <span
              style={{
                background: theme.green,
                color: "#fff",
                padding: "6px 10px",
                borderRadius: 8,
                fontWeight: 950,
              }}
            >
              {Number(product.rating || 0).toFixed(1)} ★
            </span>

            <span
              style={{
                marginLeft: 12,
                color: theme.muted,
              }}
            >
              ({Number(product.numReviews || product.reviews || 0).toLocaleString()} reviews)
            </span>
          </div>

          <div
            style={{
              borderTop: `1px solid ${theme.border}`,
              borderBottom: `1px solid ${theme.border}`,
              padding: "24px 0",
              margin: "28px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
              }}
            >
              <strong
                style={{
                  fontSize: 44,
                }}
              >
                ₹{FIXED_PRICE}
              </strong>
              <span
                style={{
                  color: theme.muted,
                  textDecoration: "line-through",
                  fontSize: 18,
                }}
              >
                ₹1299
              </span>
              <span
                style={{
                  color: theme.green,
                  fontWeight: 950,
                }}
              >
                Best value
              </span>
            </div>

            <p
              style={{
                color: theme.green,
                fontWeight: 850,
              }}
            >
              Inclusive of all taxes · Free Delivery
            </p>
          </div>

          <div
            style={{
              marginBottom: 18,
              color: outOfStock ? theme.red : theme.green,
              fontWeight: 950,
            }}
          >
            {outOfStock ? "Out of stock" : `${product.stock} pieces left in stock`}
          </div>

          <h3>Select Size</h3>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            {sizes.map((size) => {
              const active = selectedSize === size;

              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  style={{
                    width: 58,
                    height: 50,
                    borderRadius: 14,
                    border: active
                      ? "2px solid #fb641b"
                      : `1px solid ${theme.border}`,
                    background: active
                      ? "linear-gradient(135deg,#ff9900,#fb641b)"
                      : theme.panel2,
                    color: active ? "#fff" : theme.text,
                    fontWeight: 950,
                    cursor: "pointer",
                    boxShadow: active
                      ? "0 10px 25px rgba(251,100,27,0.35)"
                      : "none",
                    transform: active ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {size}
                </button>
              );
            })}
          </div>

          <p
            style={{
              color: selectedSize ? theme.green : theme.muted,
              fontWeight: 850,
            }}
          >
            {selectedSize
              ? `Selected size: ${selectedSize}`
              : "Please select a size before adding to cart."}
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
            }}
          >
            <button
              disabled={outOfStock}
              onClick={handleAddToCart}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 15,
                padding: 16,
                background: outOfStock ? "#94a3b8" : theme.orange,
                color: "#fff",
                fontWeight: 950,
                fontSize: 16,
                cursor: outOfStock ? "not-allowed" : "pointer",
              }}
            >
              {outOfStock ? "Out of Stock" : "Add to Cart"}
            </button>

            <button
              disabled={outOfStock}
              onClick={handleBuyNow}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 15,
                padding: 16,
                background: outOfStock ? "#94a3b8" : theme.orange2,
                color: "#fff",
                fontWeight: 950,
                fontSize: 16,
                cursor: outOfStock ? "not-allowed" : "pointer",
              }}
            >
              {outOfStock ? "Unavailable" : "Buy Now"}
            </button>
          </div>
        </div>
      </div>

      <section
        style={{
          marginTop: 24,
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 26,
          padding: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Customer Reviews</h2>

        {loadingReviews && <p style={{ color: theme.muted }}>Loading reviews...</p>}

        {!loadingReviews && reviews.length === 0 && (
          <p style={{ color: theme.muted }}>
            No reviews yet. Reviews will appear after customers confirm delivery.
          </p>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          {reviews.map((review) => (
            <div
              key={review._id}
              style={{
                background: theme.bg,
                borderRadius: 18,
                padding: 16,
                border: `1px solid ${theme.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <strong>{review.userName}</strong>
                <span
                  style={{
                    background: theme.green,
                    color: "#fff",
                    padding: "4px 9px",
                    borderRadius: 999,
                    fontWeight: 950,
                  }}
                >
                  {review.rating} ★
                </span>
              </div>
              <p style={{ color: theme.muted, lineHeight: 1.7 }}>
                {review.comment}
              </p>
              <small style={{ color: theme.muted }}>
                {new Date(review.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function CartPage({
  theme,
  cart,
  cartCount,
  cartTotal,
  increaseQty,
  decreaseQty,
  removeFromCart,
  setPage,
  getCartKey,
  user,
  showToast,
}) {
  if (cart.length === 0) {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "90px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 82,
          }}
        >
          🛒
        </div>
        <h1>Your cart is empty</h1>
        <p
          style={{
            color: theme.muted,
          }}
        >
          Add products to continue checkout.
        </p>
        <button
          onClick={() => setPage("home")}
          style={{
            background: theme.blue,
            color: "#fff",
            border: "none",
            padding: "14px 24px",
            borderRadius: 13,
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Continue Shopping
        </button>
      </main>
    );
  }

  const goCheckout = () => {
    if (!user) {
      showToast("Please login before checkout");
      setPage("login");
      return;
    }

    setPage("checkout");
  };

  return (
    <main
      className="cartGrid"
      style={{
        maxWidth: 1300,
        margin: "0 auto",
        padding: "36px 24px 90px",
        display: "grid",
        gridTemplateColumns: "1fr 370px",
        gap: 24,
      }}
    >
      <section
        style={{
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${theme.border}`,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
            }}
          >
            Shopping Cart
          </h2>
          <strong>{cartCount} items</strong>
        </div>

        {cart.map((item) => {
          const key = getCartKey(item);

          return (
            <div
              key={key}
              className="cartItemRow"
              style={{
                padding: 18,
                display: "flex",
                gap: 16,
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <img
                src={item.image}
                alt={item.name}
                style={{
                  width: 96,
                  height: 96,
                  objectFit: "cover",
                  borderRadius: 15,
                }}
              />

              <div
                className="cartItemInfo"
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                  }}
                >
                  {item.name}
                </h3>
                <p
                  style={{
                    color: theme.muted,
                  }}
                >
                  {item.category} · Size: {item.selectedSize}
                </p>

                <div
                  className="cartItemActions"
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => decreaseQty(key)}
                    style={qtyButton()}
                  >
                    −
                  </button>
                  <strong>{item.qty}</strong>
                  <button
                    onClick={() => increaseQty(key)}
                    style={qtyButton()}
                  >
                    +
                  </button>

                  <button
                    onClick={() => removeFromCart(key)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: theme.red,
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <strong
                className="cartItemPrice"
                style={{
                  fontSize: 20,
                }}
              >
                ₹{item.qty * FIXED_PRICE}
              </strong>
            </div>
          );
        })}
      </section>

      <PriceBox
        theme={theme}
        cartCount={cartCount}
        cartTotal={cartTotal}
        buttonLabel="Proceed to Checkout"
        onClick={goCheckout}
      />
    </main>
  );
}

function CheckoutPage({
  theme,
  cart,
  cartCount,
  cartTotal,
  checkoutForm,
  setCheckoutForm,
  placeOrder,
  placingOrder,
  setPage,
  user,
}) {
  if (!user) {
    return (
      <AccessDenied
        theme={theme}
        setPage={setPage}
        message="Please login to checkout."
      />
    );
  }

  if (cart.length === 0) {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "90px 24px",
          textAlign: "center",
        }}
      >
        <h1>No items for checkout</h1>
        <button
          onClick={() => setPage("home")}
          style={{
            background: theme.blue,
            color: "#fff",
            border: "none",
            padding: "14px 24px",
            borderRadius: 13,
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Continue Shopping
        </button>
      </main>
    );
  }

  const updateField = (field, value) => {
    setCheckoutForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <main
      className="checkoutGrid"
      style={{
        maxWidth: 1300,
        margin: "0 auto",
        padding: "38px 24px 90px",
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: 24,
      }}
    >
      <section
        style={{
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 26,
          padding: 26,
        }}
      >
        <h1
          style={{
            marginTop: 0,
          }}
        >
          Checkout
        </h1>
        <p
          style={{
            color: theme.muted,
          }}
        >
          Add your delivery details and choose COD or secure Razorpay online payment.
        </p>

        <form onSubmit={placeOrder}>
          <CheckoutInput
            theme={theme}
            label="Full Name"
            value={checkoutForm.fullName}
            onChange={(v) => updateField("fullName", v)}
          />

          <CheckoutInput
            theme={theme}
            label="Phone Number"
            value={checkoutForm.phone}
            onChange={(v) => updateField("phone", v)}
          />

          <CheckoutInput
            theme={theme}
            label="Email"
            value={checkoutForm.email}
            onChange={(v) => updateField("email", v)}
          />

          <CheckoutInput
            theme={theme}
            label="Address Line 1"
            value={checkoutForm.addressLine1}
            onChange={(v) => updateField("addressLine1", v)}
          />

          <CheckoutInput
            theme={theme}
            label="Address Line 2"
            value={checkoutForm.addressLine2}
            onChange={(v) => updateField("addressLine2", v)}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <CheckoutInput
              theme={theme}
              label="City"
              value={checkoutForm.city}
              onChange={(v) => updateField("city", v)}
            />

            <CheckoutInput
              theme={theme}
              label="State"
              value={checkoutForm.state}
              onChange={(v) => updateField("state", v)}
            />

            <CheckoutInput
              theme={theme}
              label="Pincode"
              value={checkoutForm.pincode}
              onChange={(v) => updateField("pincode", v)}
            />
          </div>

          <label
            style={{
              display: "block",
              marginBottom: 16,
            }}
          >
            <span
              style={{
                display: "block",
                fontWeight: 900,
                marginBottom: 7,
              }}
            >
              Payment Method
            </span>
            <select
              value={checkoutForm.paymentMethod}
              onChange={(e) => updateField("paymentMethod", e.target.value)}
              style={formControl(theme)}
            >
              <option value="COD">Cash on Delivery</option>
              <option value="Razorpay">Pay Online with Razorpay</option>
            </select>
          </label>

          <button
            disabled={placingOrder}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 15,
              padding: 16,
              background: placingOrder
                ? "#94a3b8"
                : "linear-gradient(135deg,#ff9900,#fb641b)",
              color: "#fff",
              fontWeight: 950,
              fontSize: 16,
              cursor: placingOrder ? "not-allowed" : "pointer",
              marginTop: 8,
            }}
          >
            {placingOrder ? "Processing..." : checkoutForm.paymentMethod === "Razorpay" ? "Pay Online" : "Place COD Order"}
          </button>
        </form>
      </section>

      <aside>
        <PriceBox
          theme={theme}
          cartCount={cartCount}
          cartTotal={cartTotal}
          buttonLabel={checkoutForm.paymentMethod === "Razorpay" ? "Pay Online" : "Place COD Order"}
          onClick={placeOrder}
          disabled={placingOrder}
        />

        <div
          style={{
            marginTop: 18,
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 24,
            padding: 20,
          }}
        >
          <h3
            style={{
              marginTop: 0,
            }}
          >
            Order Items
          </h3>

          {cart.map((item) => (
            <div
              key={`${item._id || item.id}-${item.selectedSize}`}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 0",
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <img
                src={item.image}
                alt={item.name}
                style={{
                  width: 58,
                  height: 58,
                  objectFit: "cover",
                  borderRadius: 12,
                }}
              />
              <div>
                <strong>{item.name}</strong>
                <p
                  style={{
                    margin: "4px 0",
                    color: theme.muted,
                  }}
                >
                  Size {item.selectedSize} · Qty {item.qty}
                </p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}

function CheckoutInput({ theme, label, value, onChange }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 16,
      }}
    >
      <span
        style={{
          display: "block",
          fontWeight: 900,
          marginBottom: 7,
        }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={formControl(theme)}
      />
    </label>
  );
}

function PriceBox({
  theme,
  cartCount,
  cartTotal,
  buttonLabel,
  onClick,
  disabled,
}) {
  return (
    <aside
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 24,
        padding: 24,
        height: "fit-content",
        position: "sticky",
        top: 120,
      }}
    >
      <h2>Price Details</h2>

      <PriceRow
        label={`Price (${cartCount} items)`}
        value={`₹${cartTotal * 3}`}
        theme={theme}
      />

      <PriceRow
        label="Discount"
        value={`−₹${cartTotal * 2}`}
        green
        theme={theme}
      />

      <PriceRow label="Delivery" value="FREE" green theme={theme} />

      <div
        style={{
          borderTop: `2px solid ${theme.border}`,
          paddingTop: 15,
          marginTop: 15,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 21,
          fontWeight: 950,
        }}
      >
        <span>Total</span>
        <span>₹{cartTotal}</span>
      </div>

      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 15,
          marginTop: 22,
          padding: 16,
          background: disabled ? "#94a3b8" : "#fb641b",
          color: "#fff",
          fontWeight: 950,
          fontSize: 16,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {buttonLabel}
      </button>
    </aside>
  );
}

function qtyButton() {
  return {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 950,
  };
}

function PriceRow({ label, value, green, theme }) {
  return (
    <div
      style={{
        margin: "13px 0",
        display: "flex",
        justifyContent: "space-between",
        color: green ? theme.green : theme.text,
      }}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MyOrdersPage({
  theme,
  orders,
  loadingOrders,
  fetchMyOrders,
  setPage,
  verifyDeliveryOtp,
  createReview,
  cancelMyOrder,
  requestReturnOrder,
  downloadInvoice,
}) {
  return (
    <main
      style={{
        maxWidth: 1250,
        margin: "0 auto",
        padding: "38px 24px 90px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
            }}
          >
            My Orders
          </h1>
          <p
            style={{
              color: theme.muted,
            }}
          >
            Track your Wearlance purchases.
          </p>
        </div>

        <button
          onClick={fetchMyOrders}
          style={{
            height: 46,
            background: theme.blue,
            color: "#fff",
            border: "none",
            borderRadius: 13,
            padding: "0 18px",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Refresh Orders
        </button>
      </div>

      {loadingOrders && <InfoBox theme={theme} text="Loading orders..." />}

      {!loadingOrders && orders.length === 0 && (
        <InfoBox
          theme={theme}
          text="No orders yet. Start shopping and place your first order."
        />
      )}

      <div
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        {orders.map((order) => (
          <OrderCard
            key={order._id}
            theme={theme}
            order={order}
            customerView
            verifyDeliveryOtp={verifyDeliveryOtp}
            createReview={createReview}
            cancelMyOrder={cancelMyOrder}
            requestReturnOrder={requestReturnOrder}
            downloadInvoice={downloadInvoice}
          />
        ))}
      </div>

      <button
        onClick={() => setPage("home")}
        style={{
          marginTop: 24,
          border: "none",
          borderRadius: 14,
          padding: "14px 24px",
          background: theme.orange,
          color: "#fff",
          fontWeight: 950,
          cursor: "pointer",
        }}
      >
        Continue Shopping
      </button>
    </main>
  );
}

function AdminOrdersPage({
  theme,
  orders,
  loadingOrders,
  fetchAdminOrders,
  updateOrderStatus,
  downloadInvoice,
}) {
  return (
    <main
      style={{
        maxWidth: 1350,
        margin: "0 auto",
        padding: "38px 24px 90px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
            }}
          >
            Admin Orders Dashboard
          </h1>
          <p
            style={{
              color: theme.muted,
            }}
          >
            Manage all customer orders and delivery status.
          </p>
        </div>

        <button
          onClick={fetchAdminOrders}
          style={{
            height: 46,
            background: theme.blue,
            color: "#fff",
            border: "none",
            borderRadius: 13,
            padding: "0 18px",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Refresh Orders
        </button>
      </div>

      {loadingOrders && <InfoBox theme={theme} text="Loading admin orders..." />}

      {!loadingOrders && orders.length === 0 && (
        <InfoBox theme={theme} text="No orders received yet." />
      )}

      <div
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        {orders.map((order) => (
          <OrderCard
            key={order._id}
            theme={theme}
            order={order}
            adminView
            updateOrderStatus={updateOrderStatus}
            downloadInvoice={downloadInvoice}
          />
        ))}
      </div>
    </main>
  );
}

function StatusPill({ status, theme }) {
  const color =
    status === "Delivered"
      ? theme.green
      : status === "Cancelled"
      ? theme.red
      : status === "Shipped" || status === "Out for Delivery"
      ? theme.blue
      : status === "Delivery Verification Pending"
      ? theme.purple
      : status === "Return Requested" || status === "Return Approved"
      ? theme.orange2
      : status === "Returned"
      ? theme.green
      : status === "Return Rejected"
      ? theme.red
      : theme.orange2;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "7px 12px",
        borderRadius: 999,
        background: color,
        color: "#fff",
        fontWeight: 950,
        fontSize: 13,
      }}
    >
      {status}
    </span>
  );
}

function OrderCard({
  theme,
  order,
  customerView,
  adminView,
  updateOrderStatus,
  verifyDeliveryOtp,
  createReview,
  cancelMyOrder,
  requestReturnOrder,
  downloadInvoice,
}) {
  const [returnReason, setReturnReason] = useState("");
  const [deliveryOtp, setDeliveryOtp] = useState("");
  const [reviewForms, setReviewForms] = useState({});

  const updateReviewForm = (productId, field, value) => {
    setReviewForms((prev) => ({
      ...prev,
      [productId]: {
        rating: prev[productId]?.rating || "5",
        comment: prev[productId]?.comment || "",
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const submitReview = async (productId) => {
    const form = reviewForms[productId] || {
      rating: "5",
      comment: "",
    };

    const ok = await createReview({
      productId,
      orderId: order._id,
      rating: form.rating,
      comment: form.comment,
    });

    if (ok) {
      setReviewForms((prev) => ({
        ...prev,
        [productId]: {
          rating: "5",
          comment: "",
          submitted: true,
        },
      }));
    }
  };

  return (
    <section
      style={{
        background: theme.panel,
        border: `1px solid ${theme.border}`,
        borderRadius: 24,
        padding: 22,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: 14,
          marginBottom: 14,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            Order #{order._id.slice(-8).toUpperCase()}
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              color: theme.muted,
            }}
          >
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        <div
          style={{
            textAlign: "right",
          }}
        >
          <StatusPill status={order.orderStatus} theme={theme} />
          <h3
            style={{
              margin: "8px 0 0",
            }}
          >
            ₹{order.totalPrice}
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              color: theme.muted,
              fontWeight: 850,
            }}
          >
            {order.paymentMethod} · {order.paymentStatus}
          </p>
        </div>
      </div>

      <div
        style={{
          marginBottom: 14,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() => downloadInvoice(order._id)}
          style={{
            border: "none",
            borderRadius: 13,
            padding: "12px 18px",
            background: theme.blue,
            color: "#fff",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Download Invoice
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {order.orderItems.map((item, index) => {
          const productId = String(item.product);
          const form = reviewForms[productId] || {
            rating: "5",
            comment: "",
          };

          return (
            <div
              key={`${order._id}-${index}`}
              style={{
                display: "grid",
                gap: 12,
                background: theme.bg,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{
                    width: 70,
                    height: 70,
                    objectFit: "cover",
                    borderRadius: 14,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <strong>{item.name}</strong>
                  <p
                    style={{
                      margin: "5px 0",
                      color: theme.muted,
                    }}
                  >
                    {item.category} · Size {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <strong>₹{item.price * item.quantity}</strong>
              </div>

              {customerView && order.orderStatus === "Delivered" && (
                <div
                  style={{
                    borderTop: `1px solid ${theme.border}`,
                    paddingTop: 12,
                  }}
                >
                  <strong>Rate this product</strong>

                  {form.submitted ? (
                    <p style={{ color: theme.green, fontWeight: 850 }}>
                      Review submitted successfully.
                    </p>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "120px 1fr",
                          gap: 10,
                          marginTop: 10,
                        }}
                      >
                        <select
                          value={form.rating}
                          onChange={(e) =>
                            updateReviewForm(productId, "rating", e.target.value)
                          }
                          style={formControl(theme)}
                        >
                          <option value="5">5 ★</option>
                          <option value="4">4 ★</option>
                          <option value="3">3 ★</option>
                          <option value="2">2 ★</option>
                          <option value="1">1 ★</option>
                        </select>

                        <input
                          placeholder="Write your review..."
                          value={form.comment}
                          onChange={(e) =>
                            updateReviewForm(productId, "comment", e.target.value)
                          }
                          style={formControl(theme)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => submitReview(productId)}
                        style={{
                          marginTop: 10,
                          border: "none",
                          borderRadius: 12,
                          padding: "11px 16px",
                          background: theme.blue,
                          color: "#fff",
                          fontWeight: 950,
                          cursor: "pointer",
                        }}
                      >
                        Submit Review
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {customerView && order.orderStatus === "Delivery Verification Pending" && (
        <div
          style={{
            marginTop: 16,
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: 18,
            padding: 16,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Confirm Delivery OTP</h3>
          <p style={{ color: theme.muted }}>
            Enter the OTP sent to your email after you receive the order.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              value={deliveryOtp}
              onChange={(e) => setDeliveryOtp(e.target.value)}
              placeholder="Enter delivery OTP"
              style={{
                ...formControl(theme),
                maxWidth: 240,
                letterSpacing: 4,
                fontWeight: 900,
              }}
            />

            <button
              type="button"
              onClick={() => verifyDeliveryOtp(order._id, deliveryOtp)}
              style={{
                border: "none",
                borderRadius: 13,
                padding: "0 18px",
                background: theme.green,
                color: "#fff",
                fontWeight: 950,
                cursor: "pointer",
              }}
            >
              Verify Delivery
            </button>
          </div>
        </div>
      )}

      {customerView && order.orderStatus !== "Cancelled" && (
        <div
          style={{
            marginTop: 16,
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: 18,
            padding: 16,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Order Actions</h3>

          <button
            type="button"
            onClick={() => cancelMyOrder(order._id)}
            style={{
              border: "none",
              borderRadius: 13,
              padding: "12px 18px",
              background: theme.red,
              color: "#fff",
              fontWeight: 950,
              cursor: "pointer",
              marginRight: 10,
            }}
          >
            Cancel Order
          </button>

          {order.orderStatus === "Delivered" && (
            <div style={{ marginTop: 14 }}>
              <strong>Return this order</strong>
              <p style={{ color: theme.muted }}>
                Enter a reason and submit a return request.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <input
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Reason for return"
                  style={{
                    ...formControl(theme),
                    maxWidth: 420,
                  }}
                />
                <button
                  type="button"
                  onClick={() => requestReturnOrder(order._id, returnReason)}
                  style={{
                    border: "none",
                    borderRadius: 13,
                    padding: "0 18px",
                    background: theme.orange2,
                    color: "#fff",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  Request Return
                </button>
              </div>
            </div>
          )}

          {["Return Requested", "Return Approved", "Returned", "Return Rejected"].includes(order.orderStatus) && (
            <p style={{ color: theme.muted, fontWeight: 850 }}>
              Return status: {order.orderStatus}
            </p>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: adminView ? "1fr 260px" : "1fr",
          gap: 18,
        }}
      >
        <div>
          <h3>Delivery Address</h3>
          <p
            style={{
              color: theme.muted,
              lineHeight: 1.7,
            }}
          >
            {order.shippingAddress.fullName}, {order.shippingAddress.phone}
            <br />
            {order.shippingAddress.addressLine1}
            {order.shippingAddress.addressLine2
              ? `, ${order.shippingAddress.addressLine2}`
              : ""}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
            {order.shippingAddress.pincode}
            <br />
            {order.shippingAddress.email}
          </p>
        </div>

        {adminView && (
          <div>
            <h3>Update Status</h3>
            <select
              value={order.orderStatus}
              onChange={(e) => updateOrderStatus(order._id, e.target.value)}
              style={formControl(theme)}
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {order.orderStatus === "Delivery Verification Pending" && (
              <p
                style={{
                  color: theme.orange2,
                  fontWeight: 850,
                  lineHeight: 1.6,
                }}
              >
                Delivery OTP has been sent to the customer. Delivery completes
                only after customer verification.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminPage({
  theme,
  products,
  setProducts,
  adminForm,
  setAdminForm,
  addAdminProduct,
  fetchProducts,
  showToast,
  getProductId,
  token,
  handleImageSelect,
  uploadImageToCloudinary,
  selectedImageFile,
  imagePreview,
  uploadingImage,
}) {
  const deleteProduct = async (id) => {
    try {
      const response = await fetch(`${PRODUCT_API}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setProducts((prev) =>
          prev.filter((item) => getProductId(item) !== id)
        );
        showToast("Product deleted from MongoDB");
      } else {
        showToast(data.message || "Delete failed");
      }
    } catch (error) {
      console.error(error);
      showToast("Server error while deleting product");
    }
  };

  return (
    <main
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "38px 24px 90px",
      }}
    >
      <div
        style={{
          marginBottom: 26,
        }}
      >
        <h1
          style={{
            fontSize: 42,
            margin: 0,
            fontWeight: 950,
          }}
        >
          Wearlance Admin Studio
        </h1>
        <p
          style={{
            color: theme.muted,
            fontSize: 16,
          }}
        >
          Upload product images to Cloudinary and publish products to MongoDB.
        </p>
      </div>

      <div
        className="adminGrid"
        style={{
          display: "grid",
          gridTemplateColumns: "430px 1fr",
          gap: 24,
        }}
      >
        <form
          onSubmit={addAdminProduct}
          style={{
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 26,
            padding: 24,
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            {adminForm.editingId ? "Edit Product" : "Upload Product"}
          </h2>

          <div
            style={{
              border: `2px dashed ${theme.border}`,
              borderRadius: 22,
              padding: 18,
              background: theme.bg,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            {imagePreview || adminForm.image ? (
              <img
                src={imagePreview || adminForm.image}
                alt="Preview"
                style={{
                  width: "100%",
                  height: 260,
                  objectFit: "cover",
                  borderRadius: 18,
                  marginBottom: 14,
                }}
              />
            ) : (
              <div
                style={{
                  height: 210,
                  display: "grid",
                  placeItems: "center",
                  color: theme.muted,
                  fontWeight: 850,
                }}
              >
                Product image preview will appear here
              </div>
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              onChange={handleImageSelect}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 13,
                background: theme.panel,
                color: theme.text,
                border: `1px solid ${theme.border}`,
              }}
            />

            {selectedImageFile && (
              <p
                style={{
                  color: theme.muted,
                  fontSize: 13,
                }}
              >
                Selected: {selectedImageFile.name}
              </p>
            )}

            <button
              type="button"
              onClick={uploadImageToCloudinary}
              disabled={uploadingImage}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 14,
                border: "none",
                background: uploadingImage
                  ? "#94a3b8"
                  : "linear-gradient(135deg,#2874f0,#7c3aed)",
                color: "#fff",
                fontWeight: 950,
                cursor: uploadingImage ? "not-allowed" : "pointer",
                marginTop: 10,
              }}
            >
              {uploadingImage ? "Uploading Image..." : "Upload Image to Cloudinary"}
            </button>
          </div>

          <AdminInput
            label="Product Name"
            value={adminForm.name}
            onChange={(v) => setAdminForm({ ...adminForm, name: v })}
            theme={theme}
          />

          <AdminTextarea
            label="Description"
            value={adminForm.description}
            onChange={(v) => setAdminForm({ ...adminForm, description: v })}
            theme={theme}
          />

          <AdminInput
            label="Cloudinary Image URL"
            value={adminForm.image}
            onChange={(v) => setAdminForm({ ...adminForm, image: v })}
            theme={theme}
          />

          <AdminSelect
            label="Category"
            value={adminForm.category}
            onChange={(v) => setAdminForm({ ...adminForm, category: v })}
            options={categories.filter((x) => x !== "All")}
            theme={theme}
          />

          <AdminSelect
            label="Gender"
            value={adminForm.gender}
            onChange={(v) => setAdminForm({ ...adminForm, gender: v })}
            options={genders.filter((x) => x !== "All")}
            theme={theme}
          />

          <AdminInput
            label="Stock"
            type="number"
            value={adminForm.stock}
            onChange={(v) => setAdminForm({ ...adminForm, stock: v })}
            theme={theme}
          />

          <AdminInput
            label="Badge"
            value={adminForm.badge}
            onChange={(v) => setAdminForm({ ...adminForm, badge: v })}
            theme={theme}
          />

          <div
            style={{
              padding: 15,
              background: theme.bg,
              borderRadius: 15,
              marginBottom: 18,
              fontWeight: 950,
            }}
          >
            Fixed Price: ₹399
          </div>

          <button
            style={{
              width: "100%",
              border: "none",
              borderRadius: 15,
              padding: 16,
              background: "linear-gradient(135deg,#ff9900,#fb641b)",
              color: "#fff",
              fontWeight: 950,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {adminForm.editingId ? "Update Product" : "Publish Product"}
          </button>

          {adminForm.editingId && (
            <button
              type="button"
              onClick={() =>
                setAdminForm({
                  editingId: "",
                  name: "",
                  category: "T-Shirts",
                  gender: "Unisex",
                  description: "",
                  image: "",
                  stock: 50,
                  badge: "New",
                })
              }
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                borderRadius: 15,
                padding: 15,
                background: theme.bg,
                color: theme.text,
                fontWeight: 900,
                marginTop: 12,
                cursor: "pointer",
              }}
            >
              Cancel Edit
            </button>
          )}

          <button
            type="button"
            onClick={fetchProducts}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              borderRadius: 15,
              padding: 15,
              background: theme.bg,
              color: theme.text,
              fontWeight: 900,
              marginTop: 12,
              cursor: "pointer",
            }}
          >
            Refresh Products
          </button>
        </form>

        <section
          style={{
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 26,
            padding: 24,
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            Product Inventory
          </h2>

          {products.length === 0 && (
            <p
              style={{
                color: theme.muted,
              }}
            >
              No products uploaded yet. Add your first clothing item.
            </p>
          )}

          <div
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {products.map((item) => {
              const id = getProductId(item);

              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    gap: 15,
                    alignItems: "center",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 18,
                    padding: 13,
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      width: 78,
                      height: 78,
                      objectFit: "cover",
                      borderRadius: 14,
                    }}
                  />

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                      }}
                    >
                      {item.name}
                    </h3>
                    <p
                      style={{
                        margin: "5px 0",
                        color: theme.muted,
                      }}
                    >
                      {item.category} · {item.gender} · Stock: {item.stock}
                    </p>
                    <strong>₹399</strong>
                  </div>

                  <button
                    onClick={() => {
                      setAdminForm({
                        editingId: id,
                        name: item.name || "",
                        category: item.category || "T-Shirts",
                        gender: item.gender || "Unisex",
                        description: item.description || "",
                        image: item.image || "",
                        stock: item.stock ?? 0,
                        badge: item.badge || "New",
                      });
                      setImagePreview("");
                    }}
                    style={{
                      background: theme.blue,
                      color: "#fff",
                      border: "none",
                      padding: "10px 15px",
                      borderRadius: 11,
                      cursor: "pointer",
                      fontWeight: 950,
                    }}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteProduct(id)}
                    style={{
                      background: theme.red,
                      color: "#fff",
                      border: "none",
                      padding: "10px 15px",
                      borderRadius: 11,
                      cursor: "pointer",
                      fontWeight: 950,
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminInput({ label, value, onChange, theme, type = "text" }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 15,
      }}
    >
      <span
        style={{
          display: "block",
          fontWeight: 900,
          marginBottom: 7,
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={formControl(theme)}
      />
    </label>
  );
}

function AdminTextarea({ label, value, onChange, theme }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 15,
      }}
    >
      <span
        style={{
          display: "block",
          fontWeight: 900,
          marginBottom: 7,
        }}
      >
        {label}
      </span>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...formControl(theme),
          resize: "vertical",
        }}
      />
    </label>
  );
}

function AdminSelect({ label, value, onChange, options, theme }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 15,
      }}
    >
      <span
        style={{
          display: "block",
          fontWeight: 900,
          marginBottom: 7,
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={formControl(theme)}
      >
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function formControl(theme) {
  return {
    width: "100%",
    padding: 13,
    borderRadius: 13,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.text,
    outline: "none",
  };
}

function AccessDenied({ theme, setPage, message }) {
  return (
    <main
      style={{
        minHeight: "65vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 620,
          textAlign: "center",
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          borderRadius: 28,
          padding: 42,
        }}
      >
        <h1
          style={{
            marginTop: 0,
          }}
        >
          Access Required
        </h1>
        <p
          style={{
            color: theme.muted,
            lineHeight: 1.8,
          }}
        >
          {message ||
            "Only approved Wearlance admin accounts can open this page."}
        </p>

        <button
          onClick={() => setPage("login")}
          style={{
            border: "none",
            borderRadius: 15,
            padding: "14px 25px",
            background: theme.blue,
            color: "#fff",
            fontWeight: 950,
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </div>
    </main>
  );
}

function AuthLayout({ children, theme, title, subtitle }) {
  return (
    <main
      style={{
        minHeight: "calc(100vh - 110px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        className="authGrid"
        style={{
          width: "100%",
          maxWidth: 1050,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          overflow: "hidden",
          borderRadius: 30,
          background: theme.panel,
          border: `1px solid ${theme.border}`,
          boxShadow: "0 22px 60px rgba(0,0,0,0.22)",
        }}
      >
        <div
          style={{
            padding: 52,
            color: "#fff",
            background: "linear-gradient(135deg,#131921,#2874f0,#ec4899)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 46,
              fontWeight: 950,
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.75,
              opacity: 0.92,
            }}
          >
            {subtitle}
          </p>

          <div
            style={{
              marginTop: 28,
              background: "rgba(255,255,255,0.13)",
              padding: 18,
              borderRadius: 18,
              fontWeight: 950,
            }}
          >
            WEARLANCE · Every Style ₹399
          </div>
        </div>

        <div
          style={{
            padding: 52,
          }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

function LoginPage({ theme, loginForm, setLoginForm, loginUser, setPage }) {
  return (
    <AuthLayout
      theme={theme}
      title="Welcome Back"
      subtitle="Login with email and password. OTP is used only for signup verification and forgot password."
    >
      <form onSubmit={loginUser}>
        <h2
          style={{
            fontSize: 34,
            margin: 0,
          }}
        >
          Login
        </h2>

        <input
          placeholder="Email address"
          value={loginForm.email}
          onChange={(e) =>
            setLoginForm({
              ...loginForm,
              email: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <input
          placeholder="Password"
          type="password"
          value={loginForm.password}
          onChange={(e) =>
            setLoginForm({
              ...loginForm,
              password: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <button style={authButton()}>Login</button>

        <p
          style={{
            color: theme.muted,
          }}
        >
          New to Wearlance?{" "}
          <button
            type="button"
            onClick={() => setPage("signup")}
            style={linkButton(theme)}
          >
            Create account
          </button>
        </p>

        <p>
          <button
            type="button"
            onClick={() => setPage("forgotPassword")}
            style={linkButton(theme)}
          >
            Forgot password?
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

function SignupPage({ theme, signupForm, setSignupForm, signupUser, setPage }) {
  return (
    <AuthLayout
      theme={theme}
      title="Create Your Account"
      subtitle="Signup requires email OTP verification only once."
    >
      <form onSubmit={signupUser}>
        <h2
          style={{
            fontSize: 34,
            margin: 0,
          }}
        >
          Signup
        </h2>

        <input
          placeholder="Full name"
          value={signupForm.name}
          onChange={(e) =>
            setSignupForm({
              ...signupForm,
              name: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <input
          placeholder="Email address"
          value={signupForm.email}
          onChange={(e) =>
            setSignupForm({
              ...signupForm,
              email: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <input
          placeholder="Password"
          type="password"
          value={signupForm.password}
          onChange={(e) =>
            setSignupForm({
              ...signupForm,
              password: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <button style={authButton()}>Send Signup OTP</button>

        <p
          style={{
            color: theme.muted,
          }}
        >
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setPage("login")}
            style={linkButton(theme)}
          >
            Login
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

function VerifySignupOtpPage({
  theme,
  otpForm,
  setOtpForm,
  verifySignupOtp,
  resendSignupOtp,
  setPage,
}) {
  return (
    <AuthLayout
      theme={theme}
      title="Verify Your Email"
      subtitle="Enter the OTP sent to your email to activate your Wearlance account."
    >
      <form onSubmit={verifySignupOtp}>
        <h2
          style={{
            fontSize: 34,
            margin: 0,
          }}
        >
          Signup OTP
        </h2>

        <input
          placeholder="Email address"
          value={otpForm.email}
          onChange={(e) =>
            setOtpForm({
              ...otpForm,
              email: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <input
          placeholder="6-digit OTP"
          value={otpForm.otp}
          onChange={(e) =>
            setOtpForm({
              ...otpForm,
              otp: e.target.value,
            })
          }
          style={{
            ...authInput(theme),
            letterSpacing: 5,
            fontWeight: 900,
          }}
        />

        <button style={authButton()}>Verify OTP</button>

        <p>
          <button
            type="button"
            onClick={resendSignupOtp}
            style={linkButton(theme)}
          >
            Resend OTP
          </button>
        </p>

        <p>
          <button
            type="button"
            onClick={() => setPage("signup")}
            style={linkButton(theme)}
          >
            Back to signup
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

function ForgotPasswordPage({
  theme,
  forgotForm,
  setForgotForm,
  forgotPassword,
  setPage,
}) {
  return (
    <AuthLayout
      theme={theme}
      title="Forgot Password"
      subtitle="Enter your email. We will send an OTP to reset your password."
    >
      <form onSubmit={forgotPassword}>
        <h2
          style={{
            fontSize: 34,
            margin: 0,
          }}
        >
          Reset Request
        </h2>

        <input
          placeholder="Email address"
          value={forgotForm.email}
          onChange={(e) =>
            setForgotForm({
              ...forgotForm,
              email: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <button style={authButton()}>Send Reset OTP</button>

        <p>
          <button
            type="button"
            onClick={() => setPage("login")}
            style={linkButton(theme)}
          >
            Back to login
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

function ResetPasswordPage({
  theme,
  resetForm,
  setResetForm,
  resetPassword,
  setPage,
}) {
  return (
    <AuthLayout
      theme={theme}
      title="Set New Password"
      subtitle="Enter the OTP from your email and choose a new password."
    >
      <form onSubmit={resetPassword}>
        <h2
          style={{
            fontSize: 34,
            margin: 0,
          }}
        >
          Reset Password
        </h2>

        <input
          placeholder="Email address"
          value={resetForm.email}
          onChange={(e) =>
            setResetForm({
              ...resetForm,
              email: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <input
          placeholder="OTP"
          value={resetForm.otp}
          onChange={(e) =>
            setResetForm({
              ...resetForm,
              otp: e.target.value,
            })
          }
          style={{
            ...authInput(theme),
            letterSpacing: 5,
            fontWeight: 900,
          }}
        />

        <input
          placeholder="New password"
          type="password"
          value={resetForm.newPassword}
          onChange={(e) =>
            setResetForm({
              ...resetForm,
              newPassword: e.target.value,
            })
          }
          style={authInput(theme)}
        />

        <button style={authButton()}>Reset Password</button>

        <p>
          <button
            type="button"
            onClick={() => setPage("login")}
            style={linkButton(theme)}
          >
            Back to login
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

function authInput(theme) {
  return {
    width: "100%",
    padding: 15,
    borderRadius: 15,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.text,
    outline: "none",
    marginTop: 18,
    fontSize: 15,
  };
}

function authButton() {
  return {
    width: "100%",
    border: "none",
    borderRadius: 15,
    padding: 15,
    background: "linear-gradient(135deg,#ff9900,#fb641b)",
    color: "#fff",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
    marginTop: 20,
  };
}

function linkButton(theme) {
  return {
    border: "none",
    background: "transparent",
    color: theme.blue,
    fontWeight: 950,
    cursor: "pointer",
  };
}
