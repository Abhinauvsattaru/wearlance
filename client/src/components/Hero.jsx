import { motion } from "framer-motion";

function Hero() {
  return (

    <div
      style={{
        minHeight:"90vh",
        display:"flex",
        alignItems:"center",
        background:
        "linear-gradient(to right,#0f172a,#111827,#1e293b)"
      }}
    >

      <div
        className="container"
        style={{
          display:"grid",
          gridTemplateColumns:"1fr 1fr",
          alignItems:"center",
          gap:"50px"
        }}
      >

        <motion.div
          initial={{opacity:0,x:-100}}
          animate={{opacity:1,x:0}}
          transition={{duration:1}}
        >

          <h1
            style={{
              fontSize:"72px",
              lineHeight:"1.1",
              marginBottom:"25px",
              fontWeight:"800"
            }}
          >
            Wear The
            <span className="gradient-text">
              {" "}Future
            </span>
          </h1>

          <p
            style={{
              fontSize:"20px",
              color:"#cbd5e1",
              marginBottom:"35px",
              maxWidth:"600px"
            }}
          >
            Discover premium fashion with modern aesthetics,
            luxury quality, and fixed affordable pricing.
          </p>

          <button className="theme-btn">
            Explore Collection
          </button>

        </motion.div>

        <motion.div
          initial={{opacity:0,x:100}}
          animate={{opacity:1,x:0}}
          transition={{duration:1}}
        >

          <img
            src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab"
            alt=""
            style={{
              width:"100%",
              borderRadius:"30px",
              height:"650px",
              objectFit:"cover",
              boxShadow:"0 10px 40px rgba(0,0,0,0.5)"
            }}
          />

        </motion.div>

      </div>

    </div>

  );
}

export default Hero;