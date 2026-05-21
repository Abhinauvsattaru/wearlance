import { ShoppingCart } from "lucide-react";

function ProductCard() {

  return (

    <div
      className="glass"
      style={{
        borderRadius:"24px",
        overflow:"hidden",
        transition:"0.4s",
        cursor:"pointer"
      }}
    >

      <img
        src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab"
        alt=""
        style={{
          width:"100%",
          height:"280px",
          objectFit:"cover"
        }}
      />

      <div style={{padding:"20px"}}>

        <h3
          style={{
            fontSize:"20px",
            marginBottom:"10px"
          }}
        >
          Premium Oversized T-Shirt
        </h3>

        <p
          style={{
            color:"#cbd5e1",
            marginBottom:"15px",
            fontSize:"14px"
          }}
        >
          Luxury comfort with premium cotton finish.
        </p>

        <div
          style={{
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center"
          }}
        >

          <h2
            className="gradient-text"
            style={{
              fontSize:"28px"
            }}
          >
            ₹499
          </h2>

          <button
            className="theme-btn"
            style={{
              padding:"10px 14px"
            }}
          >
            <ShoppingCart size={18}/>
          </button>

        </div>

      </div>

    </div>

  );
}

export default ProductCard;