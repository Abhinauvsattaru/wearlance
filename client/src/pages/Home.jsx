import Hero from "../components/Hero";
import ProductCard from "../components/ProductCard";

function Home() {

  return (
    <>

      <Hero/>

      <div
        className="container"
        style={{
          padding:"100px 0"
        }}
      >

        <h1 className="section-title">
          Trending Collection
        </h1>

        <p className="section-subtitle">
          Premium fashion curated for modern generation.
        </p>

        <div className="products-grid">

          <ProductCard/>
          <ProductCard/>
          <ProductCard/>
          <ProductCard/>
          <ProductCard/>
          <ProductCard/>
          <ProductCard/>
          <ProductCard/>

        </div>

      </div>

    </>
  );
}

export default Home;